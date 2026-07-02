import styles from "../viewcss/SCRSetupScreen.module.css";
import waitingStyles from "../viewcss/SCRWaiting.module.css";
import React, { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import DashboardHeader from "../component/DashboardHeader";
import { ScreenState, SCRSetupSteps, CIRSetupSteps } from "../defs/enums";
import SCRHayStackButton from "../component/SCRHayStackButton";

import BlackCheck from "../img/BlackCheck.svg";
import WhitePlus from "../img/WhitePlus.svg";
import LoadingIcon from "../img/LoadingIcon.svg";
import QuestionMessage from "../img/QuestionMessage.svg";
import PlaceHayBin from "../img/PlaceHayBin.svg";
import CountTotalSCR from "../img/CountTotalSCR.svg";
import CountSingleSCR from "../img/CountSingleSCR.svg";
import WaitHayStack from "../img/WaitHayStack.svg";
import ConnectedHayStack from "../img/ConnectedHayStack.svg";
import FailedHayStack from "../img/FailedHayStack.svg";
import InsertHayTray from "../img/InsertHayTray.svg";
import PressActuators from "../img/PressActuators.svg";
import GoodActuators from "../img/GoodActuators.svg";
import CountMismatch from "../img/CountMismatch.svg";
import SCROpenProcedureKit from "../img/SCROpenProcedureKit.svg";
import SCRRemoveHayStack from "../img/SCRRemoveHayStack.svg";
import SCRDrapeArm from "../img/SCRDrapeArm.svg";
import SCRCBIBox from "../img/SCRCBIBox.svg";
import SCRMount from "../img/SCRMount.svg";
import SCRPlug from "../img/SCRPlug.svg";
import SCRAssemble from "../img/SCRAssemble.svg";
import WaitHayTray from "../img/WaitHayTray.svg";
import ConnectedHayTray from "../img/ConnectedHayTray.svg";
import FailedHayTray from "../img/FailedHayTray.svg";
import CountTotalRecount from "../img/CountTotalRecount.svg";
import ActuatorFailed from "../img/ActuatorFailed.svg";

enum SetupStep {
    Open = "open",
    RemoveHaystack = "removeHaystack",
    Verify = "verify",
    Drape = "drape",
    Mount = "mount",
    Plug = "plug",
    Assemble = "assemble",
    SelfTest = "selfTest",
    Connected = "connected",
    Failed = "failed",
    CBIHandoff = "cbiHandoff",
    Haytray = "haytray",
    HaytrayTest = "haytrayTest",
    HaytrayConnected = "haytrayConnected",
    HaytrayFailed = "haytrayFailed",
    ButtonTest = "buttonTest",
    ActuatorTest = "actuatorTest",
    ButtonTestFailed = "buttonTestFailed",
    ActuatorTestFailed = "actuatorTestFailed",
    Hayloft = "hayloft",
    CIRWait = "cirWait",
    CIRWaitStartCount = "cirWaitStartCount",
    WaitCIRScanCaseKit = "waitCIRScanCaseKit",
    RetrieveNewCaseKit = "retrieveNewCaseKit",
    CountTypes = "countTypes",
    Total = "total",
    ConfirmTotal = "confirmTotal",
    Mismatch = "mismatch",
    MismatchConfirm = "mismatchConfirm",
    TotalRecount = "totalRecount",
}

export const SCRSetupScreen: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [step, setStep] = useState<SetupStep>(SetupStep.Open); // change initial step as needed for testing
    const stepRef = useRef(step);
    stepRef.current = step;
    const [confirmedTotal, setConfirmedTotal] = useState<number>(0);
    const [fieldCount, setFieldCount] = useState<number>(0);
    const [buttonTestState, setButtonTestState] = useState({
        yes: false,
        validate: false,
        action: false,
        no: false,
    });
    const [actuatorTestState, setActuatorTestState] = useState({
        first: false,
        second: false,
    });
    const [isWaitingForSurgeonEdit, setIsWaitingForSurgeonEdit] = useState(false);
    const [previousStep, setPreviousStep] = useState<SetupStep | null>(null);
    const currentConfirmingPack = useListenable(appContext.caseService.currentConfirmingPack);
    const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
    const haystackDefs = appContext.caseService.parlayInterface.hayStack;

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        caseManagerDefs.set_current_scr_screen("scrSetupScreen");
    }, [appContext.parlayWrapper.isConnected.value, caseManagerDefs]);

    // Listen for surgeon editing status changes from CIR
    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value || !caseManagerDefs) return;

        const handler = (event: { editing: boolean }) => {
            if (event.editing) {
                // CIR started editing surgeons - save current step and show waiting screen
                setPreviousStep(step);
                setIsWaitingForSurgeonEdit(true);
            } else {
                // CIR finished editing surgeons - restore previous step
                setIsWaitingForSurgeonEdit(false);
                if (previousStep !== null) {
                    setStep(previousStep);
                    setPreviousStep(null);
                }
            }
        };

        const unsubscribe = caseManagerDefs.surgeon_editing_status_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [caseManagerDefs, step, previousStep, appContext.parlayWrapper.isConnected.value]);

    // Set backend screen state based on which button should be lit
    useEffect(() => {
        if (step !== SetupStep.ButtonTest) return;
        if (!appContext.parlayWrapper.isConnected.value) return;

        const { yes, validate, action, no } = buttonTestState;

        if (!yes) {
            caseManagerDefs.set_current_scr_screen(ScreenState.SCR_BUTTON_TEST_YES);
        } else if (!validate) {
            caseManagerDefs.set_current_scr_screen(ScreenState.SCR_BUTTON_TEST_VALIDATE);
        } else if (!action) {
            caseManagerDefs.set_current_scr_screen(ScreenState.SCR_BUTTON_TEST_TAKE_ACTION);
        } else if (!no) {
            caseManagerDefs.set_current_scr_screen(ScreenState.SCR_BUTTON_TEST_NO);
        } else {
            // All buttons tested, turn off all lights
            caseManagerDefs.set_current_scr_screen(ScreenState.SCR_BUTTON_TEST_CLEAR);
        }
    }, [step, buttonTestState, appContext.parlayWrapper.isConnected.value, caseManagerDefs]);

    // Listen for button presses during button test
    useEffect(() => {
        if (step !== SetupStep.ButtonTest) return;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            setButtonTestState((prev) => {
                switch (event.button) {
                    case "yes":
                        return !prev.yes ? { ...prev, yes: true } : prev;
                    case "validate":
                        return prev.yes && !prev.validate ? { ...prev, validate: true } : prev;
                    case "take_action":
                        return prev.validate && !prev.action ? { ...prev, action: true } : prev;
                    case "no":
                        return prev.action && !prev.no ? { ...prev, no: true } : prev;
                    default:
                        return prev;
                }
            });
        };

        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [step, haystackDefs]);

    // Auto-transition to ActuatorTest after all buttons are tested
    useEffect(() => {
        if (step !== SetupStep.ButtonTest) return;

        const { yes, validate, action, no } = buttonTestState;
        if (yes && validate && action && no) {
            const timer = setTimeout(async () => {
                setStep(SetupStep.ActuatorTest);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [step, buttonTestState, caseManagerDefs]);

    // Listen for deposit button presses during actuator test
    useEffect(() => {
        if (step !== SetupStep.ActuatorTest) return;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            if (event.button === "deposit_1") {
                setActuatorTestState((prev) => ({ ...prev, first: true }));
            } else if (event.button === "deposit_2") {
                setActuatorTestState((prev) => ({ ...prev, second: true }));
            } else if (event.button === "deposit") {
                // Backwards compatibility: older firmware sends "deposit" instead of "deposit_1"/"deposit_2"
                setActuatorTestState((prev) => {
                    if (!prev.first) return { ...prev, first: true };
                    return { ...prev, second: true };
                });
            }
        };

        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [step, haystackDefs]);

    // Auto-transition to CIRWait after both actuator buttons are tested
    useEffect(() => {
        if (step !== SetupStep.ActuatorTest) return;

        const { first, second } = actuatorTestState;
        if (first && second) {
            const timer = setTimeout(async () => {
                setStep(SetupStep.CIRWait);
                await caseManagerDefs.set_current_cir_screen(CIRSetupSteps.SCAN);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [step, actuatorTestState]);

    // Auto-transition from HaytrayConnected to Assemble (to wait for CIR)
    useEffect(() => {
        if (step !== SetupStep.HaytrayConnected) return;

        const timer = setTimeout(() => {
            setStep(SetupStep.Assemble);
        }, 2000);

        return () => clearTimeout(timer);
    }, [step]);

    // Auto-transition from Connected (Haystack) to Haytray
    useEffect(() => {
        if (step !== SetupStep.Connected) return;

        const timer = setTimeout(() => {
            setStep(SetupStep.Haytray);
        }, 2000);

        return () => clearTimeout(timer);
    }, [step]);

    // Listen for button presses during confirm total screen
    useEffect(() => {
        if (step !== SetupStep.ConfirmTotal) return;
        if (!haystackDefs) return;

        const handler = async (event: { button: string }) => {
            if (event.button === "yes") {
                // SCR confirmed the total - backend will validate and send event to CIR
                await caseManagerDefs.scr_confirm_total(true);

                // Check result to determine next step for SCR
                const totalScanned = appContext.caseService.getTotalScannedNeedles();
                const confirmedTotal = await caseManagerDefs.get_confirmed_total();

                if (confirmedTotal === totalScanned) {
                    // Total matches - CIR will complete setup and navigate both to dashboard via complete_setup()
                } else {
                    // Total doesn't match - send SCR to recount
                    setStep(SetupStep.TotalRecount);
                }
            } else if (event.button === "no") {
                // SCR rejected - send event to CIR and go to recount
                await caseManagerDefs.scr_confirm_total(false);
                setStep(SetupStep.TotalRecount);
                console.log("Total count rejected by SCR");
            }
        };

        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [step, haystackDefs, caseManagerDefs, appContext.caseService]);

    // Listen for navigate to dashboard event
    useEffect(() => {
        if (!caseManagerDefs) return;

        const handler = () => {
            // Navigate to SCR dashboard
            appContext.navigate({ path: "scrDashboard" });
        };

        const unsubscribe = caseManagerDefs.navigate_to_dashboard(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.navigate, caseManagerDefs]);

    // Listen for button press on mismatch confirm screen
    useEffect(() => {
        if (step !== SetupStep.MismatchConfirm) return;
        if (!haystackDefs) return;

        const handler = async (event: { button: string }) => {
            if (event.button === "yes") {
                await caseManagerDefs.scr_confirmed_field_count(true);
            } else if (event.button === "no") {
                await caseManagerDefs.scr_confirmed_field_count(false);
            }
        };

        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => unsubscribe();
    }, [step, haystackDefs, caseManagerDefs]);

    // Listen for screen change events from backend
    useEffect(() => {
        if (!caseManagerDefs) return;

        const handler = async (event: { screen: string }) => {
            // Handle replace haystack during test — SCR routes to its own failed screen
            if (event.screen === SCRSetupSteps.REPLACE_HAYSTACK_DURING_TEST) {
                if (stepRef.current === SetupStep.ButtonTest) {
                    setStep(SetupStep.ButtonTestFailed);
                } else if (stepRef.current === SetupStep.ActuatorTest) {
                    setStep(SetupStep.ActuatorTestFailed);
                }
                return;
            }

            // Handle back from HaystackConfirm — SCR returns to corresponding test screen
            if (event.screen === SCRSetupSteps.BACK_FROM_HAYSTACK_CONFIRM) {
                if (stepRef.current === SetupStep.ButtonTestFailed) {
                    setStep(SetupStep.ButtonTest);
                } else if (stepRef.current === SetupStep.ActuatorTestFailed) {
                    setStep(SetupStep.ActuatorTest);
                }
                return;
            }

            const screenMap: Record<string, SetupStep> = {
                [SCRSetupSteps.OPEN]: SetupStep.Open,
                [SCRSetupSteps.REMOVE_HAYSTACK]: SetupStep.RemoveHaystack,
                [SCRSetupSteps.VERIFY]: SetupStep.Verify,
                [SCRSetupSteps.DRAPE]: SetupStep.Drape,
                [SCRSetupSteps.MOUNT]: SetupStep.Mount,
                [SCRSetupSteps.PLUG]: SetupStep.Plug,
                [SCRSetupSteps.ASSEMBLE]: SetupStep.Assemble,
                [SCRSetupSteps.SELF_TEST]: SetupStep.SelfTest,
                [SCRSetupSteps.CIR_WAIT]: SetupStep.CIRWait,
                [SCRSetupSteps.CIR_WAIT_START_COUNT]: SetupStep.CIRWaitStartCount,
                [SCRSetupSteps.WAIT_CIR_SCAN_CASE_KIT]: SetupStep.WaitCIRScanCaseKit,
                [SCRSetupSteps.RETRIEVE_NEW_CASE_KIT]: SetupStep.RetrieveNewCaseKit,
                [SCRSetupSteps.HAYLOFT]: SetupStep.Hayloft,
                [SCRSetupSteps.COUNT_TYPES]: SetupStep.CountTypes,
                [SCRSetupSteps.TOTAL]: SetupStep.Total,
                [SCRSetupSteps.CONFIRM_TOTAL]: SetupStep.ConfirmTotal,
                [SCRSetupSteps.CBI_HANDOFF]: SetupStep.CBIHandoff,
                [SCRSetupSteps.HAYTRAY]: SetupStep.Haytray,
                [SCRSetupSteps.HAYTRAY_FAILED]: SetupStep.HaytrayFailed,
                [SCRSetupSteps.BUTTON_TEST]: SetupStep.ButtonTest,
                [SCRSetupSteps.ACTUATOR_TEST]: SetupStep.ActuatorTest,
                [SCRSetupSteps.MISMATCH]: SetupStep.Mismatch,
                [SCRSetupSteps.MISMATCH_CONFIRM]: SetupStep.MismatchConfirm,
            };

            if (screenMap[event.screen]) {
                const newStep = screenMap[event.screen];

                // When moving from TotalRecount back to ConfirmTotal, CIR has entered a new number
                if (step === SetupStep.TotalRecount && newStep === SetupStep.ConfirmTotal) {
                    // Fetch the new confirmed total from CIR
                    try {
                        const total = await appContext.caseService.parlayInterface.caseManager.get_confirmed_total();
                        setConfirmedTotal(total);
                    } catch (error) {
                        console.error("Failed to get confirmed total:", error);
                    }
                }

                // Fetch confirmed total when entering ConfirmTotal step
                if (newStep === SetupStep.ConfirmTotal) {
                    try {
                        const total = await appContext.caseService.parlayInterface.caseManager.get_confirmed_total();
                        setConfirmedTotal(total);
                    } catch (error) {
                        console.error("Failed to get confirmed total:", error);
                    }
                }

                // Fetch field count when entering MismatchConfirm step
                if (newStep === SetupStep.MismatchConfirm) {
                    try {
                        const count = await appContext.caseService.parlayInterface.caseManager.get_field_count();
                        setFieldCount(count);
                    } catch (error) {
                        console.error("Failed to get field count:", error);
                    }
                }

                // Reset button test state when entering ButtonTest
                if (newStep === SetupStep.ButtonTest) {
                    setButtonTestState({ yes: false, validate: false, action: false, no: false });
                }

                setStep(newStep);
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            unsubscribe();
        };
    }, [caseManagerDefs]);

    // Listen for HayStack connection at Plug step → move to SelfTest
    useEffect(() => {
        if (step !== SetupStep.Plug) return;
        if (!haystackDefs) return;

        const unsubscribe = haystackDefs.connection_event((event) => {
            if (event.connected) {
                setStep(SetupStep.SelfTest);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [step, haystackDefs]);

    // Auto-transition from SelfTest → Connected after 5 seconds
    // (haystack_post_result event listener removed for backwards compatibility)
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

    // Call haytray_test when entering HaytrayTest step and notify CIR of result
    useEffect(() => {
        if (step !== SetupStep.HaytrayTest) return;

        const runTest = async () => {
            try {
                const testPassed = await caseManagerDefs.haytray_test();
                if (testPassed) {
                    setStep(SetupStep.HaytrayConnected);
                    await caseManagerDefs.set_current_cir_screen(CIRSetupSteps.HAYTRAY_CONNECTED);
                } else {
                    setStep(SetupStep.HaytrayFailed);
                    await caseManagerDefs.set_current_cir_screen(CIRSetupSteps.HAYTRAY_FAILED);
                }
            } catch (error) {
                console.error("HayTray test error:", error);
                setStep(SetupStep.HaytrayFailed);
                await caseManagerDefs.set_current_cir_screen(CIRSetupSteps.HAYTRAY_FAILED);
            }
        };

        runTest();
    }, [step, caseManagerDefs]);

    // Listen for tray insertion events
    useEffect(() => {
        if (step !== SetupStep.Haytray) return;
        if (!haystackDefs) return;

        const handler = (event: { event: string }) => {
            const eventName = event.event.toUpperCase();
            if (eventName === "TRAY_INSERTED" || eventName === "INSERTED") {
                setStep(SetupStep.HaytrayTest);
            }
        };

        const unsubscribe = haystackDefs.tray_event(handler);
        return () => {
            unsubscribe();
        };
    }, [step, haystackDefs]);

    const renderStep = ({
        titleKey,
        titleKey2,
        descriptionKey,
        image,
        imageStyle,
        titleParams,
    }: {
        titleKey: string;
        titleKey2?: string;
        descriptionKey?: string;
        image?: string;
        imageStyle?: React.CSSProperties;
        titleParams?: Record<string, string | number>;
    }) => (
        <div className={styles.innerScreenContainer}>
            <div className={styles.contentContainer}>
                {image ? <img src={image} alt="" style={imageStyle} /> : <div className={styles.imageContainer} />}
                <div className={styles.descriptionContainer}>
                    <div className={styles.descriptionTextContainer}>
                        <div className={styles.descriptionLargeText}>
                            {titleParams ? t(titleKey, titleParams) : t(titleKey)}
                        </div>
                        {titleKey2 && <div className={styles.descriptionLargeText}>{t(titleKey2)}</div>}
                        {descriptionKey && (
                            <div className={styles.descriptionSmallText}>
                                {titleParams ? t(descriptionKey, titleParams) : t(descriptionKey)}
                            </div>
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
        step3,
        step4,
        image,
        imageStyle,
    }: {
        instructionTitle: string;
        step1: string;
        step2: string;
        step3?: string;
        step4?: string;
        image?: string;
        imageStyle?: React.CSSProperties;
    }) => (
        <div className={styles.instructionsContainer}>
            {image ? <img src={image} alt="" style={imageStyle} /> : <div className={styles.imageSectionContainer} />}
            <div className={styles.instructionSectionContainer}>
                <div className={styles.instructionContentContainer}>
                    <span className={styles.instructionTitleText}>{t(instructionTitle)}</span>
                    <div className={styles.stepContainer}>
                        <div className={styles.singleStepContainer}>
                            <div className={styles.stepNumber}>
                                <span className={styles.stepNumberText}>1</span>
                            </div>
                            <span className={styles.instructionStepText}>{t(step1)}</span>
                        </div>
                        <div className={styles.divider} />
                    </div>
                    <div className={styles.stepContainer}>
                        <div className={styles.singleStepContainer}>
                            <div className={styles.stepNumber}>
                                <span className={styles.stepNumberText}>2</span>
                            </div>
                            <span className={styles.instructionStepText}>{t(step2)}</span>
                        </div>
                        {step3 && <div className={styles.divider} />}
                    </div>
                    {step3 && (
                        <div className={styles.stepContainer}>
                            <div className={styles.singleStepContainer}>
                                <div className={styles.stepNumber}>
                                    <span className={styles.stepNumberText}>3</span>
                                </div>
                                <span className={styles.instructionStepText}>{t(step3)}</span>
                            </div>
                            {step4 && <div className={styles.divider} />}
                        </div>
                    )}
                    {step4 && (
                        <div className={styles.stepContainer}>
                            <div className={styles.singleStepContainer}>
                                <div className={styles.stepNumber}>
                                    <span className={styles.stepNumberText}>4</span>
                                </div>
                                <span className={styles.instructionStepText}>{t(step4)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderButtonTestScreen = () => (
        <div className={styles.bigInnerContainer}>
            <div className={styles.buttonTestInnerContainer}>
                <div className={styles.haystackButtonContainer}>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="yes"
                            active={buttonTestState.yes}
                            circleClassName={buttonTestState.yes ? styles.yesColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.yes && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="validate"
                            active={buttonTestState.validate}
                            circleClassName={buttonTestState.validate ? styles.validateColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.validate && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="action"
                            active={buttonTestState.action}
                            circleClassName={buttonTestState.action ? styles.actionColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.action && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="no"
                            active={buttonTestState.no}
                            circleClassName={buttonTestState.no ? styles.noColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.no && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.buttonTestTextContainer}>
                    <span className={styles.buttonTestText}>{t("scrSetupScreen.buttonTest")}</span>
                </div>
            </div>
        </div>
    );

    const renderButtonTestFailedScreen = () => (
        <div className={styles.bigInnerContainer}>
            <div className={styles.buttonTestInnerContainer}>
                <div className={styles.haystackButtonContainer}>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="yes"
                            active={buttonTestState.yes}
                            circleClassName={buttonTestState.yes ? styles.yesColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.yes && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="validate"
                            active={buttonTestState.validate}
                            circleClassName={buttonTestState.validate ? styles.validateColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.validate && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="action"
                            active={buttonTestState.action}
                            circleClassName={buttonTestState.action ? styles.actionColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.action && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonWrapper}>
                        <SCRHayStackButton
                            type="no"
                            active={buttonTestState.no}
                            circleClassName={buttonTestState.no ? styles.noColor : styles.grayCircle}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        {buttonTestState.no && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.buttonTestTextContainer}>
                    <span className={styles.buttonTestText} style={{ whiteSpace: "pre-line" }}>
                        {t("scrSetupScreen.buttonTestFailed")}
                    </span>
                </div>
            </div>
        </div>
    );

    const renderActuatorTestScreen = () => {
        const bothPressed = actuatorTestState.first && actuatorTestState.second;
        const actuatorImage = bothPressed ? GoodActuators : PressActuators;

        return (
            <div className={styles.actuatorScreenContainer}>
                <img src={actuatorImage} alt="Actuators" style={{ width: "1000px", height: "600px" }} />
                <div className={styles.actuatorButtonContainer}>
                    <div className={styles.actuatorButtonContent}>
                        <div className={styles.buttonWrapper}>
                            <div className={actuatorTestState.first ? styles.litActuatorButton : styles.actuatorButton}>
                                <img src={WhitePlus} alt="Plus" className={styles.actuatorPlusIcon} />
                            </div>
                            {actuatorTestState.first && (
                                <div className={styles.checkmarkContainer}>
                                    <div className={styles.checkmarkCircle}>
                                        <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.buttonWrapper}>
                            <div
                                className={actuatorTestState.second ? styles.litActuatorButton : styles.actuatorButton}
                            >
                                <img src={WhitePlus} alt="Plus" className={styles.actuatorPlusIcon} />
                            </div>
                            {actuatorTestState.second && (
                                <div className={styles.checkmarkContainer}>
                                    <div className={styles.checkmarkCircle}>
                                        <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles.actuatorTextContainer}>
                        <span className={styles.actuatorText}>{t("scrSetupScreen.actuatorTest")}</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderActuatorTestFailedScreen = () => (
        <div className={styles.actuatorScreenContainer}>
            <img src={ActuatorFailed} alt="Actuator Failed" style={{ width: "1000px", height: "600px" }} />
            <div className={styles.actuatorButtonContainer}>
                <div className={styles.actuatorButtonContent}>
                    <div className={styles.buttonWrapper}>
                        <div className={actuatorTestState.first ? styles.litActuatorButton : styles.actuatorButton}>
                            <img src={WhitePlus} alt="Plus" className={styles.actuatorPlusIcon} />
                        </div>
                        {actuatorTestState.first && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonWrapper}>
                        <div className={actuatorTestState.second ? styles.litActuatorButton : styles.actuatorButton}>
                            <img src={WhitePlus} alt="Plus" className={styles.actuatorPlusIcon} />
                        </div>
                        {actuatorTestState.second && (
                            <div className={styles.checkmarkContainer}>
                                <div className={styles.checkmarkCircle}>
                                    <img src={BlackCheck} alt="Checked" className={styles.checkmark} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.actuatorTextContainer}>
                    <span className={styles.actuatorText}>{t("scrSetupScreen.actuatorTestFailed")}</span>
                </div>
            </div>
        </div>
    );

    const renderWaitScreen = ({
        waitTextOne,
        waitTextTwo,
        waitTextThree,
    }: {
        waitTextOne: string;
        waitTextTwo?: string;
        waitTextThree?: string;
    }) => (
        <div className={styles.waitScreenContainer}>
            <div className={styles.loadingIcon}>
                <span className={styles.loadingIconSpinner}>
                    <img src={LoadingIcon} alt="Loading" />
                </span>
            </div>
            <span className={styles.waitScreenText}>{t(waitTextOne)}</span>
            {waitTextTwo && <span className={styles.waitScreenText}>{t(waitTextTwo)}</span>}
            {waitTextThree && <span className={styles.waitScreenText}>{t(waitTextThree)}</span>}
        </div>
    );

    const renderMismatchConfirmScreen = () => {
        // Get suture pack info for the current confirming pack
        const suturePackInfo = currentConfirmingPack
            ? appContext.caseService.suturePackInfoMap.value[currentConfirmingPack.fda_guid]
            : null;

        return (
            <div className={styles.splitContentContainer}>
                <div className={styles.packInfoContainer}>
                    <div className={styles.packBackground}>
                        {suturePackInfo?.image && (
                            <img
                                src={`http://localhost:8080/suture_pack_images/${suturePackInfo.image}`}
                                alt="Suture Pack"
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                        )}
                    </div>
                    <div className={styles.packInfoTable}>
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrSetupScreen.needlesPerPack")}:</span>
                            <span className={styles.packInfoValue}>
                                {currentConfirmingPack?.needles_per_pack || ""}
                            </span>
                        </div>
                        <div className={styles.tableDivider} />
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrSetupScreen.size")}:</span>
                            <span className={styles.packInfoValue}>{suturePackInfo?.suture_gauge || ""}</span>
                        </div>
                        <div className={styles.tableDivider} />
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrSetupScreen.sutureType")}:</span>
                            <span className={styles.packInfoValue}>{suturePackInfo?.suture_type || ""}</span>
                        </div>
                        <div className={styles.tableDivider} />
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrSetupScreen.needleName")}:</span>
                            <span className={styles.packInfoValue}>{suturePackInfo?.needle_name || ""}</span>
                        </div>
                    </div>
                </div>
                <div className={styles.controlsContainer}>
                    <div className={styles.controlsContentContainer}>
                        <div className={styles.numberContainer}>
                            <span className={styles.numberText}>{fieldCount}</span>
                        </div>
                        <span className={styles.confirmMismatchText}>
                            {t("scrSetupScreen.mismatchConfirmQuestion")}
                        </span>
                        <div className={styles.haystackButtonContainer}>
                            <SCRHayStackButton
                                type="yes"
                                active
                                title={t("scrSetupScreen.yes")}
                                circleClassName={styles.yesColor}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                            />
                            <SCRHayStackButton
                                type="validate"
                                circleClassName={styles.grayCircle}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                            />
                            <SCRHayStackButton
                                type="action"
                                circleClassName={styles.grayCircle}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                            />
                            <SCRHayStackButton
                                type="no"
                                active
                                title={t("scrSetupScreen.no")}
                                circleClassName={styles.noColor}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderConfirmTotalScreen = () => (
        <div className={styles.confirmCountContainer}>
            <img src={QuestionMessage} alt="Question" className={styles.confirmIcon} />
            <div className={styles.confirmContent}>
                <div className={styles.confirmTextContainer}>
                    <span className={styles.confirmText}>
                        {t("scrSetupScreen.confirmTotal1")} {confirmedTotal}
                        <span className={styles.confirmText}>{t("scrSetupScreen.confirmTotal2")}</span>
                    </span>
                </div>
                <div className={styles.haystackButtonContainer}>
                    <SCRHayStackButton
                        type="yes"
                        active
                        title={t("scrSetupScreen.yes")}
                        circleClassName={styles.yesColor}
                        textClassName={styles.buttonText}
                        imageClassName={styles.haystackButtonIcon}
                    />
                    <SCRHayStackButton
                        type="validate"
                        circleClassName={styles.grayCircle}
                        textClassName={styles.buttonText}
                        imageClassName={styles.haystackButtonIcon}
                    />
                    <SCRHayStackButton
                        type="action"
                        circleClassName={styles.grayCircle}
                        textClassName={styles.buttonText}
                        imageClassName={styles.haystackButtonIcon}
                    />
                    <SCRHayStackButton
                        type="no"
                        active
                        title={t("scrSetupScreen.no")}
                        circleClassName={styles.noColor}
                        textClassName={styles.buttonText}
                        imageClassName={styles.haystackButtonIcon}
                    />
                </div>
            </div>
        </div>
    );

    // Show waiting screen when CIR is editing surgeons
    if (isWaitingForSurgeonEdit) {
        return (
            <div className={waitingStyles.screenContainer}>
                <div className={waitingStyles.waitContainer}>
                    <div className={waitingStyles.loadingIcon}>
                        <span className={waitingStyles.loadingIconSpinner}>
                            <img src={LoadingIcon} alt="Loading" />
                        </span>
                    </div>
                    <span className={waitingStyles.loginText}>{t("scrSetupScreen.waitForSurgeonEdit")}</span>
                </div>
            </div>
        );
    }

    // Bypass map: every step that waits for CIR broadcast or hardware → next step
    const bypassStepMap: Partial<Record<SetupStep, SetupStep>> = {
        // Instruction steps (CIR-driven, no SCR button)
        [SetupStep.Open]:                SetupStep.CBIHandoff,
        [SetupStep.CBIHandoff]:          SetupStep.RemoveHaystack,
        [SetupStep.RemoveHaystack]:      SetupStep.Verify,
        [SetupStep.Verify]:              SetupStep.Drape,
        [SetupStep.Drape]:               SetupStep.Mount,
        [SetupStep.Mount]:               SetupStep.Plug,
        [SetupStep.Plug]:                SetupStep.Assemble,
        [SetupStep.Assemble]:            SetupStep.SelfTest,
        // Hardware-waiting steps
        [SetupStep.SelfTest]:            SetupStep.ButtonTest,
        [SetupStep.ButtonTest]:          SetupStep.ActuatorTest,
        [SetupStep.ButtonTestFailed]:    SetupStep.ButtonTest,
        [SetupStep.Connected]:           SetupStep.Haytray,
        [SetupStep.Failed]:              SetupStep.SelfTest,
        [SetupStep.Haytray]:             SetupStep.HaytrayTest,
        [SetupStep.HaytrayTest]:         SetupStep.HaytrayConnected,
        [SetupStep.HaytrayConnected]:    SetupStep.Assemble,
        [SetupStep.HaytrayFailed]:       SetupStep.HaytrayTest,
        [SetupStep.WaitCIRScanCaseKit]:  SetupStep.RetrieveNewCaseKit,
        [SetupStep.RetrieveNewCaseKit]:  SetupStep.ActuatorTest,
        [SetupStep.ActuatorTest]:        SetupStep.CIRWait,
        [SetupStep.ActuatorTestFailed]:  SetupStep.ActuatorTest,
        [SetupStep.CIRWait]:             SetupStep.CIRWaitStartCount,
        [SetupStep.CIRWaitStartCount]:   SetupStep.Hayloft,
        [SetupStep.Hayloft]:             SetupStep.CountTypes,
        [SetupStep.CountTypes]:          SetupStep.Total,
        [SetupStep.Total]:               SetupStep.ConfirmTotal,
        [SetupStep.Mismatch]:            SetupStep.MismatchConfirm,
        [SetupStep.TotalRecount]:        SetupStep.ConfirmTotal,
    };

    const handleBypassClick = () => {
        // ConfirmTotal ends setup — navigate to SCR dashboard
        if (step === SetupStep.ConfirmTotal || step === SetupStep.MismatchConfirm) {
            appContext.navigate({ path: "scrDashboard" });
            return;
        }
        const next = bypassStepMap[step];
        if (next) setStep(next);
    };

    const showBypassButton = step in bypassStepMap ||
        step === SetupStep.ConfirmTotal ||
        step === SetupStep.MismatchConfirm;

    return (
        <div className={styles.screenContainer}>
            {showBypassButton && (
                <button
                    onClick={handleBypassClick}
                    style={{
                        position: "fixed", bottom: "32px", right: "32px", zIndex: 9999,
                        background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                        borderRadius: "8px", color: "rgba(255,255,255,0.6)", fontSize: "13px",
                        padding: "8px 16px", cursor: "pointer",
                    }}
                >
                    Skip →
                </button>
            )}
            <DashboardHeader
                title={step === SetupStep.MismatchConfirm ? "Add Suture Needles" : t("scrSetupScreen.title")}
                showLit={false}
                showPadding={true}
                showStageTracker={step !== SetupStep.MismatchConfirm}
                showInfoBar={step !== SetupStep.MismatchConfirm}
            />
            {step === SetupStep.Open &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.openKit",
                    step1: "scrSetupScreen.openKitStep1",
                    step2: "scrSetupScreen.openKitStep2",
                    step3: "scrSetupScreen.openKitStep3",
                    image: SCROpenProcedureKit,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.CBIHandoff &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.cbiHandoff",
                    step1: "scrSetupScreen.cbiHandoffStep1",
                    step2: "scrSetupScreen.cbiHandoffStep2",
                    image: SCRCBIBox,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.RemoveHaystack &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.removeHaystack",
                    step1: "scrSetupScreen.removeHayStackStep1",
                    step2: "scrSetupScreen.removeHayStackStep2",
                    step3: "scrSetupScreen.removeHayStackStep3",
                    image: SCRRemoveHayStack,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Verify && renderStep({ titleKey: "scrSetupScreen.verify" })}
            {step === SetupStep.Drape &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.drapeArm",
                    step1: "scrSetupScreen.drapeArmStep1",
                    step2: "scrSetupScreen.drapeArmStep2",
                    step3: "scrSetupScreen.drapeArmStep3",
                    image: SCRDrapeArm,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Mount &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.mountHaystack",
                    step1: "scrSetupScreen.mountHaystackStep1",
                    step2: "scrSetupScreen.mountHaystackStep2",
                    step3: "scrSetupScreen.mountHaystackStep3",
                    image: SCRMount,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Plug &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.plugHaystack",
                    step1: "scrSetupScreen.plugHayStackStep1",
                    step2: "scrSetupScreen.plugHayStackStep2",
                    step3: "scrSetupScreen.plugHayStackStep3",
                    image: SCRPlug,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.Assemble &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.assemble",
                    step1: "scrSetupScreen.assembleStep1",
                    step2: "scrSetupScreen.assembleStep2",
                    step3: "scrSetupScreen.assembleStep3",
                    step4: "scrSetupScreen.assembleStep4",
                    image: SCRAssemble,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.SelfTest &&
                renderStep({
                    titleKey: "scrSetupScreen.selfTest",
                    image: WaitHayStack,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.ButtonTest && renderButtonTestScreen()}
            {step === SetupStep.ButtonTestFailed && renderButtonTestFailedScreen()}
            {step === SetupStep.Connected &&
                renderStep({
                    titleKey: "scrSetupScreen.connected",
                    image: ConnectedHayStack,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.Failed &&
                renderStep({
                    titleKey: "scrSetupScreen.failed",
                    titleKey2: "scrSetupScreen.replace",
                    image: FailedHayStack,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.Haytray &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.insertHaytray",
                    step1: "scrSetupScreen.insertHaytrayStep1",
                    step2: "scrSetupScreen.insertHaytrayStep2",
                    step3: "scrSetupScreen.insertHaytrayStep3",
                    step4: "scrSetupScreen.insertHaytrayStep4",
                    image: InsertHayTray,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.HaytrayTest &&
                renderStep({
                    titleKey: "scrSetupScreen.haytrayTest",
                    image: WaitHayTray,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.HaytrayConnected &&
                renderStep({
                    titleKey: "scrSetupScreen.haytrayConnected",
                    image: ConnectedHayTray,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.HaytrayFailed &&
                renderStep({
                    titleKey: "scrSetupScreen.haytrayFailed",
                    titleKey2: "scrSetupScreen.haytrayReplace",
                    image: FailedHayTray,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.WaitCIRScanCaseKit &&
                renderWaitScreen({
                    waitTextOne: "scrSetupScreen.waitNewHayTray",
                })}
            {step === SetupStep.RetrieveNewCaseKit &&
                renderInstructions({
                    instructionTitle: "scrSetupScreen.openKit",
                    step1: "scrSetupScreen.openKitStep1",
                    step2: "scrSetupScreen.openKitStep2",
                    image: SCROpenProcedureKit,
                    imageStyle: { width: "889px", height: "878.5px" },
                })}
            {step === SetupStep.ActuatorTest && renderActuatorTestScreen()}
            {step === SetupStep.ActuatorTestFailed && renderActuatorTestFailedScreen()}
            {step === SetupStep.CIRWait &&
                renderWaitScreen({
                    waitTextOne: "scrSetupScreen.wait1",
                })}
            {step === SetupStep.CIRWaitStartCount &&
                renderWaitScreen({
                    waitTextOne: "scrSetupScreen.waitStartCount",
                })}
            {step === SetupStep.Hayloft &&
                renderStep({
                    titleKey: "scrSetupScreen.hayloftInstructions",
                    titleKey2: "scrSetupScreen.hayloftInstructions2",
                    image: PlaceHayBin,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.CountTypes &&
                renderStep({
                    titleKey: "scrSetupScreen.countTypes1",
                    titleKey2: "scrSetupScreen.countTypes2",
                    image: CountSingleSCR,
                    imageStyle: { width: "1000px", height: "600px" },
                    titleParams: currentConfirmingPack
                        ? { nomenclature: currentConfirmingPack.nomenclature }
                        : { nomenclature: "" },
                })}
            {step === SetupStep.Total &&
                renderStep({
                    titleKey: "scrSetupScreen.countTotal1",
                    titleKey2: "scrSetupScreen.countTotal2",
                    image: CountTotalSCR,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.ConfirmTotal && renderConfirmTotalScreen()}
            {step === SetupStep.Mismatch &&
                renderStep({
                    titleKey: "scrSetupScreen.countMismatch",
                    descriptionKey: "scrSetupScreen.noneFound",
                    titleParams: currentConfirmingPack
                        ? { nomenclature: currentConfirmingPack.nomenclature }
                        : { nomenclature: "" },
                    image: CountMismatch,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
            {step === SetupStep.MismatchConfirm && renderMismatchConfirmScreen()}
            {step === SetupStep.TotalRecount &&
                renderStep({
                    titleKey: "scrSetupScreen.recount1",
                    titleKey2: "scrSetupScreen.recount2",
                    image: CountTotalRecount,
                    imageStyle: { width: "1000px", height: "600px" },
                })}
        </div>
    );
};
