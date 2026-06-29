import React, { useRef, useLayoutEffect, useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/surgeonsView.module.css";
import BackArrow from "../../img/BackArrow.svg";
import Help from "../../img/HelpIcon.svg";
import PlusWhite from "../../img/PlusWhite.svg";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { Surgeon } from "../../services/StaffService";
import { useSurgeonsView } from "../../contexts/SurgeonsViewContext";
import { AppContext } from "../App";
import SurgeonSubtract from "../../img/SurgeonSubtract.svg";
import Change from "../../img/Change.svg";
import QuestionCircle from "../../img/QuestionCircle.svg";
import { ConfirmationPopup } from "../../component/ConfirmationPopup";
import BlackChevronRight from "../../img/BlackChevronRight.svg";
import SummarySheetIcon from "../../img/SummarySheetIcon.svg";
import TrashIcon from "../../img/TrashIcon.svg";
import WarningIcon from "../../img/Warning.svg";
import SurgeonIcon from "../../img/SurgeonIcon.svg";
import { SummarySheet } from "./SummarySheet";
import { EnrichedSutureSheetItem } from "../../types/SutureTypes";
import { CaseTypeSummaryInfo, SelectedCaseGroup } from "../Setup";
import { CaseTypeSummary } from "./CaseTypeSummary";

export interface SurgeonWithCaseGroups {
    surgeon: Surgeon;
    caseGroups: Array<{
        primary: { case_type_id: string; name: string; cpt_code: string };
        addOns: Array<{ case_type_id: string; name: string; cpt_code: string }>;
    }>;
}

interface SurgeonsViewProps {
    surgeons: SurgeonWithCaseGroups[];
    onBack: () => void;
    onAddNewSurgeon: () => void;
    onChangeSurgeon: (index: number) => void;
    onRemoveSurgeon: (index: number) => void;
    onSurgeonsUpdated: (surgeons: SurgeonWithCaseGroups[]) => void;
    onAddCaseToSurgeon?: (index: number) => void;
    onAddMoreAddOns?: (surgeonIndex: number, groupIndex: number) => void;
}

export const SurgeonsView: React.FC<SurgeonsViewProps> = ({
    surgeons,
    onBack,
    onAddNewSurgeon,
    onChangeSurgeon,
    onRemoveSurgeon,
    onSurgeonsUpdated,
    onAddCaseToSurgeon,
    onAddMoreAddOns,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const { showToast } = useSurgeonsView();
    const [showScrollbar, setShowScrollbar] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const [changeIndex, setChangeIndex] = useState<number | null>(null);
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
    const [totalPacks, setTotalPacks] = useState<number>(0);
    const [totalNeedles, setTotalNeedles] = useState<number>(0);
    const [showSummarySheet, setShowSummarySheet] = useState(false);
    const [surgeonSummaryIndex, setSurgeonSummaryIndex] = useState<number | null>(null);
    const [summarySheetItems, setSummarySheetItems] = useState<EnrichedSutureSheetItem[]>([]);
    const [caseTypeSummaries, setCaseTypeSummaries] = useState<CaseTypeSummaryInfo[]>([]);
    const [viewingSutureSheet, setViewingSutureSheet] = useState(false);

    const THUMB_HEIGHT = 84;

    // Calculate total packs and needles across all surgeons
    useEffect(() => {
        const calculateTotals = async () => {
            if (surgeons.length === 0) {
                setTotalPacks(0);
                setTotalNeedles(0);
                return;
            }

            try {
                console.log("[SurgeonsView] Requesting totals for", surgeons.length, "surgeons");
                const result =
                    await appContext.caseService.parlayInterface.caseManager.get_surgeons_pack_and_needle_totals();
                console.log("[SurgeonsView] Totals result:", result);

                setTotalPacks(result.total_packs);
                setTotalNeedles(result.total_needles);
            } catch (error) {
                console.error("[SurgeonsView] Failed to calculate totals:", error);
                setTotalPacks(0);
                setTotalNeedles(0);
            }
        };

        if (surgeons.length > 0 && appContext.parlayWrapper.isConnected.value) {
            calculateTotals();
        }
    }, [surgeons, appContext]);

    useLayoutEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const update = () => {
            const hasOverflow = el.scrollHeight > el.clientHeight + 1;
            setShowScrollbar(hasOverflow);
        };

        update();
        const timer = setTimeout(update, 100);
        const ro = new ResizeObserver(update);
        ro.observe(el);

        return () => {
            clearTimeout(timer);
            ro.disconnect();
        };
    }, [surgeons]);

    const getSurgeonName = (surgeon: Surgeon) => {
        return `${surgeon.first_name} ${surgeon.last_name}`.trim();
    };

    const getPrimaryCaseCount = (caseGroups: SurgeonWithCaseGroups["caseGroups"]) => {
        return caseGroups.length;
    };

    const getSecondaryCaseCount = (caseGroups: SurgeonWithCaseGroups["caseGroups"]) => {
        return caseGroups.reduce((total, group) => total + group.addOns.length, 0);
    };

    const handleChangeClick = (index: number) => {
        setChangeIndex(index);
    };

    const confirmChange = () => {
        if (changeIndex !== null) {
            onChangeSurgeon(changeIndex);
            setChangeIndex(null);
        }
    };

    const cancelChange = () => {
        setChangeIndex(null);
    };

    const handleDeleteClick = (index: number) => {
        setDeleteIndex(index);
    };

    const confirmDelete = () => {
        if (deleteIndex !== null) {
            const surgeonName = getSurgeonName(surgeons[deleteIndex].surgeon);
            onRemoveSurgeon(deleteIndex);
            setDeleteIndex(null);
            showToast(`${surgeonName} was removed from the case`, SurgeonIcon);
        }
    };

    const cancelDelete = () => {
        setDeleteIndex(null);
    };

    const handleSummarySheetClick = async () => {
        try {
            const allSummaries: CaseTypeSummaryInfo[] = [];
            const allSheetIds: string[] = [];

            for (const surgeonEntry of surgeons) {
                const surgeonSheets = await appContext.caseService.getSutureSheetsForSurgeon(
                    surgeonEntry.surgeon.surgeon_id,
                );

                for (const group of surgeonEntry.caseGroups) {
                    const primaryCptCode = group.primary.cpt_code;
                    if (primaryCptCode) {
                        const sheet = surgeonSheets.find((s) => s.cpt_codes?.includes(primaryCptCode));
                        if (sheet) {
                            allSheetIds.push(sheet.suture_sheet_id);
                            allSummaries.push({
                                name: group.primary.name,
                                cptCode: primaryCptCode,
                                needleCount: sheet.suture_sheet_items.reduce((sum, item) => sum + item.num_packs, 0),
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
                                allSummaries.push({
                                    name: addOn.name,
                                    cptCode: addOnCptCode,
                                    needleCount: sheet.suture_sheet_items.reduce(
                                        (sum, item) => sum + item.num_packs,
                                        0,
                                    ),
                                    hasSutureSheet: true,
                                });
                            }
                        }
                    }
                }
            }
            setCaseTypeSummaries(allSummaries);

            // Use the stored enriched summary (built with redundancy adjustments during setup)
            // rather than recalculating from scratch which would lose redundancy information.
            const items = await appContext.caseService.getEnrichedSummaryItems();

            const uniqueFdaGuids = [...new Set(items.map((item: { fda_gudid?: number }) => item.fda_gudid))];
            for (const fdaGuid of uniqueFdaGuids) {
                if (fdaGuid && !appContext.caseService.suturePackInfoMap.value[fdaGuid]) {
                    await appContext.caseService.getSuturePackInfo(fdaGuid);
                }
            }

            setSummarySheetItems(items);
            setShowSummarySheet(true);
        } catch (error) {
            console.error("[SurgeonsView] Failed to load summary sheet:", error);
        }
    };

    const handleViewCaseDetails = (index: number) => {
        setSurgeonSummaryIndex(index);
    };

    const handleSeeSutureSheetDetails = async (index: number) => {
        const surgeonEntry = surgeons[index];
        if (!surgeonEntry) return;

        try {
            const surgeonSheets = await appContext.caseService.getSutureSheetsForSurgeon(
                surgeonEntry.surgeon.surgeon_id,
            );

            const allSheetIds: string[] = [];
            const allSummaries: CaseTypeSummaryInfo[] = [];

            for (const group of surgeonEntry.caseGroups) {
                const primaryCptCode = group.primary.cpt_code;
                if (primaryCptCode) {
                    const sheet = surgeonSheets.find((s) => s.cpt_codes?.includes(primaryCptCode));
                    if (sheet) {
                        allSheetIds.push(sheet.suture_sheet_id);
                        allSummaries.push({
                            name: group.primary.name,
                            cptCode: primaryCptCode,
                            needleCount: sheet.suture_sheet_items.reduce((sum, item) => sum + item.num_packs, 0),
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
                            allSummaries.push({
                                name: addOn.name,
                                cptCode: addOnCptCode,
                                needleCount: sheet.suture_sheet_items.reduce((sum, item) => sum + item.num_packs, 0),
                                hasSutureSheet: true,
                            });
                        }
                    }
                }
            }

            setCaseTypeSummaries(allSummaries);

            const items = await appContext.caseService.calculateSummarySheetWithRedundancy(allSheetIds, []);

            const uniqueFdaGuids = [...new Set(items.map((item: { fda_gudid?: number }) => item.fda_gudid))];
            for (const fdaGuid of uniqueFdaGuids) {
                if (fdaGuid && !appContext.caseService.suturePackInfoMap.value[fdaGuid]) {
                    await appContext.caseService.getSuturePackInfo(fdaGuid);
                }
            }

            setSummarySheetItems(items);
            setViewingSutureSheet(true);
        } catch (error) {
            console.error("[SurgeonsView] Failed to load suture sheet details:", error);
        }
    };

    const convertToSelectedCaseGroups = (caseGroups: SurgeonWithCaseGroups["caseGroups"]): SelectedCaseGroup[] => {
        return caseGroups.map((group) => ({
            primary: {
                case_type_id: group.primary.case_type_id,
                name: group.primary.name,
                cpt_code: group.primary.cpt_code,
                is_primary: true,
                secondary_cpt_codes: group.addOns.map((a) => a.cpt_code),
            },
            addOns: group.addOns.map((addOn) => ({
                case_type_id: addOn.case_type_id,
                name: addOn.name,
                cpt_code: addOn.cpt_code,
                is_primary: false,
                secondary_cpt_codes: [],
            })),
        }));
    };

    const handleDeleteGroup = (groupIndex: number) => {
        if (surgeonSummaryIndex === null) return;
        const updated = [...surgeons];
        const surgeonEntry = { ...updated[surgeonSummaryIndex] };
        const newGroups = [...surgeonEntry.caseGroups];
        newGroups.splice(groupIndex, 1);
        surgeonEntry.caseGroups = newGroups;
        updated[surgeonSummaryIndex] = surgeonEntry;

        if (newGroups.length === 0) {
            setSurgeonSummaryIndex(null);
        }

        onSurgeonsUpdated(updated);
    };

    const handleRemoveAddOn = (groupIndex: number, addOnIndex: number) => {
        if (surgeonSummaryIndex === null) return;
        const updated = [...surgeons];
        const surgeonEntry = { ...updated[surgeonSummaryIndex] };
        const newGroups = [...surgeonEntry.caseGroups];
        const group = { ...newGroups[groupIndex] };
        const newAddOns = [...group.addOns];
        newAddOns.splice(addOnIndex, 1);
        group.addOns = newAddOns;
        newGroups[groupIndex] = group;
        surgeonEntry.caseGroups = newGroups;
        updated[surgeonSummaryIndex] = surgeonEntry;

        onSurgeonsUpdated(updated);
    };

    const changingSurgeon = changeIndex !== null ? surgeons[changeIndex]?.surgeon : null;
    const deletingSurgeon = deleteIndex !== null ? surgeons[deleteIndex]?.surgeon : null;

    if (showSummarySheet) {
        return (
            <SummarySheet
                items={summarySheetItems}
                caseTypeSummaries={caseTypeSummaries}
                suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                onBack={() => setShowSummarySheet(false)}
                onConfirm={() => {}}
                hideFooter={true}
            />
        );
    }

    if (surgeonSummaryIndex !== null) {
        const surgeonEntry = surgeons[surgeonSummaryIndex];

        if (viewingSutureSheet) {
            return (
                <SummarySheet
                    items={summarySheetItems}
                    caseTypeSummaries={caseTypeSummaries}
                    suturePackInfoMap={appContext.caseService.suturePackInfoMap.value}
                    onBack={() => setViewingSutureSheet(false)}
                    onConfirm={() => {}}
                    hideFooter={true}
                />
            );
        }

        if (surgeonEntry) {
            return (
                <CaseTypeSummary
                    caseGroups={convertToSelectedCaseGroups(surgeonEntry.caseGroups)}
                    onBack={() => setSurgeonSummaryIndex(null)}
                    onConfirm={() => setSurgeonSummaryIndex(null)}
                    onDeleteGroup={handleDeleteGroup}
                    onRemoveAddOn={handleRemoveAddOn}
                    onAddMoreAddOns={(index) => {
                        if (onAddMoreAddOns && surgeonSummaryIndex !== null) {
                            onAddMoreAddOns(surgeonSummaryIndex, index);
                        }
                    }}
                    onAddPrimary={() => {
                        if (onAddCaseToSurgeon) {
                            onAddCaseToSurgeon(surgeonSummaryIndex);
                        }
                    }}
                    selectedSurgeon={surgeonEntry.surgeon}
                    viewingMode={true}
                    onSeeSutureSheetDetails={() => handleSeeSutureSheetDetails(surgeonSummaryIndex)}
                />
            );
        }
    }

    return (
        <div className={styles.overlayContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerInnerContainer}>
                    <div className={styles.backButton} onClick={onBack}>
                        <img src={BackArrow} className={styles.backArrow} alt={"Back"} />
                    </div>
                    <div className={styles.leftContainer}>
                        <div className={styles.titleContainer}>
                            <span className={styles.titleText}>
                                {t("surgeonsView.title", { defaultValue: "Surgeons" })}
                            </span>
                        </div>
                        <div className={styles.chipContainer}>
                            <div className={styles.chip}>
                                <span className={styles.chipText}>{surgeons.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.rightContainer}>
                        <div className={styles.divider}></div>
                        <div className={styles.helpContainer}>
                            <img src={Help} className={styles.helpIcon} alt={"Help"} />
                            <span className={styles.helpText}>{t("surgeonsView.help", { defaultValue: "Help" })}</span>
                        </div>
                        <div className={styles.divider}></div>
                        <button className={styles.addButton} onClick={onAddNewSurgeon}>
                            <img
                                src={PlusWhite}
                                className={styles.plusIcon}
                                alt={t("surgeonsView.addSurgeon", { defaultValue: "Add" })}
                            />
                            <span className={styles.addButtonText}>
                                {t("surgeonsView.addNewSurgeon", { defaultValue: "Add New Surgeon" })}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className={styles.mainContainer}>
                <div className={styles.surgeonsContainer}>
                    <div className={styles.listContainer}>
                        <div className={styles.surgeonListContainer} ref={listRef}>
                            <div
                                className={styles.summarySheetContainer}
                                onClick={handleSummarySheetClick}
                                style={{ cursor: "pointer" }}
                            >
                                <div className={styles.summarySheetContent}>
                                    <div className={styles.summarySheetTitleContainer}>
                                        <div className={styles.summarySheetIconContainer}>
                                            <img
                                                src={SummarySheetIcon}
                                                alt="Summary Sheet"
                                                className={styles.summarySheetIcon}
                                            />
                                        </div>
                                        <span className={styles.summarySheetTitleText}>
                                            {t("setup.surgeonsView.summarySheet", { defaultValue: "Summary Sheet" })}
                                        </span>
                                    </div>
                                    <div className={styles.summarySheetCountContainer}>
                                        <div className={styles.countCard}>
                                            <span className={styles.countCardNumber}>{totalPacks}</span>
                                            <span className={styles.countCardText}>
                                                {t("setup.surgeonsView.packs", { defaultValue: "Packs" })}
                                            </span>
                                        </div>
                                        <div className={styles.countCard}>
                                            <span className={styles.countCardNumber}>{totalNeedles}</span>
                                            <span className={styles.countCardText}>
                                                {t("setup.surgeonsView.totalNeedles", {
                                                    defaultValue: "Total Needles",
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <img src={BlackChevronRight} className={styles.chevronIcon} alt="Chevron Right" />
                            </div>
                            {surgeons.map((surgeonEntry, index) => (
                                <div key={index} className={styles.surgeonRowContainer}>
                                    <div className={styles.surgeonRowInfoContainer}>
                                        <div className={styles.surgeonInfo}>
                                            <span className={styles.surgeonName}>
                                                {getSurgeonName(surgeonEntry.surgeon)}
                                            </span>
                                            <div className={styles.caseTypeContainer}>
                                                <span className={styles.caseTypeText}>
                                                    {getPrimaryCaseCount(surgeonEntry.caseGroups)}{" "}
                                                    {t("setup.surgeonsView.primaryCase", { defaultValue: "primary" })}
                                                </span>
                                                <span className={styles.caseTypeDividerText}>|</span>
                                                <span className={styles.caseTypeText}>
                                                    {getSecondaryCaseCount(surgeonEntry.caseGroups)}{" "}
                                                    {t("setup.surgeonsView.secondaryCase", {
                                                        defaultValue: "secondary",
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            className={styles.caseDetailsButton}
                                            onClick={() => handleViewCaseDetails(index)}
                                        >
                                            <span className={styles.caseDetailsText}>
                                                {t("setup.surgeonsView.seeCaseTypes", {
                                                    defaultValue: "See Procedure Details",
                                                })}
                                            </span>
                                        </button>
                                    </div>
                                    <div className={styles.surgeonActionsContainer}>
                                        {surgeons.length > 1 ? (
                                            <div
                                                className={styles.surgeonDeleteContainer}
                                                onClick={() => handleDeleteClick(index)}
                                            >
                                                <img
                                                    src={SurgeonSubtract}
                                                    alt="Subtract Surgeon"
                                                    className={styles.subtract}
                                                />
                                                <div className={styles.trashContainer}>
                                                    <img
                                                        src={TrashIcon}
                                                        alt="Trash Icon"
                                                        className={styles.trashIcon}
                                                    />
                                                    <span className={styles.removeText}>
                                                        {t("setup.surgeonsView.remove", { defaultValue: "Remove" })}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className={styles.surgeonChangeContainer}
                                                onClick={() => handleChangeClick(index)}
                                            >
                                                <img src={SurgeonSubtract} alt="Change" className={styles.subtract} />
                                                <div className={styles.changeContainer}>
                                                    <img src={Change} alt="Change" className={styles.changeIcon} />
                                                    <span className={styles.changeText}>
                                                        {t("setup.surgeonsView.change", { defaultValue: "Change" })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showScrollbar && (
                <CustomScrollbar targetRef={listRef} thumbHeight={THUMB_HEIGHT} dependency={surgeons} styles={styles} />
            )}

            <ConfirmationPopup
                isOpen={changeIndex !== null}
                onClose={cancelChange}
                onConfirm={confirmChange}
                icon={QuestionCircle}
                showBadge={true}
                badgeContent={
                    changingSurgeon ? (
                        <div className={styles.surgeonNameBadge}>
                            <span className={styles.badgeSurgeonName}>
                                {t("setup.surgeonsView.surgeonName", {
                                    defaultValue: "Surgeon Name",
                                    surgeonName: getSurgeonName(changingSurgeon),
                                })}
                            </span>
                        </div>
                    ) : null
                }
                message={t("setup.surgeonsView.areYouSure", {
                    defaultValue: "Are you sure you want to change this surgeon?",
                })}
                cancelText={t("setup.surgeonsView.no", { defaultValue: "No" })}
                confirmText={t("setup.surgeonsView.yesChange", { defaultValue: "Yes, Change" })}
            />

            <ConfirmationPopup
                isOpen={deleteIndex !== null}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                icon={WarningIcon}
                showBadge={false}
                message={t("setup.surgeonsView.deleteConfirmation", {
                    surgeonName: deletingSurgeon ? getSurgeonName(deletingSurgeon) : "",
                    defaultValue: "Are you sure you want to remove this surgeon?",
                })}
                cancelText={t("setup.surgeonsView.no", { defaultValue: "No" })}
                confirmText={t("setup.surgeonsView.yesRemove", { defaultValue: "Yes, Remove Surgeon" })}
            />
        </div>
    );
};
