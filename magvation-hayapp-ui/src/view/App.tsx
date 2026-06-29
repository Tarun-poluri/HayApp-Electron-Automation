import { createContext, useContext, useEffect, useState } from "react";
import { ParlayWrapper } from "../services/ParlayWrapper";
import StaffService, { HayAppUserType } from "../services/StaffService";
import i18n from "../locales/i18n";
import { Setup } from "./Setup";
import HayScanService from "../services/HayScanService";
import CaseService from "../services/CaseService";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { CIRDashboard } from "./CIRDashboard";
import { CIRVerification } from "./CIRVerification";
import CIRAdjudicationScreen from "./CIRAdjudicationScreen";
import CIRCBINeedlesScreen from "./CIRCBINeedlesScreen";
import RemoveFromCBI from "./RemoveFromCBI";
import { SCRSetupScreen } from "./SCRSetupScreen";
import { SCRDashboard } from "./SCRDashboard";
import { SCRValidation } from "./SCRValidation";
import { CIRAddedNeedles } from "./CIRAddedNeedles";
import { SCRAddedNeedles } from "./SCRAddedNeedles";
import { SCRActionScreen } from "./SCRActionScreen";
import { useListenable } from "../util/Listenable";
import { CIRSetupScreen } from "./CIRSetupScreen";
import { SCRWaiting } from "./SCRWaiting";
import { CIRClosingCount } from "./CIRClosingCount";
import { CIRInterimCount } from "./CIRInterimCount";
import { SCRClosingCount } from "./SCRClosingCount";
import { SCRInterimCount } from "./SCRInterimCount";
import { ErrorPopup } from "./subview/ErrorPopup";
import { TechSupportLogin } from "./TechSupportLogin";
import { Provision } from "./Provision";
import WarningIcon from "../img/Warning.svg";
import { BlankImageScreen } from "./BlankImageScreen";
import "../viewcss/default.css";
import { SurgeonsViewProvider, useSurgeonsView } from "../contexts/SurgeonsViewContext";
import { SurgeonFlowOverlay } from "./subview/SurgeonFlowOverlay";
import ToastNotification from "../component/ToastNotification";

export interface iNavPaths {
    setup: string;
    cirCbiNeedles: string;
    cirCbiNeedlesReAdjudication: string;
    cirIncompatibleNeedles: string;
    cirBrokenNeedles: string;
    cirMisplacedNeedles: string;
    cirCbiSelectType: string;
    cirDashboard: string;
    cirVerification: string;
    cirAdjudication: string;
    scrDashboard: string;
    scrValidation: string;
    cirAddedNeedles: string;
    scrAddedNeedles: string;
    scrActionScreen: string;
    scrSetupScreen: string;
    cirSetupScreen: string;
    cirClosingCount: string;
    cirInterimCount: string;
    scrClosingCount: string;
    scrInterimCount: string;
    scrWaiting: string;
    techSupportLogin: string;
    provision: string;
    blankImageScreen: string;
    removeFromCBI: string;
}

export const NavPath: iNavPaths = {
    setup: "/setup",
    cirDashboard: "/cirDashboard",
    cirVerification: "/cirVerification",
    cirAdjudication: "/cirAdjudication",
    cirCbiNeedles: "/cirCbiNeedles",
    cirCbiNeedlesReAdjudication: "/cirCbiNeedlesReAdjudication",
    cirIncompatibleNeedles: "/cirIncompatibleNeedles",
    cirBrokenNeedles: "/cirBrokenNeedles",
    cirMisplacedNeedles: "/cirMisplacedNeedles",
    cirCbiSelectType: "/cirCbiSelectType",
    scrDashboard: "/scrDashboard",
    scrValidation: "/scrValidation",
    cirAddedNeedles: "/cirAddedNeedles",
    scrAddedNeedles: "/scrAddedNeedles",
    scrActionScreen: "/scrActionScreen",
    scrSetupScreen: "/scrSetupScreen",
    cirSetupScreen: "/cirSetupScreen",
    cirClosingCount: "/cirClosingCount",
    cirInterimCount: "/cirInterimCount",
    scrClosingCount: "/scrClosingCount",
    scrInterimCount: "/scrInterimCount",
    removeFromCBI: "/removeFromCBI",
    scrWaiting: "/scrWaiting",
    techSupportLogin: "/techSupportLogin",
    provision: "/provision",
    blankImageScreen: "/blankImageScreen",
};

export interface RouteProps {
    path: keyof iNavPaths;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any;
}

export interface AppContextProps {
    navigate: (newRoute: RouteProps) => void;
    route: RouteProps;
    parlayWrapper: ParlayWrapper;
    staffService: StaffService;
    hayscanService: HayScanService;
    caseService: CaseService;
    translate: TFunction<"translation", undefined> | undefined;
    loginStep?: "CIR" | "SCR" | "DONE";
    setLoginStep?: (step: "CIR" | "SCR" | "DONE") => void;
    role: "CIR" | "SCR" | null;
}

//global context that holds the main navigator and parlay data services
const defaultContext: AppContextProps = {
    navigate: () => {},
    route: { path: "setup" },
    parlayWrapper: ParlayWrapper.instance,
    staffService: StaffService.instance,
    hayscanService: HayScanService.instance,
    caseService: CaseService.instance,
    translate: undefined,
    role: null,
};
export const AppContext = createContext(defaultContext);

export interface LaunchState {
    circulatorId?: string;
    circulatorPassword?: string;
    scrubId?: string;
    scrubPassword?: string;
    surgeonId?: string;
    path: keyof iNavPaths;
    skipLogin?: boolean;
}

export interface AppProps {
    initialNavPath?: RouteProps;
    launchState?: LaunchState;
}

function getRoleFromPath(path: keyof iNavPaths): "CIR" | "SCR" | null {
    const cirPaths: (keyof iNavPaths)[] = [
        "cirDashboard",
        "cirVerification",
        "cirAdjudication",
        "cirCbiNeedles",
        "cirCbiNeedlesReAdjudication",
        "cirIncompatibleNeedles",
        "cirBrokenNeedles",
        "cirMisplacedNeedles",
        "cirCbiSelectType",
        "cirAddedNeedles",
        "cirSetupScreen",
        "cirClosingCount",
        "cirInterimCount",
        "removeFromCBI",
    ];
    const scrPaths: (keyof iNavPaths)[] = [
        "scrDashboard",
        "scrValidation",
        "scrAddedNeedles",
        "scrActionScreen",
        "scrSetupScreen",
        "scrWaiting",
        "blankImageScreen",
        "scrClosingCount",
        "scrInterimCount",
    ];

    if (cirPaths.includes(path)) return "CIR";
    if (scrPaths.includes(path)) return "SCR";
    return null;
}

const AppCore: React.FC<AppProps> = ({ initialNavPath = { path: "setup" }, launchState }) => {
    const [route, setRoute] = useState<RouteProps>(initialNavPath);
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const restoreStateEnabled = useListenable(appContext.caseService.restoreStateEnabled);
    const isRestored = useListenable(appContext.caseService.isRestored);
    const restoredCirScreen = useListenable(appContext.caseService.restoredCirScreen);
    const restoredScrScreen = useListenable(appContext.caseService.restoredScrScreen);
    const restoredSurgeonId = useListenable(appContext.caseService.restoredSurgeonId);
    const restoredCirId = useListenable(appContext.caseService.restoredCirId);
    const restoredScrId = useListenable(appContext.caseService.restoredScrId);
    const currentRole = useListenable(appContext.caseService.currentRole);
    const [launchStateComplete, setLaunchStateComplete] = useState(false);
    const [restorationAttempted, setRestorationAttempted] = useState(false);
    const [staffRestored, setStaffRestored] = useState(false);
    const errorEvent = useListenable(appContext.caseService.errorEvent);

    // Fetch restore_state config after Parlay connects
    useEffect(() => {
        if (appContext.parlayWrapper.isConnected.value) {
            appContext.caseService.fetchRestoreStateConfig();
        }
    }, [appContext.parlayWrapper.isConnected.value, appContext]);

    // Determine and set role based on initial path or launchState
    useEffect(() => {
        const pathToCheck = launchState?.path || initialNavPath.path;
        const role = getRoleFromPath(pathToCheck);
        if (role) {
            appContext.caseService.setRole(role);
            appContext.role = role;
        }
    }, [launchState, initialNavPath, appContext]);

    // Restore staff when restored IDs are available
    useEffect(() => {
        // Skip if restoration is disabled in backend config
        if (!restoreStateEnabled) return;
        if (staffRestored) return;
        if (!isRestored) return;
        if (!restoredSurgeonId && !restoredCirId && !restoredScrId) return;

        async function restoreStaff() {
            try {
                // Initialize staff service if not already
                await appContext.staffService.init();

                // Restore surgeon
                if (restoredSurgeonId) {
                    const surgeon = appContext.staffService.surgeonIndex.get(restoredSurgeonId);
                    if (surgeon) {
                        appContext.caseService.surgeon.set(surgeon);
                        console.log(`Restored surgeon: ${surgeon.first_name} ${surgeon.last_name}`);
                    }
                }

                // Restore CIR user
                if (restoredCirId) {
                    const cirUser = appContext.staffService.hayAppIndex.get(restoredCirId);
                    if (cirUser) {
                        appContext.caseService.circulator.set(cirUser);
                        console.log(`Restored CIR: ${cirUser.first_name} ${cirUser.last_name}`);
                    }
                }

                // Restore SCR user
                if (restoredScrId) {
                    const scrUser = appContext.staffService.hayAppIndex.get(restoredScrId);
                    if (scrUser) {
                        appContext.caseService.scrub.set(scrUser);
                        console.log(`Restored SCR: ${scrUser.first_name} ${scrUser.last_name}`);
                    }
                }

                // Mark login as done if staff was restored
                if (restoredCirId && restoredScrId) {
                    appContext.caseService.loginStep.set("DONE");
                }

                setStaffRestored(true);
            } catch (error) {
                console.error("Failed to restore staff:", error);
            }
        }

        restoreStaff();
    }, [restoreStateEnabled, isRestored, restoredSurgeonId, restoredCirId, restoredScrId, appContext, staffRestored]);

    // Handle state restoration navigation AFTER launchState is complete
    useEffect(() => {
        // Skip if restoration is disabled in backend config
        if (!restoreStateEnabled) return;
        // Wait for launchState to complete first
        if (!launchStateComplete) return;
        // Only attempt restoration once
        if (restorationAttempted) return;

        if (isRestored && currentRole) {
            const restoredScreen = currentRole === "CIR" ? restoredCirScreen : restoredScrScreen;

            console.log(`Restoration check: role=${currentRole}, screen=${restoredScreen}`);

            if (restoredScreen && restoredScreen !== "") {
                const screenToPath: Record<string, keyof iNavPaths> = {
                    cirDashboard: "cirDashboard",
                    cirVerification: "cirVerification",
                    cirAdjudication: "cirAdjudication",
                    cirAddedNeedles: "cirAddedNeedles",
                    cirCbiNeedles: "cirCbiNeedles",
                    cirIncompatibleNeedles: "cirIncompatibleNeedles",
                    cirBrokenNeedles: "cirBrokenNeedles",
                    cirMisplacedNeedles: "cirMisplacedNeedles",
                    cirCbiSelectType: "cirCbiSelectType",
                    cirSetupScreen: "cirSetupScreen",
                    cirCloseCount: "cirClosingCount",
                    cirCloseCountSteps: "cirClosingCount",
                    cirResolvePendingItems: "cirClosingCount",
                    cirClosingCountVerification: "cirClosingCount",
                    cirClosingCountAdjudication: "cirClosingCount",
                    cirClosingCountReadjudication: "cirClosingCount",
                    cirClosingCountContaminated: "cirClosingCount",
                    cirInterimCountConfirm: "cirDashboard",
                    cirInterimCountReasonSelect: "cirInterimCount",
                    cirInterimCountRequesterSelect: "cirInterimCount",
                    scrDashboard: "scrDashboard",
                    scrValidation: "scrValidation",
                    scrAddedNeedles: "scrAddedNeedles",
                    scrActionScreen: "scrActionScreen",
                    SCR_DASHBOARD_VALIDATE_ACTIVE: "scrDashboard",
                    SCR_DASHBOARD_VALIDATE_INACTIVE: "scrDashboard",
                    SCR_VALIDATION: "scrValidation",
                    SCR_ACTION_SCREEN: "scrActionScreen",
                    SCR_ACTION_SCREEN_STERILE_PROMPT: "scrActionScreen",
                    SCR_ACTION_SCREEN_STERILE_DEPOSIT_PROMPT: "scrActionScreen",
                    SCR_ACTION_SCREEN_BLANK_IMAGE: "scrActionScreen",
                    SCR_ADDED_NEEDLES: "scrAddedNeedles",
                    SCR_ADDED_NEEDLES_DISPOSE: "scrAddedNeedles",
                    SCR_SETUP_SCREEN: "scrSetupScreen",
                };

                const path = screenToPath[restoredScreen];
                const defaultPath = currentRole === "CIR" ? "cirDashboard" : "scrDashboard";

                if (path && path !== defaultPath) {
                    console.log(`Restoring ${currentRole} navigation to: ${path}`);
                    const route: RouteProps =
                        path === "cirInterimCount"
                            ? restoredScreen === "cirInterimCountRequesterSelect"
                                ? {
                                      path,
                                      args: { interimSkipConfirm: true, interimInitialState: "whoIsRequesting" },
                                  }
                                : restoredScreen === "cirInterimCountReasonSelect"
                                  ? { path, args: { interimSkipConfirm: true } }
                                  : { path }
                            : { path };
                    setRoute(route);
                } else if (path) {
                    console.log(`Restored screen is default dashboard, staying on: ${path}`);
                } else {
                    console.log(`Unknown restored screen: ${restoredScreen}, staying on default`);
                }
            }

            setRestorationAttempted(true);
            appContext.caseService.isRestored.set(false);
        }
    }, [
        restoreStateEnabled,
        isRestored,
        restoredCirScreen,
        restoredScrScreen,
        currentRole,
        appContext,
        launchStateComplete,
        restorationAttempted,
    ]);

    useEffect(() => {
        void i18n;
        setRoute(initialNavPath);
    }, [initialNavPath]);

    // Listen for case cleared event from backend
    useEffect(() => {
        const unsubscribe = appContext.caseService.listenForCaseCleared(() => {
            console.log("Case cleared event received - resetting to initial screen");
            // Reset all state when case is cleared
            appContext.caseService.resetAllState();
            // Navigate to initial screen based on renderer
            if (initialNavPath.path === "scrWaiting") {
                setRoute({ path: "scrWaiting" });
            } else {
                setRoute({ path: "setup" });
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [appContext, initialNavPath]);

    useEffect(() => {
        // Cleanup CaseService listeners on app unmount
        return () => {
            CaseService.instance.dispose();
        };
    }, []);

    appContext.navigate = (newRoute) => {
        setRoute(newRoute);
        appContext.route = newRoute;
    };

    appContext.translate = t;

    useEffect(() => {
        async function waitForParlayConnection() {
            if (appContext.parlayWrapper.isConnected.value) {
                return;
            }
            appContext.parlayWrapper.start();
            return new Promise<void>((resolve) => {
                const listener = (connected: boolean) => {
                    if (connected) {
                        appContext.parlayWrapper.isConnected.removeListener(listener);
                        resolve();
                    }
                };
                appContext.parlayWrapper.isConnected.addListener(listener);
                if (appContext.parlayWrapper.isConnected.value) {
                    appContext.parlayWrapper.isConnected.removeListener(listener);
                    resolve();
                }
            });
        }

        async function doLaunchState() {
            try {
                await waitForParlayConnection();

                // Always load staff data after Parlay connects
                console.log("Loading staff data from backend...");
                await appContext.staffService.init();
                console.log("Staff data loaded successfully");

                if (!launchState) {
                    setLaunchStateComplete(true);
                    return;
                }

                // Skip login if specified or if no credentials provided
                if (launchState.skipLogin) {
                    if (launchState.path) {
                        setRoute({ path: launchState.path });
                    }
                    return;
                }

                // Only login circulator if credentials provided
                let cirUser = undefined;
                if (launchState.circulatorId && launchState.circulatorPassword) {
                    cirUser = appContext.staffService.hayAppIndex.get(launchState.circulatorId);
                    if (cirUser) {
                        const cirLogin = await appContext.staffService.loginHayAppUser(
                            cirUser,
                            launchState.circulatorPassword,
                            HayAppUserType.Circulator,
                        );
                        if (cirLogin) {
                            appContext.caseService.circulator.set(cirUser);
                        } else {
                            console.warn("LaunchState: Login failed for CIR");
                        }
                    }
                }

                // Only login scrub if credentials provided
                let scrUser = undefined;
                if (launchState.scrubId && launchState.scrubPassword) {
                    scrUser = appContext.staffService.hayAppIndex.get(launchState.scrubId);
                    if (scrUser) {
                        const scrLogin = await appContext.staffService.loginHayAppUser(
                            scrUser,
                            launchState.scrubPassword,
                            HayAppUserType.ScrubNurse,
                        );
                        if (scrLogin) {
                            appContext.caseService.scrub.set(scrUser);
                        } else {
                            console.warn("LaunchState: Login failed for SCR");
                        }
                    }
                }

                // Only set surgeon if provided
                let surgeon = undefined;
                if (launchState.surgeonId) {
                    surgeon = appContext.staffService.surgeonIndex.get(launchState.surgeonId);
                    if (surgeon) {
                        appContext.caseService.surgeon.set(surgeon);
                    }
                }

                // Only call setCaseStaff if we have at least one ID
                if (launchState.surgeonId || launchState.circulatorId || launchState.scrubId) {
                    await appContext.caseService.setCaseStaff(
                        launchState.surgeonId ?? "",
                        launchState.circulatorId ?? "",
                        launchState.scrubId ?? "",
                    );
                }

                // Set login step based on what was logged in
                if (cirUser && scrUser) {
                    appContext.caseService.loginStep.set("DONE");
                } else if (cirUser) {
                    appContext.caseService.loginStep.set("SCR");
                } else {
                    appContext.caseService.loginStep.set("CIR");
                }

                if (launchState.path) {
                    setRoute({ path: launchState.path });
                }

                // Mark launchState as complete - now restoration can happen
                setLaunchStateComplete(true);
            } catch (err) {
                console.error("Error in doLaunchState:", err);
                setLaunchStateComplete(true);
            }
        }

        doLaunchState();
    }, [launchState]);

    function renderView(item: RouteProps) {
        switch (item.path) {
            case "setup":
                return <Setup />;
            case "cirDashboard":
                return <CIRDashboard />;
            case "cirVerification":
                return <CIRVerification numCards={item.args?.numCards} />;
            case "cirAdjudication":
                return <CIRAdjudicationScreen source={item.args?.source} />;
            case "cirCbiNeedles":
                return <CIRCBINeedlesScreen needleType="contaminated" />;
            case "cirIncompatibleNeedles":
                return <CIRCBINeedlesScreen needleType="incompatible" />;
            case "cirBrokenNeedles":
                return <CIRCBINeedlesScreen needleType="broken" skipBrokenQuestion={item.args?.skipBrokenQuestion} />;
            case "cirMisplacedNeedles":
                return <CIRCBINeedlesScreen needleType="misplaced" />;
            case "cirCbiSelectType": {
                const fromFoundNonSterile = item.args?.fromFoundNonSterile;
                return (
                    <CIRCBINeedlesScreen
                        needleType="select"
                        fromFoundNonSterile={!!fromFoundNonSterile}
                        onComplete={
                            fromFoundNonSterile
                                ? async () => {
                                      await appContext.caseService.parlayInterface.caseManager.decrement_found_non_sterile(
                                          1,
                                      );
                                      appContext.navigate({ path: "cirDashboard" });
                                  }
                                : undefined
                        }
                    />
                );
            }
            case "cirCbiNeedlesReAdjudication":
                return <CIRCBINeedlesScreen reAdjudicationData={item.args?.needleData} />;
            case "removeFromCBI":
                return <RemoveFromCBI />;
            case "scrDashboard":
                return <SCRDashboard />;
            case "scrValidation":
                return <SCRValidation />;
            case "cirAddedNeedles":
                return <CIRAddedNeedles />;
            case "scrAddedNeedles":
                return <SCRAddedNeedles />;
            case "scrActionScreen":
                return <SCRActionScreen />;
            case "scrSetupScreen":
                return <SCRSetupScreen />;
            case "cirSetupScreen":
                return <CIRSetupScreen startAtStep={item.args?.startAtStep} />;
            case "cirClosingCount":
                return <CIRClosingCount />;
            case "cirInterimCount":
                return <CIRInterimCount />;
            case "scrClosingCount":
                return <SCRClosingCount />;
            case "scrInterimCount":
                return <SCRInterimCount />;
            case "scrWaiting":
                return <SCRWaiting />;
            case "techSupportLogin":
                return <TechSupportLogin />;
            case "provision":
                return <Provision />;
            case "blankImageScreen":
                return <BlankImageScreen />;
            default:
                return <div style={{ width: "100%", height: "100%", backgroundColor: "black" }} />;
        }
    }

    function renderRoute() {
        console.log("[APP] renderRoute called, errorEvent:", errorEvent);
        return (
            <div className="appBackground">
                <div style={{ width: 1920, height: 1080, marginTop: 0 }}>
                    <div className="fullScreenView" style={{ filter: errorEvent ? "blur(8px)" : "none" }}>
                        {renderView(route)}
                    </div>
                    {errorEvent && (
                        <div className="errorPopup">
                            <ErrorPopup
                                errorTitle={errorEvent.title}
                                errorMessage={errorEvent.msg}
                                onClose={() => appContext.caseService.clearErrorEvent()}
                                iconSrc={WarningIcon}
                                isFatal={errorEvent.is_fatal}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return <>{renderRoute()}</>;
};

// Wrapper component that adds SurgeonsView overlay
const AppWithSurgeonsView: React.FC<AppProps> = (props) => {
    const { surgeonFlowActive, toastMessage, toastIcon, clearToast } = useSurgeonsView();

    return (
        <>
            <AppCore {...props} />
            {surgeonFlowActive && <SurgeonFlowOverlay />}
            {toastMessage && (
                <ToastNotification message={toastMessage} icon={toastIcon ?? undefined} onDismiss={clearToast} />
            )}
        </>
    );
};

// Export wrapped version that includes the provider
export const App: React.FC<AppProps> = (props) => {
    return (
        <SurgeonsViewProvider>
            <AppWithSurgeonsView {...props} />
        </SurgeonsViewProvider>
    );
};
