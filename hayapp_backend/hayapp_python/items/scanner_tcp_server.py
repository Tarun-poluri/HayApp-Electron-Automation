# scanner_tcp_server.py
import base64
import json
import logging
import socket
import threading
import uuid

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from hayapp_python.common.config_manager import config
from hayapp_python.common.protocol_helper import ProtocolHelper
from hayapp_python.items.scanner_adapter import HayScanner

# --- Configuration ---
HOST = config.scanner.host
PORT = config.scanner.port
AUTH_KEY = config.scanner.auth_key
logger = logging.getLogger("hayapp.server")  # Use the 'hayapp' logger for consistency

# --- Global State ---
# This lock ensures thread-safe access to the scanner adapter's connection.
lock = threading.Lock()
protocol_helper = ProtocolHelper()

CLIENT_EVENT_MAP = {
    201: "ack_sync",
    202: "ack_open_screen",
    203: "scan_result",
    204: "ack_close_screen",
    205: "camera_result",
    206: "system_info_response",
    207: "disaster_recovery_response",
    208: "nfc_uid_result",
    209: "update_available",
    210: "update_installed",
    211: "handshake_response",
    401: "timestamp_missing_error",
    402: "scanner_error",
    403: "navigation_error",
    404: "camera_error",
    405: "system_info_error",
    406: "disaster_recovery_error",
    407: "update_error",
    408: "handshake_error",
}


class HandshakeError(Exception):
    """Raised when the challenge/response verification fails."""

    pass


def get_handshake_data():

    challenge_text = str(uuid.uuid4())

    return challenge_text


def process_incoming_data(scanner_adapter: HayScanner, data: str, challenge: str):
    """
    Parses a message from the Android device and calls the appropriate Parlay event.
    This is where the server "listens" and reacts to client events.
    """
    try:
        message = json.loads(data)
        status_code = message.get("status_code")
        payload = message.get("payload", {})

        if status_code is None:
            logger.warning(f"Received message without an 'status_code' field: {data}")
            return

        event_name = CLIENT_EVENT_MAP.get(status_code)
        if event_name is None:
            logger.warning(f"Received unknown 'status_code' field: {data}")
            return
        # Log the received event and its payload
        logger.info(f"Received event '{event_name}' from Android device with payload: {payload}")

        if not scanner_adapter.is_authenticated:
            if status_code == 211:
                priv_key = serialization.load_pem_private_key(
                    AUTH_KEY.encode("utf-8"), password=None
                )

                encrypted_response = base64.b64decode(payload.get("challenge_response"))

                decrypted_bytes = priv_key.decrypt(
                    encrypted_response,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None,
                    ),
                )

                decrypted_text = decrypted_bytes.decode("utf-8")
                if challenge == decrypted_text:
                    logger.info("Authenticated")
                    scanner_adapter.is_authenticated = True
                    # Send the handshake_response event to frontend
                    scanner_adapter.send_event(payload, event_name, None)
                    return
                else:
                    raise HandshakeError("Device failed security challenge")

            if status_code == 408:
                # Send the handshake_error event to frontend before raising
                scanner_adapter.send_event(payload, event_name, None)
                raise HandshakeError("Device failed security challenge")
            else:
                return

        scanner_adapter.send_event(payload, event_name, None)

    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from client: {data}")
    except Exception as e:
        logger.error(f"Error processing incoming data: {e}", exc_info=True)


def handle_client_connection(conn: socket.socket, addr, scanner_adapter: HayScanner):
    """
    Manages a new client connection. This function now runs in a loop,
    listening for messages until the client disconnects.
    """
    client_id = f"{addr[0]}:{addr[1]}"
    logger.info(f"[NEW CONNECTION] Android device {client_id} connected.")

    # --- CRITICAL INTEGRATION STEP ---
    # Assign the active connection to the scanner adapter. This allows the
    # adapter to send commands to this specific client.
    with lock:
        scanner_adapter.tcp_connection = conn
        """Command the Android app to authenticate itself"""
        challenge_text = get_handshake_data()
        command_bytes = protocol_helper.authenticate_hayscan(
            challenge=challenge_text,
        )
        conn.sendall(command_bytes)
        logger.info("sending authenticate command challenge_text")

    try:
        buffer = ""
        while True:
            # This is a blocking call. The thread waits here for data.
            data = conn.recv(4096)
            if not data:
                logger.info(f"[{client_id}] Client closed the connection gracefully.")
                break

            buffer += data.decode("utf-8")
            # Process line-by-line in case multiple messages arrive at once
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                if line:
                    process_incoming_data(scanner_adapter, line, challenge_text)

    except ConnectionResetError:
        logger.warning(f"[{client_id}] Connection was forcibly closed by the client.")
    except HandshakeError as e:
        logger.error(f"[{client_id}] Failed to Authenticate: {e}")
    except Exception as e:
        logger.error(f"[{client_id}] An error occurred: {e}", exc_info=True)
    finally:
        # --- Cleanup ---
        logger.info(f"[CONNECTION CLOSED] {client_id}")
        with lock:
            # Set the adapter's connection to None so it knows it can't send commands.
            if scanner_adapter.tcp_connection is conn:
                scanner_adapter.tcp_connection = None
                scanner_adapter.is_authenticated = False
        conn.close()


def main(scanner_adapter: HayScanner):
    """
    The main function to start the TCP server.
    It now accepts the HayScanner adapter instance as an argument.
    """
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server_socket.bind((HOST, PORT))
        server_socket.listen()
        logger.info(f"[LISTENING] TCP Server is listening on {HOST}:{PORT}")

        while True:
            # This is a blocking call, waiting for a new client connection.
            conn, addr = server_socket.accept()
            # Each client gets its own dedicated thread.
            # We pass the single scanner_adapter instance to each thread.
            client_thread = threading.Thread(
                target=handle_client_connection, args=(conn, addr, scanner_adapter), daemon=True
            )
            client_thread.start()

    except Exception as e:
        logger.error(f"[SERVER ERROR] A fatal error occurred: {e}", exc_info=True)
    finally:
        logger.info("[SHUTTING DOWN] TCP Server is shutting down.")
        server_socket.close()
