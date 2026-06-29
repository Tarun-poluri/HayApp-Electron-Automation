import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "../subviewcss/caseTypeSummary.module.css";
import { SelectedCaseGroup } from "../Setup";
import { useTranslation } from "react-i18next";
import WarningIcon from "../../img/Warning.svg";
import TrashIcon from "../../img/TrashIcon.svg";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { Surgeon } from "../../services/StaffService";
import { AppContext } from "../App";
import BackArrow from "../../img/BackArrow.svg";
import Help from "../../img/HelpIcon.svg";
import PlusWhite from "../../img/PlusWhite.svg";
import Warning from "../../img/WarningTriangle.svg";
import CloseIcon from "../../img/CloseWhite.svg";
import Document from "../../img/Document.svg";
import Change from "../../img/Change.svg";
import RightArrowBlack from "../../img/RightArrowBlack.svg";
import { ConfirmationPopup } from "../../component/ConfirmationPopup";

interface CaseTypeSummaryProps {
    caseGroups: SelectedCaseGroup[];
    onBack: () => void;
    onConfirm: () => void;
    onDeleteGroup: (index: number) => void;
    onRemoveAddOn: (groupIndex: number, addOnIndex: number) => void;
    onAddMoreAddOns: (index: number) => void;
    onAddPrimary: () => void;
    onDeleteAndGoToSelectCaseType?: () => void;
    onClearSurgeon?: () => void;
    selectedSurgeon?: Surgeon | null;
    viewingMode?: boolean;
    onSeeSutureSheetDetails?: () => void;
    onClose?: () => void;
    confirmButtonText?: string;
}

export const CaseTypeSummary: React.FC<CaseTypeSummaryProps> = ({
    caseGroups,
    onBack,
    onConfirm,
    onDeleteGroup,
    onRemoveAddOn,
    onAddMoreAddOns,
    onAddPrimary,
    onDeleteAndGoToSelectCaseType,
    onClearSurgeon,
    selectedSurgeon,
    viewingMode = false,
    onSeeSutureSheetDetails,
    onClose,
    confirmButtonText,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [sheetAvailability, setSheetAvailability] = useState<Record<string, boolean>>({});

    // Track pack and needle counts for each group
    interface GroupCounts {
        packs: number;
        needles: number;
    }
    const [groupCounts, setGroupCounts] = useState<GroupCounts[]>([]);

    // Check if a case type has a suture sheet for the selected surgeon
    const caseTypeHasSutureSheet = (cptCode?: string): boolean => {
        if (!cptCode) return true;
        return sheetAvailability[cptCode] ?? true; // Default to true while loading
    };

    // Load suture sheet availability for all case types
    useEffect(() => {
        if (!selectedSurgeon) return;

        const checkAvailability = async () => {
            const availability: Record<string, boolean> = {};

            // Collect all CPT codes from case groups
            const allCptCodes: string[] = [];
            for (const group of caseGroups) {
                if (group.primary.cpt_code) allCptCodes.push(group.primary.cpt_code);
                for (const addOn of group.addOns) {
                    if (addOn.cpt_code) allCptCodes.push(addOn.cpt_code);
                }
            }

            // Check availability for each CPT code
            for (const cptCode of allCptCodes) {
                try {
                    const hasSheet = await appContext.caseService.surgeonHasSutureSheetForCpt(
                        selectedSurgeon.surgeon_id,
                        cptCode,
                    );
                    availability[cptCode] = hasSheet;
                } catch (error) {
                    console.error(`Failed to check sheet availability for ${cptCode}:`, error);
                    availability[cptCode] = false;
                }
            }

            setSheetAvailability(availability);
        };

        checkAvailability();
    }, [selectedSurgeon, caseGroups, appContext.caseService]);

    // Calculate pack and needle counts for each case group
    useEffect(() => {
        if (!selectedSurgeon) return;

        const calculateCounts = async () => {
            const counts: GroupCounts[] = [];

            // Fetch all suture sheets for the surgeon once
            const allSheets = await appContext.caseService.getSutureSheetsForSurgeon(selectedSurgeon.surgeon_id);

            for (const group of caseGroups) {
                let totalPacks = 0;
                let totalNeedles = 0;

                // Collect all CPT codes in this group (primary + add-ons)
                const groupCptCodes = [group.primary.cpt_code, ...group.addOns.map((a) => a.cpt_code)].filter(
                    Boolean,
                ) as string[];

                for (const cptCode of groupCptCodes) {
                    // Find the suture sheet for this CPT code
                    const sheet = allSheets.find((s) => s.cpt_codes?.includes(cptCode));

                    if (sheet && sheet.suture_sheet_items) {
                        for (const item of sheet.suture_sheet_items) {
                            totalPacks += item.num_packs;

                            // Fetch pack info to get needle count
                            try {
                                const packInfo = await appContext.caseService.getSuturePackInfo(item.fda_gudid);
                                if (packInfo) {
                                    totalNeedles += packInfo.num_needles * item.num_packs;
                                }
                            } catch (error) {
                                console.error(`Failed to fetch pack info for ${item.fda_gudid}:`, error);
                            }
                        }
                    }
                }

                counts.push({ packs: totalPacks, needles: totalNeedles });
            }

            setGroupCounts(counts);
        };

        calculateCounts();
    }, [selectedSurgeon, caseGroups, appContext.caseService]);

    const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);

    const listRef = useRef<HTMLDivElement>(null);

    // Visual thumb height must match CSS
    const THUMB_HEIGHT = 84;

    const handleBack = () => onBack();
    const handleConfirm = () => onConfirm();

    const handleDeletePrimary = (index: number) => setDeleteIndex(index);

    const confirmDelete = () => {
        if (deleteIndex !== null) {
            onDeleteGroup(deleteIndex);
            setDeleteIndex(null);
            if (onDeleteAndGoToSelectCaseType) {
                onDeleteAndGoToSelectCaseType();
            }
        }
    };

    const cancelDelete = () => setDeleteIndex(null);

    const handleRemoveAddOn = (groupIndex: number, addOnIndex: number) => {
        onRemoveAddOn(groupIndex, addOnIndex);
    };

    const handleAddMoreAddOns = (index: number) => {
        onAddMoreAddOns(index);
    };

    const handleAddPrimary = () => {
        onAddPrimary();
    };

    const handleSelectPrimaryCase = () => {
        onAddPrimary();
    };

    const handleSelectAnotherSurgeon = () => {
        if (onClearSurgeon) {
            onClearSurgeon();
        }
    };

    useLayoutEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const update = () => setShowScrollbar(el.scrollHeight > el.clientHeight + 1);
        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [caseGroups]);

    const addPrimaryLabel = t("setup.caseSummary.addPrimaryOneMore", {
        defaultValue: "Add One More Primary Case",
    });

    const primaryCount = caseGroups.length;
    const addOnCount = caseGroups.reduce((acc, group) => acc + group.addOns.length, 0);

    const surgeonName = selectedSurgeon
        ? `${selectedSurgeon.first_name} ${selectedSurgeon.last_name}`
        : t("setup.caseSummary.unknownSurgeon", { defaultValue: "Unknown" });
    const headerTitle = t("setup.caseSummary.headerTitle", {
        defaultValue: "{{surgeonName}} Procedures",
        surgeonName,
    });

    const noPrimaryCase = () => {
        return (
            <div className={styles.noPrimaryContainer}>
                <div className={styles.noPrimaryCenterContent}>
                    <div className={styles.selectCaseContainer}>
                        <div className={styles.caseIconContainer}>
                            <img src={Document} className={styles.caseIcon} alt="Document" />
                        </div>
                        <span className={styles.noPrimaryText}>
                            {t("setup.caseSummary.selectCaseType", {
                                defaultValue: "Select a Primary Case for {{surgeonName}}",
                                surgeonName,
                            })}
                        </span>
                    </div>
                    <button className={styles.selectPrimaryButton} onClick={handleSelectPrimaryCase}>
                        <span className={styles.selectPrimaryText}>
                            {t("setup.caseSummary.selectPrimary", { defaultValue: "Select Primary Case" })}
                        </span>
                    </button>
                </div>
                <button className={styles.selectAnotherButton} onClick={handleSelectAnotherSurgeon}>
                    <img src={Change} className={styles.selectAnotherIcon} alt="Change" />
                    <span className={styles.selectAnotherText}>
                        {t("setup.caseSummary.selectAnotherSurgeon", { defaultValue: "Select Another Surgeon" })}
                    </span>
                </button>
            </div>
        );
    };

    const renderCaseGroups = () => {
        return (
            <>
                {caseGroups.map((group, groupIndex) => {
                    const counts = groupCounts[groupIndex] || { packs: 0, needles: 0 };

                    return (
                        <div key={groupIndex} className={styles.rowContainer}>
                            <div className={styles.rowTopContainer}>
                                <div className={styles.primaryContainer}>
                                    <div className={styles.primaryTitleContainer}>
                                        <span className={styles.primaryCptText}>{group.primary.cpt_code}</span>
                                        <span className={styles.primaryNameText}>{group.primary.name}</span>
                                    </div>
                                    {!caseTypeHasSutureSheet(group.primary.cpt_code) && (
                                        <div className={styles.noSheetContainer}>
                                            <div className={styles.noSheetLabel}>
                                                <img src={Warning} className={styles.noSheetIcon} alt="No Sheet" />
                                                <span className={styles.noSheetText}>
                                                    {t("setup.caseSummary.noSheet", {
                                                        defaultValue: "No Suture Sheet",
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        className={styles.trashContainer}
                                        onClick={() => handleDeletePrimary(groupIndex)}
                                        aria-label={t("setup.caseSummary.deletePrimary", {
                                            defaultValue: "Delete primary case",
                                        })}
                                    >
                                        <img src={TrashIcon} className={styles.trashIcon} alt="Delete" />
                                    </button>
                                </div>
                                <div className={styles.secondaryContainer}>
                                    {group.addOns.map((addOn, addOnIndex) => (
                                        <div key={addOnIndex} className={styles.secondaryCard}>
                                            <div className={styles.secondaryCardContent}>
                                                <div className={styles.secondaryCardInfo}>
                                                    <span className={styles.secondaryCodeText}>+{addOn.cpt_code}</span>
                                                    <span className={styles.secondaryNameText}>{addOn.name}</span>
                                                </div>
                                                {!caseTypeHasSutureSheet(addOn.cpt_code) && (
                                                    <div className={styles.noSheetContainer}>
                                                        <div className={styles.noSheetLabel}>
                                                            <img
                                                                src={Warning}
                                                                className={styles.noSheetIcon}
                                                                alt="No Sheet"
                                                            />
                                                            <span className={styles.noSheetText}>
                                                                {t("setup.caseSummary.noSheet", {
                                                                    defaultValue: "No Suture Sheet",
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                <button
                                                    className={styles.closeIcon}
                                                    onClick={() => handleRemoveAddOn(groupIndex, addOnIndex)}
                                                    aria-label={t("setup.caseSummary.removeAddOn", {
                                                        defaultValue: "Remove add-on",
                                                    })}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        padding: 0,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <img
                                                        src={CloseIcon}
                                                        alt="Close"
                                                        style={{ width: "40px", height: "40px" }}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.rowBottomContainer}>
                                <div className={styles.rowBottomButtonContainer}>
                                    <button
                                        className={styles.addMoreButton}
                                        onClick={() => handleAddMoreAddOns(groupIndex)}
                                    >
                                        <img src={PlusWhite} alt="Add" className={styles.plusIcon} />
                                        <span className={styles.addMoreText}>
                                            {t("setup.caseSummary.add", { defaultValue: "Add More Secondary Cases" })}
                                        </span>
                                    </button>
                                </div>
                                <div className={styles.totalCounterContainer}>
                                    <div className={styles.totalCountCard}>
                                        <span className={styles.totalCountNumber}>{counts.packs}</span>
                                        <span className={styles.totalCountText}>
                                            {t("setup.caseSummary.packs", { defaultValue: "Packs" })}
                                        </span>
                                    </div>
                                    <div className={styles.totalCountCard}>
                                        <span className={styles.totalCountNumber}>{counts.needles}</span>
                                        <span className={styles.totalCountText}>
                                            {t("setup.caseSummary.totalNeedles", { defaultValue: "Total Needles" })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </>
        );
    };

    // If no case groups, show only the empty state (no header/footer)
    if (caseGroups.length === 0) {
        return <div className={styles.container}>{noPrimaryCase()}</div>;
    }

    // Show full layout with header, content, and footer
    return (
        <div className={styles.container}>
            {/* Custom Header */}
            <div className={styles.header}>
                <div className={styles.headerInnerContainer}>
                    <div className={styles.backButton} onClick={handleBack}>
                        <img src={BackArrow} className={styles.backArrow} alt="Back" />
                    </div>
                    <div className={styles.leftContainer}>
                        <div className={styles.titleContainer}>
                            <div className={styles.titleTextContainer}>
                                <span className={styles.titleText}>{headerTitle}</span>
                            </div>
                        </div>
                        <div className={styles.chipContainer}>
                            <div className={styles.chip}>
                                <span className={styles.chipText}>
                                    {primaryCount} {t("setup.caseSummary.primary", { defaultValue: "Primary" })}
                                </span>
                                <span className={styles.dividerText}>|</span>
                                <span className={styles.chipText}>
                                    {addOnCount} {t("setup.caseSummary.secondary", { defaultValue: "Secondary" })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.rightContainer}>
                        <div className={styles.divider}></div>
                        <div className={styles.helpContainer}>
                            <img src={Help} className={styles.helpIcon} alt="Help" />
                            <span className={styles.helpText}>
                                {t("sutureSheetHeader.help", { defaultValue: "Help" })}
                            </span>
                        </div>
                        <div className={styles.divider}></div>
                        {onSeeSutureSheetDetails && (
                            <button className={styles.seeSutureSheetButton} onClick={onSeeSutureSheetDetails}>
                                <span className={styles.seeSutureSheetButtonText}>
                                    {t("setup.caseSummary.seeSutureSheetDetails", {
                                        defaultValue: "See Suture Sheet Details",
                                    })}
                                </span>
                            </button>
                        )}
                        <button className={styles.addPrimaryButton} onClick={handleAddPrimary}>
                            <img src={PlusWhite} className={styles.plusIcon} alt="Add" />
                            <span className={styles.addPrimaryButtonText}>{addPrimaryLabel}</span>
                        </button>
                        {onClose && (
                            <div className={styles.backButton} onClick={onClose} role="button">
                                <img src={CloseIcon} className={styles.backArrow} alt="Close" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.mainContent}>
                <div
                    className={`${styles.contentList} ${showScrollbar ? styles.contentListWithScrollbar : ""} ${viewingMode ? styles.contentListViewingMode : ""}`}
                    ref={listRef}
                >
                    {renderCaseGroups()}
                </div>

                {showScrollbar && (
                    <CustomScrollbar
                        targetRef={listRef}
                        thumbHeight={THUMB_HEIGHT}
                        dependency={caseGroups}
                        styles={styles}
                        containerStyle={viewingMode ? { paddingBottom: "50px" } : undefined}
                    />
                )}
            </div>

            {!viewingMode && (
                <div className={styles.confirmBar}>
                    <button className={styles.confirmButton} onClick={handleConfirm}>
                        {confirmButtonText ??
                            t("setup.caseSummary.proceed", {
                                defaultValue: "Proceed",
                            })}
                        <img src={RightArrowBlack} alt="" className={styles.confirmArrowIcon} />
                    </button>
                </div>
            )}

            <ConfirmationPopup
                isOpen={deleteIndex !== null}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                icon={WarningIcon}
                showBadge={true}
                badgeContent={
                    deleteIndex !== null && caseGroups[deleteIndex] ? (
                        <div className={styles.caseTypeBadge}>
                            <span className={styles.badgePrimaryText}>{caseGroups[deleteIndex].primary.cpt_code}</span>
                            {caseGroups[deleteIndex].addOns.length > 0 && (
                                <div className={styles.badgeSecondaryContainer}>
                                    {caseGroups[deleteIndex].addOns.map((addOn, idx) => (
                                        <React.Fragment key={idx}>
                                            <span className={styles.badgeSecondaryText}>+{addOn.cpt_code}</span>
                                            {idx < caseGroups[deleteIndex].addOns.length - 1 && (
                                                <span className={styles.badgeSecondaryDivider}>|</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null
                }
                message={t("setup.caseSummary.deleteConfirmation", {
                    defaultValue: "Are you sure you want to delete this case for {{surgeonName}}?",
                    surgeonName,
                })}
                cancelText={t("setup.caseSummary.no", { defaultValue: "No" })}
                confirmText={t("setup.caseSummary.yesDelete", { defaultValue: "Yes, Delete" })}
            />
        </div>
    );
};
