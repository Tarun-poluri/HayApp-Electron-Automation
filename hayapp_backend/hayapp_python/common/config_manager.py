from configparser import ConfigParser
from pathlib import Path
from typing import NamedTuple, Type, TypeVar

import keyring

from hayapp_python.common.paths import (
    APPLICATION_PATH,
    DATABASE_CASES_PATH,
    DATABASE_PATH,
    DECODER_PATH,
    DETECTOR_PATH,
    HAYAPP_CONFIG_FILE_PATH,
    IMAGE_PATH,
    LOG_PATH,
    PROCESSED_IMAGES_PATH,
)

CONFIG_SECTIONS = (
    "logging",
    "parlay",
    "iTrace",
    "camera",
    "scanner",
    "haystack",
    "all_in_one",
    "cloud",
)


class ConfigError(Exception):
    """Base exception for config.ini file related errors."""

    pass


T = TypeVar("T")


class CloudConfig:
    """Cloud: middleware URL and OAuth client id from ini; API key/group from keyring."""

    def __init__(self, middleware_url: str, tech_support_oauth_client_id: str):
        self._middleware_url = middleware_url
        self._tech_support_oauth_client_id = tech_support_oauth_client_id.strip()

    @property
    def middleware_url(self) -> str:
        return self._middleware_url

    @property
    def tech_support_oauth_client_id(self) -> str:
        """OAuth2 client_id for POST /v2/auth/token (tech support login)."""
        return self._tech_support_oauth_client_id

    @property
    def api_key(self) -> str | None:
        """Read API key from keyring dynamically."""
        return keyring.get_password("hayapp", "api_key")

    @property
    def group_id(self) -> str | None:
        """Read group ID from keyring dynamically."""
        return keyring.get_password("hayapp", "group_id")


class ParlayConfig(NamedTuple):
    ip_address: str
    http_port: int
    https_port: int
    log_level: str
    secure_websocket_port: int
    ssl_only: bool
    ui_caching: bool
    ui_dirname: str
    websocket_port: int
    use_mock_items: bool
    open_browser: bool
    development_mode: bool
    restore_state: bool


class LoggingConfig(NamedTuple):
    filename: str
    file_log_level: str
    console_log_level: str
    root_log_level: str
    num_days_per_log: int
    num_backup_logs: int


class ItraceConfig(NamedTuple):
    decoder_dll_path: str
    decoder_config_path: str
    decoder_key_path: str
    decoder_flags: str
    needle_detector_dll_path: str
    needle_detector_config_path: str
    object_to_image_ratio: float
    object_pixel_count: int
    company_id: int
    mark_type: str
    use_mock_decoder: bool
    use_mock_detector: bool


class CameraConfig(NamedTuple):
    server_host: str
    server_port: int
    default_exposure_time: int
    image_format: str
    vir_service_name: str
    check_vir_service: bool
    auto_start_vir_service: bool
    service_start_timeout_s: float
    calibration_output_file: str
    calibration_default_matrix: list[str]
    calibration_default_distortion: list[str]
    connection_retries: int
    connection_retry_delay: float


class ScannerConfig(NamedTuple):
    host: str
    port: int
    auth_key: str


class HaystackConfig(NamedTuple):
    heartbeat_interval: float
    heartbeat_timeout: float
    port_monitoring_timeout: float
    firmware_flash_timeout: float
    firmware_bootloader_timeout: float
    firmware_reconnect_timeout: float
    firmware_max_retries: int
    firmware_tools_dir: str


class AllInOneConfig(NamedTuple):
    battery_low_threshold: int
    storage_low_threshold_gb: float
    power_monitor_interval: float


class Paths(NamedTuple):
    database_path: Path
    database_cases_path: Path
    image_path: Path
    processed_images_path: Path
    ui_path: Path
    log_path: Path


def get_full_scanner_auth_key():
    count_str = keyring.get_password("hayapp", "hayScan_auth_key_count")
    if not count_str:
        return (keyring.get_password("hayapp", "hayScan_auth_key") or "PleaseProvisionAPIKey",)

    count = int(count_str)
    parts = []
    for i in range(count):
        parts.append(keyring.get_password("hayapp", f"hayScan_auth_key_part_{i}"))

    return "".join(parts)


def store_hayscan_auth_key_in_keyring(hayscan_auth_key: str) -> None:
    """
    Store HayScan auth key in the OS keyring using the same chunked layout as
    scripts/provision_haystack.py (long RSA keys exceed single keyring entry limits).
    """
    service = "hayapp"
    name = "hayScan_auth_key"
    chunk_size = 1000
    chunks = [
        hayscan_auth_key[i : i + chunk_size] for i in range(0, len(hayscan_auth_key), chunk_size)
    ]
    try:
        keyring.delete_password(service, name)
    except keyring.errors.PasswordDeleteError:
        pass
    keyring.set_password(service, f"{name}_count", str(len(chunks)))
    for i, chunk in enumerate(chunks):
        keyring.set_password(service, f"{name}_part_{i}", chunk)


class HayappConfig:

    def __init__(self):
        self.configparser = self._load_config()

        self.cloud = CloudConfig(
            middleware_url=self._get_config_value("middleware_url", "cloud"),
            tech_support_oauth_client_id=self.configparser.get(
                "cloud",
                "tech_support_oauth_client_id",
                fallback="XN2WMW4D",
            ).strip(),
        )

        self.parlay = ParlayConfig(
            ip_address=self._get_config_value("ip_address", "parlay"),
            http_port=self._get_config_value("http_port", "parlay", int),
            https_port=self._get_config_value("https_port", "parlay", int),
            log_level=self._get_config_value("log_level", "parlay"),
            secure_websocket_port=self._get_config_value("secure_websocket_port", "parlay", int),
            ssl_only=self._get_config_value("ssl_only", "parlay", bool),
            ui_caching=self._get_config_value("ui_caching", "parlay", bool),
            ui_dirname=self._get_config_value("ui_dirname", "parlay"),
            websocket_port=self._get_config_value("websocket_port", "parlay", int),
            use_mock_items=self._get_config_value("use_mock_items", "parlay", bool),
            open_browser=self._get_config_value("open_browser", "parlay", bool),
            development_mode=self._get_config_value("development_mode", "parlay", bool),
            restore_state=self._get_config_value("restore_state", "parlay", bool),
        )

        self.logging = LoggingConfig(
            filename=self._get_config_value("filename", "logging"),
            file_log_level=self._get_config_value("file_log_level", "logging"),
            console_log_level=self._get_config_value("console_log_level", "logging"),
            root_log_level=self._get_config_value("root_log_level", "logging"),
            num_days_per_log=self._get_config_value("num_days_per_log", "logging", int),
            num_backup_logs=self._get_config_value("num_backup_logs", "logging", int),
        )

        self.itrace = ItraceConfig(
            decoder_dll_path=self._get_config_path("decoder_dll", "iTrace", DECODER_PATH),
            decoder_config_path=self._get_config_path("decoder_config", "iTrace", DECODER_PATH),
            decoder_key_path=self._get_config_path("decoder_key", "iTrace", DECODER_PATH),
            needle_detector_dll_path=self._get_config_path(
                "needle_detector_dll", "iTrace", DETECTOR_PATH
            ),
            needle_detector_config_path=self._get_config_path(
                "needle_detector_config", "iTrace", DETECTOR_PATH
            ),
            decoder_flags=self._get_config_value("decoder_flags", "iTrace"),
            object_to_image_ratio=self._get_config_value("object_to_image_ratio", "iTrace", float),
            object_pixel_count=self._get_config_value("object_pixel_count", "iTrace", int),
            company_id=self._get_config_value("company_id", "iTrace", int),
            mark_type=self._get_config_value("mark_type", "iTrace"),
            use_mock_decoder=self._get_config_value("use_mock_decoder", "iTrace", bool),
            use_mock_detector=self._get_config_value("use_mock_detector", "iTrace", bool),
        )

        self.camera = CameraConfig(
            server_host=self._get_config_value("server_host", "camera"),
            server_port=self._get_config_value("server_port", "camera", int),
            default_exposure_time=self._get_config_value("default_exposure_time", "camera", int),
            image_format=self._get_config_value("image_format", "camera"),
            vir_service_name=self.configparser.get(
                "camera",
                "vir_service_name",
                fallback="Magvation.Video.Image.Recognition.Service",
            ),
            check_vir_service=self.configparser.getboolean(
                "camera", "check_vir_service", fallback=True
            ),
            auto_start_vir_service=self.configparser.getboolean(
                "camera", "auto_start_vir_service", fallback=True
            ),
            service_start_timeout_s=self.configparser.getfloat(
                "camera", "service_start_timeout_s", fallback=10.0
            ),
            calibration_output_file=self._get_config_path(
                "calibration_output_file", "camera", APPLICATION_PATH, verify=False
            ),
            calibration_default_matrix=self._get_config_value(
                "calibration_default_matrix", "camera", str
            ).split(","),
            calibration_default_distortion=self._get_config_value(
                "calibration_default_distortion", "camera", str
            ).split(","),
            connection_retries=self._get_config_value("connection_retries", "camera", int),
            connection_retry_delay=self._get_config_value(
                "connection_retry_delay", "camera", float
            ),
        )

        self.scanner = ScannerConfig(
            host=self._get_config_value("host", "scanner"),
            port=self._get_config_value("port", "scanner", int),
            auth_key=get_full_scanner_auth_key() or "PleaseProvisionAPIKey",
        )

        self.haystack = HaystackConfig(
            heartbeat_interval=self._get_config_value("heartbeat_interval", "haystack", float),
            heartbeat_timeout=self._get_config_value("heartbeat_timeout", "haystack", float),
            port_monitoring_timeout=self._get_config_value(
                "port_monitoring_timeout", "haystack", float
            ),
            firmware_flash_timeout=self._get_config_value(
                "firmware_flash_timeout", "haystack", float
            ),
            firmware_bootloader_timeout=self._get_config_value(
                "firmware_bootloader_timeout", "haystack", float
            ),
            firmware_reconnect_timeout=self._get_config_value(
                "firmware_reconnect_timeout", "haystack", float
            ),
            firmware_max_retries=self._get_config_value("firmware_max_retries", "haystack", int),
            firmware_tools_dir=self._get_config_path(
                "firmware_tools_dir", "haystack", APPLICATION_PATH
            ),
        )

        self.all_in_one = AllInOneConfig(
            battery_low_threshold=self._get_config_value(
                "battery_low_threshold", "all_in_one", int
            ),
            storage_low_threshold_gb=self._get_config_value(
                "storage_low_threshold_gb", "all_in_one", float
            ),
            power_monitor_interval=self._get_config_value(
                "power_monitor_interval", "all_in_one", float
            ),
        )

        self.paths = Paths(
            database_path=DATABASE_PATH,
            database_cases_path=DATABASE_CASES_PATH,
            image_path=IMAGE_PATH,
            processed_images_path=PROCESSED_IMAGES_PATH,
            ui_path=APPLICATION_PATH / self.parlay.ui_dirname,
            log_path=LOG_PATH,
        )
        self._ensure_paths_exist()

    def _ensure_paths_exist(self) -> None:
        """Create configured directories if they do not exist."""
        for path in self.paths:
            path.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _load_config() -> ConfigParser:
        """
        Load configuration from file.

        Returns:
            Loaded configuration parser

        Raises:
            ConfigError: If configuration cannot be loaded
        """
        config = ConfigParser()
        try:
            if not HAYAPP_CONFIG_FILE_PATH.exists():
                raise ConfigError(f"Configuration file not found: {HAYAPP_CONFIG_FILE_PATH}")

            config.read(HAYAPP_CONFIG_FILE_PATH)

            # Validate required sections
            for section in CONFIG_SECTIONS:
                if section not in config:
                    raise ConfigError(f"Missing '{section}' section in configuration")

            return config
        except Exception as e:
            raise ConfigError(f"Configuration error: {e}") from e

    def _get_config_value(self, key: str, section: str, key_type: Type[T] = str) -> T:
        """
        Get a configuration value.

        Args:
            key: Configuration key
            section: Configuration section

        Returns:
            Configuration value

        Raises:
            ConfigError: If key is missing
        """
        try:
            if key_type == str:
                return self.configparser.get(section, key)
            elif key_type == int:
                return self.configparser.getint(section, key)
            elif key_type == float:
                return self.configparser.getfloat(section, key)
            elif key_type == bool:
                return self.configparser.getboolean(section, key)
        except KeyError as e:
            raise ConfigError(f"Missing config key: {section}.{key}") from e

    def _get_config_path(self, key: str, section: str, base_path: Path = None, verify=True) -> str:
        """
        Get a configuration path, resolving relative paths against a base path.

        Args:
            key: Configuration key
            section: Configuration section
            base_path: Base path for relative paths
        """
        path_str = self._get_config_value(key, section)
        path = Path(path_str)
        if not path.is_absolute() and base_path is not None:
            path = base_path / path
        # check for paths, not files
        path_to_check = path.resolve() if path.suffix == "" else path.parent.resolve()
        if verify and not path_to_check.exists():
            raise ConfigError(
                f"Configured path does not exist: {path_to_check}. Was initial setup script run?"
            )
        return str(path.resolve())


config = HayappConfig()
