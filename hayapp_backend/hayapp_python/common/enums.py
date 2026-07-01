from enum import Enum, StrEnum


class HayAppRole(Enum):
    Admin = "ADMIN"
    Circulator = "CIR"
    Scrub = "SCR"


class CaseState(Enum):
    NotStarted = "NOT_STARTED"
    Setup = "SETUP"
    Verification = "VERIFICATION"
    InProgress = "IN PROGRESS"
    InterimCount = "INTERIM COUNT"
    ClosingCount = "CLOSING COUNT"
    Closing = "CLOSING"
    FinalCount = "FINAL COUNT"
    Cancelled = "CANCELLED"


class AdjudicationReason(StrEnum):
    Multiple = "multiple"
    Broken = "broken"
    Other = "other"
    Blade = "blade"
    KWire = "k-wire"
    Hypo = "hypo"


class CBIType(StrEnum):
    Contaminated = "contaminated"
    Broken = "broken"
    Incompatible = "incompatible"
    Misplaced = "misplaced"


class CIRScreen(StrEnum):
    """Screen names for CIR role"""

    Dashboard = "cirDashboard"
    SetupScreen = "cirSetupScreen"
    # Setup steps
    SetupScan = "SCAN"
    SetupCbiHandoff = "CBI_HANDOFF"
    SetupWaitTimeout = "WAIT_TIMEOUT"
    SetupTotal = "TOTAL"


class SCRScreen(StrEnum):
    """Screen names for SCR role"""

    ScrDashboardValidateActive = "SCR_DASHBOARD_VALIDATE_ACTIVE"
    ScrDashboardValidateInactive = "SCR_DASHBOARD_VALIDATE_INACTIVE"
    ScrValidation = "SCR_VALIDATION"
    ScrAddedNeedles = "SCR_ADDED_NEEDLES"
    ScrAddedNeedlesWaiting = "SCR_ADDED_NEEDLES_WAITING"
    ScrAddedNeedlesInterim = "SCR_ADDED_NEEDLES_INTERIM"
    ScrActionScreen = "SCR_ACTION_SCREEN"
    ScrActionScreenSterilePrompt = "SCR_ACTION_SCREEN_STERILE_PROMPT"
    ScrActionScreenSterileDepositPrompt = "SCR_ACTION_SCREEN_STERILE_DEPOSIT_PROMPT"
    ScrActionScreenBlankImage = "SCR_ACTION_SCREEN_BLANK_IMAGE"
    ScrAdjudication = "SCR_ADJUDICATION"
    ScrContaminatedNeedles = "SCR_CONTAMINATED_NEEDLES"
    ScrButtonTestYes = "SCR_BUTTON_TEST_YES"
    ScrButtonTestNo = "SCR_BUTTON_TEST_NO"
    ScrButtonTestValidate = "SCR_BUTTON_TEST_VALIDATE"
    ScrButtonTestTakeAction = "SCR_BUTTON_TEST_TAKE_ACTION"
    ScrButtonTestClear = "SCR_BUTTON_TEST_CLEAR"
    ScrConfirmTotal = "SCR_CONFIRM_TOTAL"
    ScrBlankImage = "SCR_BLANK_IMAGE"
    SetupScreen = "scrSetupScreen"
    # Setup steps
    SetupOpen = "OPEN"
    SetupRemoveHaystack = "REMOVE_HAYSTACK"
    SetupVerify = "VERIFY"
    SetupDrape = "DRAPE"
    SetupMount = "MOUNT"
    SetupPlug = "PLUG"
    SetupSelfTest = "SELF_TEST"
    SetupCirWait = "CIR_WAIT"
    SetupHayloft = "HAYLOFT"
    SetupCountTypes = "COUNT_TYPES"
    SetupTotal = "TOTAL"
    SetupConfirmTotal = "CONFIRM_TOTAL"
    SetupWaitTimeout = "WAIT_TIMEOUT"
    SetupCbiHandoff = "CBI_HANDOFF"
    SetupHaytray = "HAYTRAY"
    SetupMismatch = "MISMATCH"
    SetupMismatchConfirm = "MISMATCH_CONFIRM"
