import binascii
import logging
import queue
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional, TypedDict

import serial
from serial.tools import list_ports as serial_list_ports

from hayapp_python.common.config_manager import config
from hayapp_python.items.haystack.base_transport import BaseTransport
from hayapp_python.items.haystack.haystack_interface import (
    Command,
    SetCommand,
)
from hayapp_python.items.haystack.serial_protocol import (
    CRCError,
    InvalidPacketError,
    SerialProtocol,
)

BOOTLOADER_TIMEOUT = config.haystack.firmware_bootloader_timeout
RECONNECT_TIMEOUT = config.haystack.firmware_reconnect_timeout


class AckWaiter:
    """Helper class to wait for ACK responses."""

    def __init__(self, seq_id: int, timeout: float = 5.0):
        self.seq_id = seq_id
        self.timeout = timeout
        self.event = threading.Event()
        self.ack_received = False
        self.ack_params = None
        self.timestamp = time.time()

    def wait(self) -> tuple[bool, Optional[list]]:
        """Wait for ACK response.

        Returns:
            Tuple of (success, params) where success indicates if ACK was received
        """
        _ = self.event.wait(timeout=self.timeout)
        return (self.ack_received, self.ack_params)

    def signal(self, params: Optional[list] = None):
        """Signal that ACK was received."""
        self.ack_received = True
        self.ack_params = params
        self.event.set()


class VerifiedMessage(TypedDict):
    command: str
    params: list
    sequence_id: int
    raw_message: str
    timestamp: float


class UsbCommsLogger:
    """Dedicated logger for USB communication packets."""

    def __init__(self, log_to_file: bool = True, log_dir: str = None):
        """
        Initialize USB communications logger.

        Args:
            log_to_file: Whether to log to a file
            log_dir: Directory for log files (defaults to current directory)
        """
        self.enabled = True
        self.log_to_file = log_to_file
        self.logger = logging.getLogger(f"{__name__}.usb_comms")
        self.file_handler = None
        self.packet_count_tx = 0
        self.packet_count_rx = 0
        self.start_time = time.time()

        if log_to_file:
            self._setup_file_logging(log_dir)

    def _setup_file_logging(self, log_dir: str = None):
        """Setup file handler for USB comms logging."""
        if log_dir is None:
            log_dir = config.paths.log_path
        else:
            log_dir = Path(log_dir)

        # Create logs directory if it doesn't exist
        log_dir.mkdir(parents=True, exist_ok=True)

        # Create log file with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = log_dir / f"usb_comms_{timestamp}.log"

        # Create file handler
        self.file_handler = logging.FileHandler(log_file)
        self.file_handler.setLevel(logging.DEBUG)

        # Format: timestamp | direction | packet | details
        formatter = logging.Formatter(
            "%(asctime)s.%(msecs)03d | %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )
        self.file_handler.setFormatter(formatter)
        self.logger.addHandler(self.file_handler)
        self.logger.setLevel(logging.DEBUG)

        # Don't propagate to parent logger to avoid duplicate console output
        self.logger.propagate = False

        self.logger.info("=" * 80)
        self.logger.info("USB COMMUNICATION LOG STARTED")
        self.logger.info("=" * 80)

    def log_tx(self, packet: str):
        """Log transmitted packet."""
        if not self.enabled:
            return

        self.packet_count_tx += 1
        elapsed = time.time() - self.start_time

        # Format packet for display
        hex_repr = " ".join(f"{ord(c):02X}" for c in packet.strip())

        msg = (
            f"TX [{self.packet_count_tx:05d}] | "
            f"Time: {elapsed:8.3f}s | "
            f"Len: {len(packet):3d} | "
            f"Data: {packet.strip():<40} | "
            f"Hex: {hex_repr}"
        )

        self.logger.info(msg)

    def log_rx(self, packet: str):
        """Log received packet."""
        if not self.enabled:
            return

        self.packet_count_rx += 1
        elapsed = time.time() - self.start_time

        # Format packet for display
        hex_repr = " ".join(f"{ord(c):02X}" for c in packet.strip())

        msg = (
            f"RX [{self.packet_count_rx:05d}] | "
            f"Time: {elapsed:8.3f}s | "
            f"Len: {len(packet):3d} | "
            f"Data: {packet.strip():<40} | "
            f"Hex: {hex_repr}"
        )

        self.logger.info(msg)

    def log_error(self, error_msg: str):
        """Log error message."""
        if not self.enabled:
            return

        elapsed = time.time() - self.start_time
        msg = f"ERROR | Time: {elapsed:8.3f}s | {error_msg}"
        self.logger.error(msg)

    def log_event(self, event_msg: str):
        """Log general event."""
        if not self.enabled:
            return

        elapsed = time.time() - self.start_time
        msg = f"EVENT | Time: {elapsed:8.3f}s | {event_msg}"
        self.logger.info(msg)

    def get_statistics(self) -> dict:
        """Get communication statistics."""
        return {
            "enabled": self.enabled,
            "packets_tx": self.packet_count_tx,
            "packets_rx": self.packet_count_rx,
            "total_packets": self.packet_count_tx + self.packet_count_rx,
            "elapsed_time": time.time() - self.start_time,
        }

    def close(self):
        """Close the logger and file handler."""
        if self.file_handler:
            self.logger.info("=" * 80)
            stats = self.get_statistics()
            self.logger.info(
                f"USB COMMUNICATION LOG ENDED - "
                f"TX: {stats['packets_tx']}, RX: {stats['packets_rx']}, "
                f"Duration: {stats['elapsed_time']:.2f}s"
            )
            self.logger.info("=" * 80)
            self.file_handler.close()
            self.logger.removeHandler(self.file_handler)


class UsbTransport(BaseTransport):
    """
    USB Serial Interface for HayStack communication.
    Integrates SerialManager functionality with SerialProtocol for robust communication.
    """

    __version__: str = "0.0.1"

    def __init__(
        self,
        response_processor: Callable[[str, list], None] = None,
        port: Optional[str] = None,
        enforce_crc: bool = False,
        enable_comms_log: bool = True,
        comms_log_dir: str = None,
    ):
        """
        Initialize USB interface with serial communication capabilities.

        Args:
            response_processor: Callback function to handle incoming messages (command, params)
            port: Serial port to connect to (optional, can be set later)
            enforce_crc: Whether to enforce CRC validation on packets
            enable_comms_log: Whether to enable detailed USB comms logging
            comms_log_dir: Directory for USB comms log files (defaults to ./logs)
        """
        self.port = port
        self.serial: Optional[serial.Serial] = None
        self.is_connected = False
        self.response_processor = response_processor
        self.read_queue: queue.Queue[str] = queue.Queue()
        self.reader_thread: Optional[threading.Thread] = None
        self.should_read = False

        self.write_queue: queue.Queue[str] = queue.Queue()
        self.writer_thread: Optional[threading.Thread] = None
        self.should_write = False
        self.write_timeout = 1.0
        self.max_retries = 3
        self.send_interval = 0.05  # seconds between outgoing packets

        # Verified message queue and response handler
        self.verified_message_queue: queue.Queue[VerifiedMessage] = queue.Queue()
        self.response_handler_thread: Optional[threading.Thread] = None
        self.should_handle_responses = False

        # ACK tracking
        self.pending_acks: dict[int, AckWaiter] = {}
        self.pending_acks_lock = threading.Lock()
        self.ack_cleanup_thread: Optional[threading.Thread] = None
        self.should_cleanup_acks = False

        self.protocol = SerialProtocol(enforce_crc=enforce_crc)
        self.logger = logging.getLogger(__name__)
        self.disconnect_callback: Optional[Callable] = None

        # USB Communications Logger
        self.comms_logger = (
            UsbCommsLogger(log_to_file=enable_comms_log, log_dir=comms_log_dir)
            if enable_comms_log
            else None
        )

        # Connect if port is provided
        if port:
            self.connect(port)

    def __del__(self):
        """Destructor to ensure proper cleanup."""
        self.disconnect()
        if self.comms_logger:
            self.comms_logger.close()

    def scan_ports(self) -> list[str]:
        return [
            port.device
            for port in serial_list_ports.comports()
            if port.pid == 0x6015 and port.vid == 0x0403
        ]

    def connect(self, port: str) -> bool:
        """
        Connect to the specified serial port.

        Args:
            port: Serial port name (e.g., '/dev/ttyUSB0', 'COM3')

        Returns:
            True if connection successful, False otherwise
        """
        # Validate port parameter
        if not port:
            self.logger.error("Port must be configured before it can be used.")
            return False

        try:
            self.logger.info(f"Connecting to serial port: {port}")

            # Ensure we're disconnected first
            self.disconnect()
            time.sleep(0.2)  # Give the OS time to properly release the port

            self.port = port
            self.serial = serial.Serial(port=port, baudrate=115200, timeout=0.10, write_timeout=1)

            if not self.serial.is_open:
                self.serial.open()
                self.logger.info(f"Opened port {port}")

            # Clear any pending data
            self.serial.reset_input_buffer()
            self.serial.reset_output_buffer()
            time.sleep(0.1)  # Short delay to let port settle

            self.is_connected = True
            self.logger.info("Serial connection established")

            # Log connection event
            if self.comms_logger:
                self.comms_logger.log_event(f"Connected to {port} at 115200 baud")

            # Start reading, writing, response handler, and ACK cleanup threads
            self.start_reading()
            self.start_writing()
            self.start_response_handler()
            self.start_ack_cleanup()

            return True
        except Exception as e:
            self.logger.error(f"Error connecting to port {port}: {str(e)}")
            self.disconnect()  # Cleanup on failure
            return False

    def disconnect(self):
        """Disconnect from the serial port and cleanup resources."""
        try:
            self.is_connected = False

            # Log disconnection event
            if self.comms_logger:
                self.comms_logger.log_event("Disconnecting from serial port")

            # Stop reading, writing, response handler, and ACK cleanup threads
            self.stop_reading()
            self.stop_writing()
            self.stop_response_handler()
            self.stop_ack_cleanup()

            # Close serial port
            if self.serial and self.serial.is_open:
                self.serial.close()
                self.logger.info("Serial port closed")

        except Exception as e:
            self.logger.error(f"Error disconnecting: {str(e)}")
        finally:
            self.serial = None
            self.port = None

            # Clear any pending messages
            while not self.read_queue.empty():
                try:
                    self.read_queue.get_nowait()
                except queue.Empty:
                    break

            # Clear any pending write operations
            while not self.write_queue.empty():
                try:
                    self.write_queue.get_nowait()
                except queue.Empty:
                    break

            # Clear any pending verified messages
            while not self.verified_message_queue.empty():
                try:
                    self.verified_message_queue.get_nowait()
                except queue.Empty:
                    break

    def start_reading(self):
        """Start the background reading thread."""
        if not self.reader_thread and self.is_connected:
            self.should_read = True
            self.reader_thread = threading.Thread(target=self._read_serial_data, daemon=True)
            self.reader_thread.start()
            self.logger.info("Started serial reading thread")

    def stop_reading(self):
        """Stop the background reading thread."""
        self.should_read = False
        if self.reader_thread:
            self.reader_thread.join(timeout=1.0)
            self.reader_thread = None
            self.logger.info("Stopped serial reading thread")

    def start_writing(self):
        """Start the background writing thread."""
        if not self.writer_thread and self.is_connected:
            self.should_write = True
            self.writer_thread = threading.Thread(target=self._write_serial_data, daemon=True)
            self.writer_thread.start()
            self.logger.info("Started serial writing thread")

    def stop_writing(self):
        """Stop the background writing thread."""
        self.should_write = False
        if self.writer_thread:
            self.writer_thread.join(timeout=1.0)
            self.writer_thread = None
            self.logger.info("Stopped serial writing thread")

    def start_response_handler(self):
        """Start the background response handler thread."""
        if not self.response_handler_thread and self.is_connected:
            self.should_handle_responses = True
            self.response_handler_thread = threading.Thread(
                target=self._handle_responses, daemon=True
            )
            self.response_handler_thread.start()
            self.logger.info("Started response handler thread")

    def stop_response_handler(self):
        """Stop the background response handler thread."""
        self.should_handle_responses = False
        if self.response_handler_thread:
            self.response_handler_thread.join(timeout=1.0)
            self.response_handler_thread = None
            self.logger.info("Stopped response handler thread")

    def start_ack_cleanup(self):
        """Start the background ACK cleanup thread."""
        if not self.ack_cleanup_thread and self.is_connected:
            self.should_cleanup_acks = True
            self.ack_cleanup_thread = threading.Thread(
                target=self._cleanup_expired_acks, daemon=True
            )
            self.ack_cleanup_thread.start()
            self.logger.info("Started ACK cleanup thread")

    def stop_ack_cleanup(self):
        """Stop the background ACK cleanup thread."""
        self.should_cleanup_acks = False
        if self.ack_cleanup_thread:
            self.ack_cleanup_thread.join(timeout=1.0)
            self.ack_cleanup_thread = None
            self.logger.info("Stopped ACK cleanup thread")

    def _read_serial_data(self):
        """Background thread to continuously read serial data."""
        connection_check_counter = 0
        buffer = ""

        while self.should_read:
            try:
                # Check connection periodically
                if connection_check_counter % 100 == 0:
                    if not self._check_connection():
                        self._handle_disconnect("Device disconnected unexpectedly")
                        break
                connection_check_counter += 1

                if self.serial.in_waiting:
                    # Read all available bytes at once (non-blocking)
                    chunk = self.serial.read(self.serial.in_waiting).decode("utf-8")
                    buffer += chunk

                    # Process complete lines
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip("\r\n\t ")
                        if line:
                            self.logger.info(f"(<<<) {line}")
                            # Log RX packet with USB comms logger
                            if self.comms_logger:
                                self.comms_logger.log_rx(line + "\n")
                            self.read_queue.put(line)
                            # Process the message through response_processor if available
                            self._process_incoming_message(line)
                else:
                    # Only sleep when no data is available
                    time.sleep(0.01)

            except serial.SerialException as e:
                if self.comms_logger:
                    self.comms_logger.log_error(f"Serial error in read thread: {str(e)}")
                self._handle_disconnect(f"Serial error: {str(e)}")
                break
            except Exception as e:
                if self.comms_logger:
                    self.comms_logger.log_error(f"Unexpected error in read thread: {str(e)}")
                self._handle_disconnect(f"Unexpected error: {str(e)}")
                break

    def _write_serial_data(self):
        """Background thread to continuously process write queue."""
        while self.should_write:
            try:
                # Get packet from queue with timeout
                packet = self.write_queue.get(timeout=0.1)

                # Attempt to send the packet with retry logic
                success = self._send_packet_with_retry(packet)

                if not success:
                    self.logger.warning(f"Failed to send packet after retries: {packet}")

                # Mark task as done
                self.write_queue.task_done()

                # Throttle outgoing messages to give the haystack time to process
                if self.send_interval > 0:
                    time.sleep(self.send_interval)

            except queue.Empty:
                # No packets to send, continue loop
                continue
            except Exception as e:
                self.logger.error(f"Unexpected error in write thread: {str(e)}")
                # Continue processing other packets
                continue

    def _send_packet_with_retry(self, packet: str) -> bool:
        """
        Send a packet with retry logic.

        Args:
            packet: Packet string to send

        Returns:
            True if sent successfully, False otherwise
        """
        for attempt in range(self.max_retries):
            try:
                # Check connection before attempting to write
                if not self._check_connection():
                    self._handle_disconnect("Device disconnected unexpectedly")
                    return False

                # Send the packet
                self.serial.write(packet.encode("utf-8"))
                self.logger.info(f"(>>>) {packet}")
                # Log TX packet with USB comms logger
                if self.comms_logger:
                    self.comms_logger.log_tx(packet)
                return True

            except serial.SerialException as e:
                self.logger.warning(
                    f"Write attempt {attempt + 1}/{self.max_retries} failed: {str(e)}"
                )
                if attempt < self.max_retries - 1:
                    time.sleep(0.1)  # Brief delay before retry
                else:
                    self._handle_disconnect(
                        f"Send error after {self.max_retries} attempts: {str(e)}"
                    )
                    return False
            except Exception as e:
                self.logger.error(f"Unexpected error sending packet: {str(e)}")
                return False

        return False

    def _handle_responses(self):
        """Background thread to process verified messages and call callbacks."""
        while self.should_handle_responses:
            try:
                # Get verified message from queue with timeout
                message_data = self.verified_message_queue.get(timeout=0.1)

                # Extract command and params from the message data
                command = message_data.get("command")
                params = message_data.get("params", [])

                # Call the response processor callback
                if self.response_processor and command:
                    try:
                        self.response_processor(command, params)
                    except Exception as e:
                        self.logger.error(f"Error in response processor callback: {str(e)}")

                # Mark task as done
                self.verified_message_queue.task_done()

            except queue.Empty:
                # No messages to process, continue loop
                continue
            except Exception as e:
                self.logger.error(f"Unexpected error in response handler thread: {str(e)}")
                # Continue processing other messages
                continue

    def _process_incoming_message(self, message: str):
        """
        Process an incoming message by decoding it and queuing for response handler.

        Args:
            message: Raw message string received from the device
        """
        try:
            # Decode the packet using the serial protocol
            packet = self.protocol.decode_packet(message)

            # Parse data fields if present
            params = []
            if packet.data:
                params = self.protocol.parse_data_fields(packet.data)

            # Check if this is an ACK response
            if packet.command == "ACK":
                self._handle_ack_response(packet.seq_id, params)
                # Still queue ACK messages for the response handler

            # Queue the verified message for the response handler thread
            message_data = VerifiedMessage(
                command=packet.command,
                params=params,
                sequence_id=packet.seq_id,
                raw_message=message,
                timestamp=time.time(),
            )

            try:
                self.verified_message_queue.put(message_data, timeout=0.1)
            except queue.Full:
                self.logger.warning(f"Verified message queue full, dropping message: {message}")

        except (InvalidPacketError, CRCError) as e:
            self.logger.warning(f"Failed to decode packet '{message}': {str(e)}")
            if self.comms_logger:
                self.comms_logger.log_error(f"Decode failed: {str(e)} - Packet: {message}")
        except Exception as e:
            self.logger.error(f"Unexpected error processing message '{message}': {str(e)}")
            if self.comms_logger:
                self.comms_logger.log_error(f"Processing error: {str(e)} - Packet: {message}")

    def _handle_ack_response(self, seq_id: int, params: Optional[list] = None):
        """
        Handle an ACK response by signaling any waiting threads.

        Args:
            seq_id: Sequence ID of the ACK
            params: Optional parameters from the ACK
        """
        with self.pending_acks_lock:
            if seq_id in self.pending_acks:
                waiter = self.pending_acks[seq_id]
                waiter.signal(params)
                self.logger.debug(f"ACK received for seq_id {seq_id:08X}")
                # Don't remove yet - let cleanup thread handle it
            else:
                self.logger.debug(f"Received unexpected ACK for seq_id {seq_id:08X}")

    def _cleanup_expired_acks(self):
        """Background thread to cleanup expired ACK waiters."""
        while self.should_cleanup_acks:
            try:
                current_time = time.time()
                expired_seq_ids = []

                with self.pending_acks_lock:
                    for seq_id, waiter in self.pending_acks.items():
                        if current_time - waiter.timestamp > waiter.timeout:
                            expired_seq_ids.append(seq_id)

                    # Remove expired waiters
                    for seq_id in expired_seq_ids:
                        del self.pending_acks[seq_id]
                        self.logger.debug(f"Cleaned up expired ACK waiter for seq_id {seq_id:08X}")

                # Sleep for a short time before next cleanup
                time.sleep(1.0)

            except Exception as e:
                self.logger.error(f"Error in ACK cleanup thread: {str(e)}")
                if self.should_cleanup_acks:
                    time.sleep(1.0)  # Brief delay before continuing

    def _check_connection(self) -> bool:
        """Check if device is still connected."""
        try:
            if not self.serial or not self.serial.is_open:
                return False
            # Try to get the port state - this will fail if device is disconnected
            self.serial.in_waiting
            return True
        except (serial.SerialException, AttributeError):
            return False

    def _stop_thread_safely(self, thread: threading.Thread):
        """Safely stop a thread with timeout."""
        if thread and thread.is_alive() and threading.current_thread() is not thread:
            try:
                thread.join(timeout=1.0)
            except Exception as e:
                self.logger.error(f"Error stopping {thread.name}: {str(e)}")
        return None

    def _clear_queue(self, queue_obj: queue.Queue):
        """Clear all items from a queue."""
        while not queue_obj.empty():
            try:
                queue_obj.get_nowait()
            except queue.Empty:
                break

    def _handle_disconnect(self, error_msg: str = None):
        """Handle a disconnect event."""
        if not self.is_connected:
            return

        self.is_connected = False
        self.logger.error(f"Disconnect event: {error_msg}")

        # Stop all threads
        self.should_read = False
        self.should_write = False
        self.should_handle_responses = False
        self.should_cleanup_acks = False

        self.reader_thread = self._stop_thread_safely(self.reader_thread)
        self.writer_thread = self._stop_thread_safely(self.writer_thread)
        self.response_handler_thread = self._stop_thread_safely(self.response_handler_thread)
        self.ack_cleanup_thread = self._stop_thread_safely(self.ack_cleanup_thread)

        # Close and cleanup serial port
        try:
            if self.serial and self.serial.is_open:
                self.serial.close()
            self.serial = None
        except Exception as e:
            self.logger.error(f"Error closing serial port: {str(e)}")

        self.port = None

        # Clear all queues
        self._clear_queue(self.read_queue)
        self._clear_queue(self.write_queue)
        self._clear_queue(self.verified_message_queue)

        # Clear pending ACKs and signal all waiters
        with self.pending_acks_lock:
            for seq_id, waiter in self.pending_acks.items():
                waiter.signal(None)  # Signal without ACK received
            self.pending_acks.clear()

        # Notify via callback if set
        if self.disconnect_callback:
            try:
                self.disconnect_callback()
            except Exception as e:
                self.logger.error(f"Error in disconnect callback: {str(e)}")

    def get_verified_messages(self) -> list[VerifiedMessage]:
        """
        Get any incoming data from the queue.

        Returns:
            List of received messages
        """
        messages = []
        try:
            while True:
                messages.append(self.verified_message_queue.get_nowait())
        except queue.Empty:
            pass
        return messages

    def get_queue_statistics(self) -> dict:
        """
        Get statistics about all queues for debugging purposes.

        Returns:
            Dictionary with queue sizes and status information
        """
        stats = {
            "read_queue_size": self.read_queue.qsize(),
            "write_queue_size": self.write_queue.qsize(),
            "verified_message_queue_size": self.verified_message_queue.qsize(),
            "is_connected": self.is_connected,
            "reader_thread_alive": self.reader_thread.is_alive() if self.reader_thread else False,
            "writer_thread_alive": self.writer_thread.is_alive() if self.writer_thread else False,
            "response_handler_thread_alive": (
                self.response_handler_thread.is_alive() if self.response_handler_thread else False
            ),
        }

        # Add USB comms logger statistics if available
        if self.comms_logger:
            stats["comms_log"] = self.comms_logger.get_statistics()

        return stats

    def get_usb_comms_statistics(self) -> dict:
        """
        Get USB communications logging statistics.

        Returns:
            Dictionary with USB comms logging statistics
        """
        if self.comms_logger:
            return self.comms_logger.get_statistics()
        return {"enabled": False}

    def enable_usb_comms_logging(self, enabled: bool = True):
        """
        Enable or disable USB communications logging.

        Args:
            enabled: True to enable, False to disable
        """
        if self.comms_logger:
            self.comms_logger.enabled = enabled
            if enabled:
                self.comms_logger.log_event("USB comms logging enabled")
            else:
                self.comms_logger.log_event("USB comms logging disabled")

    def send_raw(self, bytes: bytes) -> bool:
        """
        Send raw bytes to the HayStack.
        :param bytes: Bytes to send
        :return: True if sent successfully, False otherwise
        """
        hex_data = "7f"
        byte_data = bytes.fromhex(hex_data)
        self.serial.write(byte_data)

    def send_packet(self, packet: str) -> bool:
        """
        Queue a raw packet string for transmission (non-blocking).

        Args:
            packet: Formatted packet string

        Returns:
            True if queued successfully, False otherwise
        """
        if not self.is_connected:
            self.logger.warning("Cannot send packet: not connected")
            return False

        try:
            # Queue the packet for background transmission
            self.write_queue.put(packet, timeout=self.write_timeout)
            return True

        except queue.Full:
            self.logger.warning(f"Write queue full, packet dropped: {packet}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error queuing packet: {str(e)}")
            return False

    def send_command(
        self, command: str, data: Optional[str | list] = None, include_crc: bool = False
    ) -> Optional[int]:
        """
        Send a command and wait for an ACK response.
        :param command: Command string
        :param data: Optional data payload (string or list of values)
        :param include_crc: Whether to include CRC checksum
        :return: Sequence ID if sent successfully, None otherwise
        """
        if seq_id := super().send_command(command, data, include_crc):
            waiter = AckWaiter(seq_id, timeout=1.0)
            with self.pending_acks_lock:
                self.pending_acks[seq_id] = waiter

            # Wait for ACK
            ack_received, ack_params = waiter.wait()

            # Remove waiter from pending (if not already removed)
            with self.pending_acks_lock:
                self.pending_acks.pop(seq_id, None)

            if ack_received:
                return seq_id
        print(f"No ACK received for command '{command}' (seq_id: {seq_id})")
        return None

    def attempt_reconnect(self, max_attempts: int = 3) -> bool:
        """
        Attempt to reconnect to the last known port.

        Args:
            max_attempts: Maximum number of reconnection attempts

        Returns:
            True if reconnection successful, False otherwise
        """
        if not self.port:
            self.logger.error("No known port to reconnect to")
            return False

        for attempt in range(max_attempts):
            self.logger.info(f"Reconnection attempt {attempt + 1}/{max_attempts} to {self.port}")
            if self.connect(self.port):
                return True
            time.sleep(1)  # Wait between attempts
        return False

    def _open_serial_for_bootloader(self) -> bool:
        """
        Open the serial port in raw mode when the firmware application is not
        running (e.g. device is stuck in bootloader after an interrupted flash).

        Sets self.serial so that close_for_flash() can clean up afterwards.

        Returns:
            True if the port was opened successfully, False otherwise
        """
        if not self.port:
            self.logger.error("No port information available to enter bootloader")
            return False

        self.logger.info(
            f"Firmware application not running; opening raw serial port {self.port} "
            f"for direct bootloader handshake"
        )
        if self.comms_logger:
            self.comms_logger.log_event(
                f"Opening raw serial port {self.port} for bootloader (app not running)"
            )
        try:
            raw_serial = serial.Serial(port=self.port, baudrate=115200, timeout=1, write_timeout=1)
            if not raw_serial.is_open:
                raw_serial.open()
            raw_serial.reset_input_buffer()
            raw_serial.reset_output_buffer()
            self.serial = raw_serial
            self.logger.info(f"Opened serial port {self.port} for direct bootloader handshake")
            return True
        except Exception as e:
            self.logger.error(f"Failed to open serial port {self.port} for bootloader: {e}")
            if self.comms_logger:
                self.comms_logger.log_error(f"Raw serial open failed: {e}")
            return False

    def _wait_for_bootloader_ack(self) -> bool:
        """
        Send the UART bootloader init byte (0x7F) and wait for the ACK (0x79).

        Returns:
            True if ACK received within BOOTLOADER_TIMEOUT, False otherwise
        """
        if not self.serial or not self.serial.is_open:
            self.logger.error("Serial port not open")
            return False

        self.serial.write(bytes.fromhex("7f"))
        self.logger.info("Sent bootloader init byte")
        if self.comms_logger:
            self.comms_logger.log_tx("0x7F (bootloader init)")

        ack_received = False
        start_time = time.time()

        while (time.time() - start_time) < BOOTLOADER_TIMEOUT:
            raw_response = self.serial.readline().strip()
            response = binascii.hexlify(raw_response).decode()
            if self.comms_logger:
                self.comms_logger.log_rx(response)
            if response:
                self.logger.info(f"Received byte: {response}")
                if response == "79":
                    ack_received = True
                    self.logger.info("Bootloader ACK received")
                    if self.comms_logger:
                        self.comms_logger.log_event("Bootloader ACK received (0x79)")
                    break
            time.sleep(0.01)

        if not ack_received:
            self.logger.error("Did not receive bootloader ACK (0x79)")
        return ack_received

    def enter_bootloader(self) -> bool:
        """
        Enter bootloader mode for firmware update.

        Normal path (firmware application running):
            Sends the UPDATE command via the application protocol, waits briefly
            for the device to reboot into the bootloader, then completes the UART
            bootloader handshake (0x7F init → 0x79 ACK).

        Recovery path (firmware application unable to start):
            If the serial port is already closed – e.g. a previous flash was
            interrupted and the device is stuck in bootloader – the port is
            re-opened in raw mode and the bootloader handshake is attempted
            directly, without sending the UPDATE command first.

        Returns:
            True if bootloader entry successful, False otherwise
        """
        try:
            self.logger.info("Entering bootloader mode")
            if self.comms_logger:
                self.comms_logger.log_event("Entering bootloader mode")

            if self.is_connected and self.serial and self.serial.is_open:
                self.send_command(Command.SET.value, [SetCommand.UPDATE.value])
                self.logger.info("UPDATE command sent to firmware application")
                time.sleep(0.2)
            else:
                # Recovery path: firmware application is not running (device is already in
                # bootloader). A racing port-monitoring connect attempt may have opened the
                # serial port BEFORE is_connected was set to True, leaving self.serial open
                # while self.is_connected is still False. Close it now so
                # _open_serial_for_bootloader() can open the port without a PermissionError.
                if self.serial and self.serial.is_open:
                    self.logger.info(
                        "Closing lingering serial connection before bootloader handshake"
                    )
                    if self.comms_logger:
                        self.comms_logger.log_event(
                            "Closing lingering serial before bootloader recovery"
                        )
                    self.stop_reading()
                    self.stop_writing()
                    self.stop_response_handler()
                    self.stop_ack_cleanup()
                    try:
                        self.serial.close()
                    except serial.SerialException as e:
                        self.logger.error(f"Error closing serial port: {e}")
                    self.serial = None

                if not self._open_serial_for_bootloader():
                    return False

            if not self._wait_for_bootloader_ack():
                return False

            self.logger.info("Successfully entered bootloader mode")
            return True

        except Exception as e:
            self.logger.error(f"Error entering bootloader: {e}")
            if self.comms_logger:
                self.comms_logger.log_error(f"Bootloader entry failed: {e}")
            return False

    def close_for_flash(self) -> bool:
        """
        Safely close serial port for external flashing.

        Stops all threads and closes the port cleanly, but saves port
        information for reconnection later.

        Returns:
            True if closed successfully, False otherwise
        """
        try:
            self.logger.info("Closing connection for firmware flashing")
            if self.comms_logger:
                self.comms_logger.log_event("Closing for firmware flash")

            # Save port name before disconnecting
            saved_port = self.port

            # Stop all threads but don't clear port info
            self.is_connected = False

            # Stop reading, writing, response handler, and ACK cleanup threads
            self.stop_reading()
            self.stop_writing()
            self.stop_response_handler()
            self.stop_ack_cleanup()

            # Close serial port
            if self.serial and self.serial.is_open:
                self.serial.close()
                self.logger.info("Serial port closed for flashing")
                self.serial = None

            # Restore port name so we can reconnect later
            self.port = saved_port

            # Clear queues
            self._clear_queue(self.read_queue)
            self._clear_queue(self.write_queue)
            self._clear_queue(self.verified_message_queue)

            # Clear pending ACKs
            with self.pending_acks_lock:
                for seq_id, waiter in self.pending_acks.items():
                    waiter.signal(None)
                self.pending_acks.clear()

            return True

        except Exception as e:
            self.logger.error(f"Error closing for flash: {e}")
            if self.comms_logger:
                self.comms_logger.log_error(f"Close for flash failed: {e}")
            return False

    def reconnect_after_flash(self, timeout: float = RECONNECT_TIMEOUT) -> bool:
        """
        Reconnect after firmware flash.

        Waits for the device to reboot and attempts to reconnect.

        Returns:
            True if reconnected successfully, False otherwise
        """
        try:
            self.logger.info(f"Attempting to reconnect after flash (timeout: {timeout}s)")
            if self.comms_logger:
                self.comms_logger.log_event("Reconnecting after firmware flash")

            if not self.port:
                self.logger.error("No port information available for reconnection")
                return False

            start_time = time.time()
            reconnect_interval = 1.0  # Try reconnecting every 1 second

            while (time.time() - start_time) < timeout:
                # Try to reconnect
                if self.connect(self.port):
                    self.logger.info("Successfully reconnected after flash")
                    if self.comms_logger:
                        self.comms_logger.log_event("Reconnection successful")
                        return True

                # Wait before next attempt
                time.sleep(reconnect_interval)

            self.logger.error(f"Failed to reconnect after {timeout}s")
            if self.comms_logger:
                self.comms_logger.log_error(f"Reconnection timeout after {timeout}s")
            return False

        except Exception as e:
            self.logger.error(f"Error reconnecting after flash: {e}")
            if self.comms_logger:
                self.comms_logger.log_error(f"Reconnection failed: {e}")
            return False
