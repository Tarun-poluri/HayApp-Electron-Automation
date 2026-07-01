# -*- coding: utf-8 -*-
from datetime import timedelta
from enum import Enum, StrEnum

from hayapp_python.items.haystack.haystack_interface import (
    BtnIndicatorCommand,
)


class CaseState(Enum):
    NOT_STARTED = 0
    SETUP = 1
    VERIFICATION = 2
    IN_PROGRESS = 3
    CLOSING_COUNT = 4
    CLOSING = 5
    FINAL_COUNT = 6
    CANCELLED = 7
    CLEANUP = 8


class ScrubScreen(StrEnum):
    SCR_DASHBOARD_VALIDATE_ACTIVE = "SCR_DASHBOARD_VALIDATE_ACTIVE"
    SCR_DASHBOARD_VALIDATE_INACTIVE = "SCR_DASHBOARD_VALIDATE_INACTIVE"
    SCR_VALIDATION = "SCR_VALIDATION"
    SCR_ACTION_SCREEN = "SCR_ACTION_SCREEN"
    SCR_ACTION_SCREEN_STERILE_PROMPT = "SCR_ACTION_SCREEN_STERILE_PROMPT"
    SCR_ACTION_SCREEN_STERILE_DEPOSIT_PROMPT = "SCR_ACTION_SCREEN_STERILE_DEPOSIT_PROMPT"
    SCR_ACTION_SCREEN_BLANK_IMAGE = "SCR_ACTION_SCREEN_BLANK_IMAGE"
    SCR_ADDED_NEEDLES = "SCR_ADDED_NEEDLES"
    SCR_ADDED_NEEDLES_WAITING = "SCR_ADDED_NEEDLES_WAITING"
    SCR_ADDED_NEEDLES_INTERIM = "SCR_ADDED_NEEDLES_INTERIM"
    SCR_BUTTON_TEST_YES = "SCR_BUTTON_TEST_YES"
    SCR_BUTTON_TEST_NO = "SCR_BUTTON_TEST_NO"
    SCR_BUTTON_TEST_VALIDATE = "SCR_BUTTON_TEST_VALIDATE"
    SCR_BUTTON_TEST_TAKE_ACTION = "SCR_BUTTON_TEST_TAKE_ACTION"
    SCR_BUTTON_TEST_CLEAR = "SCR_BUTTON_TEST_CLEAR"
    CONFIRM_TOTAL = "CONFIRM_TOTAL"
    SCR_BLANK_IMAGE = "SCR_BLANK_IMAGE"
    MISMATCH_CONFIRM = "MISMATCH_CONFIRM"
    SCR_VALIDATION_REMOVED_PROMPT = "SCR_VALIDATION_REMOVED_PROMPT"


ScrubScreenToLedMapping = {
    ScrubScreen.SCR_DASHBOARD_VALIDATE_ACTIVE: BtnIndicatorCommand(
        btn1=False, btn2=True, btn3=True, btn4=False
    ),
    ScrubScreen.SCR_DASHBOARD_VALIDATE_INACTIVE: BtnIndicatorCommand(
        btn1=False, btn2=False, btn3=True, btn4=False
    ),
    ScrubScreen.SCR_VALIDATION: BtnIndicatorCommand(btn1=True, btn2=False, btn3=True, btn4=True),
    ScrubScreen.SCR_ACTION_SCREEN: BtnIndicatorCommand(btn1=True, btn2=True, btn3=True, btn4=False),
    ScrubScreen.SCR_ACTION_SCREEN_STERILE_PROMPT: BtnIndicatorCommand(
        btn1=True, btn2=False, btn3=True, btn4=True
    ),
    ScrubScreen.SCR_ACTION_SCREEN_STERILE_DEPOSIT_PROMPT: BtnIndicatorCommand(
        btn1=False, btn2=False, btn3=True, btn4=False
    ),
    ScrubScreen.SCR_ACTION_SCREEN_BLANK_IMAGE: BtnIndicatorCommand(
        btn1=True, btn2=False, btn3=False, btn4=True
    ),
    ScrubScreen.SCR_ADDED_NEEDLES: BtnIndicatorCommand(
        btn1=True, btn2=False, btn3=False, btn4=True
    ),
    ScrubScreen.SCR_ADDED_NEEDLES_WAITING: BtnIndicatorCommand(
        btn1=False, btn2=False, btn3=False, btn4=False
    ),
    ScrubScreen.SCR_ADDED_NEEDLES_INTERIM: BtnIndicatorCommand(
        btn1=True, btn2=False, btn3=False, btn4=False
    ),
    ScrubScreen.SCR_BUTTON_TEST_YES: BtnIndicatorCommand(
        btn1=True, btn2=False, btn3=False, btn4=False
    ),
    ScrubScreen.SCR_BUTTON_TEST_VALIDATE: BtnIndicatorCommand(
        btn1=False, btn2=True, btn3=False, btn4=False
    ),
    ScrubScreen.SCR_BUTTON_TEST_TAKE_ACTION: BtnIndicatorCommand(
        btn1=False, btn2=False, btn3=True, btn4=False
    ),
    ScrubScreen.SCR_BUTTON_TEST_NO: BtnIndicatorCommand(
        btn1=False, btn2=False, btn3=False, btn4=True
    ),
    ScrubScreen.SCR_BUTTON_TEST_CLEAR: BtnIndicatorCommand(
        btn1=False, btn2=False, btn3=False, btn4=False
    ),
    ScrubScreen.CONFIRM_TOTAL: BtnIndicatorCommand(btn1=True, btn2=False, btn3=False, btn4=True),
    ScrubScreen.SCR_BLANK_IMAGE: BtnIndicatorCommand(btn1=True, btn2=False, btn3=False, btn4=True),
    ScrubScreen.MISMATCH_CONFIRM: BtnIndicatorCommand(btn1=True, btn2=False, btn3=False, btn4=True),
    ScrubScreen.SCR_VALIDATION_REMOVED_PROMPT: BtnIndicatorCommand(
        btn1=True, btn2=False, btn3=True, btn4=False
    ),
}


class NeedleResponseType(StrEnum):
    SINGLE_NEEDLE = "SINGLE_NEEDLE"
    MULTIPLE_NEEDLES = "MULTIPLE_NEEDLES"
    SINGLE_SHARP = "SINGLE_SHARP"
    MULTIPLE_SHARPS = "MULTIPLE_SHARPS"
    MIXED_OBJECTS = "MIXED_OBJECTS"
    NO_OBJECTS = "NO_OBJECTS"
    ERROR = "ERROR"


class CaseManager_item:
    """
    DataStore Parlay interface definition
    """

    id = 100
    name = "Case Manager"
    properties = {}
    stream_properties = {}
    commands = [
        {"name": "version", "parameters": {}, "return_type": str},
        {
            "name": "verify_login",
            "parameters": {"username": str, "password": str, "role": str},
            "return_type": bool,
        },
        {"name": "set_case_types", "parameters": {"case_types_list": list}, "return_type": bool},
        {"name": "remove_case_type", "parameters": {"case_type_id": str}, "return_type": bool},
        {
            "name": "set_case_staff",
            "parameters": {"surgeon_id": str, "cir_id": str, "scr_id": str},
            "return_type": bool,
        },
        {
            "name": "add_bad_needle",
            "parameters": {"image": str, "amount": int, "verified": bool},
            "return_type": bool,
        },
        {"name": "get_bad_needles", "parameters": {}, "return_type": list},
        {
            "name": "add_interim_count",
            "parameters": {
                "when": str,
                "remaining_count": int,
                "bad_needles_count": int,
                "verified": bool,
            },
            "return_type": bool,
        },
        {
            "name": "start_interim_count",
            "parameters": {},
            "return_type": bool,
        },
        {
            "name": "add_relief_count",
            "parameters": {
                "when": str,
                "remaining_count": int,
                "bad_needles_count": int,
                "misplaced_count": int,
                "remaining_verified": bool,
                "bad_needles_verified": bool,
                "total_needles_verified": bool,
                "relief_count_verified": bool,
                "cir_replaced": bool,
                "scr_replaced": bool,
                "cir_replacement_id": str,
                "scr_replacement_id": str,
            },
            "return_type": bool,
        },
        {
            "name": "add_adjudicated_image",
            "parameters": {
                "image": str,
                "timestamp": str,
                "one_complete_suture": bool,
                "reason": str,
                "description": str,
            },
            "return_type": bool,
        },
        {"name": "get_adjudicated_images", "parameters": {}, "return_type": list},
        {"name": "get_surgeons", "parameters": {}, "return_type": list},
        {"name": "get_hayapp_users_by_role", "parameters": {"role": str}, "return_type": list},
        {"name": "get_room_id", "parameters": {}, "return_type": str},
        {"name": "get_hayapp_users", "parameters": {}, "return_type": list},
        {"name": "get_case_types", "parameters": {}, "return_type": list},
        {
            "name": "get_case_types_for_surgeon",
            "parameters": {"surgeon_id": str},
            "return_type": list,
        },
        {"name": "get_surgeon_by_id", "parameters": {"surgeon_id": str}, "return_type": dict},
        {"name": "get_suture_sheet", "parameters": {"suture_sheet_id": str}, "return_type": dict},
        {
            "name": "add_case_worker",
            "parameters": {"user_id": str, "role": str},
            "return_type": bool,
        },
        {"name": "add_surgeon", "parameters": {"surgeon_id": str}, "return_type": bool},
        {
            "name": "set_case_state",
            "parameters": {"state": int},
            "return_type": dict,
        },
        {"name": "clear_case_data", "parameters": {}, "return_type": bool},
        {
            "name": "add_case_suture",
            "parameters": {
                "fda_guid": str,
                "original_suture_count": int,
                "verified_suture_count": int,
                "suture_sheet_count": int,
                "verified": bool,
                "modified": bool,
            },
            "return_type": bool,
        },
        {
            "name": "add_adjudicated_image",
            "parameters": {
                "image": str,
                "one_complete_suture": bool,
                "timestamp": str,
                "reason": str,
                "description": str,
            },
            "return_type": bool,
        },
        {"name": "get_adjudicated_images", "parameters": {}, "return_type": list},
        {"name": "get_pending_adjudications", "parameters": {}, "return_type": list},
        {
            "name": "add_closing_count",
            "parameters": {
                "when": str,
                "cir_id": str,
                "scr_id": str,
                "remaining_count": int,
                "bad_needles_count": int,
                "all_loose_sutures_desposited": bool,
                "unused_sutures_deposited": bool,
                "pending_adjudications_cleared": bool,
                "amount_closing_sutures_added": int,
                "closing_sutures": list,
            },
            "return_type": bool,
        },
        {"name": "get_pending_adjudications", "parameters": {}, "return_type": list},
        {"name": "on_deposit_ready", "parameters": {}, "return_type": None},
        {"name": "on_moved_to_sharps", "parameters": {}, "return_type": None},
        {"name": "on_imaging_ready", "parameters": {}, "return_type": None},
        {
            "name": "cir_verified_needles",
            "parameters": {"complete_needles": list, "not_complete_needles": list},
            "return_type": bool,
        },
        {
            "name": "cir_adjudicated_needles",
            "parameters": {"adjudicated_needles": list, "source": str},
            "return_type": bool,
        },
        {
            "name": "scr_validated_needles",
            "parameters": {"validated_needles": list},
            "return_type": bool,
        },
        {
            "name": "cir_added_suture_pack",
            "parameters": {"suture_pack_info": dict},
            "return_type": bool,
        },
        {
            "name": "scr_confirm_suture_pack",
            "parameters": {"suture_pack_info": dict},
            "return_type": None,
        },
        {
            "name": "confirmed_added",
            "parameters": {"suture_pack_info": dict},
            "return_type": bool,
        },
    ]


class DataStore_item:
    """
    DataStore Parlay interface definition
    """

    id = 200
    name = "Data Store"
    properties = {}
    stream_properties = {}
    commands = [
        {"name": "version", "parameters": {}, "return_type": str},
        {"name": "get_surgeons", "parameters": {}, "return_type": list},
        {"name": "get_hayapp_users_by_role", "parameters": {"role": str}, "return_type": list},
        {"name": "get_room_id", "parameters": {}, "return_type": str},
        {"name": "get_hayapp_users", "parameters": {}, "return_type": list},
        {"name": "get_case_types", "parameters": {}, "return_type": list},
        {
            "name": "get_case_types_for_surgeon",
            "parameters": {"surgeon_id": str},
            "return_type": list,
        },
        {"name": "get_surgeon_by_id", "parameters": {"surgeon_id": str}, "return_type": dict},
        {"name": "get_suture_sheet", "parameters": {"suture_sheet_id": str}, "return_type": dict},
    ]


class HayStackError(Enum):
    LINEAR_MOTOR = 0x01
    ROTATION_MOTOR = 0x02
    HOME_SENSOR = 0x03
    END_SENSOR = 0x04
    CALIBRATION_SENSOR = 0x05
    LINEAR_MOTOR_STALL = 0x06
    ROTATION_MOTOR_STALL = 0x07
    TIMEOUT = 0x08
    INCORRECT_POSITION = 0x09
    STEPPER_IN_MOTION = 0x0A
    DROP_AREA_BTN = 0x0B
    TOWER_CAP_BTN = 0x0C
    # Not defined in protocol from exp
    NOT_READY = 0xFE
    INVAILD_CMD = 0xFF


class HayStack_item:
    """
    HayStack Parlay interface definition
    """

    id = 300
    name = "HayStack"

    properties = [
        {"name": "id", "return_type": str},  # Haystack ID
        {"name": "version", "return_type": str},  # Haystack firmware version
        {"name": "is_connected", "return_type": bool},
        {"name": "last_error", "return_type": int},
        {"name": "needle_number", "return_type": int},
        # Status structure properties
        {"name": "status_change", "return_type": bool},  # Status changed flag
        {"name": "status_tray", "return_type": bool},  # Tray inserted flag
        {"name": "status_ready", "return_type": bool},  # Ready flag
        {"name": "status_magnet_error", "return_type": bool},  # Magnet error flag
        {"name": "status_error", "return_type": bool},  # Error flag
        {"name": "status_error_value", "return_type": int},  # Error value (0-255)
        {"name": "status_btn1_led", "return_type": bool},  # Button 1 LED state
        {"name": "status_btn2_led", "return_type": bool},  # Button 2 LED state
        {"name": "status_btn3_led", "return_type": bool},  # Button 3 LED state
        {"name": "status_btn4_led", "return_type": bool},  # Button 4 LED state
        {"name": "status_hex", "return_type": str},  # Raw status hex string
    ]
    stream_properties = []
    commands = [
        {"name": "connect", "parameters": {"port": str}, "return_type": bool},
        # connect to the haystack device on the specified port
        {"name": "reset_command", "parameters": {"reset_type": str}, "return_type": bool},
        # send message to haystack to perform a reset
        # (SYSTEM, TEST, BATT, BUZZER, BLUETOOTH, BTN_OUTPUT, CONFIG)
        {"name": "set_state", "parameters": {"state": str}, "return_type": bool},
        # state = READY, NOT_READY, TEST
        {"name": "reset_needle_count", "parameters": {}, "return_type": bool},
        # reset the haystack needle counter to 1
        {"name": "set_needle_count", "parameters": {"count": int}, "return_type": bool},
        # set the haystack needle counter to a specific value
        {"name": "imaging_complete", "parameters": {}, "return_type": bool},
        # notify haystack needle image processing is complete
        {"name": "prepare_next_deposit", "parameters": {}, "return_type": bool},
        # after imaging, notify haystack to prepare to receive the next needle
        {
            "name": "set_button_led",
            "parameters": {"led_num": int, "state": str},
            "return_type": bool,
        },
        # set button LED state (led_num: 1-4 or 5 for all LEDs), state: ON or OFF
        {"name": "set_drop_area_led", "parameters": {"state": str}, "return_type": bool},
        # set drop area LED state (state: ON or OFF)
        {"name": "set_illuminator", "parameters": {"state": str}, "return_type": bool},
        # set illuminator state (state: ON or OFF)
        {"name": "get_current_status", "parameters": {}, "return_type": str},
        # get current status information as a string
        {"name": "get_heartbeat_status", "parameters": {}, "return_type": dict},
        # get heartbeat monitoring status
        {
            "name": "set_heartbeat_config",
            "parameters": {"interval": float, "timeout": float},
            "return_type": dict,
        },
        # configure heartbeat monitoring parameters
        {"name": "api_version", "parameters": {}, "return_type": str},
        # get the API version
        {
            "name": "get_camera_calibration",
            "parameters": {"timeout_sec": float},
            "return_type": dict,
        },
        # get camera matrix and distortion coefficients from Haystack
    ]
    events = [
        {"event": "stack_connection", "info": {"event": "connected | disconnected", "id": str}},
        {
            "event": "stack_button",
            "info": {"button": "yes | no | validate | take_action | deposit"},
        },
        # Note: The deposit event should be immediately followed by a [needle,imaging]
        # event. The Haystack automatically moved the needle when the deposit button is pressed.
        {"event": "stack_tray", "info": {"event": "inserted | removed"}},
        # inserted - tray has been inserted
        # removed - tray has been removed
        {"event": "stack_needle", "info": {"event": str, "number": int}},
        # deposit_ready - ready to receive new needle, tray is inserted
        # deposit_no_tray - ready to receive new needle, tray is NOT inserted
        # imaging_ready - needle has been dropped and moved under the camera for imaging
        # moved_to_sharps - imaging completed, moved needle to sharps container
        # Number is the needle number reported. This is only provided with imaging_ready
        #  This can be used to determine if the image number needs to be set.
        {"event": "stack_error", "info": {"error": str}},
        # Note: Each error is reported individually
        # Error Strings:
        #    "LINEAR MOTOR"
        #    "ROTATION MOTOR"
        #    "HOME SENSOR"
        #    "END SENSOR"
        #    "CALIBRATION SENSOR"
        #    "LINEAR MOTOR STALL"
        #    "ROTATION MOTOR STALL"
        #    "TIMEOUT"
        #    "INCORRECT POSITION"
        #    "STEPPER IN MOTION"
        #    "DROP AREA BTN" - deposit button failure
        #    "TOWER CAP BTN" - yes, no, validate or action failed
    ]


class HayStackSimulator_item:
    """
    HayStack Simulator Parlay interface definition
    """

    id = 500
    name = "SimHayStack"
    properties = [
        {"name": "image_num", "return_type": int},  # Current image number
        {"name": "is_ready", "return_type": bool},  # Ready state
        {"name": "is_installed", "return_type": bool},  # Installation state
        {"name": "test_mode", "return_type": bool},  # Test mode flag
        # Status structure properties (inherited from HayStackStatus)
        {"name": "status_change", "return_type": bool},  # Status changed flag
        {"name": "status_tray", "return_type": bool},  # Tray inserted flag
        {"name": "status_ready", "return_type": bool},  # Ready flag
        {"name": "status_magnet_error", "return_type": bool},  # Magnet error flag
        {"name": "status_error", "return_type": bool},  # Error flag
        {"name": "status_error_value", "return_type": int},  # Error value (0-255)
        {"name": "status_btn1_led", "return_type": bool},  # Button 1 LED state
        {"name": "status_btn2_led", "return_type": bool},  # Button 2 LED state
        {"name": "status_btn3_led", "return_type": bool},  # Button 3 LED state
        {"name": "status_btn4_led", "return_type": bool},  # Button 4 LED state
    ]
    stream_properties = []
    commands = [
        {"name": "simulate_button_press", "parameters": {"button": str}, "return_type": None},
        # button - YES, NO, VALIDATE, TAKE_ACTION, DEPOSIT
        {"name": "simulate_tray_event", "parameters": {"event": str}, "return_type": None},
        # event - INSERTED, REMOVED
        {"name": "simulate_error", "parameters": {"error_code": int}, "return_type": None},
        # simulate an error condition with error code (0-255)
        {"name": "get_current_status", "parameters": {}, "return_type": str},
        # get current status information as a string
        {"name": "sim_connect", "parameters": {"sim": str}, "return_type": list},
        # add a simulated port for scan_ports (default sim id: SIM); idempotent per sim id
        {"name": "sim_disconnect", "parameters": {}, "return_type": list},
        # clear simulated ports so scan_ports returns []
    ]


class HayScanner_item:
    """
    HayScanner Parlay interface definition.
    This defines the contract between the Parlay broker (backend) and the
    Android device (client).
    """

    id = 400
    name = "HayScanner"
    properties = {}
    stream_properties = {}

    # --------------------------------------------------------------------------
    # COMMANDS: Sent FROM the Backend TO the Android App
    # --------------------------------------------------------------------------
    # These are actions the backend tells the Android app's UI to perform.
    # Corresponds to status codes 102-106 in the ViewModel.
    commands = {
        "open_data_matrix_scanner": {
            "name": "open_data_matrix_scanner",
            "status_code": 102,
            "parameters": {"mode": str, "timeout": int},
            "return_type": None,
        },
        "open_itrace_scanner": {
            "name": "open_itrace_scanner",
            "status_code": 104,
            "parameters": {"mode": str, "timeout": int},
            "return_type": None,
        },
        "open_camera": {
            "name": "open_camera",
            "status_code": 105,
            "parameters": {"timeout": int},
            "return_type": None,
        },
        "close_active_screen": {
            "name": "close_active_screen",
            "status_code": 103,
            "parameters": {},
            "return_type": None,
        },
        "request_system_info": {
            "name": "request_system_info",
            "status_code": 106,
            "parameters": {},
            "return_type": None,
        },
        "request_disaster_recovery": {
            "name": "request_disaster_recovery",
            "status_code": 107,
            "parameters": {},
            "return_type": None,
        },
        "install_update": {
            "name": "install_update",
            "status_code": 108,
            "parameters": {},
            "return_type": None,
        },
        "synchronize_state": {
            "name": "synchronize_state",
            "status_code": 101,
            "parameters": {
                "scr_relief_count": int,
                "scr_relief_timestamp": str,
                "cir_relief_count": int,
                "cir_relief_timestamp": str,
            },
            "return_type": None,
        },
    }

    # --------------------------------------------------------------------------
    # EVENTS: Sent FROM the Android App TO the Backend
    # --------------------------------------------------------------------------
    # These are notifications the Android app sends back to the backend to
    # report results, errors, or acknowledgements.
    events = [
        # --- Acknowledgement Events ---
        {"event": "ack_open_screen", "info": {"screen_name": str, "status": str}},
        {"event": "ack_close_screen", "info": {"screen_name": str, "status": str}},
        {"event": "ack_sync", "info": {}},
        # --- Update Events ---
        {"event": "update_available", "info": {}},
        {"event": "update_installed", "info": {}},
        # --- Data Result Events ---
        {"event": "scan_result", "info": {"code_type": str, "code_data": str}},
        {"event": "nfc_uid_result", "info": {"uid": str}},
        {
            "event": "camera_result",
            "info": {"image_base64": str, "resolution": str, "size_bytes": int},
        },
        {
            "event": "disaster_recovery_response",
            "info": {
                "scr_relief_count": int,
                "scr_relief_timestamp": str,
                "cir_relief_count": int,
                "cir_relief_timestamp": str,
                "contaminated_count": int,
                "broken_count": int,
                "incompatible_count": int,
                "misplaced_count": int,
                "starting_count": int,
                "added_during_surgery_count": int,
                "remaining_count": int,
                "confirmed_count": int,
                "cir_verification_count": int,
                "cir_adjudication_count": int,
                "cir_readjudication_count": int,
                "scr_validation_count": int,
                "stage": int,
            },
        },
        {
            "event": "system_info_response",
            "info": {
                "app": dict(
                    {
                        "app_version_name": str,
                        "app_version_code": int,  # Using 'int' as it maps to longVersionCode
                        "app_package_name": str,
                    }
                ),
                "operating_system": dict(
                    {
                        "android_os_version": str,
                        "android_sdk_int": int,
                        "android_security_patch": str,
                    }
                ),
                "hardware": dict(
                    {
                        "device_manufacturer": str,
                        "device_model": str,
                        "device_brand": str,
                        "device_board": str,
                    }
                ),
                "language": dict(
                    {
                        "kotlin_stdlib_version": str,
                        "jvm_target": str,
                    }
                ),
                "dependencies": dict(
                    {
                        "open_cv_version": str,
                        "agp_version": str,
                        "kotlin_plugin_version": str,
                        "core_ktx_version": str,
                        "junit_version": str,
                        "junit_ext_version": str,
                        "espresso_core_version": str,
                        "lifecycle_runtime_ktx_version": str,
                        "activity_compose_version": str,
                        "compose_bom_version": str,
                        "navigation_compose_version": str,
                        "camerax_version": str,
                        "accompanist_version": str,
                        "zebra_emdk_version": str,
                    }
                ),
            },
        },
        # --- Error Events ---
        {"event": "scanner_error", "info": {"screen_type": str, "error_string": str}},
        {"event": "camera_error", "info": {"error_string": str}},
        {"event": "navigation_error", "info": {"reason": str}},
        {"event": "timestamp_missing_error", "info": {"error_string": str}},
        {"event": "system_info_error", "info": {"error_string": str}},
        {"event": "disaster_recovery_error", "info": {"error_string": str}},
        {"event": "update_error", "info": {"error_string": str}},
    ]


class DecoderAdapter_item:
    """
    Decoder Adapter Parlay interface definition
    """

    id = 650
    name = "DecoderAdapter"
    properties = [
        {"name": "decode_enabled", "return_type": bool},
        {"name": "auth_key_path", "return_type": str},
        {"name": "decode_flags", "return_type": str},
        {"name": "mark_config_path", "return_type": str},
        {"name": "mark_so_path", "return_type": str},
        {"name": "itrace_path", "return_type": str},
        {"name": "version", "return_type": str},
        {"name": "decoded_mark_count", "return_type": int},
    ]
    stream_properties = []
    commands = [
        {"name": "decode_mark", "parameters": {"image": str}, "return_type": dict},
        {"name": "initialize_decoder", "parameters": {}, "return_type": bool},
    ]


class DetectorAdapter_item:
    """
    Detector Adapter Parlay interface definition
    """

    id = 600
    name = "DetectorAdapter"
    properties = [
        {"name": "detect_enabled", "return_type": bool},
        {"name": "needle_detector_so_path", "return_type": str},
        {"name": "needle_config_path", "return_type": str},
        {"name": "itrace_path", "return_type": str},
        {"name": "version", "return_type": str},
        {"name": "analyzed_count", "return_type": int},
    ]
    stream_properties = []
    commands = [
        {
            "name": "analyze_needle",
            "parameters": {"image": str, "pix_per_mm": float},
            "return_type": dict,
        },
        {
            "name": "analyze_reference_image",
            "parameters": {"image": str, "pix_per_mm": float},
            "return_type": dict,
        },
        {"name": "initialize_detector", "parameters": {}, "return_type": bool},
        {
            "name": "set_reference_image",
            "parameters": {"image": str},
            "return_type": None,
        },
    ]


class Camera_item:
    """
    Camera Parlay interface definition
    """

    id = 700
    name = "Camera"
    properties = [
        {
            "name": "current_exposure",
            "return_type": float,
        },  # Current exposure time, -1 if not set yet
        {"name": "last_image_path", "return_type": str},  # Path to the last image taken
        {"name": "save_images_path", "return_type": str},  # Path where images will be saved to
    ]
    stream_properties = []
    commands = [
        {"name": "take_image", "parameters": {}, "return_type": str},
        # Take a picture with the iTrace camera wrapper, AKA VIR Service
        {"name": "set_exposure", "parameters": {"exposure_value": float}},
        # Set the Exposure in microseconds and returns current exposure
        {
            "name": "write_calibration_to_file",
            "parameters": {"camera_matrix_data": list, "distortion_data": list},
            "return_type": str,
        },
        # write camera calibration to out_camera_data.json in configured directory
    ]


class CloudStore_item:
    """
    CloudStore Parlay interface definition
    """

    id = 800
    name = "CloudStore"
    properties = [
        {"name": "is_online", "return_type": bool},
        {"name": "currently_uploading_pending", "return_type": bool},
    ]
    stream_properties = []
    commands = []


class Timer_item:
    """
    Timer Parlay interface definition
    """

    id = 900
    name = "Timer"
    properties = []
    stream_properties = []
    commands = [
        {"name": "get_last_total_duration", "parameters": {}, "return_type": None},
        {"name": "get_completed_averages", "parameters": {}, "return_type": timedelta},
    ]


class TechSupport_item:
    """
    TechSupport Parlay interface definition
    """

    id = 1000
    name = "TechSupport"
    properties = []
    stream_properties = []
    commands = [
        {"name": "version", "parameters": {}, "return_type": str},
        {
            "name": "tech_support_login",
            "parameters": {"username": str, "password": str},
            "return_type": dict,
        },
        {
            "name": "provision_device",
            "parameters": {"serial_number": str},
            "return_type": dict,
        },
        {
            "name": "is_provisioned",
            "parameters": {},
            "return_type": dict,
        },
        {
            "name": "get_device_serial_number",
            "parameters": {},
            "return_type": dict,
        },
        {
            "name": "sync_group_data",
            "parameters": {},
            "return_type": dict,
        },
    ]


class AllInOne_item:
    """
    AllInOne Parlay interface definition
    """

    id = 1100
    name = "AllInOne"
    properties = [
        {"name": "power_source", "return_type": str},
        {"name": "battery_level", "return_type": int},
        {"name": "storage_available_gb", "return_type": float},
        {"name": "serial_number", "return_type": str},
    ]
    stream_properties = []
    commands = [
        {"name": "get_power_source", "parameters": {}, "return_type": dict},
        {"name": "check_battery_low", "parameters": {}, "return_type": bool},
        {"name": "get_storage_space", "parameters": {}, "return_type": dict},
    ]
