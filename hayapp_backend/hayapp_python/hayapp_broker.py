import logging
import os
import signal
import threading
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer

from parlay import Broker, start, start_for_test

from hayapp_python.common.config_manager import config
from hayapp_python.common.logger import init_logger, install_global_exception_logging
from hayapp_python.common.utils import get_utc_iso_timestamp
from hayapp_python.items.all_in_one import AllInOneAdapter
from hayapp_python.items.camera_adapter import Camera
from hayapp_python.items.case import CaseManager
from hayapp_python.items.cloud_store import CloudStore
from hayapp_python.items.data_store import DataStore
from hayapp_python.items.haystack.haystack_adapter import HayStack
from hayapp_python.items.haystack.usb_transport import UsbTransport
from hayapp_python.items.scanner_adapter import HayScanner
from hayapp_python.items.scanner_tcp_server import main as start_tcp_server
from hayapp_python.items.tech_support import TechSupport
from hayapp_python.items.timer import Timer
from hayapp_python.iTrace.decoder_adapter import DecoderAdapter
from hayapp_python.iTrace.detector_adapter import DetectorAdapter

logger = logging.getLogger("hayapp")


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


class ReusableTCPServer(TCPServer):
    allow_reuse_address = True


def start_image_http_server(directory, port=8080, stop_event=None):
    directory = os.path.abspath(directory)

    class CustomCORSHandler(CORSRequestHandler):
        def translate_path(self, path):
            # Parse the URL path and convert to filesystem path
            from urllib.parse import unquote

            # Remove leading slash and query parameters
            path = path.split("?", 1)[0]
            path = path.split("#", 1)[0]
            path = unquote(path)

            # Remove leading slash
            if path.startswith("/"):
                path = path[1:]

            # Combine with our base directory
            fullpath = os.path.join(directory, path)

            # Security: ensure the path doesn't escape our directory
            fullpath = os.path.normpath(fullpath)
            if not fullpath.startswith(directory):
                return directory

            return fullpath

    handler = CustomCORSHandler
    httpd = ReusableTCPServer(("", port), handler)
    logger.info(f"Serving images at http://localhost:{port}/")
    logger.info(f"Serving from directory {directory}")
    if stop_event:
        # Run in a thread, check for stop_event
        while not stop_event.is_set():
            httpd.handle_request()
        logger.info("Shutting down image server...")
        httpd.server_close()
    else:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down image server...")
            httpd.shutdown()
            httpd.server_close()


def start_broker(for_test=False):
    """
    Create the local command items and start the parlay broker.
    :return:
    """
    log_dir = config.paths.log_path
    log_file = os.path.join(log_dir, f"log_{get_utc_iso_timestamp()}.log".replace(":", ""))
    with open(log_file, "a"):
        os.utime(log_file, None)

    logger = init_logger(log_file)
    install_global_exception_logging(logger)
    logger.info("Logger initialized for hayapp.")

    img_dir = config.paths.image_path
    ui_path = config.paths.ui_path

    stop_event = threading.Event()
    http_thread = threading.Thread(
        target=start_image_http_server, args=(img_dir, 8080, stop_event), daemon=True
    )
    http_thread.start()

    def handle_sigint(sig, frame):
        logger.info("SIGINT received, shutting down image server...")
        stop_event.set()
        signal.default_int_handler(sig, frame)

    signal.signal(signal.SIGINT, handle_sigint)

    parlay_kwargs = dict(
        default_ip=config.parlay.ip_address,
        http_port=config.parlay.http_port,
        https_port=config.parlay.https_port,
        log_level=getattr(logging, config.parlay.log_level),
        mode=(
            Broker.Modes.DEVELOPMENT if config.parlay.development_mode else Broker.Modes.PRODUCTION
        ),
        open_browser=config.parlay.open_browser,
        secure_websocket_port=config.parlay.secure_websocket_port,
        ssl_only=config.parlay.ssl_only,
        ui_caching=config.parlay.ui_caching,
        ui_path=str(ui_path),
        websocket_port=config.parlay.websocket_port,
    )

    #############################################
    # Instantiate all the local command items.
    #############################################

    transport = UsbTransport
    camera = Camera
    decoder_cls = DecoderAdapter
    detector_cls = DetectorAdapter

    if config.parlay.use_mock_items:
        from hayapp_python.items.camera_adapter import MockCamera
        from hayapp_python.items.haystack.sim_transport import SimTransport

        transport = SimTransport
        camera = MockCamera

    # Check for mock decoder flag
    if config.itrace.use_mock_decoder:
        from hayapp_python.iTrace.decoder_adapter import MockDecoderAdapter

        decoder_cls = MockDecoderAdapter
        logger.info("Using MockDecoderAdapter for cross-platform testing")

    # Check for mock detector flag
    if config.itrace.use_mock_detector:
        from hayapp_python.iTrace.detector_adapter import MockDetectorAdapter

        detector_cls = MockDetectorAdapter
        logger.info("Using MockDetectorAdapter for cross-platform testing")

    cloud = CloudStore()
    model = DataStore(cloud=cloud)
    scanner = HayScanner()
    tcp_server_thread = threading.Thread(target=start_tcp_server, args=(scanner,), daemon=True)
    tcp_server_thread.start()
    stack = HayStack(interface=transport)
    decoder = decoder_cls()
    detector = detector_cls()
    camera = camera()
    aio = AllInOneAdapter()
    _ = Timer()
    case_manager = CaseManager(
        model=model,
        scanner=scanner,
        haystack=stack,
        decoder=decoder,
        detector=detector,
        camera=camera,
        all_in_one=aio,
    )
    _ = TechSupport(all_in_one=aio, data_store=model, case_manager=case_manager)

    #############################################
    # Start the broker
    #############################################
    logger.info("Starting parlay broker with arguments: %s", parlay_kwargs)
    try:
        if for_test:
            start_for_test()
        else:
            start(**parlay_kwargs)
    finally:
        stop_event.set()


if __name__ == "__main__":
    start_broker()
