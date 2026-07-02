import React, { useContext, useState, useEffect } from "react";
import styles from "../viewcss/CIRSetupScreen.module.css";
import { TrackingHeader } from "./subview/TrackingHeader";
import { LogoutPopup } from "./subview/LogoutPopUp";
import { useTranslation } from "react-i18next";
import BlackRightArrow from "../img/BlackRightArrow.svg";
import { AppContext } from "./App";
import { SCRSetupSteps, CIRSetupSteps, TotalValidationStatus } from "../defs/enums";
import { CaseSuture, SuturePackInfo } from "../services/CaseService";
import { ScannedPacksList } from "./subview/ScannedPacksList";
import { ConfirmCount } from "./subview/ConfirmCount";
import { TotalCount } from "./subview/TotalCount";
import LoadingIcon from "../img/LoadingIcon.svg";
import PlaceHayBin from "../img/PlaceHayBin.svg";
import ScanWrapperImg from "../img/ScanOpenWrapper.svg";
import InitialCountImg from "../img/InitialCount.svg";
import { useListenable } from "../util/Listenable";
import LogoutIcon from "../img/LogoutIcon.svg";
import { useLogout } from "../hooks/useLogout";
import CIRCBIBox from "../img/CIRCBIBox.svg";
import CIRPrepareHayStack from "../img/CIRPrepareHayStack.svg";
import CIRProcedureKit from "../img/CIRProcedureKit.svg";
import CIRDrapeArm from "../img/CIRDrapeArm.svg";
import CIRMount from "../img/CIRMount.svg";
import CIRPlug from "../img/CIRPlug.svg";
import CIRAssemble from "../img/CIRAssemble.svg";
import WaitHayStack from "../img/WaitHayStack.svg";
import ConnectedHayStack from "../img/ConnectedHayStack.svg";
import FailedHayStack from "../img/FailedHayStack.svg";
import NewHayStack from "../img/NewHayStack.svg";
import NewHayTray from "../img/NewHayTray.svg";
import ToastNotification from "../component/ToastNotification";
import UserLoggedOut from "../img/UserLoggedOut.svg";
import WaitHayTray from "../img/WaitHayTray.svg";
import ConnectedHayTray from "../img/ConnectedHayTray.svg";
import FailedHayTray from "../img/FailedHayTray.svg";
import WaitCompleteHayStack from "../img/WaitCompleteHayStack.svg";
import ProcedureKit from "../img/ProcedureKit.svg";
import { ProcedureKitScanError } from "./subview/ProcedureKitScanError";
import { ProcedureKitVerified as ProcedureKitVerifiedComponent } from "./subview/ProcedureKitVerified";

enum SetupStep {
    Prepare = "prepare",
    Haystack = "haystack",
    Drape = "drape",
    Mount = "mount",
    Plug = "plug",
    SelfTest = "selfTest",
    Connected = "connected",
    Failed = "failed",
    HaytrayWait = "haytrayWait",
    HaytrayTest = "haytrayTest",
    HaytrayConnected = "haytrayConnected",
    HaytrayFailed = "haytrayFailed",
    Assemble = "assemble",
    ReplaceEither = "replaceEither",
    CBIHandoff = "cbiHandoff",
    Scan = "scan",
    PackOverview = "packOverview",
    Pickup = "pickup",
    Start = "start",
    Confirm = "confirm",
    Total = "total",
    SCRConfirm = "scrConfirm",
    ReplaceHaystack = "replaceHaystack",
    HaystackConfirm = "haystackConfirm",
    HaytrayConfirm = "haytrayConfirm",
    ScanNewHayTray = "scanNewHayTray",
    ProcedureKitFailed = "procedureKitFailed",
    ProcedureKitVerified = "procedureKitVerified",
    OpenNewCaseKit = "openNewCaseKit",
}

export const CIRSetupScreen: React.FC<{ startAtStep?: string }> = ({ startAtStep }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    // Determine initial step based on route args or shouldRestartCount flag
    const getInitialStep = () => {
        if (startAtStep === "start" || appContext.caseService.shouldRestartCount.value) {
            return SetupStep.Start;
        }
        // Check if returning to a specific step after logout before Start
        const returnStep = appContext.caseService.returnToCirStep.value;
        if (returnStep && returnStep in SetupStep) {
            return returnStep as SetupStep;
        }
        return SetupStep.Prepare; // change as needed for testing
    };

    const [step, setStep] = useState<SetupStep>(getInitialStep());
    const [prevStep, setPrevStep] = useState<SetupStep | null>(null);
    const [caseSutures, setCaseSutures] = useState<CaseSuture[]>([]);
    const [suturePackInfoMap, setSuturePackInfoMap] = useState<Record<number, SuturePackInfo>>(
        appContext.caseService.suturePackInfoMap.value,
    );
    const [removingPacks, setRemovingPacks] = useState<Set<number>>(new Set());
    const [parlayConnected, setParlayConnected] = useState(appContext.parlayWrapper.isConnected.value);
    const [scannerAuthenticated, setScannerAuthenticated] = useState(appContext.caseService.scannerAuthenticated.value);

    // Track when showing "new procedure" banner
    const showingNewProcedure = useListenable(appContext.caseService.showingNewProcedureOnly);
    const packsBeforeNewProcedure = useListenable(appContext.caseService.packsBeforeNewProcedure);

    // Logout state
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [logoutRole, setLogoutRole] = useState<"CIR" | "SCR" | null>(null);
    const [logoutToastMessage, setLogoutToastMessage] = useState<string | null>(null);

    // Total count confirmation state
    const [confirmedTotal, setConfirmedTotal] = useState<number>(0);
    const [totalCountView, setTotalCountView] = useState<"entry" | "mismatch" | "tooLow" | "tooHigh" | "waiting">(
        "entry",
    );

    // Get current users
    const circulatorUser = useListenable(appContext.caseService.circulator);
    const scrubUser = useListenable(appContext.caseService.scrub);

    const { logout } = useLogout();

    // Clear shouldRestartCount and returnToCirStep flags after using them
    useEffect(() => {
        if (appContext.caseService.shouldRestartCount.value) {
            appContext.caseService.shouldRestartCount.set(false);
        }
        if (appContext.caseService.returnToCirStep.value) {
            appContext.caseService.returnToCirStep.set(null);
        }
    }, []);

    // Track current step in CaseService for surgeon flow coordination
    useEffect(() => {
        appContext.caseService.currentCirStep.set(step);
    }, [step, appContext.caseService]);

    // Subscribe to parlay connection status
    useEffect(() => {
        const handleConnectionChange = (connected: boolean) => {
            setParlayConnected(connected);
        };
        appContext.parlayWrapper.isConnected.addListener(handleConnectionChange);
        return () => {
            appContext.parlayWrapper.isConnected.removeListener(handleConnectionChange);
        };
    }, [appContext.parlayWrapper.isConnected]);

    // Subscribe to scanner authentication status
    useEffect(() => {
        const handleAuthChange = (authenticated: boolean) => {
            setScannerAuthenticated(authenticated);
        };
        appContext.caseService.scannerAuthenticated.addListener(handleAuthChange);
        return () => {
            appContext.caseService.scannerAuthenticated.removeListener(handleAuthChange);
        };
    }, [appContext.caseService.scannerAuthenticated]);

    // Subscribe to caseSutures changes from CaseService
    useEffect(() => {
        const updateCaseSutures = (items: CaseSuture[]) => {
            setCaseSutures((prevSutures) => {
                // Build a map of backend items for quick lookup
                const backendMap = new Map(items.map((s) => [s.fda_guid, s]));

                // Keep existing items that are still in backend (preserving local order), updated with backend data
                const existingItems = prevSutures
                    .filter((s) => backendMap.has(s.fda_guid))
                    .map((s) => backendMap.get(s.fda_guid) as CaseSuture);

                // Collect existing fda_guids to find truly new items
                const existingGuids = new Set(prevSutures.map((s) => s.fda_guid));

                // Add new items from backend that aren't already in local state
                const newItems = items.filter((item) => !existingGuids.has(item.fda_guid));

                return [...newItems, ...existingItems];
            });
        };
        appContext.caseService.caseSutures.addListener(updateCaseSutures);
        return () => {
            appContext.caseService.caseSutures.removeListener(updateCaseSutures);
        };
    }, [appContext.caseService.caseSutures]);

    // Subscribe to suturePackInfoMap changes from CaseService
    useEffect(() => {
        const updatePackInfoMap = (map: Record<number, SuturePackInfo>) => {
            setSuturePackInfoMap(map);
        };
        appContext.caseService.suturePackInfoMap.addListener(updatePackInfoMap);
        return () => {
            appContext.caseService.suturePackInfoMap.removeListener(updatePackInfoMap);
        };
    }, [appContext.caseService.suturePackInfoMap]);

    useEffect(() => {
        // Only listen for scans during Scan and PackOverview steps
        if (step !== SetupStep.Scan && step !== SetupStep.PackOverview) {
            return;
        }

        const handler = () => {
            setStep(SetupStep.PackOverview);
        };
        const unsubscribe = appContext.caseService.parlayInterface.caseManager.suture_pack_scanned(handler);
        return () => {
            unsubscribe();
        };
    }, [step, appContext.caseService.parlayInterface.caseManager]);

    useEffect(() => {
        // Set screen state to let backend know we're in setup
        if (!parlayConnected) {
            return;
        }
        appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirSetupScreen");
    }, [parlayConnected, appContext.caseService.parlayInterface.caseManager]);

    useEffect(() => {
        if (prevStep !== SetupStep.Scan && prevStep !== SetupStep.PackOverview && step === SetupStep.Scan) {
            //TODO: this is not needed but will be keeping it in case we need a demo that starts at the Scan step
            if (!parlayConnected) {
                return;
            }
            if (!scannerAuthenticated) {
                return;
            }

            appContext.caseService.parlayInterface.hayScanner.open_data_matrix_scanner(0, "continuous");
        } else if (
            prevStep !== SetupStep.Scan &&
            prevStep !== SetupStep.PackOverview &&
            step === SetupStep.PackOverview
        ) {
            if (!parlayConnected) {
                return;
            }
            if (!scannerAuthenticated) {
                return;
            }

            appContext.caseService.parlayInterface.hayScanner.open_data_matrix_scanner(0, "continuous");
        } else if (
            prevStep === SetupStep.PackOverview &&
            step !== SetupStep.PackOverview &&
            step !== SetupStep.Scan &&
            parlayConnected
        ) {
            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
        }

        // Track previous step
        setPrevStep(step);
    }, [step, prevStep, parlayConnected, scannerAuthenticated, appContext.caseService.parlayInterface.hayScanner]);

    // Open iTrace scanner for ScanNewHayTray step and advance on successful scan
    useEffect(() => {
        if (step !== SetupStep.ScanNewHayTray || !parlayConnected) return;

        let upArrowCount = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowUp") {
                upArrowCount = 0;
                return;
            }
            upArrowCount++;
            if (upArrowCount >= 2) {
                upArrowCount = 0;
                setStep(SetupStep.ProcedureKitFailed);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        appContext.caseService.parlayInterface.hayScanner.open_itrace_scanner(0, "single").catch((err) => {
            console.error("Failed to open iTrace scanner:", err);
        });

        const unsubscribe = appContext.caseService.parlayInterface.caseManager.itrace_scan_result(() => {
            setStep(SetupStep.ProcedureKitVerified);
        });

        return () => {
            unsubscribe();
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [step, parlayConnected, appContext.caseService.parlayInterface]);

    // Listen for screen change events from backend
    useEffect(() => {
        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = async (event: { screen: string }) => {
            const screenMap: Record<string, SetupStep> = {
                [CIRSetupSteps.CBI_HANDOFF]: SetupStep.CBIHandoff,
                [CIRSetupSteps.REPLACE_EITHER]: SetupStep.ReplaceEither,
                [CIRSetupSteps.SCAN]: SetupStep.Scan,
                [CIRSetupSteps.TOTAL]: SetupStep.Total,
                [CIRSetupSteps.HAYTRAY_CONNECTED]: SetupStep.HaytrayConnected,
                [CIRSetupSteps.HAYTRAY_FAILED]: SetupStep.HaytrayFailed,
            };

            if (screenMap[event.screen]) {
                setStep(screenMap[event.screen]);
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext]);

    // Listen for SCR total confirmation response
    useEffect(() => {
        if (step !== SetupStep.SCRConfirm) return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const unsubscribe = caseManagerDefs.scr_total_confirmation_event(async (data) => {
            if (data.confirmed) {
                if (data.validation_status === TotalValidationStatus.TOO_LOW) {
                    setTotalCountView("tooLow");
                    setStep(SetupStep.Total);
                } else if (data.validation_status === TotalValidationStatus.TOO_HIGH) {
                    setTotalCountView("tooHigh");
                    setStep(SetupStep.Total);
                } else {
                    // Total matches - directly go to stage 2
                    const confirmedTotalValue =
                        await appContext.caseService.parlayInterface.caseManager.get_confirmed_total();
                    appContext.caseService.startingCount.set(confirmedTotalValue);
                    await appContext.caseService.parlayInterface.caseManager.complete_setup();
                    appContext.navigate({ path: "cirDashboard" });
                }
            } else {
                setTotalCountView("mismatch");
                setStep(SetupStep.Total);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [step, confirmedTotal, appContext]);

    // Listen for HayStack connection at Plug step â†’ move to SelfTest
    useEffect(() => {
        if (step !== SetupStep.Plug) return;

        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const unsubscribe = haystackDefs.connection_event((event) => {
            if (event.connected) {
                setStep(SetupStep.SelfTest);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [step, appContext.caseService.parlayInterface.hayStack]);

    // Auto-transition from SelfTest â†’ Connected after 5 seconds
    // (haystack_post_result event listener removed)
    useEffect(() => {
        if (step !== SetupStep.SelfTest) return;

        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        const unsubscribe = haystackDefs.haystack_post_result((result) => {
            const passed = result.vin_pass && result.motor_pass && result.tower_cap_pass && result.rotation_pass;
            if (passed) {
                setStep(SetupStep.Connected);
            } else {
                setStep(SetupStep.Failed);
            }
        });
        return () => {
            unsubscribe();
        };
    }, [step, appContext.caseService.parlayInterface.hayStack]);

    // Auto-transition from Connected (Haystack) to HaytrayWait
    useEffect(() => {
        if (step !== SetupStep.Connected) return;

        const timer = setTimeout(() => {
            setStep(SetupStep.HaytrayWait);
        }, 2000);

        return () => clearTimeout(timer);
    }, [step]);

    // Listen for tray insertion events to transition from HaytrayWait to HaytrayTest
    useEffect(() => {
        if (step !== SetupStep.HaytrayWait) return;

        let upArrowCount = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowUp") {
                upArrowCount = 0;
                return;
            }
            upArrowCount++;
            if (upArrowCount >= 2) {
                upArrowCount = 0;
                setStep(SetupStep.HaytrayFailed);
                if (parlayConnected) {
                    appContext.caseService.parlayInterface.caseManager
                        .set_current_scr_screen(SCRSetupSteps.HAYTRAY_FAILED)
                        .catch((err) => console.error("Failed to send SCR to HaytrayFailed:", err));
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [step, parlayConnected, appContext.caseService.parlayInterface.caseManager]);

    // Listen for tray insertion events to transition from HaytrayWait to HaytrayTest (original)
    useEffect(() => {
        if (step !== SetupStep.HaytrayWait) return;

        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const unsubscribe = haystackDefs.tray_event((event: { event: string }) => {
            const eventName = event.event.toUpperCase();
            if (eventName === "TRAY_INSERTED" || eventName === "INSERTED") {
                setStep(SetupStep.HaytrayTest);
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [step, appContext.caseService.parlayInterface.hayStack]);

    // Auto-transition from HaytrayConnected to Assemble
    useEffect(() => {
        if (step !== SetupStep.HaytrayConnected) return;

        const timer = setTimeout(() => {
            setStep(SetupStep.Assemble);
        }, 2000);

        return () => clearTimeout(timer);
    }, [step]);

    // Listen for SCR completing actuator test to transition to Scan
    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            // When SCR finishes actuator test, CIR should go to Scan
            if (event.screen === SCRSetupSteps.CIR_WAIT && step === SetupStep.ReplaceEither) {
                setStep(SetupStep.Scan);
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [step, appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    const handleStepComplete = async (nextStep: SetupStep, scrScreen?: string) => {
        if (scrScreen) {
            try {
                await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(scrScreen, false);
            } catch (error) {
                console.error("Failed to advance SCR screen:", error);
            }
        }
        setStep(nextStep);
    };

    const renderStep = ({
        titleKey,
        descriptionKey,
        titleKey2,
        buttonText,
        onClick,
        image,
        imageStyle,
        showHeader = true,
        showBack = true,
        showArrow = true,
    }: {
        titleKey: string;
        descriptionKey?: string;
        titleKey2?: string;
        buttonText?: string;
        onClick?: () => void;
        image?: string;
        imageStyle?: React.CSSProperties;
        showHeader?: boolean;
        showBack?: boolean;
        showArrow?: boolean;
    }) => (
        <div className={styles.screenContainer}>
            {showHeader && (
                <TrackingHeader
                    stage={1}
                    title={t("cirSetupScreen.title")}
                    stageColor="rgba(210, 178, 255, 1)"
                    onBack={showBack ? handleBack : undefined}
                    showAbortButton={true}
                    onAbortCase={handleAbortCase}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                    showBadges={true}
                    onCirLogout={() => handleLogoutClick("CIR")}
                    onScrLogout={() => handleLogoutClick("SCR")}
                    onCirLogin={() => handleLoginClick("CIR")}
                    onScrLogin={() => handleLoginClick("SCR")}
                />
            )}
            <div className={styles.innerScreenContainer}>
                <div className={styles.contentContainer}>
                    {image ? <img src={image} alt="" style={imageStyle} /> : <div className={styles.imageContainer} />}
                    <div className={styles.descriptionContainer}>
                        <div className={styles.descriptionTextContainer}>
                            <div className={styles.descriptionLargeText}>{t(titleKey)}</div>
                            {titleKey2 && <div className={styles.descriptionLargeText}>{t(titleKey2)}</div>}
                            {descriptionKey && <div className={styles.descriptionSmallText}>{t(descriptionKey)}</div>}
                        </div>
                    </div>
                    {buttonText && (
                        <button className={styles.button} onClick={onClick}>
                            <span className={styles.buttonText}>{t(buttonText)}</span>
                            {showArrow && <img src={BlackRightArrow} className={styles.buttonArrow} />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderReplace = ({
        titleKey,
        titleKey2,
        buttonText,
        buttonText2,
        onClick,
        onClick2,
        image,
        imageStyle,
    }: {
        titleKey: string;
        titleKey2?: string;
        buttonText?: string;
        onClick?: () => void;
        buttonText2?: string;
        onClick2?: () => void;
        image?: string;
        imageStyle?: React.CSSProperties;
    }) => (
        <div className={styles.screenContainer}>
            <TrackingHeader
                stage={1}
                title={t("cirSetupScreen.title")}
                stageColor="rgba(210, 178, 255, 1)"
                onBack={handleBack}
                showAbortButton={true}
                onAbortCase={handleAbortCase}
                circulatorUser={circulatorUser}
                scrubUser={scrubUser}
                showBadges={true}
                onCirLogout={() => handleLogoutClick("CIR")}
                onScrLogout={() => handleLogoutClick("SCR")}
                onCirLogin={() => handleLoginClick("CIR")}
                onScrLogin={() => handleLoginClick("SCR")}
            />
            <div className={styles.innerScreenContainer}>
                <div className={styles.contentContainer}>
                    {image ? <img src={image} alt="" style={imageStyle} /> : <div className={styles.imageContainer} />}
                    <div className={styles.descriptionContainer}>
                        <div className={styles.descriptionTextContainer}>
                            <div className={styles.descriptionLargeText}>{t(titleKey)}</div>
                            {titleKey2 && <div className={styles.descriptionLargeText}>{t(titleKey2)}</div>}
                        </div>
                    </div>
                    <div className={styles.replaceButtonContainer}>
                        {buttonText && (
                            <button className={styles.replaceButton} onClick={onClick}>
                                <span className={styles.replaceButtonText}>{t(buttonText)}</span>
                            </button>
                        )}
                        {buttonText2 && (
                            <button className={styles.replaceButton} onClick={onClick2}>
                                <span className={styles.replaceButtonText}>{t(buttonText2)}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderInstructions = ({
        instructionTitle,
        step1,
        step2,
        buttonText,
        onButtonClick,
        step3,
        image,
        imageStyle,
        showHeader = true,
        showBack = true,
        showArrow = true,
        showSteps = true,
    }: {
        instructionTitle: string;
        step1?: string;
        step2?: string;
        buttonText: string;
        onButtonClick?: () => void;
        step3?: string;
        image?: string;
        imageStyle?: React.CSSProperties;
        showHeader?: boolean;
        showBack?: boolean;
        showArrow?: boolean;
        showSteps?: boolean;
    }) => (
        <div className={styles.screenContainer}>
            {showHeader && (
                <TrackingHeader
                    stage={1}
                    title={t("cirSetupScreen.title")}
                    stageColor="rgba(210, 178, 255, 1)"
                    onBack={showBack ? handleBack : undefined}
                    showAbortButton={true}
                    onAbortCase={handleAbortCase}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                    showBadges={true}
                    onCirLogout={() => handleLogoutClick("CIR")}
                    onScrLogout={() => handleLogoutClick("SCR")}
                    onCirLogin={() => handleLoginClick("CIR")}
                    onScrLogin={() => handleLoginClick("SCR")}
                />
            )}
            <div className={styles.instructionsContainer}>
                {image ? (
                    <img src={image} alt="" style={imageStyle} />
                ) : (
                    <div className={styles.imageSectionContainer} />
                )}
                <div className={styles.instructionSectionContainer}>
                    <div className={styles.instructionContentContainer}>
                        <span className={styles.instructionTitleText}>{t(instructionTitle)}</span>
                        {showSteps && step1 && (
                            <div className={styles.stepContainer}>
                                <div className={styles.singleStepContainer}>
                                    <div className={styles.stepNumber}>
                                        <span className={styles.stepNumberText}>1</span>
                                    </div>
                                    <span className={styles.instructionStepText}>{t(step1)}</span>
                                </div>
                                <div className={styles.divider} />
                            </div>
                        )}
                        {showSteps && step2 && (
                            <div className={styles.stepContainer}>
                                <div className={styles.singleStepContainer}>
                                    <div className={styles.stepNumber}>
                                        <span className={styles.stepNumberText}>2</span>
                                    </div>
                                    <span className={styles.instructionStepText}>{t(step2)}</span>
                                </div>
                                {step3 && <div className={styles.divider} />}
                            </div>
                        )}
                        {showSteps && step3 && (
                            <div className={styles.stepContainer}>
                                <div className={styles.singleStepContainer}>
                                    <div className={styles.stepNumber}>
                                        <span className={styles.stepNumberText}>3</span>
                                    </div>
                                    <span className={styles.instructionStepText}>{t(step3)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {buttonText && (
                        <div className={styles.buttonContainer}>
                            <button className={styles.button} onClick={onButtonClick}>
                                <span className={styles.buttonText}>{t(buttonText)}</span>
                                {showArrow && <img src={BlackRightArrow} className={styles.buttonArrow} />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderWaitScreen = ({
        waitText,
        buttonText,
        onClick,
        showHeader = true,
        showBack = true,
    }: {
        waitText: string;
        buttonText?: string;
        onClick?: () => void;
        showHeader?: boolean;
        showBack?: boolean;
    }) => (
        <div className={showHeader ? styles.screenContainer : styles.screenContainerNoHeader}>
            {showHeader && (
                <TrackingHeader
                    stage={1}
                    title={t("cirSetupScreen.title")}
                    stageColor="rgba(210, 178, 255, 1)"
                    onBack={showBack ? handleBack : undefined}
                    showAbortButton={true}
                    onAbortCase={handleAbortCase}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                    showBadges={true}
                    onCirLogout={() => handleLogoutClick("CIR")}
                    onScrLogout={() => handleLogoutClick("SCR")}
                    onCirLogin={() => handleLoginClick("CIR")}
                    onScrLogin={() => handleLoginClick("SCR")}
                />
            )}
            <div className={`${styles.waitScreenContainer} ${!showHeader ? styles.waitScreenContainerNoHeader : ""}`}>
                <div className={styles.loadingIcon}>
                    <span className={styles.loadingIconSpinner}>
                        <img src={LoadingIcon} alt="Loading" />
                    </span>
                </div>
                <span className={styles.waitScreenText}>{t(waitText)}</span>
                {buttonText && (
                    <button className={styles.waitButton} onClick={onClick}>
                        <span className={styles.waitButtonText}>{t(buttonText)}</span>
                        <img src={BlackRightArrow} className={styles.buttonArrow} />
                    </button>
                )}
            </div>
        </div>
    );

    const handleLogoutClick = (role: "CIR" | "SCR") => {
        setLogoutRole(role);
        setShowLogoutPopup(true);
    };

    const handleLoginClick = (role: "CIR" | "SCR") => {
        appContext.caseService.reloginRole.set(role);
        appContext.caseService.shouldReturnToCirSetup.set(true);
        appContext.caseService.skipRoleSelection.set(true);
        appContext.navigate({ path: "setup" });
    };

    // Check if we're in the middle of counting
    const isInCountingSteps = () => {
        return step === SetupStep.Confirm || step === SetupStep.Total || step === SetupStep.SCRConfirm;
    };

    const handleConfirmLogout = async () => {
        if (!logoutRole) return;

        const bothLoggedIn = !!(circulatorUser && scrubUser);

        // Capture user info before logout clears it
        const loggedOutUser = logoutRole === "CIR" ? circulatorUser : scrubUser;
        const remainingUser = logoutRole === "CIR" ? scrubUser : circulatorUser;
        const remainingRole = logoutRole === "CIR" ? "SCR" : "CIR";

        // Check if current step is at or after Start
        const isAtOrAfterStart =
            step === SetupStep.Start ||
            step === SetupStep.Confirm ||
            step === SetupStep.Total ||
            step === SetupStep.SCRConfirm;

        // If at or after Start, restart at Start; otherwise, return to current step
        const result = await logout(logoutRole, {
            shouldRestartCount: isAtOrAfterStart,
            shouldNavigateToSetup: true,
            shouldReturnToCirSetup: true,
            skipRoleSelection: true,
        });

        if (result.success) {
            // Store current step for return if before Start
            if (!isAtOrAfterStart) {
                appContext.caseService.returnToCirStep.set(step);
            }

            setShowLogoutPopup(false);
            setLogoutRole(null);

            if (bothLoggedIn && loggedOutUser && remainingUser) {
                setLogoutToastMessage(
                    t("logout.loggedOutNotification", {
                        loggedOutUser: `${loggedOutUser.first_name} ${loggedOutUser.last_name}`,
                        loggedOutRole: logoutRole,
                        remainingUser: `${remainingUser.first_name} ${remainingUser.last_name}`,
                        remainingRole: remainingRole,
                    }),
                );
            }
        }
    };

    const handleAbortCase = async () => {
        try {
            // Close any open scanner screen before aborting
            await appContext.caseService.parlayInterface.hayScanner.close_active_screen();

            // Clear backend state
            await appContext.caseService.parlayInterface.caseManager.reset_haystack();
            await appContext.caseService.parlayInterface.caseManager.clear_case();

            // Reset all frontend state
            appContext.caseService.resetAllState();

            // Navigate back to setup
            appContext.navigate({ path: "setup" });
        } catch (error) {
            console.error("Error aborting case:", error);
        }
    };

    const handleBack = async () => {
        // Define the step flow for back navigation (CIR side)
        const backStepMap: Record<SetupStep, SetupStep | null> = {
            [SetupStep.Prepare]: null,
            [SetupStep.CBIHandoff]: SetupStep.Prepare,
            [SetupStep.Drape]: SetupStep.CBIHandoff,
            [SetupStep.Haystack]: SetupStep.Drape,
            [SetupStep.Mount]: SetupStep.Haystack,
            [SetupStep.Plug]: SetupStep.Mount,
            [SetupStep.SelfTest]: null, // Auto-transitions, no back
            [SetupStep.Connected]: null, // Auto-transitions, no back
            [SetupStep.Failed]: null, // Error state, no back
            [SetupStep.HaytrayWait]: null, // Waiting for SCR, no back
            [SetupStep.HaytrayTest]: null, // Auto-transitions, no back
            [SetupStep.HaytrayConnected]: null, // Auto-transitions, no back
            [SetupStep.HaytrayFailed]: null, // Error state, no back
            [SetupStep.Assemble]: SetupStep.Plug,
            [SetupStep.Scan]: null,
            [SetupStep.PackOverview]: SetupStep.Scan,
            [SetupStep.Pickup]: SetupStep.PackOverview,
            [SetupStep.Start]: SetupStep.Pickup,
            [SetupStep.Confirm]: SetupStep.Start,
            [SetupStep.Total]: SetupStep.Confirm,
            [SetupStep.SCRConfirm]: null,

            [SetupStep.ReplaceHaystack]: null,
            [SetupStep.ReplaceEither]: SetupStep.Assemble,
            [SetupStep.HaystackConfirm]: SetupStep.ReplaceEither,
            [SetupStep.HaytrayConfirm]: SetupStep.ReplaceEither,
            [SetupStep.ScanNewHayTray]: null,
            [SetupStep.ProcedureKitFailed]: SetupStep.ScanNewHayTray,
            [SetupStep.ProcedureKitVerified]: null,
            [SetupStep.OpenNewCaseKit]: null,
        };

        // Define corresponding SCR screen for each CIR back navigation
        const cirToScrBackMap: Record<SetupStep, string | null> = {
            [SetupStep.Prepare]: null,
            [SetupStep.CBIHandoff]: SCRSetupSteps.OPEN,
            [SetupStep.Drape]: SCRSetupSteps.CBI_HANDOFF,
            [SetupStep.Haystack]: SCRSetupSteps.DRAPE,
            [SetupStep.Mount]: SCRSetupSteps.REMOVE_HAYSTACK,
            [SetupStep.Plug]: SCRSetupSteps.MOUNT,
            [SetupStep.SelfTest]: null,
            [SetupStep.Connected]: null,
            [SetupStep.Failed]: null,
            [SetupStep.HaytrayWait]: null,
            [SetupStep.HaytrayTest]: null,
            [SetupStep.HaytrayConnected]: null,
            [SetupStep.HaytrayFailed]: null,
            [SetupStep.Assemble]: SCRSetupSteps.PLUG,
            [SetupStep.Scan]: null,
            [SetupStep.PackOverview]: null,
            [SetupStep.Pickup]: SCRSetupSteps.CIR_WAIT,
            [SetupStep.Start]: null,
            [SetupStep.Confirm]: SCRSetupSteps.HAYLOFT,
            [SetupStep.Total]: null,
            [SetupStep.SCRConfirm]: null,

            [SetupStep.ReplaceHaystack]: null,
            [SetupStep.ReplaceEither]: SCRSetupSteps.ASSEMBLE,
            [SetupStep.HaystackConfirm]: SCRSetupSteps.BACK_FROM_HAYSTACK_CONFIRM,
            [SetupStep.HaytrayConfirm]: null,
            [SetupStep.ScanNewHayTray]: null,
            [SetupStep.ProcedureKitFailed]: null,
            [SetupStep.ProcedureKitVerified]: null,
            [SetupStep.OpenNewCaseKit]: null,
        };

        const previousStep = backStepMap[step];
        const scrBackScreen = cirToScrBackMap[step];

        // Send SCR back to corresponding screen if defined
        if (scrBackScreen && parlayConnected) {
            try {
                await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(scrBackScreen);
            } catch (error) {
                console.error(`Failed to send SCR back to ${scrBackScreen}:`, error);
            }
        }

        // Navigate CIR to previous step
        if (previousStep !== null) {
            setStep(previousStep);
        }
    };

    if (step === SetupStep.PackOverview) {
        return (
            <ScannedPacksList
                caseSutures={caseSutures}
                suturePackInfoMap={suturePackInfoMap}
                showNewProcedureBanner={showingNewProcedure}
                packsBeforeNewProcedure={packsBeforeNewProcedure}
                onRemovePack={async (caseSuture: CaseSuture) => {
                    const fda_guid = caseSuture.fda_guid;

                    // Prevent duplicate removal requests
                    if (removingPacks.has(fda_guid)) {
                        return;
                    }

                    try {
                        setRemovingPacks((prev) => new Set(prev).add(fda_guid));

                        // Remove from backend - it will trigger dashboard update to sync frontend
                        await appContext.caseService.parlayInterface.caseManager.remove_scanned_suture_pack(fda_guid);
                    } catch (error) {
                        console.error("Error removing pack:", error);
                    } finally {
                        setRemovingPacks((prev) => {
                            const newSet = new Set(prev);
                            newSet.delete(fda_guid);
                            return newSet;
                        });
                    }
                }}
                onComplete={async () => {
                    // Close the scanner and proceed to next step
                    try {
                        await appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                        // Notify SCR to advance to HayLoft screen
                        await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(
                            SCRSetupSteps.HAYLOFT,
                            false,
                        );

                        // Reset new procedure flags when moving to pickup step
                        appContext.caseService.showingNewProcedureOnly.set(false);
                        appContext.caseService.packsBeforeNewProcedure.set(0);

                        setStep(SetupStep.Pickup);
                    } catch (error) {
                        console.error("Failed to complete scanning:", error);
                    }
                }}
                onBack={handleBack}
            />
        );
    }

    // When in Confirm step, render ConfirmCount screen
    if (step === SetupStep.Confirm) {
        return (
            <ConfirmCount
                caseSutures={caseSutures}
                suturePackInfoMap={suturePackInfoMap}
                onComplete={async () => {
                    // Notify SCR to move to CountTotal screen
                    await handleStepComplete(SetupStep.Total, SCRSetupSteps.TOTAL);
                }}
                onBack={handleBack}
            />
        );
    }

    if (step === SetupStep.Total) {
        return (
            <TotalCount
                view={totalCountView}
                confirmedTotal={confirmedTotal}
                onAbortCase={handleAbortCase}
                onComplete={async (total: number) => {
                    setConfirmedTotal(total);
                    setTotalCountView("waiting");
                    // Send confirmed total to backend for SCR to display
                    await appContext.caseService.parlayInterface.caseManager.set_confirmed_total(total);
                    handleStepComplete(SetupStep.SCRConfirm, SCRSetupSteps.CONFIRM_TOTAL);
                }}
                onBack={async () => {
                    // Reset view when going back
                    setTotalCountView("entry");
                    setConfirmedTotal(0);

                    await appContext.caseService.parlayInterface.caseManager.restart_count();

                    setStep(SetupStep.Start);

                    await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(
                        SCRSetupSteps.HAYLOFT,
                    );
                }}
                onEnterNewNumber={async () => {
                    // Reset to entry view for CIR
                    setTotalCountView("entry");
                    setConfirmedTotal(0);
                    // Notify SCR to go back to Total step
                    await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(
                        SCRSetupSteps.TOTAL,
                    );
                }}
            />
        );
    }

    return (
        <>
            {step === SetupStep.Prepare &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.prepareTitle",
                    step1: "cirSetupScreen.prepareStep1",
                    step2: "cirSetupScreen.prepareStep2",
                    buttonText: "cirSetupScreen.verified",
                    onButtonClick: () => handleStepComplete(SetupStep.CBIHandoff, SCRSetupSteps.CBI_HANDOFF),
                    image: CIRProcedureKit,
                    imageStyle: { width: "889px", height: "878.5px" },
                    showBack: false,
                })}
            {step === SetupStep.Haystack &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.haystackTitle",
                    step1: "cirSetupScreen.haystackStep1",
                    step2: "cirSetupScreen.haystackStep2",
                    buttonText: "cirSetupScreen.verified",
                    onButtonClick: () => handleStepComplete(SetupStep.Mount, SCRSetupSteps.MOUNT),
                    image: CIRPrepareHayStack,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Drape &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.drapeTitle",
                    step1: "cirSetupScreen.drapeStep1",
                    step2: "cirSetupScreen.drapeStep2",
                    buttonText: "cirSetupScreen.proceed",
                    onButtonClick: () => handleStepComplete(SetupStep.Haystack, SCRSetupSteps.REMOVE_HAYSTACK),
                    step3: "cirSetupScreen.drapeStep3",
                    image: CIRDrapeArm,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Mount &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.mountTitle",
                    step1: "cirSetupScreen.mountStep1",
                    step2: "cirSetupScreen.mountStep2",
                    buttonText: "cirSetupScreen.proceed",
                    onButtonClick: () => handleStepComplete(SetupStep.Plug, SCRSetupSteps.PLUG),
                    step3: "cirSetupScreen.mountStep3",
                    image: CIRMount,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Plug &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.plugTitle",
                    step1: "cirSetupScreen.plugStep1",
                    step2: "cirSetupScreen.plugStep2",
                    buttonText: "Skip →",
                    onButtonClick: () => setStep(SetupStep.SelfTest),
                    step3: "cirSetupScreen.plugStep3",
                    image: CIRPlug,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.SelfTest &&
                renderStep({
                    titleKey: "cirSetupScreen.selfTest",
                    image: WaitHayStack,
                    imageStyle: { width: "1000px", height: "600px" },
                    showBack: false,
                    buttonText: "Skip →",
                    onClick: () => setStep(SetupStep.Connected),
                })}
            {step === SetupStep.Connected &&
                renderStep({
                    titleKey: "cirSetupScreen.connected",
                    image: ConnectedHayStack,
                    imageStyle: { width: "1000px", height: "600px" },
                    showBack: false,
                    buttonText: "Skip →",
                    onClick: () => setStep(SetupStep.HaytrayWait),
                })}
            {step === SetupStep.Failed &&
                renderStep({
                    titleKey: "cirSetupScreen.failed",
                    descriptionKey: "cirSetupScreen.replace",
                    buttonText: "cirSetupScreen.replaceHaystack",
                    onClick: () => handleStepComplete(SetupStep.ReplaceHaystack),
                    image: FailedHayStack,
                    imageStyle: { width: "1000px", height: "600px" },
                    showBack: false,
                })}
            {step === SetupStep.HaytrayWait &&
                renderWaitScreen({
                    waitText: "cirSetupScreen.haytrayWait",
                    showHeader: false,
                    showBack: false,
                    buttonText: "Skip →",
                    onClick: () => setStep(SetupStep.HaytrayTest),
                })}
            {step === SetupStep.HaytrayTest &&
                renderStep({
                    titleKey: "cirSetupScreen.haytrayTest",
                    image: WaitHayTray,
                    imageStyle: { width: "1000px", height: "600px" },
                    showBack: false,
                    buttonText: "Skip →",
                    onClick: () => setStep(SetupStep.HaytrayConnected),
                })}
            {step === SetupStep.HaytrayConnected &&
                renderStep({
                    titleKey: "cirSetupScreen.haytrayConnected",
                    image: ConnectedHayTray,
                    imageStyle: { width: "1000px", height: "600px" },
                    showBack: false,
                    buttonText: "Skip →",
                    onClick: () => setStep(SetupStep.Assemble),
                })}
            {step === SetupStep.HaytrayFailed &&
                renderReplace({
                    titleKey: "cirSetupScreen.hayTrayFailed",
                    buttonText: "cirSetupScreen.replaceHayTray",
                    onClick: () => handleStepComplete(SetupStep.ScanNewHayTray, SCRSetupSteps.WAIT_CIR_SCAN_CASE_KIT),
                    image: FailedHayTray,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.Assemble &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.assemble",
                    buttonText: "cirSetupScreen.proceed",
                    onButtonClick: () => handleStepComplete(SetupStep.ReplaceEither, SCRSetupSteps.BUTTON_TEST),
                    image: CIRAssemble,
                    imageStyle: { width: "889px", height: "878.5px" },
                    showSteps: false,
                })}
            {step === SetupStep.ReplaceHaystack &&
                renderReplace({
                    titleKey: "cirSetupScreen.haystackFailed",
                    buttonText: "cirSetupScreen.replaceHaystack",
                    onClick: () => handleStepComplete(SetupStep.HaystackConfirm),
                    image: FailedHayStack,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.CBIHandoff &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.cbiHandoff",
                    step1: "cirSetupScreen.cbiStep1",
                    step2: "cirSetupScreen.cbiStep2",
                    buttonText: "cirSetupScreen.confirm",
                    onButtonClick: () => handleStepComplete(SetupStep.Drape, SCRSetupSteps.DRAPE),
                    image: CIRCBIBox,
                    imageStyle: { width: "889px", height: "878.5px" },
                    showArrow: false,
                })}
            {step === SetupStep.ReplaceEither &&
                renderReplace({
                    titleKey: "cirSetupScreen.replaceEither",
                    buttonText: "cirSetupScreen.replaceHaystack",
                    onClick: () =>
                        handleStepComplete(SetupStep.HaystackConfirm, SCRSetupSteps.REPLACE_HAYSTACK_DURING_TEST),
                    image: WaitCompleteHayStack,
                    imageStyle: { width: "785px", height: "600px" },
                })}
            {step === SetupStep.HaystackConfirm &&
                renderStep({
                    titleKey: "cirSetupScreen.confirmHaystack",
                    buttonText: "cirSetupScreen.confirm",
                    image: NewHayStack,
                    onClick: () => handleStepComplete(SetupStep.Haystack, SCRSetupSteps.REMOVE_HAYSTACK),
                })}
            {step === SetupStep.HaytrayConfirm &&
                renderStep({
                    titleKey: "cirSetupScreen.confirmHaytray",
                    buttonText: "cirSetupScreen.confirm",
                    image: NewHayTray,
                    onClick: () => handleStepComplete(SetupStep.Prepare, SCRSetupSteps.OPEN),
                    imageStyle: { height: "660px" },
                })}
            {step === SetupStep.ScanNewHayTray &&
                renderStep({
                    image: ProcedureKit,
                    titleKey: "cirSetupScreen.scanNewCaseKit",
                    showBack: false,
                    buttonText: "Skip →",
                    onClick: () => setStep(SetupStep.ProcedureKitVerified),
                })}
            {step === SetupStep.ProcedureKitFailed && (
                <div className={styles.screenContainer}>
                    <ProcedureKitScanError
                        onRescan={() => setStep(SetupStep.ScanNewHayTray)}
                        header={
                            <TrackingHeader
                                stage={1}
                                title={t("cirSetupScreen.title")}
                                stageColor="rgba(210, 178, 255, 1)"
                                onBack={handleBack}
                                showAbortButton={true}
                                onAbortCase={handleAbortCase}
                                circulatorUser={circulatorUser}
                                scrubUser={scrubUser}
                                showBadges={true}
                                onCirLogout={() => handleLogoutClick("CIR")}
                                onScrLogout={() => handleLogoutClick("SCR")}
                                onCirLogin={() => handleLoginClick("CIR")}
                                onScrLogin={() => handleLoginClick("SCR")}
                            />
                        }
                    />
                </div>
            )}
            {step === SetupStep.ProcedureKitVerified && (
                <div className={styles.screenContainer}>
                    <ProcedureKitVerifiedComponent
                        onProceed={() =>
                            handleStepComplete(SetupStep.OpenNewCaseKit, SCRSetupSteps.RETRIEVE_NEW_CASE_KIT)
                        }
                        message={t("cirSetupScreen.scanSuccess")}
                        header={
                            <TrackingHeader
                                stage={1}
                                title={t("cirSetupScreen.title")}
                                stageColor="rgba(210, 178, 255, 1)"
                                showAbortButton={true}
                                onAbortCase={handleAbortCase}
                                circulatorUser={circulatorUser}
                                scrubUser={scrubUser}
                                showBadges={true}
                                onCirLogout={() => handleLogoutClick("CIR")}
                                onScrLogout={() => handleLogoutClick("SCR")}
                                onCirLogin={() => handleLoginClick("CIR")}
                                onScrLogin={() => handleLoginClick("SCR")}
                            />
                        }
                    />
                </div>
            )}
            {step === SetupStep.OpenNewCaseKit &&
                renderInstructions({
                    instructionTitle: "cirSetupScreen.prepareTitle",
                    step1: "cirSetupScreen.prepareStep1",
                    step2: "cirSetupScreen.prepareStep2",
                    buttonText: "cirSetupScreen.verified",
                    onButtonClick: () => handleStepComplete(SetupStep.HaytrayWait, SCRSetupSteps.HAYTRAY),
                    image: CIRProcedureKit,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Scan && (
                <>
                    {renderStep({
                        image: ScanWrapperImg,
                        titleKey: "cirSetupScreen.scanPrompt",
                        showBack: false,
                        buttonText: "Skip →",
                        onClick: () => setStep(SetupStep.Pickup),
                    })}
                    <button
                        className={styles.invisibleCornerButton}
                        onClick={() =>
                            appContext.caseService.parlayInterface.hayScanner.open_data_matrix_scanner(0, "continuous")
                        }
                    />
                </>
            )}
            {step === SetupStep.Pickup &&
                renderStep({
                    image: PlaceHayBin,
                    imageStyle: { width: "1000px", height: "600px" },
                    titleKey: "cirSetupScreen.pickup1",
                    titleKey2: "cirSetupScreen.pickup2",
                    buttonText: "cirSetupScreen.confirmHayLoft",
                    onClick: () => handleStepComplete(SetupStep.Start, SCRSetupSteps.CIR_WAIT_START_COUNT),
                    showArrow: false,
                })}
            {step === SetupStep.Start &&
                renderStep({
                    image: InitialCountImg,
                    titleKey: "cirSetupScreen.initial",
                    buttonText: "cirSetupScreen.startCount",
                    onClick: () => handleStepComplete(SetupStep.Confirm, SCRSetupSteps.COUNT_TYPES),
                    showArrow: false,
                })}
            {step === SetupStep.SCRConfirm &&
                renderWaitScreen({
                    waitText: "cirSetupScreen.waitSCR",
                    showHeader: false,
                    buttonText: "Skip →",
                    onClick: () => setStep(SetupStep.Total),
                })}
            {/* Logout toast notification */}
            {logoutToastMessage && (
                <ToastNotification
                    message={logoutToastMessage}
                    icon={UserLoggedOut}
                    onDismiss={() => setLogoutToastMessage(null)}
                />
            )}

            {/* Logout popup */}
            {showLogoutPopup && logoutRole && (
                <LogoutPopup
                    iconSrc={LogoutIcon}
                    userFirstName={
                        logoutRole === "CIR" ? circulatorUser?.first_name || "" : scrubUser?.first_name || ""
                    }
                    userLastName={logoutRole === "CIR" ? circulatorUser?.last_name || "" : scrubUser?.last_name || ""}
                    role={logoutRole}
                    showTwoRolesMessage={!!(circulatorUser && scrubUser)}
                    showRestartCountMessage={isInCountingSteps()}
                    onConfirm={handleConfirmLogout}
                    cancelButtonText={isInCountingSteps() ? t("logout.backToCount") : undefined}
                    onClose={() => {
                        setShowLogoutPopup(false);
                        setLogoutRole(null);
                    }}
                />
            )}
        </>
    );
};

