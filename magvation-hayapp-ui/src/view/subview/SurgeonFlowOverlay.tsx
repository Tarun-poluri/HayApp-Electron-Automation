import React, { useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import { useSurgeonsView } from "../../contexts/SurgeonsViewContext";
import { SurgeonsView, SurgeonWithCaseGroups } from "./SurgeonsView";
import { SelectedCaseGroup, CaseTypeSummaryInfo } from "../Setup";
import { Surgeon } from "../../services/StaffService";
import { CaseType } from "../../services/CaseService";
import { EnrichedSutureSheetItem } from "../../types/SutureTypes";
import { getSurgeonFullName } from "../../util/setupHelpers";
import { useListenable } from "../../util/Listenable";
import { SelectSurgeon } from "./SelectSurgeon";
import { SelectCaseType } from "./SelectCaseType";
import { SelectAddOnCaseType } from "./SelectAddOnCaseType";
import { CaseTypeSummary } from "./CaseTypeSummary";
import { SummarySheet } from "./SummarySheet";
import { IdentifyNeedlesTable } from "./IdentifyNeedlesTable";
import { StartCountInstruction } from "./StartCountInstruction";
import { ClosingBoxVerified } from "./ClosingBoxVerified";
import { SutureSheetHeader } from "../../component/SutureSheetHeader";
import { TrackingHeader } from "./TrackingHeader";
import SetAsideOpen from "../../img/SetAsideOpen.svg";
import SetAsideClose from "../../img/SetAsideClose.svg";
import SetAsideJIT from "../../img/SetAsideJIT.svg";
import PlaceInClosingDrawer from "../../img/PlaceInClosingDrawer.svg";
import ScanClosingDrawer from "../../img/ScanClosingDrawer.svg";
import OpenDrawer from "../../img/OpenDrawer.svg";
import JITDrawer from "../../img/JITDrawer.svg";
import styles from "../subviewcss/surgeonFlowOverlay.module.css";

type FlowState =
    | "surgeonsView"
    | "selectSurgeon"
    | "selectCaseType"
    | "selectAddOnCaseType"
    | "caseTypeSummary"
    | "summarySheet"
    | "setAsideOpen"
    | "identifyOpen"
    | "setAsideJit"
    | "identifyJit"
    | "setAsideClosing"
    | "identifyClosing"
    | "placeOpenBox"
    | "placeJitBox"
    | "placeClosingBox"
    | "scanClosingBox"
    | "closingBoxVerified";

export const SurgeonFlowOverlay: React.FC = () => {
    const appContext = useContext(AppContext);
    const { t } = useTranslation();
    const { surgeonFlowMode, flowSurgeons, flowTargetIndex, endSurgeonFlow } = useSurgeonsView();
    const circulatorUser = useListenable(appContext.caseService.circulator);
    const scrubUser = useListenable(appContext.caseService.scrub);

    const [flowState, setFlowState] = useState<FlowState>(
        surgeonFlowMode === "view" ? "surgeonsView" : "selectSurgeon",
    );
    const [viewSurgeons, setViewSurgeons] = useState<SurgeonWithCaseGroups[]>([]);
    const [viewLoading, setViewLoading] = useState(false);
    const [cameFromSurgeonsView, setCameFromSurgeonsView] = useState(false);
    const [internalMode, setInternalMode] = useState<"add" | "change" | null>(null);
    const [internalTargetIndex, setInternalTargetIndex] = useState<number | null>(null);
    const [addingCaseToViewSurgeonIndex, setAddingCaseToViewSurgeonIndex] = useState<number | null>(null);
    const [selectedSurgeon, setSelectedSurgeon] = useState<Surgeon | null>(null);
    const [selectedPrimaryCaseType, setSelectedPrimaryCaseType] = useState<CaseType | null>(null);
    const [selectedAddOnCaseTypes, setSelectedAddOnCaseTypes] = useState<CaseType[]>([]);
    const [selectedCaseGroups, setSelectedCaseGroups] = useState<SelectedCaseGroup[]>([]);
    const [editingCaseGroupIndex, setEditingCaseGroupIndex] = useState<number>(-1);
    const [isAddingFromCaseSummary, setIsAddingFromCaseSummary] = useState(false);
    const [summarySheetItems, setSummarySheetItems] = useState<EnrichedSutureSheetItem[]>([]);
    const [caseTypeSummaries, setCaseTypeSummaries] = useState<CaseTypeSummaryInfo[]>([]);
    const [openNeedlesIdentified, setOpenNeedlesIdentified] = useState(false);
    const [jitNeedlesIdentified, setJitNeedlesIdentified] = useState(false);
    const [closingNeedlesIdentified, setClosingNeedlesIdentified] = useState(false);
    // Sheet IDs from the current surgeon flow — appended to enriched summary on complete
    const [pendingNewSheetIds, setPendingNewSheetIds] = useState<string[]>([]);
    // Tracks which existing surgeon/group is having its add-ons edited
    const [editingAddOnForSurgeonIndex, setEditingAddOnForSurgeonIndex] = useState<number | null>(null);
    const [editingAddOnForGroupIndex, setEditingAddOnForGroupIndex] = useState<number | null>(null);

    const isChangeMode = surgeonFlowMode === "change" || internalMode === "change";

    // Effective surgeon list and target index based on whether we came from surgeonsView
    const effectiveSurgeons = cameFromSurgeonsView ? viewSurgeons : flowSurgeons;
    const effectiveTargetIndex = cameFromSurgeonsView ? internalTargetIndex : flowTargetIndex;

    // iTrace scanner for scan closing box
    useEffect(() => {
        if (flowState !== "scanClosingBox" || !appContext.parlayWrapper.isConnected.value) return;

        appContext.parlayWrapper.hayScanner.open_itrace_scanner(0, "single").catch((err) => {
            console.error("[SurgeonFlowOverlay] Failed to open iTrace scanner:", err);
        });

        const unsubscribe = appContext.parlayWrapper.caseManager.itrace_scan_result(() => {
            setTimeout(() => {
                appContext.parlayWrapper.hayScanner.close_active_screen().catch((err) => {
                    console.error("[SurgeonFlowOverlay] Failed to close iTrace scanner:", err);
                });
            }, 2000);
            setFlowState("closingBoxVerified");
        });

        return () => {
            unsubscribe();
        };
    }, [flowState, appContext.parlayWrapper]);

    // Fetch surgeon data from backend when in view mode (always self-contained)
    useEffect(() => {
        if (surgeonFlowMode !== "view") return;

        // Notify SCR that surgeon editing has started
        const notifyStart = async () => {
            try {
                await appContext.caseService.parlayInterface.caseManager.notify_scr_surgeon_editing_started();
            } catch (error) {
                console.error("Failed to notify SCR surgeon editing started:", error);
            }
        };

        if (appContext.parlayWrapper.isConnected.value) {
            notifyStart();
        }

        const fetchSurgeons = async () => {
            setViewLoading(true);
            try {
                const result = await appContext.caseService.parlayInterface.caseManager.get_surgeons_with_case_types();
                if (result && result.surgeons) {
                    const surgeonsData: SurgeonWithCaseGroups[] = [];

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    for (const surgeon of result.surgeons as any[]) {
                        const caseGroups: SurgeonWithCaseGroups["caseGroups"] = (surgeon.case_groups || []).map(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (g: any) => ({
                                primary: {
                                    case_type_id: g.primary?.case_type_id ?? "",
                                    name: g.primary?.name ?? "",
                                    cpt_code: g.primary?.cpt_code ?? "",
                                },
                                addOns: (g.addOns || []).map(
                                    (ao: { case_type_id?: string; name?: string; cpt_code?: string }) => ({
                                        case_type_id: ao.case_type_id ?? "",
                                        name: ao.name ?? "",
                                        cpt_code: ao.cpt_code ?? "",
                                    }),
                                ),
                            }),
                        );
                        surgeonsData.push({
                            surgeon: new Surgeon({
                                surgeon_id: surgeon.surgeon_id,
                                first_name: surgeon.first_name,
                                last_name: surgeon.last_name,
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                cyphermed_user_id: (surgeon as any).cyphermed_user_id,
                            }),
                            caseGroups,
                        });
                    }
                    setViewSurgeons(surgeonsData);
                } else {
                    setViewSurgeons([]);
                }
            } catch (error) {
                console.error("Failed to fetch surgeons:", error);
                setViewSurgeons([]);
            } finally {
                setViewLoading(false);
            }
        };

        if (appContext.parlayWrapper.isConnected.value) {
            fetchSurgeons();
        }

        // Cleanup: notify SCR that surgeon editing has ended when overlay closes
        return () => {
            if (appContext.parlayWrapper.isConnected.value) {
                appContext.caseService.parlayInterface.caseManager.notify_scr_surgeon_editing_ended().catch((error) => {
                    console.error("Failed to notify SCR surgeon editing ended on cleanup:", error);
                });
            }
        };
    }, [surgeonFlowMode]);

    // Compute excluded surgeons: for change, exclude all except the target; for add, exclude all
    const excludedSurgeons = isChangeMode
        ? effectiveSurgeons.filter((_, i) => i !== effectiveTargetIndex).map((s) => s.surgeon)
        : effectiveSurgeons.map((s) => s.surgeon);

    const commitCurrentSelection = (primary: CaseType, addOns: CaseType[]) => {
        const newGroups = [...selectedCaseGroups];
        if (editingCaseGroupIndex !== -1) {
            newGroups[editingCaseGroupIndex] = { primary, addOns };
            setEditingCaseGroupIndex(-1);
        } else {
            newGroups.push({ primary, addOns });
        }
        setSelectedCaseGroups(newGroups);
    };

    const confirmCaseTypes = async () => {
        if (!selectedSurgeon || selectedCaseGroups.length === 0) return;

        try {
            const allSheetIds: string[] = [];
            const allSummaries: CaseTypeSummaryInfo[] = [];

            const surgeonSheets = await appContext.caseService.getSutureSheetsForSurgeon(selectedSurgeon.surgeon_id);

            for (const group of selectedCaseGroups) {
                const primaryCptCode = group.primary.cpt_code;
                if (primaryCptCode) {
                    const sheet = surgeonSheets.find((s) => s.cpt_codes?.includes(primaryCptCode));
                    if (sheet) {
                        allSheetIds.push(sheet.suture_sheet_id);
                        const needleCount = sheet.suture_sheet_items.reduce((sum, item) => sum + item.num_packs, 0);
                        allSummaries.push({
                            name: group.primary.name,
                            cptCode: primaryCptCode,
                            needleCount,
                            hasSutureSheet: true,
                        });
                    }
                }
                for (const addOn of group.addOns) {
                    const addOnCptCode = addOn.cpt_code;
                    if (addOnCptCode) {
                        const sheet = surgeonSheets.find((s) => s.cpt_codes?.includes(addOnCptCode));
                        if (sheet) {
                            allSheetIds.push(sheet.suture_sheet_id);
                            const needleCount = sheet.suture_sheet_items.reduce((sum, item) => sum + item.num_packs, 0);
                            allSummaries.push({
                                name: addOn.name,
                                cptCode: addOnCptCode,
                                needleCount,
                                hasSutureSheet: true,
                            });
                        }
                    }
                }
            }

            setCaseTypeSummaries(allSummaries);

            // Store the new sheet IDs so completeFlow can append them to the stored enriched summary.
            // Do NOT call setSelectedSutureSheets here — that would overwrite the global sheet list
            // (set during setup) with only this surgeon's sheets.
            setPendingNewSheetIds(allSheetIds);

            // Calculate preview items for this surgeon's case types only (no redundancy adjustments
            // needed here — this is just a display preview, not the canonical enriched summary).
            const items =
                await appContext.caseService.parlayInterface.caseManager.calculate_summary_sheet_with_redundancy(
                    allSheetIds,
                    [],
                );

            const uniqueFdaGuids = [...new Set(items.map((item: { fda_gudid?: number }) => item.fda_gudid))];
            for (const fdaGuid of uniqueFdaGuids) {
                if (fdaGuid && !appContext.caseService.suturePackInfoMap.value[fdaGuid]) {
                    await appContext.caseService.getSuturePackInfo(fdaGuid);
                }
            }

            setSummarySheetItems(items);
            setFlowState("summarySheet");
        } catch (error) {
            console.error(`Failed to build ${surgeonFlowMode} surgeon summary:`, error);
        }
    };

    const syncSurgeonsToBackend = async (surgeonsList: SurgeonWithCaseGroups[]) => {
        const surgeonsData = surgeonsList.map((s) => ({
            surgeon_id: s.surgeon.surgeon_id,
            case_groups: s.caseGroups.map((g) => ({
                primary: {
                    case_type_id: g.primary.case_type_id,
                    name: g.primary.name,
                    cpt_code: g.primary.cpt_code,
                    is_primary: true,
                    secondary_cpt_codes: (g.primary as unknown as CaseType)?.secondary_cpt_codes ?? [],
                },
                addOns: g.addOns.map((a) => ({
                    case_type_id: a.case_type_id,
                    name: a.name,
                    cpt_code: a.cpt_code,
                    is_primary: false,
                    secondary_cpt_codes: (a as unknown as CaseType)?.secondary_cpt_codes ?? [],
                })),
            })),
        }));
        await appContext.parlayWrapper.caseManager.set_surgeons_with_case_types(surgeonsData);

        // Update local CaseService properties for immediate UI feedback (backend will sync to other instance)
        appContext.caseService.surgeonCount.set(surgeonsList.length);
        if (surgeonsList.length === 1) {
            const surgeon = surgeonsList[0].surgeon;
            appContext.caseService.firstSurgeonName.set(`${surgeon.first_name} ${surgeon.last_name}`.trim());
        } else if (surgeonsList.length > 1) {
            appContext.caseService.firstSurgeonName.set(`${surgeonsList.length} surgeons`);
        } else {
            appContext.caseService.firstSurgeonName.set("");
        }
    };

    const resetFlowSelections = () => {
        setSelectedSurgeon(null);
        setSelectedPrimaryCaseType(null);
        setSelectedAddOnCaseTypes([]);
        setSelectedCaseGroups([]);
        setEditingCaseGroupIndex(-1);
        setIsAddingFromCaseSummary(false);
        setSummarySheetItems([]);
        setCaseTypeSummaries([]);
        setOpenNeedlesIdentified(false);
        setJitNeedlesIdentified(false);
        setClosingNeedlesIdentified(false);
        setPendingNewSheetIds([]);
        setEditingAddOnForSurgeonIndex(null);
        setEditingAddOnForGroupIndex(null);
    };

    const handleCloseToSurgeonsView = () => {
        if (cameFromSurgeonsView) {
            setCameFromSurgeonsView(false);
            setInternalMode(null);
            setInternalTargetIndex(null);
            resetFlowSelections();
            setFlowState("surgeonsView");
        } else {
            resetFlowSelections();
            endSurgeonFlow();
        }
    };

    const completeFlow = async () => {
        // Note: SCR notification for ending is handled by useEffect cleanup
        // when the overlay closes, so we don't need to call it here explicitly

        // Handle adding case groups to an existing surgeon from view mode
        if (addingCaseToViewSurgeonIndex !== null && selectedCaseGroups.length > 0) {
            try {
                const updated = [...viewSurgeons];
                const surgeonEntry = updated[addingCaseToViewSurgeonIndex];
                if (surgeonEntry) {
                    const newCaseGroups = selectedCaseGroups.map((group) => ({
                        primary: {
                            case_type_id: group.primary.case_type_id,
                            name: group.primary.name,
                            cpt_code: group.primary.cpt_code,
                        },
                        addOns: group.addOns.map((ao) => ({
                            case_type_id: ao.case_type_id,
                            name: ao.name,
                            cpt_code: ao.cpt_code,
                        })),
                    }));
                    surgeonEntry.caseGroups = [...surgeonEntry.caseGroups, ...newCaseGroups];
                    setViewSurgeons(updated);
                    await syncSurgeonsToBackend(updated);
                    // Append the new sheets to the stored enriched summary
                    if (pendingNewSheetIds.length > 0) {
                        await appContext.caseService.appendSheetsToEnrichedSummary(pendingNewSheetIds);
                    }
                }
                setAddingCaseToViewSurgeonIndex(null);
                resetFlowSelections();
                endSurgeonFlow(undefined, updated);
            } catch (error) {
                console.error("Failed to add case to surgeon:", error);
                setAddingCaseToViewSurgeonIndex(null);
                resetFlowSelections();
                endSurgeonFlow(undefined, viewSurgeons);
            }
            return;
        }

        if (selectedSurgeon && selectedCaseGroups.length > 0) {
            try {
                const newSurgeon: SurgeonWithCaseGroups = {
                    surgeon: selectedSurgeon,
                    caseGroups: selectedCaseGroups,
                };

                // Build updated surgeons list
                let updatedSurgeons: SurgeonWithCaseGroups[];
                if (isChangeMode && effectiveTargetIndex !== null) {
                    updatedSurgeons = [...effectiveSurgeons];
                    updatedSurgeons[effectiveTargetIndex] = newSurgeon;
                } else {
                    updatedSurgeons = [...effectiveSurgeons, newSurgeon];
                }

                await syncSurgeonsToBackend(updatedSurgeons);

                // Append the new surgeon's sheets to the stored enriched summary
                if (pendingNewSheetIds.length > 0) {
                    await appContext.caseService.appendSheetsToEnrichedSummary(pendingNewSheetIds);
                }

                if (cameFromSurgeonsView) {
                    endSurgeonFlow(undefined, updatedSurgeons);
                } else {
                    endSurgeonFlow(newSurgeon);
                }
            } catch (error) {
                console.error(`Failed to complete ${surgeonFlowMode} surgeon:`, error);
                if (cameFromSurgeonsView) {
                    endSurgeonFlow(undefined, viewSurgeons);
                } else {
                    endSurgeonFlow();
                }
            }
        } else {
            if (cameFromSurgeonsView) {
                endSurgeonFlow(undefined, viewSurgeons);
            } else {
                endSurgeonFlow();
            }
        }
    };

    const onBackClicked = () => {
        if (flowState === "surgeonsView") {
            endSurgeonFlow(undefined, viewSurgeons);
        } else if (flowState === "selectSurgeon") {
            if (cameFromSurgeonsView) {
                setCameFromSurgeonsView(false);
                setInternalMode(null);
                setInternalTargetIndex(null);
                resetFlowSelections();
                setFlowState("surgeonsView");
            } else {
                endSurgeonFlow();
            }
        } else if (flowState === "selectCaseType") {
            if (addingCaseToViewSurgeonIndex !== null) {
                // Cancel adding case to existing surgeon, return to surgeons view
                setAddingCaseToViewSurgeonIndex(null);
                resetFlowSelections();
                setFlowState("surgeonsView");
            } else if (isAddingFromCaseSummary) {
                setIsAddingFromCaseSummary(false);
                setFlowState("caseTypeSummary");
            } else {
                setSelectedSurgeon(null);
                setSelectedCaseGroups([]);
                setFlowState("selectSurgeon");
            }
        } else if (flowState === "selectAddOnCaseType") {
            if (editingAddOnForSurgeonIndex !== null) {
                // Editing add-ons for an existing surgeon's group — go back to surgeons view
                setEditingAddOnForSurgeonIndex(null);
                setEditingAddOnForGroupIndex(null);
                setSelectedPrimaryCaseType(null);
                setSelectedAddOnCaseTypes([]);
                setFlowState("surgeonsView");
            } else if (editingCaseGroupIndex !== -1) {
                setEditingCaseGroupIndex(-1);
                setSelectedPrimaryCaseType(null);
                setSelectedAddOnCaseTypes([]);
                setFlowState("caseTypeSummary");
            } else {
                setSelectedPrimaryCaseType(null);
                setSelectedAddOnCaseTypes([]);
                setFlowState("selectCaseType");
            }
        } else if (flowState === "caseTypeSummary") {
            if (addingCaseToViewSurgeonIndex !== null) {
                // Going back from case summary while adding to existing surgeon
                setAddingCaseToViewSurgeonIndex(null);
                setSelectedCaseGroups([]);
                setSelectedPrimaryCaseType(null);
                setSelectedAddOnCaseTypes([]);
                setIsAddingFromCaseSummary(false);
                resetFlowSelections();
                setFlowState("surgeonsView");
            } else {
                // Navigate back to selectAddOnCaseType, restoring the last case group for editing
                const lastIndex = selectedCaseGroups.length - 1;
                if (lastIndex >= 0) {
                    const lastGroup = selectedCaseGroups[lastIndex];
                    setSelectedCaseGroups(selectedCaseGroups.slice(0, lastIndex));
                    setSelectedPrimaryCaseType(lastGroup.primary);
                    setSelectedAddOnCaseTypes(lastGroup.addOns);
                    setEditingCaseGroupIndex(-1);
                    setIsAddingFromCaseSummary(false);
                    setFlowState("selectAddOnCaseType");
                } else {
                    setSelectedCaseGroups([]);
                    setSelectedPrimaryCaseType(null);
                    setSelectedAddOnCaseTypes([]);
                    setIsAddingFromCaseSummary(false);
                    setFlowState("selectSurgeon");
                }
            }
        } else if (flowState === "summarySheet") {
            setSummarySheetItems([]);
            setFlowState("caseTypeSummary");
        } else if (flowState === "setAsideOpen") {
            setFlowState("summarySheet");
        } else if (flowState === "identifyOpen") {
            setFlowState("setAsideOpen");
        } else if (flowState === "placeOpenBox") {
            setFlowState("identifyOpen");
        } else if (flowState === "setAsideJit") {
            setFlowState("placeOpenBox");
        } else if (flowState === "identifyJit") {
            setFlowState("setAsideJit");
        } else if (flowState === "placeJitBox") {
            setFlowState("identifyJit");
        } else if (flowState === "setAsideClosing") {
            setFlowState("placeJitBox");
        } else if (flowState === "identifyClosing") {
            setFlowState("setAsideClosing");
        } else if (flowState === "placeClosingBox") {
            setFlowState("identifyClosing");
        } else if (flowState === "scanClosingBox") {
            appContext.parlayWrapper.hayScanner.close_active_screen().catch((err) => {
                console.error("[SurgeonFlowOverlay] Failed to close iTrace scanner:", err);
            });
            setFlowState("placeClosingBox");
        } else if (flowState === "closingBoxVerified") {
            setFlowState("scanClosingBox");
        }
    };

    if (flowState === "surgeonsView") {
        if (viewLoading) {
            return (
                <div className={styles.container}>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                        Loading...
                    </div>
                </div>
            );
        }
        return (
            <div className={styles.container}>
                <SurgeonsView
                    surgeons={viewSurgeons}
                    onBack={() => endSurgeonFlow(undefined, viewSurgeons)}
                    onAddNewSurgeon={() => {
                        setCameFromSurgeonsView(true);
                        setInternalMode("add");
                        setFlowState("selectSurgeon");
                    }}
                    onChangeSurgeon={(index) => {
                        setCameFromSurgeonsView(true);
                        setInternalMode("change");
                        setInternalTargetIndex(index);
                        setFlowState("selectSurgeon");
                    }}
                    onRemoveSurgeon={async (index) => {
                        const updated = viewSurgeons.filter((_, i) => i !== index);
                        setViewSurgeons(updated);
                        await syncSurgeonsToBackend(updated);
                        endSurgeonFlow(undefined, updated);
                    }}
                    onSurgeonsUpdated={async (updated) => {
                        setViewSurgeons(updated);
                        await syncSurgeonsToBackend(updated);
                    }}
                    onAddCaseToSurgeon={(index) => {
                        // User wants to add a case to an existing surgeon
                        const surgeonEntry = viewSurgeons[index];
                        if (surgeonEntry) {
                            setAddingCaseToViewSurgeonIndex(index);
                            setSelectedSurgeon(surgeonEntry.surgeon);
                            setSelectedCaseGroups([]);
                            setSelectedPrimaryCaseType(null);
                            setSelectedAddOnCaseTypes([]);
                            setEditingCaseGroupIndex(-1);
                            setIsAddingFromCaseSummary(false);
                            setFlowState("selectCaseType");
                        }
                    }}
                    onAddMoreAddOns={(surgeonIndex, groupIndex) => {
                        const surgeonEntry = viewSurgeons[surgeonIndex];
                        const group = surgeonEntry?.caseGroups[groupIndex];
                        if (!surgeonEntry || !group) return;
                        setEditingAddOnForSurgeonIndex(surgeonIndex);
                        setEditingAddOnForGroupIndex(groupIndex);
                        setSelectedPrimaryCaseType({
                            case_type_id: group.primary.case_type_id,
                            name: group.primary.name,
                            cpt_code: group.primary.cpt_code,
                            is_primary: true,
                            secondary_cpt_codes: [],
                        });
                        setSelectedAddOnCaseTypes(
                            group.addOns.map((ao) => ({
                                case_type_id: ao.case_type_id,
                                name: ao.name,
                                cpt_code: ao.cpt_code,
                                is_primary: false,
                                secondary_cpt_codes: [],
                            })),
                        );
                        setFlowState("selectAddOnCaseType");
                    }}
                />
            </div>
        );
    }

    if (flowState === "selectSurgeon") {
        return (
            <div className={styles.container}>
                <SelectSurgeon
                    onBack={onBackClicked}
                    onClose={handleCloseToSurgeonsView}
                    onContinue={(surgeon) => {
                        setSelectedSurgeon(surgeon);
                        appContext.caseService.surgeon.set(surgeon);
                        setFlowState("selectCaseType");
                    }}
                    excludedSurgeons={excludedSurgeons}
                    onAddCustomSurgeon={(searchTerm) => {
                        const nameParts = searchTerm.trim().split(/\s+/);
                        const firstName = nameParts[0] || "Unknown";
                        const lastName = nameParts.slice(1).join(" ") || "Surgeon";
                        const customSurgeon = new Surgeon({
                            surgeon_id: `custom_${Date.now()}`,
                            first_name: firstName,
                            last_name: lastName,
                        });
                        setSelectedSurgeon(customSurgeon);
                        appContext.caseService.surgeon.set(customSurgeon);
                        setFlowState("selectCaseType");
                    }}
                    initialSelectedSurgeon={selectedSurgeon}
                />
            </div>
        );
    }

    if (flowState === "selectCaseType") {
        return (
            <div className={styles.container}>
                <SelectCaseType
                    onBack={() => {
                        setIsAddingFromCaseSummary(false);
                        onBackClicked();
                    }}
                    onContinue={(caseType) => {
                        setSelectedPrimaryCaseType(caseType);
                        setFlowState("selectAddOnCaseType");
                    }}
                    initialSelectedCaseType={selectedPrimaryCaseType}
                    fromCaseSummary={isAddingFromCaseSummary}
                    onCancelToSummary={() => {
                        setIsAddingFromCaseSummary(false);
                        setFlowState("caseTypeSummary");
                    }}
                    selectedSurgeon={selectedSurgeon}
                    onClose={handleCloseToSurgeonsView}
                />
            </div>
        );
    }

    if (flowState === "selectAddOnCaseType") {
        return (
            <div className={styles.container}>
                <SelectAddOnCaseType
                    onBack={onBackClicked}
                    onContinue={async (addOns) => {
                        if (editingAddOnForSurgeonIndex !== null && editingAddOnForGroupIndex !== null) {
                            // Editing add-ons for an existing surgeon's group
                            const updated = [...viewSurgeons];
                            const surgeonEntry = { ...updated[editingAddOnForSurgeonIndex] };
                            const updatedGroups = [...surgeonEntry.caseGroups];
                            updatedGroups[editingAddOnForGroupIndex] = {
                                ...updatedGroups[editingAddOnForGroupIndex],
                                addOns: addOns.map((ao) => ({
                                    case_type_id: ao.case_type_id,
                                    name: ao.name,
                                    cpt_code: ao.cpt_code,
                                })),
                            };
                            surgeonEntry.caseGroups = updatedGroups;
                            updated[editingAddOnForSurgeonIndex] = surgeonEntry;
                            setViewSurgeons(updated);
                            await syncSurgeonsToBackend(updated);
                            setEditingAddOnForSurgeonIndex(null);
                            setEditingAddOnForGroupIndex(null);
                            setSelectedPrimaryCaseType(null);
                            setSelectedAddOnCaseTypes([]);
                            setFlowState("surgeonsView");
                        } else {
                            setSelectedAddOnCaseTypes(addOns);
                            if (selectedPrimaryCaseType) {
                                commitCurrentSelection(selectedPrimaryCaseType, addOns);
                                setFlowState("caseTypeSummary");
                            }
                        }
                    }}
                    primaryCaseType={selectedPrimaryCaseType}
                    initialSelectedAddOns={selectedAddOnCaseTypes}
                    fromCaseSummary={editingCaseGroupIndex !== -1}
                    onCancelToSummary={() => {
                        setEditingCaseGroupIndex(-1);
                        setFlowState("caseTypeSummary");
                    }}
                    selectedSurgeon={selectedSurgeon}
                    onClose={handleCloseToSurgeonsView}
                />
            </div>
        );
    }

    if (flowState === "caseTypeSummary") {
        return (
            <div className={styles.container}>
                <CaseTypeSummary
                    caseGroups={selectedCaseGroups}
                    onBack={onBackClicked}
                    onConfirm={confirmCaseTypes}
                    onDeleteGroup={(index) => {
                        const newGroups = [...selectedCaseGroups];
                        newGroups.splice(index, 1);
                        setSelectedCaseGroups(newGroups);
                    }}
                    onRemoveAddOn={(groupIndex, addOnIndex) => {
                        if (!selectedCaseGroups[groupIndex]) return;
                        const newGroups = [...selectedCaseGroups];
                        const group = { ...newGroups[groupIndex] };
                        const newAddOns = [...group.addOns];
                        newAddOns.splice(addOnIndex, 1);
                        group.addOns = newAddOns;
                        newGroups[groupIndex] = group;
                        setSelectedCaseGroups(newGroups);
                    }}
                    onAddMoreAddOns={(index) => {
                        if (selectedCaseGroups[index]) {
                            setEditingCaseGroupIndex(index);
                            setSelectedPrimaryCaseType(selectedCaseGroups[index].primary);
                            setSelectedAddOnCaseTypes(selectedCaseGroups[index].addOns);
                            setFlowState("selectAddOnCaseType");
                        }
                    }}
                    onAddPrimary={() => {
                        setSelectedPrimaryCaseType(null);
                        setSelectedAddOnCaseTypes([]);
                        setEditingCaseGroupIndex(-1);
                        setIsAddingFromCaseSummary(true);
                        setFlowState("selectCaseType");
                    }}
                    onClearSurgeon={() => {
                        setSelectedSurgeon(null);
                        setFlowState("selectSurgeon");
                    }}
                    selectedSurgeon={selectedSurgeon}
                    viewingMode={false}
                    onClose={handleCloseToSurgeonsView}
                    confirmButtonText={t("setup.caseSummary.confirmSelection", { defaultValue: "Confirm Selection" })}
                />
            </div>
        );
    }

    if (flowState === "summarySheet") {
        const surgeonName = selectedSurgeon ? getSurgeonFullName(selectedSurgeon) : "";
        // Only count aggregated items (cptCode=null) to avoid double-counting per-case-type entries
        const aggregatedItems = summarySheetItems.filter((item) => item.cptCode == null);
        const totalPacks = aggregatedItems.reduce((sum, item) => sum + item.num_packs, 0);
        const totalNeedles = aggregatedItems.reduce((sum, item) => {
            const packInfo = appContext.caseService.suturePackInfoMap.value[item.fda_gudid];
            return sum + (packInfo?.num_needles || 1) * item.num_packs;
        }, 0);
        return (
            <div className={styles.container}>
                <SummarySheet
                    items={summarySheetItems}
                    caseTypeSummaries={caseTypeSummaries}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={onBackClicked}
                    onConfirm={() => setFlowState("setAsideOpen")}
                    openCompleted={openNeedlesIdentified}
                    jitCompleted={jitNeedlesIdentified}
                    closingCompleted={closingNeedlesIdentified}
                    onSetAsideOpen={() => setFlowState("setAsideOpen")}
                    onSetAsideJit={() => setFlowState("setAsideJit")}
                    onSetAsideClosing={() => setFlowState("setAsideClosing")}
                    instructionText={t("setup.summarySheet.instructionSurgeonFlow", {
                        defaultValue: "Place suture needle wrappers into the Open, JIT, and Closing drawers.",
                    })}
                    headerComponent={
                        <SutureSheetHeader
                            title={`${surgeonName} Procedures`}
                            onBack={onBackClicked}
                            packNumber={totalPacks}
                            needleNumber={totalNeedles}
                            redundant={false}
                        />
                    }
                />
            </div>
        );
    }

    if (flowState === "setAsideOpen") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    onBack={onBackClicked}
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <StartCountInstruction
                    instructionKey="setup.startCount.identifyOpen"
                    defaultInstruction="Identify and set aside all Open suture needles."
                    instructionKey1="setup.startCount.identifyOpen1"
                    instructionKey2="setup.startCount.identifyOpen2Surgeon"
                    defaultInstruction1="Identify and set aside all "
                    defaultInstruction2=" suture needles"
                    category="Open"
                    showProceedButton={true}
                    onProceed={() => setFlowState("identifyOpen")}
                    image={SetAsideOpen}
                    suffixText={selectedSurgeon ? ` for ${getSurgeonFullName(selectedSurgeon)}.` : "."}
                />
            </div>
        );
    }

    if (flowState === "identifyOpen") {
        return (
            <div className={styles.container}>
                <IdentifyNeedlesTable
                    category="Open"
                    items={summarySheetItems}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={onBackClicked}
                    onConfirm={() => {
                        setOpenNeedlesIdentified(true);
                        setFlowState("placeOpenBox");
                    }}
                />
            </div>
        );
    }

    if (flowState === "placeOpenBox") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    onBack={onBackClicked}
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <StartCountInstruction
                    instructionKey="setup.startCount.placeOpenBox"
                    defaultInstruction="Place the Open suture needles into the Open Drawer"
                    instructionKey1="setup.startCount.placeOpenBox1"
                    instructionKey2="setup.startCount.placeOpenBox2"
                    defaultInstruction1="Place the "
                    defaultInstruction2=" suture needles into the Open Drawer"
                    category="Open"
                    showProceedButton={true}
                    onProceed={() => setFlowState("setAsideJit")}
                    image={OpenDrawer}
                />
            </div>
        );
    }

    if (flowState === "setAsideJit") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    onBack={onBackClicked}
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <StartCountInstruction
                    instructionKey="setup.startCount.identifyJIT"
                    defaultInstruction="All remaining sutures are JIT (Just-in-Time) sutures."
                    instructionKey1="setup.startCount.identifyJIT1"
                    instructionKey2="setup.startCount.identifyJIT2Surgeon"
                    defaultInstruction1="All remaining sutures are "
                    defaultInstruction2=" (Just-in-Time) sutures"
                    category="JIT"
                    showProceedButton={true}
                    onProceed={() => setFlowState("identifyJit")}
                    image={SetAsideJIT}
                    suffixText={selectedSurgeon ? ` for ${getSurgeonFullName(selectedSurgeon)}.` : "."}
                />
            </div>
        );
    }

    if (flowState === "identifyJit") {
        return (
            <div className={styles.container}>
                <IdentifyNeedlesTable
                    category="JIT"
                    items={summarySheetItems}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={onBackClicked}
                    onConfirm={() => {
                        setJitNeedlesIdentified(true);
                        setFlowState("placeJitBox");
                    }}
                />
            </div>
        );
    }

    if (flowState === "placeJitBox") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    onBack={onBackClicked}
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <StartCountInstruction
                    instructionKey="setup.startCount.placeJitBox"
                    defaultInstruction="Place the JIT suture needles into the JIT Drawer"
                    instructionKey1="setup.startCount.placeJitBox1"
                    instructionKey2="setup.startCount.placeJitBox2"
                    defaultInstruction1="Place the "
                    defaultInstruction2=" suture needles into the JIT Drawer"
                    category="JIT"
                    showProceedButton={true}
                    onProceed={() => setFlowState("setAsideClosing")}
                    image={JITDrawer}
                />
            </div>
        );
    }

    if (flowState === "setAsideClosing") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    onBack={onBackClicked}
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <StartCountInstruction
                    instructionKey="setup.startCount.identifyClosing"
                    defaultInstruction="Identify and set aside all Closing suture needles."
                    instructionKey1="setup.startCount.identifyClosing1"
                    instructionKey2="setup.startCount.identifyClosing2Surgeon"
                    defaultInstruction1="And now identify and set aside all "
                    defaultInstruction2=" suture needles"
                    category="Closing"
                    showProceedButton={true}
                    onProceed={() => setFlowState("identifyClosing")}
                    image={SetAsideClose}
                    suffixText={selectedSurgeon ? ` for ${getSurgeonFullName(selectedSurgeon)}.` : "."}
                />
            </div>
        );
    }

    if (flowState === "identifyClosing") {
        return (
            <div className={styles.container}>
                <IdentifyNeedlesTable
                    category="Closing"
                    items={summarySheetItems}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={onBackClicked}
                    onConfirm={() => {
                        setClosingNeedlesIdentified(true);
                        setFlowState("placeClosingBox");
                    }}
                />
            </div>
        );
    }

    if (flowState === "placeClosingBox") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    onBack={onBackClicked}
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <StartCountInstruction
                    instructionKey="setup.startCount.placeClosingBox"
                    defaultInstruction="Place the Closing suture needles into the Closing Box"
                    showProceedButton={true}
                    onProceed={() => setFlowState("scanClosingBox")}
                    image={PlaceInClosingDrawer}
                />
            </div>
        );
    }

    if (flowState === "scanClosingBox") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    onBack={onBackClicked}
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <StartCountInstruction
                    instructionKey="setup.startCount.scanClosingBox"
                    defaultInstruction="Scan the iTrace mark on the Closing Box"
                    showProceedButton={false}
                    image={ScanClosingDrawer}
                />
            </div>
        );
    }

    if (flowState === "closingBoxVerified") {
        return (
            <div className={styles.container}>
                <TrackingHeader
                    stage={1}
                    title="Setup"
                    showSurgeonBadge={false}
                    showBadges={true}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                />
                <ClosingBoxVerified onOk={completeFlow} />
            </div>
        );
    }

    return null;
};
