import { useContext, useEffect, useState } from "react";
import { AppContext } from "./App";
import styles from "../viewcss/setup.module.css";
import startCountInstructionStyles from "../view/subviewcss/startCountInstruction.module.css";
import { useTranslation } from "react-i18next";
import { useListenable } from "../util/Listenable";
import { CaseTypeSummary } from "./subview/CaseTypeSummary";
import { SelectedSurgeons } from "./subview/SelectedSurgeons";
import { useSurgeonsView } from "../contexts/SurgeonsViewContext";
import { TrackingHeader } from "./subview/TrackingHeader";
import { SystemCheck } from "./subview/SystemCheck";
import { NeedsProvisioning } from "./subview/NeedsProvisioning";
import { RoleSelection } from "./subview/RoleSelection";
import { ScanBadge } from "./subview/ScanBadge";
import { ManualLogin } from "./subview/ManualLogin";
import { ScanORiTrace } from "./subview/ScanORiTrace";
import { TechSupportService } from "../services/TechSupportService";
import { SelectSurgeon } from "./subview/SelectSurgeon";
import { SelectCaseType } from "./subview/SelectCaseType";
import { HayAppUserType, Surgeon, HayAppUser } from "../services/StaffService";
import { SelectAddOnCaseType } from "./subview/SelectAddOnCaseType";
import { CaseType } from "../services/CaseService";
import { ReviewRedundantNeedles } from "./subview/ReviewRedundantNeedles";
import { SutureSheetNotAvailable, MissingCaseTypeInfo } from "./subview/SutureSheetNotAvailable";
import { SummarySheet } from "./subview/SummarySheet";
import { SelectSutureSheet, SurgeonSheetOption } from "./subview/SelectSutureSheet";
import { CIRSetupSteps, SCRSetupSteps } from "../defs/enums";
import { NeedleDetail, NeedleDetailSource } from "./subview/NeedleDetail";
import { IdentifyNeedlesTable } from "./subview/IdentifyNeedlesTable";
import { SutureNeedleCategory } from "../component/CategoryBadge";
import { RedundantNeedleItem, EnrichedSutureSheetItem } from "../types/SutureTypes";
import { getNeedleSpecifications } from "../util/setupHelpers";
import { StartCountInstruction } from "./subview/StartCountInstruction";
import { ClosingBoxVerified } from "./subview/ClosingBoxVerified";
import { ProcedureKitVerified } from "./subview/ProcedureKitVerified";
import { ProcedureKitScanError } from "./subview/ProcedureKitScanError";
import { DrawerScanError } from "./subview/DrawerScanError";
import { AbortedCase } from "./subview/AbortedCase";
import { LogoutPopup } from "./subview/LogoutPopUp";
import LogoutIcon from "../img/LogoutIcon.svg";
import { useLogout } from "../hooks/useLogout";
import ToastNotification from "../component/ToastNotification";
import UserLoggedOut from "../img/UserLoggedOut.svg";
import PlaceInClosingDrawer from "../img/PlaceInClosingDrawer.svg";
import ScanClosingDrawer from "../img/ScanClosingDrawer.svg";
import SetAsideOpen from "../img/SetAsideOpen.svg";
import SetAsideClose from "../img/SetAsideClose.svg";
import SetAsideJIT from "../img/SetAsideJIT.svg";
import OpenDrawer from "../img/OpenDrawer.svg";
import JITDrawer from "../img/JITDrawer.svg";
import ProcedureKit from "../img/ProcedureKit.svg";
import RoomScanVerified from "../img/RoomScanVerified.svg";
import RoomScanFailed from "../img/RoomScanFailed.svg";
import CIRLoginSuccess from "../img/CIRLoginSuccess.svg";
import SCRLoginSuccess from "../img/SCRLoginSuccess.svg";

// State enum for setup flow
//
// FORWARD FLOW (complete path through setup):
// 1. SYSTEM_CHECK (no back arrow - returns to root)
// 2. ROLE_SELECTION (HAS back arrow - goes to SYSTEM_CHECK on first login)
// 3. SCAN_BADGE (HAS back arrow - goes to ROLE_SELECTION)
// 4. ROOM_SCAN_VERIFIED (HAS back arrow - goes to SCAN_BADGE and logs out user)
// 5. ROOM_SCAN_CAMERA
// 6. ROOM_CONFIRM
// 7. ROOM_SCAN_FAILED
// 8. START_COUNT_INSTRUCTION
// 9. SELECT_SURGEON_NEW
// 10. ROOM_SCAN_STEP3
// 11. SELECT_CASE_TYPE (can be returned to from CASE_TYPE_SUMMARY to add more primary cases)
// 12. SELECT_ADD_ON_CASE_TYPE (can be returned to from CASE_TYPE_SUMMARY to edit add-ons)
// 13. CASE_TYPE_SUMMARY (can add more primary cases or edit add-ons from here)
// 14. SELECTED_SURGEONS (shows all selected surgeons - confirms surgeon selection)
// 15. [Optional: SUTURE_SHEET_NOT_AVAILABLE -> SELECT_SUTURE_SHEET if sheets missing]
// 16. REVIEW_REDUNDANT_NEEDLES
// 17. SUMMARY_SHEET
// 18. ROLE_SELECTION (second role login - HAS back arrow - goes to SUMMARY_SHEET)
// 19. SCAN_BADGE (second role login - HAS back arrow - goes to ROLE_SELECTION)
// -> Then navigates to setup screens (CIR/SCR setup)
//
// BACK ARROW BEHAVIOR:
// - No back arrow: only SYSTEM_CHECK
// - Back arrow shown: all other screens
// - Going back from certain screens clears backend/frontend data:
//   * ROOM_SCAN_STEP1 -> logs out the current user (clears circulator/scrub)
//   * ROOM_SCAN_STEP3 -> clears surgeon
//   * CASE_TYPE_SUMMARY -> clears case types
//   * REVIEW_REDUNDANT_NEEDLES -> clears suture sheets
//
export enum State {
    SYSTEM_CHECK,
    ROLE_SELECTION,
    SCAN_BADGE,
    MANUAL_LOGIN,
    START_COUNT_INSTRUCTION,
    ROOM_SCAN_CAMERA,
    ROOM_SCAN_VERIFIED,
    ROOM_SCAN_FAILED,
    SELECT_SURGEON_NEW,
    SELECT_CASE_TYPE,
    SELECT_ADD_ON_CASE_TYPE,
    CASE_TYPE_SUMMARY,
    SELECTED_SURGEONS,
    SURGEONS_VIEW,
    SUTURE_SHEET_NOT_AVAILABLE,
    SELECT_SUTURE_SHEET,
    REVIEW_REDUNDANT_NEEDLES,
    SUMMARY_SHEET,
    NEEDLE_DETAIL,
    SET_ASIDE_OPEN,
    IDENTIFY_OPEN_NEEDLES,
    PLACE_OPEN_BOX,
    SET_ASIDE_JIT,
    IDENTIFY_JIT_NEEDLES,
    PLACE_JIT_BOX,
    SET_ASIDE_CLOSING,
    IDENTIFY_CLOSING_NEEDLES,
    PLACE_CLOSING_BOX,
    SCAN_CLOSING_BOX,
    CLOSING_BOX_VERIFIED,
    CLOSING_BOX_SCAN_ERROR,
    SCAN_PROCEDURE_KIT,
    PROCEDURE_KIT_SCAN_ERROR,
    PROCEDURE_KIT_VERIFIED,
    SCAN_BADGE_ENTRY,
    ABORTED_CASE,
}

// Interface for selected case groups
export interface SelectedCaseGroup {
    primary: CaseType;
    addOns: CaseType[];
}

// Interface for surgeon with their case groups (Setup-internal type)
interface SetupSurgeonWithCaseGroups {
    surgeon: Surgeon;
    caseGroups: SelectedCaseGroup[];
}

// Interface for case type summary info used in SummarySheet dropdown
export interface CaseTypeSummaryInfo {
    name: string;
    cptCode: string;
    needleCount: number;
    hasSutureSheet: boolean;
}

export const Setup: React.FC<object> = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const { setOnFlowComplete, showSurgeonsView } = useSurgeonsView();

    const [state, setState] = useState<State>(State.SYSTEM_CHECK);
    const [selectedRole, setSelectedRole] = useState<HayAppUserType | undefined>(undefined);
    const [selectedPrimaryCaseType, setSelectedPrimaryCaseType] = useState<CaseType | null>(null);
    const [selectedAddOnCaseTypes, setSelectedAddOnCaseTypes] = useState<CaseType[]>([]);
    const [selectedCaseGroups, setSelectedCaseGroups] = useState<SelectedCaseGroup[]>([]);
    const [editingCaseGroupIndex, setEditingCaseGroupIndex] = useState<number>(-1);
    const [selectedSurgeon, setSelectedSurgeon] = useState<Surgeon | null>(null);

    // Multi-surgeon tracking
    const [selectedSurgeons, setSelectedSurgeons] = useState<SetupSurgeonWithCaseGroups[]>([]);
    const [viewingSurgeonIndex, setViewingSurgeonIndex] = useState<number | null>(null);

    const [redundantNeedleItems, setRedundantNeedleItems] = useState<RedundantNeedleItem[]>([]);
    const [summarySheetItems, setSummarySheetItems] = useState<EnrichedSutureSheetItem[]>([]);

    // State for suture sheet availability flow
    const [missingCaseTypes, setMissingCaseTypes] = useState<MissingCaseTypeInfo[]>([]);
    const [selectedMissingCptCode, setSelectedMissingCptCode] = useState<string>("");
    const [previousState, setPreviousState] = useState<State | null>(null);
    const [caseTypeSummaries, setCaseTypeSummaries] = useState<CaseTypeSummaryInfo[]>([]);

    // State for selecting replacement suture sheets from other surgeons
    const [currentSelectingCptCode, setCurrentSelectingCptCode] = useState<string>("");
    const [firstSurgeonWithSheet, setFirstSurgeonWithSheet] = useState<Surgeon | null>(null); // First surgeon found with a sheet for the missing case type
    interface ReplacementSheetInfo {
        sheetId: string;
        originalCptCode: string; // The CPT code the sheet was originally for
        replacementCptCode: string; // The CPT code we're using it for (the missing one)
        surgeonName: string;
    }
    const [replacementSheets, setReplacementSheets] = useState<Map<string, ReplacementSheetInfo>>(new Map());

    // State for needle detail screen
    const [selectedNeedleItem, setSelectedNeedleItem] = useState<RedundantNeedleItem | null>(null);
    const [needleDetailSource, setNeedleDetailSource] = useState<NeedleDetailSource>("summarySheet");
    const [needlePackInfo, setNeedlePackInfo] = useState<import("../services/CaseService").SuturePackInfo | null>(null);

    const circulatorUser = useListenable(appContext.caseService.circulator);
    const scrubUser = useListenable(appContext.caseService.scrub);
    const [isAddingFromCaseSummary, setIsAddingFromCaseSummary] = useState(false);

    const [openNeedlesIdentified, setOpenNeedlesIdentified] = useState(false);
    const [jitNeedlesIdentified, setJitNeedlesIdentified] = useState(false);
    const [closingNeedlesIdentified, setClosingNeedlesIdentified] = useState(false);
    const [stateBeforeHeaderLogin, setStateBeforeHeaderLogin] = useState<State | null>(null);

    // State for logout popup
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [logoutRole, setLogoutRole] = useState<"CIR" | "SCR" | null>(null);
    const [logoutToastMessage, setLogoutToastMessage] = useState<string | null>(null);
    /** SYSTEM_CHECK: loading provision status from broker, then route by is_provisioned / group_data_access_denied */
    const [systemCheckGate, setSystemCheckGate] = useState<
        | { kind: "loading" }
        | { kind: "ready"; is_provisioned: boolean; group_data_access_denied: boolean; development_mode: boolean }
    >({ kind: "loading" });
    const [manualLoginError, setManualLoginError] = useState<string | null>(null);

    // Wrapper component for SelectSutureSheet to handle async loading of surgeon options
    const SelectSutureSheetWrapper: React.FC = () => {
        const [surgeonOptions, setSurgeonOptions] = useState<SurgeonSheetOption[]>([]);
        const [isLoading, setIsLoading] = useState(true);
        const [preselectedOption, setPreselectedOption] = useState<SurgeonSheetOption | null>(null);

        useEffect(() => {
            const loadSurgeonOptions = async () => {
                try {
                    setIsLoading(true);
                    // Fetch all surgeons and all case types
                    const allSurgeons = await appContext.caseService.getSurgeons();
                    const allCaseTypes = await appContext.caseService.getCaseTypes();

                    // Load ALL suture sheets from ALL surgeons
                    const options: SurgeonSheetOption[] = [];
                    let preselectedForMissingCpt: SurgeonSheetOption | null = null;

                    for (const surgeon of allSurgeons) {
                        // Get all sheets for this surgeon
                        const sheets = await appContext.caseService.getSutureSheetsForSurgeon(surgeon.surgeon_id);

                        // For each sheet, create options for each CPT code it covers
                        for (const sheet of sheets) {
                            if (sheet.cpt_codes && sheet.cpt_codes.length > 0) {
                                for (const cptCode of sheet.cpt_codes) {
                                    // Find case type name for this CPT code
                                    const caseType = allCaseTypes.find((ct) => ct.cpt_code === cptCode);
                                    const caseTypeName = caseType?.name ?? cptCode;

                                    const option: SurgeonSheetOption = {
                                        surgeon,
                                        sheet,
                                        caseTypeName,
                                        cptCode,
                                    };
                                    options.push(option);

                                    // If this matches the missing CPT code and is the first surgeon with a sheet, pre-select it
                                    if (
                                        cptCode === currentSelectingCptCode &&
                                        !preselectedForMissingCpt &&
                                        firstSurgeonWithSheet &&
                                        surgeon.surgeon_id === firstSurgeonWithSheet.surgeon_id
                                    ) {
                                        preselectedForMissingCpt = option;
                                    }
                                }
                            }
                        }
                    }

                    // If we didn't find the firstSurgeonWithSheet for the missing CPT, try to find any sheet with that CPT
                    if (!preselectedForMissingCpt && currentSelectingCptCode) {
                        preselectedForMissingCpt =
                            options.find((opt) => opt.cptCode === currentSelectingCptCode) || null;
                    }

                    // If still no pre-selection and we have options, pre-select first in list
                    if (!preselectedForMissingCpt && options.length > 0) {
                        preselectedForMissingCpt = options[0];
                    }

                    setSurgeonOptions(options);
                    setPreselectedOption(preselectedForMissingCpt);
                    setIsLoading(false);
                } catch (error) {
                    console.error("Failed to load surgeon options:", error);
                    setIsLoading(false);
                }
            };

            loadSurgeonOptions();
        }, [currentSelectingCptCode]);

        if (isLoading) {
            return <div>Loading...</div>; // TODO: Add proper loading UI
        }

        return (
            <SelectSutureSheet
                cptCode={currentSelectingCptCode}
                caseTypeName={
                    caseTypeSummaries.find((s) => s.cptCode === currentSelectingCptCode)?.name ??
                    currentSelectingCptCode
                }
                surgeonOptions={surgeonOptions}
                preselectedOption={preselectedOption}
                onBack={() => setState(State.SUTURE_SHEET_NOT_AVAILABLE)}
                onContinue={handleSelectSutureSheetContinue}
            />
        );
    };

    const { logout } = useLogout();
    const techSupportService = TechSupportService.instance;

    // Check for relogin requirement on mount
    useEffect(() => {
        const reloginRole = appContext.caseService.reloginRole.value;
        const shouldReturnToCirSetup = appContext.caseService.shouldReturnToCirSetup.value;
        const skipRoleSelection = appContext.caseService.skipRoleSelection.value;

        if (reloginRole) {
            if (shouldReturnToCirSetup && skipRoleSelection) {
                // At Start step or later: skip role selection, go straight to scan badge
                setSelectedRole(reloginRole === "CIR" ? HayAppUserType.Circulator : HayAppUserType.ScrubNurse);
                setState(State.SCAN_BADGE);
            } else {
                // Before Start step or other cases: go to role selection, still return to CIR setup after
                setState(State.ROLE_SELECTION);
            }
            appContext.caseService.reloginRole.set(null);
            // skipRoleSelection is cleared in handleBadgeScan when shouldReturnToCirSetup is consumed
        }
    }, []);

    // When on SYSTEM_CHECK, ask the broker for post-startup migration outcome (e.g. HTTP 500 / invalid group).
    // is_provisioned is false when group_data_access_denied so the UI can send the user to Tech Support login.
    useEffect(() => {
        if (state === State.SYSTEM_CHECK && appContext.parlayWrapper.isConnected.value) {
            setSystemCheckGate({ kind: "loading" });
            Promise.all([
                techSupportService.isProvisioned(),
                appContext.caseService.parlayInterface.caseManager.get_development_mode().catch(() => false),
            ])
                .then(([result, devMode]) => {
                    console.log("Provisioning check result:", result);
                    setSystemCheckGate({
                        kind: "ready",
                        is_provisioned: result.is_provisioned,
                        group_data_access_denied: result.group_data_access_denied || false,
                        development_mode: devMode as boolean,
                    });
                })
                .catch((error) => {
                    console.error("Failed to check provisioning status:", error);
                    setSystemCheckGate({
                        kind: "ready",
                        is_provisioned: false,
                        group_data_access_denied: false,
                        development_mode: false,
                    });
                });
        }
    }, [state, appContext.parlayWrapper.isConnected.value, techSupportService]);

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        appContext.hayscanService.scanRoom();
    }, [appContext.parlayWrapper.isConnected.value]);

    // Listen for CIR screen changes (for demo skip button navigation)
    useEffect(() => {
        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            // Navigate to CIR dashboard when screen changes to cirDashboard
            if (event.screen === "cirDashboard") {
                appContext.navigate({ path: "cirDashboard" });
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [appContext]);

    const buildRedundantNeedleItems = async (sheetsByCaseGroup: Map<number, string[]>) => {
        const caseGroups: string[][] = Array.from(sheetsByCaseGroup.values());
        const backendItems = await appContext.caseService.getRedundantNeedleItems(caseGroups);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: RedundantNeedleItem[] = backendItems.map((item: any) => ({
            id: item.id,
            nomenclature: item.nomenclature,
            subLabel: item.product_code,
            needlesPerPack: item.needles_per_pack,
            packsToOpen: item.packs_to_open,
            sutureNeedleUse: item.suture_needle_use,
            sutureNeedleCategory: item.suture_needle_category as SutureNeedleCategory,
            potentialRedundantPack: item.potential_redundant_pack,
            fdaGudid: item.fda_gudid,
            // Additional fields from SuturePackInfo
            image: item.image,
            manufacturer: item.manufacturer,
            sutureLength: item.suture_length,
            sutureColor: item.suture_color,
            sutureStyle: item.suture_style,
            needleSize: item.needle_size,
            needleArc: item.needle_arc,
            needleTip: item.needle_tip,
            numSutures: item.num_sutures,
        }));

        setRedundantNeedleItems(items);
    };
    // iTrace scanning: open scanner and advance on any scan result for room, closing box, and procedure kit screens
    useEffect(() => {
        const itraceStates = [State.ROOM_SCAN_CAMERA, State.SCAN_CLOSING_BOX, State.SCAN_PROCEDURE_KIT];
        if (!itraceStates.includes(state) || !appContext.parlayWrapper.isConnected.value) return;

        appContext.parlayWrapper.hayScanner.open_itrace_scanner(0, "single").catch((err) => {
            console.error("Failed to open iTrace scanner:", err);
        });

        const unsubscribe = appContext.parlayWrapper.caseManager.itrace_scan_result(() => {
            if (state === State.ROOM_SCAN_CAMERA) {
                setState(State.ROOM_SCAN_VERIFIED);
            } else if (state === State.SCAN_CLOSING_BOX) {
                setTimeout(() => setState(State.CLOSING_BOX_VERIFIED), 2500);
            } else if (state === State.SCAN_PROCEDURE_KIT) {
                setState(State.PROCEDURE_KIT_VERIFIED);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [state, appContext.parlayWrapper]);

    // Register callback with context to handle surgeon flow completion (add, change, or view)
    useEffect(() => {
        setOnFlowComplete(async (mode, newSurgeon, targetIndex, updatedSurgeons) => {
            const currentCirStep = appContext.caseService.currentCirStep.value;
            const stepsRequiringRescan = ["pickup", "start", "confirm", "total", "scrConfirm", "complete"];
            const needsRescan = currentCirStep && stepsRequiringRescan.includes(currentCirStep);

            if (mode === "view" && updatedSurgeons) {
                // Overlay already synced to backend, just use the updated data directly
                setSelectedSurgeons(
                    updatedSurgeons.map((s) => ({
                        surgeon: s.surgeon,
                        caseGroups: s.caseGroups as unknown as SelectedCaseGroup[],
                    })),
                );

                // Check if we need to go back to scan step
                if (needsRescan) {
                    console.log(`New procedure added during/after ${currentCirStep} step - returning to scan`);
                    // Store current pack count as the "before" marker
                    const currentPackCount = appContext.caseService.caseSutures.value.length;
                    appContext.caseService.packsBeforeNewProcedure.set(currentPackCount);
                    appContext.caseService.showingNewProcedureOnly.set(true);

                    // Use backend commands to navigate both CIR and SCR
                    try {
                        await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(
                            SCRSetupSteps.CIR_WAIT,
                        );
                        await appContext.caseService.parlayInterface.caseManager.set_current_cir_screen(
                            CIRSetupSteps.SCAN,
                        );
                    } catch (error) {
                        console.error("Failed to navigate screens after procedure addition:", error);
                    }
                }
            } else if (mode === "change" && targetIndex !== null && newSurgeon) {
                setSelectedSurgeons((prev) => {
                    const updated = [...prev];
                    updated[targetIndex] = {
                        surgeon: newSurgeon.surgeon,
                        caseGroups: newSurgeon.caseGroups as unknown as SelectedCaseGroup[],
                    };
                    return updated;
                });

                // Check if we need to go back to scan step
                if (needsRescan) {
                    console.log(`Procedure changed during/after ${currentCirStep} step - returning to scan`);
                    const currentPackCount = appContext.caseService.caseSutures.value.length;
                    appContext.caseService.packsBeforeNewProcedure.set(currentPackCount);
                    appContext.caseService.showingNewProcedureOnly.set(true);

                    // Use backend commands to navigate both CIR and SCR
                    try {
                        await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(
                            SCRSetupSteps.CIR_WAIT,
                        );
                        await appContext.caseService.parlayInterface.caseManager.set_current_cir_screen(
                            CIRSetupSteps.SCAN,
                        );
                    } catch (error) {
                        console.error("Failed to navigate screens after procedure change:", error);
                    }
                }
            } else if (mode === "add" && newSurgeon) {
                setSelectedSurgeons((prev) => [
                    ...prev,
                    {
                        surgeon: newSurgeon.surgeon,
                        caseGroups: newSurgeon.caseGroups as unknown as SelectedCaseGroup[],
                    },
                ]);

                // Check if we need to go back to scan step
                if (needsRescan) {
                    console.log(`New surgeon added during/after ${currentCirStep} step - returning to scan`);
                    const currentPackCount = appContext.caseService.caseSutures.value.length;
                    appContext.caseService.packsBeforeNewProcedure.set(currentPackCount);
                    appContext.caseService.showingNewProcedureOnly.set(true);

                    // Use backend commands to navigate both CIR and SCR
                    try {
                        await appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(
                            SCRSetupSteps.CIR_WAIT,
                        );
                        await appContext.caseService.parlayInterface.caseManager.set_current_cir_screen(
                            CIRSetupSteps.SCAN,
                        );
                    } catch (error) {
                        console.error("Failed to navigate screens after surgeon addition:", error);
                    }
                }
            }
        });

        return () => {
            setOnFlowComplete(null);
        };
    }, [setOnFlowComplete]);

    // Simulated scan: auto-transition after 5 seconds on SCAN_PROCEDURE_KIT
    // NOTE: now handled by the iTrace scanner useEffect above
    useEffect(() => {
        void state; // intentional no-op — iTrace scan result drives the transition
    }, [state]);

    // Development toggle: press up-arrow twice within 500ms to trigger error screen
    useEffect(() => {
        if (state !== State.SCAN_PROCEDURE_KIT) return;

        let lastUpArrowTime = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp") {
                const now = Date.now();
                if (now - lastUpArrowTime < 500) {
                    // Two up-arrows within 500ms - trigger error
                    setState(State.PROCEDURE_KIT_SCAN_ERROR);
                }
                lastUpArrowTime = now;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [state]);

    // Development toggle: press up-arrow twice within 500ms to trigger error screen
    useEffect(() => {
        if (state !== State.SCAN_CLOSING_BOX) return;

        let lastUpArrowTime = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp") {
                const now = Date.now();
                if (now - lastUpArrowTime < 500) {
                    // Two up-arrows within 500ms - trigger error
                    setState(State.CLOSING_BOX_SCAN_ERROR);
                }
                lastUpArrowTime = now;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [state]);

    // Development toggle: press down-arrow twice within 500ms to trigger scan error screen
    useEffect(() => {
        if (state !== State.ROOM_SCAN_CAMERA) return;

        let lastDownArrowTime = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                const now = Date.now();
                if (now - lastDownArrowTime < 500) {
                    // Two down-arrows within 500ms - trigger error
                    setState(State.ROOM_SCAN_FAILED);
                }
                lastDownArrowTime = now;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [state]);

    const selectRole = (role: HayAppUserType) => {
        setSelectedRole(role);
        setState(State.SCAN_BADGE);
    };

    const handleBadgeScan = async (success: boolean, error?: string) => {
        if (success) {
            // Get the NFC scan result and set the user
            const nfcResult = appContext.caseService.nfcScanResult.value;
            if (nfcResult?.user && selectedRole) {
                const user: HayAppUser = {
                    user_id: nfcResult.user.user_id,
                    first_name: nfcResult.user.first_name,
                    last_name: nfcResult.user.last_name,
                    email: nfcResult.user.email || "",
                    roles: nfcResult.user.roles.map((r) => {
                        if (r === "CIR") return HayAppUserType.Circulator;
                        if (r === "SCR") return HayAppUserType.ScrubNurse;
                        if (r === "ADMIN") return HayAppUserType.Admin;
                        return HayAppUserType.Circulator;
                    }),
                };

                if (selectedRole === HayAppUserType.Circulator) {
                    appContext.caseService.circulator.set(user);
                } else {
                    appContext.caseService.scrub.set(user);
                }

                appContext.caseService.clearNFCScanResult();
            } else if (selectedRole) {
                // Bypass: no NFC hardware — create a dummy user so UI flow continues
                const roleLabel = selectedRole === HayAppUserType.Circulator ? "CIR" : "SCR";
                const bypassUser: HayAppUser = {
                    user_id: `bypass-${roleLabel.toLowerCase()}`,
                    first_name: "Test",
                    last_name: roleLabel,
                    email: `bypass-${roleLabel.toLowerCase()}@test.com`,
                    roles: [selectedRole],
                };
                if (selectedRole === HayAppUserType.Circulator) {
                    appContext.caseService.circulator.set(bypassUser);
                } else {
                    appContext.caseService.scrub.set(bypassUser);
                }
            }

            // Check if this is the second role login
            if (previousState === State.PROCEDURE_KIT_VERIFIED) {
                // Second role has logged in - ensure staff is saved to backend before navigating
                const surgeon = appContext.caseService.surgeon.value;
                const circulator = appContext.caseService.circulator.value;
                const scrub = appContext.caseService.scrub.value;

                if (surgeon && circulator && scrub) {
                    try {
                        // Save all staff to backend
                        await appContext.caseService.setCaseStaff(
                            surgeon.surgeon_id,
                            circulator.user_id,
                            scrub.user_id,
                        );

                        // Set CIR screen state (secondary renderer will navigate)
                        await appContext.parlayWrapper.caseManager.set_current_cir_screen("cirSetupScreen");

                        // Set SCR screen state (main renderer will navigate)
                        await appContext.parlayWrapper.caseManager.set_current_scr_screen("scrSetupScreen");

                        // Navigate the current renderer to the appropriate screen based on who just logged in
                        appContext.navigate({ path: "cirSetupScreen" });
                    } catch (error) {
                        console.error("Failed to set screen states:", error);
                    }
                } else {
                    console.error("Cannot navigate to setup: missing staff selections", {
                        surgeon: !!surgeon,
                        circulator: !!circulator,
                        scrub: !!scrub,
                    });
                }
                setPreviousState(null);
            } else if (appContext.caseService.shouldReturnToCirSetup.value) {
                // Returning to CIR setup after logout
                const wasSkipRoleSelection = appContext.caseService.skipRoleSelection.value;
                appContext.caseService.shouldReturnToCirSetup.set(false);
                appContext.caseService.skipRoleSelection.set(false);

                // If we came through role selection (single user before Start), ensure
                // the other role is not accidentally restored by backend dashboard updates
                if (!wasSkipRoleSelection && selectedRole) {
                    if (selectedRole === HayAppUserType.Circulator) {
                        appContext.caseService.scrub.set(undefined);
                    } else {
                        appContext.caseService.circulator.set(undefined);
                    }
                }

                // Only update case staff if both roles are logged in
                const circulator = appContext.caseService.circulator.value;
                const scrub = appContext.caseService.scrub.value;
                const surgeon = appContext.caseService.surgeon.value;

                if (surgeon && circulator && scrub) {
                    await appContext.caseService.setCaseStaff(surgeon.surgeon_id, circulator.user_id, scrub.user_id);
                }

                // Determine which step to return to
                const returnStep = appContext.caseService.returnToCirStep.value;
                const startAtStep = appContext.caseService.shouldRestartCount.value
                    ? "start"
                    : returnStep
                      ? returnStep
                      : undefined;

                appContext.navigate({
                    path: "cirSetupScreen",
                    args: { startAtStep },
                });
            } else if (stateBeforeHeaderLogin !== null) {
                // Header login or logout from Setup.tsx - return to previous state
                setState(stateBeforeHeaderLogin);
                setStateBeforeHeaderLogin(null);
            } else {
                // First role login, continue normal flow
                setState(State.START_COUNT_INSTRUCTION);
            }
        } else {
            console.warn("Badge scan failed:", error);
        }
    };

    const handleLogoutClick = (role: "CIR" | "SCR") => {
        setLogoutRole(role);
        setShowLogoutPopup(true);
    };

    const handleConfirmLogout = async () => {
        if (!logoutRole) return;

        const bothLoggedIn = !!(circulatorUser && scrubUser);
        const loggedOutUser = logoutRole === "CIR" ? circulatorUser : scrubUser;
        const remainingUser = logoutRole === "CIR" ? scrubUser : circulatorUser;
        const remainingRole = logoutRole === "CIR" ? "SCR" : "CIR";

        const result = await logout(logoutRole);

        if (result.success) {
            setShowLogoutPopup(false);
            const currentLogoutRole = logoutRole;
            setLogoutRole(null);

            if (bothLoggedIn && loggedOutUser && remainingUser) {
                setLogoutToastMessage(
                    t("logout.loggedOutNotification", {
                        loggedOutUser: `${loggedOutUser.first_name} ${loggedOutUser.last_name}`,
                        loggedOutRole: currentLogoutRole,
                        remainingUser: `${remainingUser.first_name} ${remainingUser.last_name}`,
                        remainingRole: remainingRole,
                    }),
                );
            }

            // Setup.tsx logout flow:
            // - If only one role was logged in (now zero): Force re-login to continue
            // - Otherwise stay on current screen
            if (!result.at_least_one_still_logged_in) {
                // Only one role was logged in, now zero - must force re-login
                // Save current state so we can return to it after re-login
                setStateBeforeHeaderLogin(state);
                setSelectedRole(currentLogoutRole === "CIR" ? HayAppUserType.Circulator : HayAppUserType.ScrubNurse);
                setState(State.ROLE_SELECTION);
            }
            // If at_least_one_still_logged_in is true, do nothing - stay on current screen
        }
    };

    //TODO: Refactor back arrow logic
    const onBackClicked = async () => {
        if (state == State.ROLE_SELECTION) {
            // Check if this is the second role selection
            if (previousState === State.PROCEDURE_KIT_VERIFIED) {
                // Going back from second role selection
                setPreviousState(null);
                setState(State.PROCEDURE_KIT_VERIFIED);
            } else {
                // First role selection - go back to system check
                setState(State.SYSTEM_CHECK);
            }
        } else if (state == State.SCAN_BADGE) {
            // Check if this is from header login
            if (stateBeforeHeaderLogin !== null) {
                // Going back from header badge scan - return to saved state and clear
                setState(stateBeforeHeaderLogin);
                setStateBeforeHeaderLogin(null);
            } else if (previousState === State.PROCEDURE_KIT_VERIFIED) {
                // Going back from second badge scan - return to procedure kit verified
                setState(State.PROCEDURE_KIT_VERIFIED);
            } else {
                // First badge scan - go back to role selection
                setState(State.ROLE_SELECTION);
            }
        } else if (state == State.MANUAL_LOGIN) {
            setState(State.SCAN_BADGE);
        } else if (state == State.START_COUNT_INSTRUCTION) {
            // Going back logs out the current user and returns to scan badge
            // Clear the logged in user
            if (selectedRole === HayAppUserType.Circulator) {
                appContext.caseService.circulator.set(undefined);
            } else if (selectedRole === HayAppUserType.ScrubNurse) {
                appContext.caseService.scrub.set(undefined);
            }
            setState(State.SCAN_BADGE);
        } else if (state == State.ROOM_SCAN_CAMERA) {
            appContext.parlayWrapper.hayScanner.close_active_screen().catch((err) => {
                console.error("Failed to close iTrace scanner:", err);
            });
            setState(State.START_COUNT_INSTRUCTION);
        } else if (state == State.SELECT_SURGEON_NEW) {
            // Clear surgeon selection when going back
            setSelectedSurgeon(null);
            appContext.caseService.surgeon.set(undefined);
            try {
                await appContext.caseService.parlayInterface.caseManager.clear_surgeon();
            } catch (error) {
                console.error("Failed to clear surgeon from backend:", error);
            }
            setState(State.ROOM_SCAN_VERIFIED);
        } else if (state == State.SELECT_CASE_TYPE) {
            // If we're adding from case summary, go back to summary
            if (isAddingFromCaseSummary) {
                setIsAddingFromCaseSummary(false);
                setState(State.CASE_TYPE_SUMMARY);
            } else {
                // Clear the most recently selected surgeon and go back to surgeon selection
                setSelectedSurgeon(null);
                appContext.caseService.surgeon.set(undefined);
                try {
                    await appContext.caseService.parlayInterface.caseManager.clear_surgeon();
                } catch (error) {
                    console.error("Failed to clear surgeon from backend:", error);
                }
                setState(State.SELECT_SURGEON_NEW);
            }
        } else if (state == State.SELECT_ADD_ON_CASE_TYPE) {
            if (editingCaseGroupIndex !== -1) {
                // If editing, cancel changes and go back to summary
                setEditingCaseGroupIndex(-1);
                setSelectedPrimaryCaseType(null);
                setSelectedAddOnCaseTypes([]);
                setState(State.CASE_TYPE_SUMMARY);
            } else {
                // Clear the selected primary case type and add-on selections, go back to case type selection
                setSelectedPrimaryCaseType(null);
                setSelectedAddOnCaseTypes([]);
                setState(State.SELECT_CASE_TYPE);
            }
        } else if (state == State.CASE_TYPE_SUMMARY) {
            // If viewing surgeon details from SELECTED_SURGEONS, go back to that screen
            if (viewingSurgeonIndex !== null) {
                backFromViewingSurgeonDetails();
            } else {
                // Clear all case group selections when going back from summary
                setSelectedCaseGroups([]);
                setSelectedPrimaryCaseType(null);
                setSelectedAddOnCaseTypes([]);
                setIsAddingFromCaseSummary(false);
                try {
                    await appContext.caseService.parlayInterface.caseManager.clear_case_types();
                } catch (error) {
                    console.error("Failed to clear case types from backend:", error);
                }
                setState(State.SELECT_SURGEON_NEW);
            }
        } else if (state == State.SELECTED_SURGEONS) {
            // Go back to Case Type Summary if viewing details, otherwise nowhere to go back
            if (viewingSurgeonIndex !== null) {
                backFromViewingSurgeonDetails();
            }
            // If not viewing, this is the first surgeon selection screen, no back action
        } else if (state == State.SUTURE_SHEET_NOT_AVAILABLE) {
            // Go back to Summary Sheet
            setState(State.SUMMARY_SHEET);
            setPreviousState(null);
        } else if (state == State.SELECT_SUTURE_SHEET) {
            // Go back to SutureSheetNotAvailable
            setState(State.SUTURE_SHEET_NOT_AVAILABLE);
        } else if (state == State.REVIEW_REDUNDANT_NEEDLES) {
            // Reset redundant needle adjustments when going back
            setRedundantNeedleItems((items) => items.map((item) => ({ ...item, potentialRedundantPack: 0 })));
            try {
                await appContext.caseService.parlayInterface.caseManager.clear_suture_sheets();
            } catch (error) {
                console.error("Failed to clear suture sheets from backend:", error);
            }
            setState(State.SELECTED_SURGEONS);
        } else if (state == State.SUMMARY_SHEET) {
            // Clear summary sheet items when going back
            setSummarySheetItems([]);
            setState(State.REVIEW_REDUNDANT_NEEDLES);
        } else if (state == State.NEEDLE_DETAIL) {
            // Navigate back to the source screen
            if (needleDetailSource === "summarySheet") {
                setState(State.SUMMARY_SHEET);
            } else {
                setState(State.REVIEW_REDUNDANT_NEEDLES);
            }
            setSelectedNeedleItem(null);
            setNeedlePackInfo(null);
        } else if (state == State.SET_ASIDE_OPEN) {
            setState(State.SUMMARY_SHEET);
        } else if (state == State.IDENTIFY_OPEN_NEEDLES) {
            setState(State.SET_ASIDE_OPEN);
        } else if (state == State.PLACE_OPEN_BOX) {
            setState(State.IDENTIFY_OPEN_NEEDLES);
        } else if (state == State.SET_ASIDE_JIT) {
            setState(State.PLACE_OPEN_BOX);
        } else if (state == State.IDENTIFY_JIT_NEEDLES) {
            setState(State.SET_ASIDE_JIT);
        } else if (state == State.PLACE_JIT_BOX) {
            setState(State.IDENTIFY_JIT_NEEDLES);
        } else if (state == State.SET_ASIDE_CLOSING) {
            setState(State.PLACE_JIT_BOX);
        } else if (state == State.IDENTIFY_CLOSING_NEEDLES) {
            setState(State.SET_ASIDE_CLOSING);
        } else if (state == State.PLACE_CLOSING_BOX) {
            setState(State.IDENTIFY_CLOSING_NEEDLES);
        } else if (state == State.SCAN_CLOSING_BOX) {
            appContext.parlayWrapper.hayScanner.close_active_screen().catch((err) => {
                console.error("Failed to close iTrace scanner:", err);
            });
            setState(State.PLACE_CLOSING_BOX);
        } else if (state == State.CLOSING_BOX_SCAN_ERROR) {
            setState(State.SCAN_CLOSING_BOX);
        } else if (state == State.CLOSING_BOX_VERIFIED) {
            setState(State.SCAN_CLOSING_BOX);
        } else if (state == State.SCAN_PROCEDURE_KIT) {
            appContext.parlayWrapper.hayScanner.close_active_screen().catch((err) => {
                console.error("Failed to close iTrace scanner:", err);
            });
            setState(State.CLOSING_BOX_VERIFIED);
        } else if (state == State.PROCEDURE_KIT_SCAN_ERROR) {
            setState(State.SCAN_PROCEDURE_KIT);
        } else if (state == State.PROCEDURE_KIT_VERIFIED) {
            setState(State.SCAN_PROCEDURE_KIT);
        } else if (state == State.SCAN_BADGE_ENTRY) {
            setState(State.PROCEDURE_KIT_VERIFIED);
        }
    };

    const addPrimaryFromCaseSummary = () => {
        setSelectedPrimaryCaseType(null);
        setSelectedAddOnCaseTypes([]);
        setEditingCaseGroupIndex(-1);
        setIsAddingFromCaseSummary(true);
        setState(State.SELECT_CASE_TYPE);
    };

    const clearSurgeonAndSelectAnother = async () => {
        // Clear surgeon selection and navigate to surgeon selection
        setSelectedSurgeon(null);
        setSelectedCaseGroups([]);
        setSelectedPrimaryCaseType(null);
        setSelectedAddOnCaseTypes([]);
        setEditingCaseGroupIndex(-1);
        setViewingSurgeonIndex(null);
        appContext.caseService.surgeon.set(undefined);
        try {
            await appContext.caseService.parlayInterface.caseManager.clear_surgeon();
        } catch (error) {
            console.error("Failed to clear surgeon from backend:", error);
        }
        setState(State.SELECT_SURGEON_NEW);
    };

    const addNewSurgeonFromSelectedSurgeons = () => {
        // Clear current surgeon and case groups, navigate to select surgeon
        setSelectedSurgeon(null);
        setSelectedCaseGroups([]);
        setSelectedPrimaryCaseType(null);
        setSelectedAddOnCaseTypes([]);
        setEditingCaseGroupIndex(-1);
        setState(State.SELECT_SURGEON_NEW);
    };

    const confirmSurgeonCaseTypes = () => {
        // Add the current surgeon with their case groups to the list
        if (selectedSurgeon && selectedCaseGroups.length > 0) {
            const newSurgeonEntry: SetupSurgeonWithCaseGroups = {
                surgeon: selectedSurgeon,
                caseGroups: [...selectedCaseGroups],
            };
            setSelectedSurgeons((prev) => [...prev, newSurgeonEntry]);

            // Clear current selection
            setSelectedSurgeon(null);
            setSelectedCaseGroups([]);
            setSelectedPrimaryCaseType(null);
            setSelectedAddOnCaseTypes([]);
            setEditingCaseGroupIndex(-1);
        }
        setState(State.SELECTED_SURGEONS);
    };

    const removeSurgeonFromList = (index: number) => {
        setSelectedSurgeons((prev) => prev.filter((_, i) => i !== index));
    };

    const viewSurgeonCaseDetails = (index: number) => {
        const surgeonWithCases = selectedSurgeons[index];
        if (surgeonWithCases) {
            setViewingSurgeonIndex(index);
            setSelectedSurgeon(surgeonWithCases.surgeon);
            setSelectedCaseGroups(surgeonWithCases.caseGroups);
            setState(State.CASE_TYPE_SUMMARY);
        }
    };

    const backFromViewingSurgeonDetails = () => {
        // Save changes to the surgeon's case groups before going back
        if (viewingSurgeonIndex !== null && selectedSurgeon && selectedCaseGroups.length > 0) {
            setSelectedSurgeons((prev) => {
                const updated = [...prev];
                updated[viewingSurgeonIndex] = {
                    surgeon: selectedSurgeon,
                    caseGroups: selectedCaseGroups,
                };
                return updated;
            });
        }

        // Clear viewing state and return to SELECTED_SURGEONS
        setViewingSurgeonIndex(null);
        setSelectedSurgeon(null);
        setSelectedCaseGroups([]);

        setState(State.SELECTED_SURGEONS);
    };

    const editCaseGroupAddOns = (index: number) => {
        const groups = selectedCaseGroups;
        if (groups && groups[index]) {
            setEditingCaseGroupIndex(index);
            setSelectedPrimaryCaseType(groups[index].primary);
            setSelectedAddOnCaseTypes(groups[index].addOns);
            setState(State.SELECT_ADD_ON_CASE_TYPE);
        }
    };

    const commitCurrentSelection = (primary: CaseType, addOns: CaseType[]) => {
        const currentGroups = selectedCaseGroups || [];
        const newGroups = [...currentGroups];

        if (editingCaseGroupIndex !== -1) {
            newGroups[editingCaseGroupIndex] = { primary, addOns };
            setEditingCaseGroupIndex(-1);
        } else {
            newGroups.push({ primary, addOns });
        }

        setSelectedCaseGroups(newGroups);
        setState(State.CASE_TYPE_SUMMARY);
    };

    const removeCaseGroup = (index: number) => {
        const currentGroups = selectedCaseGroups || [];
        const newGroups = [...currentGroups];
        newGroups.splice(index, 1);
        setSelectedCaseGroups(newGroups);
    };

    const removeAddOnFromGroup = (groupIndex: number, addOnIndex: number) => {
        const currentGroups = selectedCaseGroups || [];
        if (!currentGroups[groupIndex]) return;

        const newGroups = [...currentGroups];
        const group = { ...newGroups[groupIndex] };
        const newAddOns = [...group.addOns];
        newAddOns.splice(addOnIndex, 1);
        group.addOns = newAddOns;
        newGroups[groupIndex] = group;

        setSelectedCaseGroups(newGroups);
    };

    const onNextClicked = () => {
        if (state == State.CASE_TYPE_SUMMARY) {
            // If viewing surgeon details from SELECTED_SURGEONS, go back to that screen
            if (viewingSurgeonIndex !== null) {
                backFromViewingSurgeonDetails();
            } else {
                // Otherwise, confirm surgeon and their case types
                confirmSurgeonCaseTypes();
            }
        } else if (state == State.SELECTED_SURGEONS) {
            // Check if we have any surgeons selected
            if (selectedSurgeons.length === 0) {
                console.error("No surgeons selected");
                return;
            }

            // Send surgeons with their case groups to backend (use case_groups format, not case_types)
            const surgeonsData = selectedSurgeons.map((surgeonWithCases) => ({
                surgeon_id: surgeonWithCases.surgeon.surgeon_id,
                case_groups: surgeonWithCases.caseGroups.map((group) => ({
                    primary: {
                        case_type_id: group.primary.case_type_id,
                        name: group.primary.name,
                        cpt_code: group.primary.cpt_code,
                        is_primary: group.primary.is_primary,
                        secondary_cpt_codes: group.primary.secondary_cpt_codes || [],
                    },
                    addOns: group.addOns.map((addOn) => ({
                        case_type_id: addOn.case_type_id,
                        name: addOn.name,
                        cpt_code: addOn.cpt_code,
                        is_primary: addOn.is_primary,
                        secondary_cpt_codes: addOn.secondary_cpt_codes || [],
                    })),
                })),
            }));

            // Fetch suture sheets for all surgeons and their case groups
            const fetchSheets = async () => {
                try {
                    // Send surgeons and case types to backend
                    await appContext.parlayWrapper.caseManager.set_surgeons_with_case_types(surgeonsData);

                    const allSheetIds: string[] = [];
                    // const allMissingCptCodes: string[] = [];
                    const allSummaries: CaseTypeSummaryInfo[] = [];
                    const allSheetsByCaseGroup = new Map<number, string[]>();
                    let globalGroupIndex = 0;

                    // Process each surgeon and their case groups
                    for (const surgeonWithCases of selectedSurgeons) {
                        const surgeon = surgeonWithCases.surgeon;
                        const caseGroups = surgeonWithCases.caseGroups;

                        // Fetch suture sheets for this surgeon
                        const surgeonSheets = await appContext.caseService.getSutureSheetsForSurgeon(
                            surgeon.surgeon_id,
                        );

                        // Process each case group for this surgeon
                        for (const group of caseGroups) {
                            const groupSheetIds: string[] = [];

                            // Process primary case type
                            const primaryCptCode = group.primary.cpt_code;
                            // Always process case types, even if cpt_code is missing
                            const sheet = primaryCptCode
                                ? surgeonSheets.find((s) => s.cpt_codes?.includes(primaryCptCode))
                                : null;
                            if (sheet) {
                                allSheetIds.push(sheet.suture_sheet_id);
                                groupSheetIds.push(sheet.suture_sheet_id);
                                const needleCount = sheet.suture_sheet_items.reduce(
                                    (sum, item) => sum + item.num_packs,
                                    0,
                                );
                                allSummaries.push({
                                    name: group.primary.name,
                                    cptCode: primaryCptCode || "",
                                    needleCount,
                                    hasSutureSheet: true,
                                });
                            } else {
                                // Add case types without suture sheets to dropdown with hasSutureSheet: false
                                console.log(
                                    `Adding ${group.primary.name} (${primaryCptCode || "no-cpt"}) to dropdown without suture sheet`,
                                );
                                allSummaries.push({
                                    name: group.primary.name,
                                    cptCode: primaryCptCode || "",
                                    needleCount: 0,
                                    hasSutureSheet: false,
                                });
                            }

                            // Process add-on case types
                            for (const addOn of group.addOns) {
                                const addOnCptCode = addOn.cpt_code;
                                // Always process case types, even if cpt_code is missing
                                const sheet = addOnCptCode
                                    ? surgeonSheets.find((s) => s.cpt_codes?.includes(addOnCptCode))
                                    : null;
                                if (sheet) {
                                    allSheetIds.push(sheet.suture_sheet_id);
                                    groupSheetIds.push(sheet.suture_sheet_id);
                                    const needleCount = sheet.suture_sheet_items.reduce(
                                        (sum, item) => sum + item.num_packs,
                                        0,
                                    );
                                    allSummaries.push({
                                        name: addOn.name,
                                        cptCode: addOnCptCode || "",
                                        needleCount,
                                        hasSutureSheet: true,
                                    });
                                } else {
                                    // Add case types without suture sheets to dropdown with hasSutureSheet: false
                                    console.log(
                                        `Adding ${addOn.name} (${addOnCptCode || "no-cpt"}) to dropdown without suture sheet`,
                                    );
                                    allSummaries.push({
                                        name: addOn.name,
                                        cptCode: addOnCptCode || "",
                                        needleCount: 0,
                                        hasSutureSheet: false,
                                    });
                                }
                            }
                            allSheetsByCaseGroup.set(globalGroupIndex, groupSheetIds);
                            globalGroupIndex++;
                        }
                    }

                    // Deduplicate allSummaries by CPT code - if any instance has a sheet, show it as having one
                    const summariesByCpt = new Map<string, CaseTypeSummaryInfo>();
                    for (const summary of allSummaries) {
                        const existing = summariesByCpt.get(summary.cptCode);
                        if (!existing) {
                            summariesByCpt.set(summary.cptCode, summary);
                        } else {
                            // If this one has a sheet and existing doesn't, update to show it has a sheet
                            if (summary.hasSutureSheet && !existing.hasSutureSheet) {
                                summariesByCpt.set(summary.cptCode, {
                                    ...existing,
                                    hasSutureSheet: true,
                                    needleCount: existing.needleCount + summary.needleCount,
                                });
                            } else {
                                // Just accumulate needle counts
                                summariesByCpt.set(summary.cptCode, {
                                    ...existing,
                                    needleCount: existing.needleCount + summary.needleCount,
                                });
                            }
                        }
                    }
                    const deduplicatedSummaries = Array.from(summariesByCpt.values());

                    setCaseTypeSummaries(deduplicatedSummaries);

                    // Save selected sheet IDs to backend
                    if (allSheetIds.length > 0) {
                        await appContext.caseService.setSelectedSutureSheets(allSheetIds);
                    }

                    // Always proceed to review redundant needles with available sheets
                    await buildRedundantNeedleItems(allSheetsByCaseGroup);
                    setState(State.REVIEW_REDUNDANT_NEEDLES);
                } catch (error) {
                    console.error("Failed to fetch suture sheets:", error);
                }
            };

            fetchSheets();
        }
    };

    const updateRedundantPack = (id: string, newValue: number) => {
        setRedundantNeedleItems((items) =>
            items.map((item) => (item.id === id ? { ...item, potentialRedundantPack: newValue } : item)),
        );
        if (selectedNeedleItem && selectedNeedleItem.id === id) {
            setSelectedNeedleItem({ ...selectedNeedleItem, potentialRedundantPack: newValue });
        }
    };

    const handleMoreInfo = async (item: RedundantNeedleItem | EnrichedSutureSheetItem, source: NeedleDetailSource) => {
        let redundantItem: RedundantNeedleItem;

        if ("subLabel" in item) {
            redundantItem = item;
        } else {
            redundantItem = {
                id: item.id || String(item.fda_gudid),
                nomenclature: item.nomenclature,
                subLabel: item.product_code,
                needlesPerPack: item.needles_per_pack,
                packsToOpen: item.num_packs,
                sutureNeedleUse: item.suture_needle_use,
                sutureNeedleCategory: item.suture_needle_category as SutureNeedleCategory,
                potentialRedundantPack: 0,
                cptCode: item.cptCode ?? undefined,
                fdaGudid: item.fda_gudid,
            };
        }

        setSelectedNeedleItem(redundantItem);
        setNeedleDetailSource(source);
        try {
            let packInfo = null;

            if (redundantItem.fdaGudid) {
                const allPackInfo = appContext.caseService.suturePackInfoMap.value;
                packInfo = allPackInfo[redundantItem.fdaGudid];
                if (!packInfo) {
                    packInfo = await appContext.caseService.getSuturePackInfo(redundantItem.fdaGudid);
                }
            }

            setNeedlePackInfo(packInfo || null);
        } catch (error) {
            console.error("Failed to fetch needle pack info:", error);
            setNeedlePackInfo(null);
        }

        setState(State.NEEDLE_DETAIL);
    };

    const handleSummarySheetConfirm = () => {
        setState(State.PLACE_CLOSING_BOX);
    };

    const handleSetAsideOpen = () => {
        setState(State.SET_ASIDE_OPEN);
    };

    const handleSetAsideJit = () => {
        setState(State.SET_ASIDE_JIT);
    };

    const handleSetAsideClosing = () => {
        setState(State.SET_ASIDE_CLOSING);
    };

    const handleOpenNeedlesComplete = () => {
        setOpenNeedlesIdentified(true);
        setState(State.PLACE_OPEN_BOX);
    };

    const handleJitNeedlesComplete = () => {
        setJitNeedlesIdentified(true);
        setState(State.PLACE_JIT_BOX);
    };

    const handleClosingNeedlesComplete = () => {
        setClosingNeedlesIdentified(true);
        setState(State.PLACE_CLOSING_BOX);
    };

    const handleSkipToStage2 = async () => {
        try {
            const result = await appContext.parlayWrapper.caseManager.skip_to_stage_2();

            if (!result.success) {
                console.error("Skip to stage 2 failed:", result.error);
                return;
            }

            console.log("Skip to Stage 2 - Selected staff:", {
                cir: result.cir_name,
                scr: result.scr_name,
                surgeon: result.surgeon_name,
            });
        } catch (error) {
            console.error("Error skipping to stage 2:", error);
        }
    };

    const handleSkipRedundancy = () => {
        // Skip means keep all packs (no redundancy)
        const zeroedItems = redundantNeedleItems.map((item) => ({ ...item, potentialRedundantPack: 0 }));
        setRedundantNeedleItems(zeroedItems);
        // Pass zeroed items directly to avoid reading stale state before React re-renders
        buildSummarySheetItems(undefined, zeroedItems).then(() => setState(State.SUMMARY_SHEET));
    };

    const handleReviewRedundantNeedlesContinue = async () => {
        // Build summary sheet items from redundant needle items with JIT adjustments
        try {
            await buildSummarySheetItems();
        } catch (err) {
            console.error("buildSummarySheetItems failed (bypass mode — continuing anyway):", err);
        }
        // If backend returned no items (bypass/no real case data), build mock summary
        // items from the redundant needle items already displayed on screen
        if (summarySheetItems.length === 0 && redundantNeedleItems.length > 0) {
            const mockItems: EnrichedSutureSheetItem[] = redundantNeedleItems.map((item, idx) => ({
                id: `bypass-summary-${idx}`,
                cptCode: null,
                product_code: item.subLabel,
                nomenclature: item.nomenclature,
                needles_per_pack: item.needlesPerPack,
                suture_gauge: "",
                suture_type: item.nomenclature,
                needle_name: "",
                fda_gudid: item.fdaGudid || 0,
                suture_needle_use: Array.isArray(item.sutureNeedleUse)
                    ? item.sutureNeedleUse
                    : [item.sutureNeedleUse || ""],
                suture_needle_category: item.sutureNeedleCategory,
                num_packs: Math.max(0, item.packsToOpen - item.potentialRedundantPack),
            }));
            setSummarySheetItems(mockItems);
        }
        setState(State.SUMMARY_SHEET);
    };

    const buildSummarySheetItems = async (
        replacementSheetsOverride?: Map<string, ReplacementSheetInfo>,
        redundantItemsOverride?: RedundantNeedleItem[],
    ) => {
        // Use provided replacement sheets or fall back to state
        const sheetsToUse = replacementSheetsOverride || replacementSheets;

        // Get selected suture sheet IDs
        const sheets = await appContext.caseService.getSelectedSutureSheets();
        const sheetIds = sheets.map((s) => s.suture_sheet_id);

        // Build redundancy adjustments from user input
        const redundantAdjustments = (redundantItemsOverride ?? redundantNeedleItems)
            .filter((item) => item.potentialRedundantPack > 0)
            .map((item) => ({
                product_code: item.subLabel,
                suture_needle_use: Array.isArray(item.sutureNeedleUse)
                    ? item.sutureNeedleUse
                    : item.sutureNeedleUse
                      ? [item.sutureNeedleUse]
                      : [],
                redundant_packs: item.potentialRedundantPack,
            }));

        // Call backend to calculate summary sheet with redundancy
        let items = await appContext.caseService.calculateSummarySheetWithRedundancy(sheetIds, redundantAdjustments);

        // Apply CPT code overrides for replacement sheets
        // Map sheet IDs to their replacement CPT codes for quick lookup
        const sheetIdToReplacementCpt = new Map<string, string>();
        sheetsToUse.forEach((replacement) => {
            sheetIdToReplacementCpt.set(replacement.sheetId, replacement.replacementCptCode);
        });

        // Update cptCode for items from replacement sheets
        items = items.map((item: EnrichedSutureSheetItem) => {
            // Extract sheet ID from item ID
            // Original items have format: "sheetId_fdaGudid"
            // Aggregated items have format: "productCode_sutureNeedleUse" (no sheet ID)
            const itemId = item.id || "";
            const sheetIdMatch = itemId.match(/^(.+?)_\d+$/);

            if (sheetIdMatch) {
                const itemSheetId = sheetIdMatch[1];
                const replacementCpt = sheetIdToReplacementCpt.get(itemSheetId);

                if (replacementCpt) {
                    // This item is from a replacement sheet - override its cptCode
                    console.log(`Overriding cptCode for item ${itemId} from ${item.cptCode} to ${replacementCpt}`);
                    return { ...item, cptCode: replacementCpt };
                }
            }

            return item;
        });

        console.log(
            `buildSummarySheetItems: Total items = ${items.length}, Replacement sheets =`,
            Array.from(sheetsToUse.values()),
        );

        // Fetch full pack info for each unique fda_gudid to populate suturePackInfoMap
        const uniqueFdaGuids = [...new Set(items.map((item: { fda_gudid?: number }) => item.fda_gudid))];
        for (const fdaGuid of uniqueFdaGuids) {
            if (fdaGuid && !appContext.caseService.suturePackInfoMap.value[fdaGuid]) {
                await appContext.caseService.getSuturePackInfo(fdaGuid);
            }
        }

        // Persist redundancy adjustments and final computed items to backend so
        // SurgeonsView and any later surgeon additions can use them correctly.
        await appContext.caseService.setRedundantAdjustments(redundantAdjustments);
        await appContext.caseService.parlayInterface.caseManager.set_enriched_summary_items(items);

        setSummarySheetItems(items);
    };

    // Handler for when user selects a case type without a suture sheet from SummarySheet dropdown
    const handleCaseTypeWithoutSheetSelected = async (cptCode: string, caseTypeName: string) => {
        try {
            // Find the first surgeon who has a sheet for this CPT code
            const allSurgeons = await appContext.caseService.getSurgeons();
            let foundSurgeon: Surgeon | null = null;

            for (const surgeon of allSurgeons) {
                const hasSheet = await appContext.caseService.surgeonHasSutureSheetForCpt(surgeon.surgeon_id, cptCode);
                if (hasSheet) {
                    foundSurgeon = surgeon;
                    break;
                }
            }

            // If no surgeon has a sheet, fall back to the first surgeon in the list
            if (!foundSurgeon && allSurgeons.length > 0) {
                foundSurgeon = allSurgeons[0] ?? null;
            }

            // Store the found surgeon
            setFirstSurgeonWithSheet(foundSurgeon);

            // Set up state for SUTURE_SHEET_NOT_AVAILABLE screen
            setMissingCaseTypes([
                {
                    name: caseTypeName,
                    cptCode: cptCode,
                },
            ]);
            setSelectedMissingCptCode(cptCode);
            setCurrentSelectingCptCode(cptCode);
            setPreviousState(State.SUMMARY_SHEET);

            setState(State.SUTURE_SHEET_NOT_AVAILABLE);
        } catch (error) {
            console.error("Failed to handle case type without sheet:", error);
        }
    };

    const handleSutureSheetNotAvailableSeeOther = () => {
        // Navigate to SELECT_SUTURE_SHEET to show other surgeons with sheets for this CPT code
        setState(State.SELECT_SUTURE_SHEET);
    };

    const handleSutureSheetNotAvailableConfirm = async () => {
        if (!firstSurgeonWithSheet) {
            setState(State.SUMMARY_SHEET);
            return;
        }
        try {
            const allSheets = await appContext.caseService.getSutureSheetsForSurgeon(firstSurgeonWithSheet.surgeon_id);

            // Try to find a sheet matching the currently displayed missing case type's CPT
            let sheet = allSheets.find((s) => s.cpt_codes?.includes(selectedMissingCptCode)) ?? null;

            // Fall back to the surgeon's first sheet (first case type they have)
            if (!sheet && allSheets.length > 0) {
                sheet = allSheets[0];
            }

            if (!sheet) {
                setState(State.SUMMARY_SHEET);
                return;
            }

            // originalCptCode = the sheet's own CPT; replacementCptCode = the missing one
            // This ensures the missing case type's name/cpt code is preserved in summary
            const originalCptCode = sheet.cpt_codes?.[0] || "";
            const replacementCptCode = selectedMissingCptCode;

            const newReplacementSheets = new Map(replacementSheets);
            newReplacementSheets.set(sheet.suture_sheet_id, {
                sheetId: sheet.suture_sheet_id,
                originalCptCode,
                replacementCptCode,
                surgeonName: `${firstSurgeonWithSheet.first_name} ${firstSurgeonWithSheet.last_name}`,
            });
            setReplacementSheets(newReplacementSheets);

            // Add to backend selected sheets (deduplicate)
            const currentSheets = await appContext.caseService.getSelectedSutureSheets();
            const existingIds = new Set(currentSheets.map((s) => s.suture_sheet_id));
            if (!existingIds.has(sheet.suture_sheet_id)) {
                await appContext.caseService.setSelectedSutureSheets([...existingIds, sheet.suture_sheet_id]);
            }

            await buildSummarySheetItems(newReplacementSheets);

            let sheetNeedleCount = 0;
            for (const item of sheet.suture_sheet_items) {
                const packInfo = await appContext.caseService.getSuturePackInfo(item.fda_gudid);
                const needlesPerPack = packInfo?.num_needles || 1;
                sheetNeedleCount += needlesPerPack * item.num_packs;
            }

            setCaseTypeSummaries((prev) =>
                prev.map((ct) =>
                    ct.cptCode === selectedMissingCptCode
                        ? { ...ct, hasSutureSheet: true, needleCount: ct.needleCount + sheetNeedleCount }
                        : ct,
                ),
            );

            setState(State.SUMMARY_SHEET);
        } catch (error) {
            console.error("Failed to apply suture sheet on confirm:", error);
            setState(State.SUMMARY_SHEET);
        }
    };

    const handleSelectSutureSheetContinue = async (selectedOption: SurgeonSheetOption) => {
        // Store the selected sheet and update summary sheet items to include this sheet
        try {
            // Get the selected sheet items
            const sheet = selectedOption.sheet;

            // Store the replacement mapping
            const originalCptCode = sheet.cpt_codes?.[0] || "";
            const replacementCptCode = currentSelectingCptCode; // The CPT code we're replacing (the one that was missing)

            const newReplacementSheets = new Map(replacementSheets);
            newReplacementSheets.set(sheet.suture_sheet_id, {
                sheetId: sheet.suture_sheet_id,
                originalCptCode,
                replacementCptCode,
                surgeonName: `${selectedOption.surgeon.first_name} ${selectedOption.surgeon.last_name}`,
            });
            setReplacementSheets(newReplacementSheets);

            // Add this sheet to the backend's selected sheets
            const currentSheets = await appContext.caseService.getSelectedSutureSheets();
            const allSheetIds = [...currentSheets.map((s) => s.suture_sheet_id), sheet.suture_sheet_id];
            await appContext.caseService.setSelectedSutureSheets(allSheetIds);

            // Rebuild summary sheet items with the new sheet (will apply CPT overrides)
            // Pass the new replacement sheets map directly to avoid async state issues
            await buildSummarySheetItems(newReplacementSheets);

            // Calculate needle count from the selected sheet
            let sheetNeedleCount = 0;
            for (const item of sheet.suture_sheet_items) {
                const packInfo = await appContext.caseService.getSuturePackInfo(item.fda_gudid);
                const needlesPerPack = packInfo?.num_needles || 1;
                sheetNeedleCount += needlesPerPack * item.num_packs;
            }

            console.log(
                `Selected replacement sheet ${sheet.suture_sheet_id} for CPT ${currentSelectingCptCode}, needle count: ${sheetNeedleCount}`,
            );

            // Update case type summaries to mark this case type as having a sheet and update needle count
            setCaseTypeSummaries((prev) =>
                prev.map((ct) => {
                    if (ct.cptCode === currentSelectingCptCode) {
                        console.log(
                            `Updating summary for ${ct.name} (${ct.cptCode}): needleCount ${ct.needleCount} -> ${ct.needleCount + sheetNeedleCount}`,
                        );
                        return { ...ct, hasSutureSheet: true, needleCount: ct.needleCount + sheetNeedleCount };
                    }
                    return ct;
                }),
            );

            // Return to SUMMARY_SHEET
            setState(State.SUMMARY_SHEET);
        } catch (error) {
            console.error("Failed to apply selected suture sheet:", error);
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

            // Navigate back to system check (initial screen)
            setState(State.SYSTEM_CHECK);

            // Reset local Setup component state
            setSelectedRole(undefined);
            setSelectedPrimaryCaseType(null);
            setSelectedAddOnCaseTypes([]);
            setSelectedCaseGroups([]);
            setEditingCaseGroupIndex(-1);
            setSelectedSurgeon(null);
            setSelectedSurgeons([]);
            setRedundantNeedleItems([]);
            setSummarySheetItems([]);
            setMissingCaseTypes([]);
            setSelectedMissingCptCode("");
            setPreviousState(null);
            setCaseTypeSummaries([]);
            setCurrentSelectingCptCode("");
            setReplacementSheets(new Map());
            setSelectedNeedleItem(null);
            setNeedleDetailSource("summarySheet");
            setNeedlePackInfo(null);
        } catch (error) {
            console.error("Failed to abort case:", error);
        }
        setState(State.ABORTED_CASE);
    };

    function renderMain() {
        if (state == State.SYSTEM_CHECK) {
            if (systemCheckGate.kind === "loading") {
                return (
                    <div className={styles.systemCheckProvisionLoading}>
                        <p>{t("setup.checkingDeviceProvisioning")}</p>
                    </div>
                );
            }
            if (systemCheckGate.is_provisioned) {
                return (
                    <SystemCheck
                        onProceed={() => setState(State.ROLE_SELECTION)}
                        onAdminPanel={() => {
                            /* TODO: Handle admin panel navigation */
                        }}
                        onSkipToStage2={
                            systemCheckGate.kind === "ready" && systemCheckGate.development_mode
                                ? handleSkipToStage2
                                : undefined
                        }
                    />
                );
            }
            if (systemCheckGate.group_data_access_denied) {
                return (
                    <NeedsProvisioning
                        titleKey="setup.groupAccessDenied.title"
                        messageKey="setup.groupAccessDenied.message"
                        onTechSupportLogin={() => {
                            appContext.navigate({ path: "techSupportLogin" });
                        }}
                        onAdminPanel={() => {
                            /* TODO: Handle admin panel navigation */
                        }}
                    />
                );
            }
            return (
                <NeedsProvisioning
                    onTechSupportLogin={() => {
                        appContext.navigate({ path: "techSupportLogin" });
                    }}
                    onAdminPanel={() => {
                        /* TODO: Handle admin panel navigation */
                    }}
                />
            );
        } else if (state == State.ROLE_SELECTION) {
            return (
                <RoleSelection
                    onSelectCIR={() => selectRole(HayAppUserType.Circulator)}
                    onSelectSCR={() => selectRole(HayAppUserType.ScrubNurse)}
                />
            );
        } else if (state == State.SCAN_BADGE) {
            return (
                <ScanBadge
                    role={selectedRole ?? HayAppUserType.Circulator}
                    onScan={handleBadgeScan}
                    onManualLogin={() => {
                        setManualLoginError(null);
                        setState(State.MANUAL_LOGIN);
                    }}
                    isReloginForCirSetup={appContext.caseService.shouldReturnToCirSetup.value}
                />
            );
        } else if (state == State.MANUAL_LOGIN) {
            return (
                <ManualLogin
                    role={selectedRole ?? HayAppUserType.Circulator}
                    onConfirm={async (email: string, password: string) => {
                        const roleName = selectedRole === HayAppUserType.Circulator ? "CIR" : "SCR";
                        setManualLoginError(null);
                        try {
                            // Bypass: accept any non-empty email without backend verification
                            const success = email.trim().length > 0;
                            if (success) {
                                // Try to get real user from backend, fall back to bypass user
                                let hayAppUser: HayAppUser;
                                try {
                                    const users =
                                        await appContext.caseService.parlayInterface.caseManager.get_hayapp_users();
                                    const loggedInUser = users.find(
                                        (u) => u.email?.toLowerCase() === email.toLowerCase(),
                                    );
                                    if (loggedInUser) {
                                        hayAppUser = {
                                            user_id: loggedInUser.user_id,
                                            first_name: loggedInUser.first_name,
                                            last_name: loggedInUser.last_name,
                                            email: loggedInUser.email || "",
                                            roles: loggedInUser.roles.map((r) => {
                                                if (r === "CIR") return HayAppUserType.Circulator;
                                                if (r === "SCR") return HayAppUserType.ScrubNurse;
                                                if (r === "ADMIN") return HayAppUserType.Admin;
                                                return HayAppUserType.Circulator;
                                            }),
                                            badge: loggedInUser.badge,
                                        };
                                    } else {
                                        throw new Error("User not found in backend");
                                    }
                                } catch {
                                    // No real user found — create a bypass user for UI testing
                                    hayAppUser = {
                                        user_id: `bypass-${roleName.toLowerCase()}`,
                                        first_name: email.split("@")[0] || "Test",
                                        last_name: roleName,
                                        email: email,
                                        roles: [selectedRole ?? HayAppUserType.Circulator],
                                        badge: undefined,
                                    };
                                }

                                // Set the appropriate user based on role
                                if (selectedRole === HayAppUserType.Circulator) {
                                    appContext.caseService.circulator.set(hayAppUser);
                                } else if (selectedRole === HayAppUserType.ScrubNurse) {
                                    appContext.caseService.scrub.set(hayAppUser);
                                }

                                // Check if this is the second role login
                                if (previousState === State.PROCEDURE_KIT_VERIFIED) {
                                    // Second role has logged in - ensure staff is saved to backend before navigating
                                    const surgeon = appContext.caseService.surgeon.value;
                                    const circulator = appContext.caseService.circulator.value;
                                    const scrub = appContext.caseService.scrub.value;

                                    if (surgeon && circulator && scrub) {
                                        await appContext.caseService.setCaseStaff(
                                            surgeon.surgeon_id,
                                            circulator.user_id,
                                            scrub.user_id,
                                        );
                                        await appContext.parlayWrapper.caseManager.set_current_cir_screen(
                                            "cirSetupScreen",
                                        );
                                        await appContext.parlayWrapper.caseManager.set_current_scr_screen(
                                            "scrSetupScreen",
                                        );
                                        appContext.navigate({ path: "cirSetupScreen" });
                                    }
                                    setPreviousState(null);
                                } else if (appContext.caseService.shouldReturnToCirSetup.value) {
                                    // Returning to CIR setup after logout during counting
                                    const shouldRestart = appContext.caseService.shouldRestartCount.value;
                                    appContext.caseService.shouldReturnToCirSetup.set(false);
                                    appContext.caseService.skipRoleSelection.set(false);

                                    // Both roles should be logged in at this point
                                    const circulator = appContext.caseService.circulator.value;
                                    const scrub = appContext.caseService.scrub.value;
                                    const surgeon = appContext.caseService.surgeon.value;

                                    if (surgeon && circulator && scrub) {
                                        await appContext.caseService.setCaseStaff(
                                            surgeon.surgeon_id,
                                            circulator.user_id,
                                            scrub.user_id,
                                        );
                                    }

                                    appContext.navigate({
                                        path: "cirSetupScreen",
                                        args: { startAtStep: shouldRestart ? "start" : undefined },
                                    });
                                } else if (stateBeforeHeaderLogin !== null) {
                                    // Header login - return to previous state
                                    setState(stateBeforeHeaderLogin);
                                    setStateBeforeHeaderLogin(null);
                                } else {
                                    // First role login, continue normal flow
                                    setState(State.START_COUNT_INSTRUCTION);
                                }
                            } else {
                                console.error("Manual login failed");
                                setManualLoginError(
                                    t("setup.manualLogin.invalidCredentials", {
                                        defaultValue: "Invalid email or password. Please try again.",
                                    }),
                                );
                            }
                        } catch (error) {
                            console.error("Error during manual login:", error);
                            setManualLoginError(
                                t("setup.manualLogin.loginError", {
                                    defaultValue: "Unable to log in right now. Please try again.",
                                }),
                            );
                        }
                    }}
                    onScanBadge={() => setState(State.SCAN_BADGE)}
                    errorMessage={manualLoginError}
                    onDismissError={() => setManualLoginError(null)}
                />
            );
        } else if (state == State.START_COUNT_INSTRUCTION) {
            const isSCR = selectedRole === HayAppUserType.ScrubNurse;
            return (
                <StartCountInstruction
                    onProceed={() => setState(State.ROOM_SCAN_CAMERA)}
                    image={isSCR ? SCRLoginSuccess : CIRLoginSuccess}
                    imageClassName={startCountInstructionStyles.loginSuccessImage}
                    showProceedButton={true}
                    instructionKey="cirSetupScreen.loginSuccess"
                    defaultInstruction="You've successfully signed in."
                    proceedButtonTextKey="setup.startCount.proceed"
                    showArrow={true}
                    translationVars={{
                        role: t(isSCR ? "login.role_scr" : "login.role_cir"),
                    }}
                />
            );
        } else if (state == State.ROOM_SCAN_CAMERA) {
            return (
                <ScanORiTrace
                    onScanSuccess={() => setState(State.ROOM_SCAN_VERIFIED)}
                    onBack={() => onBackClicked()}
                    manualNav={true}
                    stage={1}
                    showAbortButton={true}
                    onAbortCase={handleAbortCase}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                    showBadges={true}
                    onCirLogout={() => handleLogoutClick("CIR")}
                    onScrLogout={() => handleLogoutClick("SCR")}
                    onCirLogin={() => {
                        setStateBeforeHeaderLogin(state);
                        setSelectedRole(HayAppUserType.Circulator);
                        setState(State.SCAN_BADGE);
                    }}
                    onScrLogin={() => {
                        setStateBeforeHeaderLogin(state);
                        setSelectedRole(HayAppUserType.ScrubNurse);
                        setState(State.SCAN_BADGE);
                    }}
                />
            );
        } else if (state == State.ROOM_SCAN_VERIFIED) {
            return (
                <StartCountInstruction
                    onProceed={() => setState(State.SELECT_SURGEON_NEW)}
                    image={RoomScanVerified}
                    showProceedButton={true}
                    instructionKey="setup.startCount.scanSuccess"
                    defaultInstruction="iTrace marker successfully scanned. Please continue to select the surgeon."
                    proceedButtonTextKey="setup.startCount.proceed"
                    overlapText={true}
                />
            );
        } else if (state == State.ROOM_SCAN_FAILED) {
            return (
                <StartCountInstruction
                    onProceed={() => setState(State.ROOM_SCAN_CAMERA)}
                    image={RoomScanFailed}
                    showProceedButton={true}
                    instructionKey="setup.startCount.scanFailed"
                    defaultInstruction="iTrace marker scan failed. Please try again."
                    proceedButtonTextKey="setup.startCount.rescan"
                    overlapText={true}
                />
            );
        } else if (state == State.SELECT_SURGEON_NEW) {
            return (
                <SelectSurgeon
                    onBack={() => setState(State.ROOM_SCAN_VERIFIED)}
                    onContinue={(surgeon) => {
                        setSelectedSurgeon(surgeon);
                        appContext.caseService.surgeon.set(surgeon);
                        setState(State.SELECT_CASE_TYPE);
                    }}
                    excludedSurgeons={selectedSurgeons.map((s) => s.surgeon)}
                    onAddCustomSurgeon={(searchTerm) => {
                        // Parse the search term to extract first and last name
                        const nameParts = searchTerm.trim().split(/\s+/);
                        const firstName = nameParts[0] || "Unknown";
                        const lastName = nameParts.slice(1).join(" ") || "Surgeon";

                        // Create a temporary custom surgeon (runtime only, not persisted to DB)
                        const customSurgeon = new Surgeon({
                            surgeon_id: `custom_${Date.now()}`,
                            first_name: firstName,
                            last_name: lastName,
                        });

                        // Set as selected surgeon and proceed to case type selection
                        setSelectedSurgeon(customSurgeon);
                        appContext.caseService.surgeon.set(customSurgeon);
                        setState(State.SELECT_CASE_TYPE);
                    }}
                    initialSelectedSurgeon={selectedSurgeon}
                />
            );
        } else if (state == State.SELECT_CASE_TYPE) {
            return (
                <SelectCaseType
                    onBack={() => {
                        setIsAddingFromCaseSummary(false);
                        onBackClicked();
                    }}
                    onContinue={(caseType) => {
                        setSelectedPrimaryCaseType(caseType);
                        setState(State.SELECT_ADD_ON_CASE_TYPE);
                    }}
                    initialSelectedCaseType={selectedPrimaryCaseType}
                    fromCaseSummary={isAddingFromCaseSummary}
                    onCancelToSummary={() => {
                        setIsAddingFromCaseSummary(false);
                        setState(State.CASE_TYPE_SUMMARY);
                    }}
                    selectedSurgeon={selectedSurgeon}
                />
            );
        } else if (state == State.SELECT_ADD_ON_CASE_TYPE) {
            return (
                <SelectAddOnCaseType
                    onBack={() => onBackClicked()}
                    onContinue={(addOns) => {
                        setSelectedAddOnCaseTypes(addOns);
                        if (selectedPrimaryCaseType) {
                            commitCurrentSelection(selectedPrimaryCaseType, addOns);
                        }
                    }}
                    primaryCaseType={selectedPrimaryCaseType}
                    initialSelectedAddOns={selectedAddOnCaseTypes}
                    fromCaseSummary={editingCaseGroupIndex !== -1}
                    onCancelToSummary={() => {
                        setEditingCaseGroupIndex(-1);
                        setState(State.CASE_TYPE_SUMMARY);
                    }}
                    selectedSurgeon={selectedSurgeon}
                />
            );
        } else if (state == State.CASE_TYPE_SUMMARY) {
            return (
                <CaseTypeSummary
                    caseGroups={selectedCaseGroups}
                    onBack={() => onBackClicked()}
                    onConfirm={() => onNextClicked()}
                    onDeleteGroup={removeCaseGroup}
                    onRemoveAddOn={removeAddOnFromGroup}
                    onAddMoreAddOns={editCaseGroupAddOns}
                    onAddPrimary={addPrimaryFromCaseSummary}
                    onClearSurgeon={clearSurgeonAndSelectAnother}
                    selectedSurgeon={selectedSurgeon}
                    viewingMode={viewingSurgeonIndex !== null}
                />
            );
        } else if (state == State.SELECTED_SURGEONS) {
            return (
                <SelectedSurgeons
                    surgeons={selectedSurgeons}
                    onBack={() => onBackClicked()}
                    onContinue={() => onNextClicked()}
                    onAddSurgeon={addNewSurgeonFromSelectedSurgeons}
                    onRemoveSurgeon={removeSurgeonFromList}
                    onViewCaseDetails={viewSurgeonCaseDetails}
                />
            );
        } else if (state == State.SUTURE_SHEET_NOT_AVAILABLE) {
            const surgeonNameWithSheet = firstSurgeonWithSheet
                ? `${firstSurgeonWithSheet.first_name} ${firstSurgeonWithSheet.last_name}`
                : "";

            // Compute pack/needle counts per case type from summarySheetItems
            const ssnaPackCounts: Record<string, number> = {};
            const ssnaNeedleCounts: Record<string, number> = {};
            for (const ct of caseTypeSummaries) {
                const caseItems = summarySheetItems.filter((item) => item.cptCode === ct.cptCode);
                ssnaPackCounts[ct.cptCode] = caseItems.reduce((sum, item) => sum + item.num_packs, 0);
                ssnaNeedleCounts[ct.cptCode] = caseItems.reduce(
                    (sum, item) => sum + item.needles_per_pack * item.num_packs,
                    0,
                );
            }
            const aggregatedItems = summarySheetItems.filter((item) => item.cptCode == null);
            const ssnaTotalPacks = aggregatedItems.reduce((sum, item) => sum + item.num_packs, 0);
            const ssnaTotalNeedles = aggregatedItems.reduce(
                (sum, item) => sum + item.needles_per_pack * item.num_packs,
                0,
            );

            return (
                <SutureSheetNotAvailable
                    surgeonName={surgeonNameWithSheet}
                    missingCaseTypes={missingCaseTypes}
                    caseTypeSummaries={caseTypeSummaries}
                    packCounts={ssnaPackCounts}
                    needleCounts={ssnaNeedleCounts}
                    totalPacks={ssnaTotalPacks}
                    totalNeedles={ssnaTotalNeedles}
                    selectedCptCode={selectedMissingCptCode}
                    onSelectCaseType={async (cptCode) => {
                        setSelectedMissingCptCode(cptCode);
                        setCurrentSelectingCptCode(cptCode);
                        try {
                            const allSurgeons = await appContext.caseService.getSurgeons();
                            let foundSurgeon: Surgeon | null = null;
                            for (const surgeon of allSurgeons) {
                                const hasSheet = await appContext.caseService.surgeonHasSutureSheetForCpt(
                                    surgeon.surgeon_id,
                                    cptCode,
                                );
                                if (hasSheet) {
                                    foundSurgeon = surgeon;
                                    break;
                                }
                            }
                            if (!foundSurgeon && allSurgeons.length > 0) {
                                foundSurgeon = allSurgeons[0] ?? null;
                            }
                            setFirstSurgeonWithSheet(foundSurgeon);
                        } catch (error) {
                            console.error("Failed to find surgeon for selected case type:", error);
                        }
                    }}
                    onSelectCaseTypeWithSheet={() => setState(State.SUMMARY_SHEET)}
                    onGoToSummarySheet={() => setState(State.SUMMARY_SHEET)}
                    onBack={() => onBackClicked()}
                    onConfirm={handleSutureSheetNotAvailableConfirm}
                    onSeeOtherSurgeonSheets={handleSutureSheetNotAvailableSeeOther}
                />
            );
        } else if (state == State.SELECT_SUTURE_SHEET) {
            return <SelectSutureSheetWrapper />;
        } else if (state == State.REVIEW_REDUNDANT_NEEDLES) {
            return (
                <ReviewRedundantNeedles
                    items={redundantNeedleItems}
                    onBack={() => onBackClicked()}
                    onContinue={() => handleReviewRedundantNeedlesContinue()}
                    onSkip={() => handleSkipRedundancy()}
                    onUpdateRedundantPack={updateRedundantPack}
                />
            );
        } else if (state == State.SUMMARY_SHEET) {
            return (
                <SummarySheet
                    items={summarySheetItems}
                    caseTypeSummaries={caseTypeSummaries}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={() => onBackClicked()}
                    onConfirm={handleSummarySheetConfirm}
                    onMoreInfo={(item) => handleMoreInfo(item, "summarySheet")}
                    openCompleted={openNeedlesIdentified}
                    jitCompleted={jitNeedlesIdentified}
                    closingCompleted={closingNeedlesIdentified}
                    onSetAsideOpen={handleSetAsideOpen}
                    onSetAsideJit={handleSetAsideJit}
                    onSetAsideClosing={handleSetAsideClosing}
                    onCaseTypeWithoutSheetSelected={handleCaseTypeWithoutSheetSelected}
                />
            );
        } else if (state == State.NEEDLE_DETAIL && selectedNeedleItem) {
            return (
                <NeedleDetail
                    item={selectedNeedleItem}
                    specifications={getNeedleSpecifications(needlePackInfo)}
                    source={needleDetailSource}
                    onBack={() => onBackClicked()}
                    onUpdateRedundantPack={updateRedundantPack}
                />
            );
        } else if (state == State.SET_ASIDE_OPEN) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.identifyOpen"
                    defaultInstruction="Identify and set aside all Open suture needles."
                    instructionKey1="setup.startCount.identifyOpen1"
                    instructionKey2="setup.startCount.identifyOpen2"
                    defaultInstruction1="Identify and set aside all "
                    defaultInstruction2=" suture needles."
                    category="Open"
                    showProceedButton={true}
                    onProceed={() => setState(State.IDENTIFY_OPEN_NEEDLES)}
                    image={SetAsideOpen}
                />
            );
        } else if (state == State.IDENTIFY_OPEN_NEEDLES) {
            return (
                <IdentifyNeedlesTable
                    category="Open"
                    items={summarySheetItems}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={() => onBackClicked()}
                    onConfirm={handleOpenNeedlesComplete}
                />
            );
        } else if (state == State.PLACE_OPEN_BOX) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.placeOpenBox"
                    defaultInstruction="Place the Open suture needles into the Open Drawer"
                    instructionKey1="setup.startCount.placeOpenBox1"
                    instructionKey2="setup.startCount.placeOpenBox2"
                    defaultInstruction1="Place the "
                    defaultInstruction2=" suture needles into the Open Drawer"
                    category="Open"
                    showProceedButton={true}
                    onProceed={() => setState(State.SET_ASIDE_JIT)}
                    image={OpenDrawer}
                />
            );
        } else if (state == State.SET_ASIDE_JIT) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.identifyJIT"
                    defaultInstruction="All remaining sutures are JIT (Just-in-Time) sutures."
                    instructionKey1="setup.startCount.identifyJIT1"
                    instructionKey2="setup.startCount.identifyJIT2"
                    defaultInstruction1="All remaining sutures are "
                    defaultInstruction2=" (Just-in-Time) sutures."
                    category="JIT"
                    showProceedButton={true}
                    onProceed={() => setState(State.IDENTIFY_JIT_NEEDLES)}
                    image={SetAsideJIT}
                />
            );
        } else if (state == State.IDENTIFY_JIT_NEEDLES) {
            return (
                <IdentifyNeedlesTable
                    category="JIT"
                    items={summarySheetItems}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={() => onBackClicked()}
                    onConfirm={handleJitNeedlesComplete}
                />
            );
        } else if (state == State.PLACE_JIT_BOX) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.placeJitBox"
                    defaultInstruction="Place the JIT suture needles into the JIT Drawer"
                    instructionKey1="setup.startCount.placeJitBox1"
                    instructionKey2="setup.startCount.placeJitBox2"
                    defaultInstruction1="Place the "
                    defaultInstruction2=" suture needles into the JIT Drawer"
                    category="JIT"
                    showProceedButton={true}
                    onProceed={() => setState(State.SET_ASIDE_CLOSING)}
                    image={JITDrawer}
                />
            );
        } else if (state == State.SET_ASIDE_CLOSING) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.identifyClosing"
                    defaultInstruction="Identify and set aside all Closing suture needles."
                    instructionKey1="setup.startCount.identifyClosing1"
                    instructionKey2="setup.startCount.identifyClosing2"
                    defaultInstruction1="Identify and set aside all "
                    defaultInstruction2=" suture needles."
                    category="Closing"
                    showProceedButton={true}
                    onProceed={() => setState(State.IDENTIFY_CLOSING_NEEDLES)}
                    image={SetAsideClose}
                />
            );
        } else if (state == State.IDENTIFY_CLOSING_NEEDLES) {
            return (
                <IdentifyNeedlesTable
                    category="Closing"
                    items={summarySheetItems}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={() => onBackClicked()}
                    onConfirm={handleClosingNeedlesComplete}
                />
            );
        } else if (state == State.PLACE_CLOSING_BOX) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.placeClosingBox"
                    defaultInstruction="Place the Closing suture needles into the Closing Box"
                    instructionKey1="setup.startCount.placeClosingBox1"
                    instructionKey2="setup.startCount.placeClosingBox2"
                    defaultInstruction1="Place the "
                    defaultInstruction2=" suture needles into the Closing Box"
                    category="Closing"
                    showProceedButton={true}
                    onProceed={() => setState(State.SCAN_CLOSING_BOX)}
                    image={PlaceInClosingDrawer}
                />
            );
        } else if (state == State.SCAN_CLOSING_BOX) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.scanClosingBox"
                    defaultInstruction="Scan the iTrace mark on the Closing Box"
                    showProceedButton={true}
                    onProceed={() => setState(State.CLOSING_BOX_VERIFIED)}
                    image={ScanClosingDrawer}
                    imageClassName={startCountInstructionStyles.closingDrawerImage}
                />
            );
        } else if (state == State.CLOSING_BOX_SCAN_ERROR) {
            return <DrawerScanError onRescan={() => setState(State.SCAN_CLOSING_BOX)} />;
        } else if (state == State.CLOSING_BOX_VERIFIED) {
            return <ClosingBoxVerified onOk={() => setState(State.SCAN_PROCEDURE_KIT)} />;
        } else if (state == State.SCAN_PROCEDURE_KIT) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.scanProcedureKit"
                    defaultInstruction="Scan Procedure Kit"
                    showProceedButton={true}
                    onProceed={() => setState(State.PROCEDURE_KIT_VERIFIED)}
                    image={ProcedureKit}
                    imageClassName={startCountInstructionStyles.procedureKitImage}
                    showInstructionMarginTop={false}
                />
            );
        } else if (state == State.PROCEDURE_KIT_SCAN_ERROR) {
            return <ProcedureKitScanError onRescan={() => setState(State.SCAN_PROCEDURE_KIT)} />;
        } else if (state == State.PROCEDURE_KIT_VERIFIED) {
            return (
                <ProcedureKitVerified
                    onProceed={async () => {
                        // Check if both roles are already logged in
                        const surgeon = appContext.caseService.surgeon.value;
                        const circulator = appContext.caseService.circulator.value;
                        const scrub = appContext.caseService.scrub.value;

                        if (circulator && scrub && surgeon) {
                            // Both roles already logged in - skip second login and go straight to CIR setup
                            try {
                                // Save all staff to backend
                                await appContext.caseService.setCaseStaff(
                                    surgeon.surgeon_id,
                                    circulator.user_id,
                                    scrub.user_id,
                                );

                                // Set CIR screen state (secondary renderer will navigate)
                                await appContext.parlayWrapper.caseManager.set_current_cir_screen("cirSetupScreen");

                                // Set SCR screen state (main renderer will navigate)
                                await appContext.parlayWrapper.caseManager.set_current_scr_screen("scrSetupScreen");

                                // Navigate to CIR setup screen
                                appContext.navigate({ path: "cirSetupScreen" });
                            } catch (error) {
                                console.error("Failed to set screen states:", error);
                            }
                        } else {
                            // At least one role not logged in - determine which role needs to log in
                            setPreviousState(State.PROCEDURE_KIT_VERIFIED);

                            // Set selected role to whichever one is NOT logged in
                            if (!circulator) {
                                setSelectedRole(HayAppUserType.Circulator);
                            } else if (!scrub) {
                                setSelectedRole(HayAppUserType.ScrubNurse);
                            }

                            // Go directly to scan badge screen for that role
                            setState(State.SCAN_BADGE);
                        }
                    }}
                />
            );
        } else if (state == State.SCAN_BADGE_ENTRY) {
            return (
                <StartCountInstruction
                    instructionKey="setup.startCount.scanBadgeEntry"
                    defaultInstruction="Scan the badge to enter as CIR."
                    showProceedButton={true}
                    onProceed={() => setState(State.PROCEDURE_KIT_VERIFIED)}
                />
            );
        } else if (state == State.ABORTED_CASE) {
            return (
                <AbortedCase
                    onStartCase={() => setState(State.SYSTEM_CHECK)}
                    onAdminPanel={() => {
                        // Placeholder - not implemented yet
                    }}
                />
            );
        } else {
            return <></>;
        }
    }

    // Determine which states should NOT show back arrow in TrackingHeader
    const shouldHideBackArrow =
        state === State.SYSTEM_CHECK ||
        state === State.SELECTED_SURGEONS ||
        state === State.ROOM_SCAN_VERIFIED ||
        state === State.ROOM_SCAN_FAILED ||
        state === State.PROCEDURE_KIT_VERIFIED ||
        state === State.PROCEDURE_KIT_SCAN_ERROR ||
        state === State.CLOSING_BOX_VERIFIED ||
        state === State.CLOSING_BOX_SCAN_ERROR ||
        // Hide back arrow during forced re-login from CIRSetupScreen
        (state === State.ROLE_SELECTION && appContext.caseService.shouldReturnToCirSetup.value) ||
        (state === State.SCAN_BADGE && appContext.caseService.shouldReturnToCirSetup.value);

    // Determine if surgeon badge should be shown in TrackingHeader
    // Only show after user has confirmed selection on SELECTED_SURGEONS screen
    const shouldShowSurgeonBadge =
        state === State.SET_ASIDE_CLOSING ||
        state === State.PLACE_CLOSING_BOX ||
        state === State.SCAN_CLOSING_BOX ||
        state === State.CLOSING_BOX_VERIFIED ||
        state === State.CLOSING_BOX_SCAN_ERROR ||
        state === State.SCAN_PROCEDURE_KIT ||
        state === State.PROCEDURE_KIT_SCAN_ERROR ||
        state === State.PROCEDURE_KIT_VERIFIED ||
        state === State.SCAN_BADGE_ENTRY ||
        state === State.SET_ASIDE_JIT ||
        state === State.SET_ASIDE_OPEN ||
        // Second user login flow - show badge when one user is already logged in
        (state === State.ROLE_SELECTION && (!!circulatorUser || !!scrubUser)) ||
        (state === State.SCAN_BADGE && (!!circulatorUser || !!scrubUser));

    return (
        <div className={styles.systemCheckMode}>
            {state !== State.SYSTEM_CHECK &&
            state !== State.SELECT_SURGEON_NEW &&
            state !== State.CASE_TYPE_SUMMARY &&
            state !== State.ROOM_SCAN_CAMERA &&
            state !== State.SELECT_CASE_TYPE &&
            state !== State.SELECT_ADD_ON_CASE_TYPE &&
            state !== State.SUTURE_SHEET_NOT_AVAILABLE &&
            state !== State.SELECT_SUTURE_SHEET &&
            state !== State.REVIEW_REDUNDANT_NEEDLES &&
            state !== State.SUMMARY_SHEET &&
            state !== State.NEEDLE_DETAIL &&
            state !== State.IDENTIFY_OPEN_NEEDLES &&
            state !== State.IDENTIFY_JIT_NEEDLES &&
            state !== State.IDENTIFY_CLOSING_NEEDLES &&
            state !== State.SURGEONS_VIEW &&
            state !== State.ABORTED_CASE ? (
                <TrackingHeader
                    stage={1}
                    title={t("setup.startCount.title")}
                    onBack={shouldHideBackArrow ? undefined : () => onBackClicked()}
                    onViewSurgeons={() => {
                        showSurgeonsView();
                    }}
                    showSurgeonBadge={shouldShowSurgeonBadge}
                    showAbortButton={true}
                    onAbortCase={handleAbortCase}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                    showBadges={
                        state !== State.ROLE_SELECTION &&
                        state !== State.MANUAL_LOGIN &&
                        (state !== State.SCAN_BADGE || !!circulatorUser || !!scrubUser)
                    }
                    onCirLogout={() => handleLogoutClick("CIR")}
                    onScrLogout={() => handleLogoutClick("SCR")}
                    onCirLogin={() => {
                        setStateBeforeHeaderLogin(state);
                        setSelectedRole(HayAppUserType.Circulator);
                        setState(State.SCAN_BADGE);
                    }}
                    onScrLogin={() => {
                        setStateBeforeHeaderLogin(state);
                        setSelectedRole(HayAppUserType.ScrubNurse);
                        setState(State.SCAN_BADGE);
                    }}
                />
            ) : null}
            {renderMain()}

            {/* Logout popup */}
            {showLogoutPopup && logoutRole && (
                <LogoutPopup
                    userFirstName={
                        logoutRole === "CIR" ? circulatorUser?.first_name || "" : scrubUser?.first_name || ""
                    }
                    userLastName={logoutRole === "CIR" ? circulatorUser?.last_name || "" : scrubUser?.last_name || ""}
                    role={logoutRole}
                    showTwoRolesMessage={!!(circulatorUser && scrubUser)}
                    onConfirm={handleConfirmLogout}
                    onClose={() => {
                        setShowLogoutPopup(false);
                        setLogoutRole(null);
                    }}
                    iconSrc={LogoutIcon}
                />
            )}
            {logoutToastMessage && (
                <ToastNotification
                    message={logoutToastMessage}
                    icon={UserLoggedOut}
                    onDismiss={() => setLogoutToastMessage(null)}
                />
            )}
        </div>
    );
};
