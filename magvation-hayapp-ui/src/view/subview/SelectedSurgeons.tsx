import React, { useLayoutEffect, useRef, useState } from "react";
import styles from "../subviewcss/selectedSurgeons.module.css";
import { useTranslation } from "react-i18next";
import { Surgeon } from "../../services/StaffService";
import { SelectedCaseGroup } from "../Setup";
import { ConfirmationPopup } from "../../component/ConfirmationPopup";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import SurgeonSubtract from "../../img/SurgeonSubtract.svg";
import TrashIcon from "../../img/TrashIcon.svg";
import PlusWhite from "../../img/PlusWhite.svg";
import SurgeonIcon from "../../img/SurgeonWhite.svg";

export interface SurgeonWithCaseGroups {
    surgeon: Surgeon;
    caseGroups: SelectedCaseGroup[];
}

interface SelectedSurgeonsProps {
    surgeons: SurgeonWithCaseGroups[];
    onBack: () => void;
    onContinue: () => void;
    onAddSurgeon: () => void;
    onRemoveSurgeon: (index: number) => void;
    onViewCaseDetails: (index: number) => void;
}

export const SelectedSurgeons: React.FC<SelectedSurgeonsProps> = ({
    surgeons,
    onContinue,
    onAddSurgeon,
    onRemoveSurgeon,
    onViewCaseDetails,
}) => {
    const { t } = useTranslation();
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    const THUMB_HEIGHT = 84;

    useLayoutEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const update = () => {
            const hasOverflow = el.scrollHeight > el.clientHeight + 1;
            setShowScrollbar(hasOverflow);
        };

        // Initial check
        update();

        // Check after a brief delay to ensure content is rendered
        const timer = setTimeout(update, 100);

        const ro = new ResizeObserver(update);
        ro.observe(el);

        return () => {
            clearTimeout(timer);
            ro.disconnect();
        };
    }, [surgeons]);

    const handleDeleteClick = (index: number) => {
        setDeleteIndex(index);
    };

    const confirmDelete = () => {
        if (deleteIndex !== null) {
            onRemoveSurgeon(deleteIndex);
            setDeleteIndex(null);
        }
    };

    const cancelDelete = () => {
        setDeleteIndex(null);
    };

    const getSurgeonName = (surgeon: Surgeon) => {
        return `${surgeon.first_name} ${surgeon.last_name}`.trim();
    };

    const getPrimaryCaseCount = (caseGroups: SelectedCaseGroup[]) => {
        return caseGroups.length;
    };

    const getSecondaryCaseCount = (caseGroups: SelectedCaseGroup[]) => {
        return caseGroups.reduce((total, group) => total + group.addOns.length, 0);
    };

    const deletingSurgeon = deleteIndex !== null ? surgeons[deleteIndex]?.surgeon : null;

    const noSurgeons = () => (
        <div className={styles.noSurgeonsContainer}>
            <div className={styles.noSurgeonContent}>
                <div className={styles.noSurgeonImageContainer}>
                    <img src={SurgeonIcon} alt="No Surgeons" className={styles.noSurgeonImage} />
                </div>
                <span className={styles.noSurgeonText}>
                    {t("setup.selectedSurgeons.selectSurgeonToProceed", {
                        defaultValue: "Select surgeons to proceed with the Start Count.",
                    })}
                </span>
            </div>
            <button className={styles.selectSurgeonButton} onClick={onAddSurgeon}>
                <span className={styles.selectSurgeonText}>
                    {t("setup.selectedSurgeons.selectSurgeon", { defaultValue: "Select Surgeon" })}
                </span>
            </button>
        </div>
    );

    if (surgeons.length === 0) {
        return noSurgeons();
    }

    return (
        <>
            <div className={styles.mainContainer}>
                <div className={styles.selectedSurgeonsContainer}>
                    <div className={styles.selectedSurgeonsTitle}>
                        <span className={styles.selectedSurgeonsTitleText}>
                            {t("setup.selectedSurgeons.selectedSurgeons", { defaultValue: "Selected Surgeons" })}
                        </span>
                        <div className={styles.numSurgeonsChip}>
                            <span className={styles.numSurgeonsText}>{surgeons.length}</span>
                        </div>
                    </div>

                    <div className={styles.listContainer}>
                        <div className={styles.surgeonListContainer} ref={listRef}>
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
                                                    {t("setup.selectedSurgeons.primary", { defaultValue: "Primary" })}
                                                </span>
                                                <span className={styles.caseTypeDividerText}>|</span>
                                                <span className={styles.caseTypeText}>
                                                    {getSecondaryCaseCount(surgeonEntry.caseGroups)}{" "}
                                                    {t("setup.selectedSurgeons.secondary", {
                                                        defaultValue: "Secondary",
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            className={styles.caseDetailsButton}
                                            onClick={() => onViewCaseDetails(index)}
                                        >
                                            <span className={styles.caseDetailsText}>
                                                {t("setup.selectedSurgeons.caseDetails", {
                                                    defaultValue: "Case Details",
                                                })}
                                            </span>
                                        </button>
                                    </div>
                                    <div
                                        className={styles.surgeonDeleteContainer}
                                        onClick={() => handleDeleteClick(index)}
                                    >
                                        <img src={SurgeonSubtract} alt="Subtract Surgeon" className={styles.subtract} />
                                        <div className={styles.trashContainer}>
                                            <img src={TrashIcon} alt="Trash Icon" className={styles.trashIcon} />
                                            <span className={styles.removeText}>
                                                {t("setup.selectedSurgeons.remove", { defaultValue: "Remove" })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button className={styles.addSurgeonContainer} onClick={onAddSurgeon}>
                                <img src={PlusWhite} alt="Add Surgeon" className={styles.plusIcon} />
                                <span className={styles.addSurgeonText}>
                                    {t("setup.selectedSurgeons.addNewSurgeon", { defaultValue: "Add Surgeon" })}
                                </span>
                            </button>

                            <button className={styles.continueButton} onClick={onContinue}>
                                <span className={styles.continueText}>
                                    {t("setup.selectedSurgeons.continue", { defaultValue: "Continue" })}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showScrollbar && (
                <CustomScrollbar targetRef={listRef} thumbHeight={THUMB_HEIGHT} dependency={surgeons} styles={styles} />
            )}

            <ConfirmationPopup
                isOpen={deleteIndex !== null}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                showBadge={true}
                icon={TrashIcon}
                badgeContent={
                    deletingSurgeon ? (
                        <div className={styles.surgeonNameBadge}>
                            <span className={styles.badgeSurgeonName}>
                                {t("setup.selectedSurgeons.surgeon", { surgeonName: getSurgeonName(deletingSurgeon) })}
                            </span>
                        </div>
                    ) : null
                }
                message={t("setup.selectedSurgeons.deleteConfirmation", {
                    defaultValue: "Are you sure you want to remove this surgeon?",
                })}
                cancelText={t("setup.selectedSurgeons.no", { defaultValue: "No" })}
                confirmText={t("setup.selectedSurgeons.yesRemove", { defaultValue: "Yes, Remove Surgeon" })}
            />
        </>
    );
};
