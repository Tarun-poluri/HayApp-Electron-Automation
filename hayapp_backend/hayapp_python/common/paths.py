import sys
from pathlib import Path

from platformdirs import user_data_path

_appname = "HayApp"
_appauthor = "Magvation"


def get_app_path() -> Path:
    """
    Returns the absolute path to the application directory as a pathlib.Path object.

    - If compiled (PyInstaller/cx_Freeze): Returns the folder containing the executable.
    - If script: Returns the folder containing this python file.
    """
    if getattr(sys, "frozen", False):
        # If frozen, use the directory of the executable
        application_path = Path(sys.executable).parent
    else:
        # If running as python file, get the path fron the current file path
        application_path = Path(__file__).resolve().parent.parent.parent

    return application_path


APPLICATION_PATH = get_app_path()
USER_DATA_PATH = user_data_path(_appname, _appauthor)
LOG_PATH = USER_DATA_PATH / "logs"

DATABASE_PATH = USER_DATA_PATH / "databases"
DATABASE_CASES_PATH = DATABASE_PATH / "cases"
IMAGE_PATH = USER_DATA_PATH / "images"
PROCESSED_IMAGES_PATH = USER_DATA_PATH / "processed_images"
HAYAPP_CONFIG_FILE_PATH = USER_DATA_PATH / "hayapp_config.ini"
DECODER_PATH = APPLICATION_PATH / "image_decoder"
DETECTOR_PATH = APPLICATION_PATH / "needle_detector"
HAYSCAN_IMAGE_PATH = IMAGE_PATH / "hayscan_cbi_images"
