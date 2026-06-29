import React, { useState, useRef, useEffect } from "react";
import styles from "../subviewcss/sutureSheetNotAvailable.module.css";
import { useTranslation } from "react-i18next";
import BackArrow from "../../img/BackArrow.svg";
import WarningIcon from "../../img/WarningTriangle.svg";
import ChevronDownIcon from "../../img/downChevron.svg";
import WhiteCheckIcon from "../../img/WhiteCheck.svg";
import { CaseTypeSummaryInfo } from "../Setup";

/**
 * Represents a case type that is missing a suture sheet
 */
export interface MissingCaseTypeInfo {
    name: string;
    cptCode: string;
    /** Whether a replacement sheet from another surgeon has been selected */
    hasReplacement?: boolean;
    /** Name of the surgeon whose sheet was selected as replacement */
    replacementSurgeonName?: string;
}

interface SutureSheetNotAvailableProps {
    surgeonName: string;
    /** Array of all case types missing suture sheets */
    missingCaseTypes: MissingCaseTypeInfo[];
    /** All case types (with and without sheets) – when provided, shows full SummarySheet-style dropdown */
    caseTypeSummaries?: CaseTypeSummaryInfo[];
    /** Pack count per cptCode (for dropdown display) */
    packCounts?: Record<string, number>;
    /** Needle count per cptCode (for dropdown display) */
    needleCounts?: Record<string, number>;
    /** Total packs for the combined "Summary Sheet" dropdown row */
    totalPacks?: number;
    /** Total needles for the combined "Summary Sheet" dropdown row */
    totalNeedles?: number;
    /** Currently selected CPT code to display */
    selectedCptCode: string;
    /** Callback when user selects a different missing case type from dropdown */
    onSelectCaseType: (cptCode: string) => void;
    /** Callback when user selects a case type that HAS a suture sheet */
    onSelectCaseTypeWithSheet?: (cptCode: string) => void;
    /** Callback when user selects the combined "Summary Sheet" option */
    onGoToSummarySheet?: () => void;
    onBack: () => void;
    onConfirm: () => void;
    onSeeOtherSurgeonSheets: () => void;
}

export const SutureSheetNotAvailable: React.FC<SutureSheetNotAvailableProps> = ({
    surgeonName,
    missingCaseTypes,
    caseTypeSummaries,
    packCounts,
    needleCounts,
    totalPacks,
    totalNeedles,
    selectedCptCode,
    onSelectCaseType,
    onSelectCaseTypeWithSheet,
    onGoToSummarySheet,
    onBack,
    onConfirm,
    onSeeOtherSurgeonSheets,
}) => {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const chevronRef = useRef<HTMLImageElement>(null);

    // Get the currently selected case type info
    const selectedCaseType = missingCaseTypes.find((ct) => ct.cptCode === selectedCptCode) ?? missingCaseTypes[0];
    const caseTypeName = selectedCaseType?.name ?? "Unknown Case Type";

    // Show dropdown when caseTypeSummaries is provided (full SummarySheet-style dropdown),
    // or fall back to showing only when there are multiple missing case types
    const showDropdownChevron = caseTypeSummaries ? caseTypeSummaries.length > 0 : missingCaseTypes.length > 1;

    // Click outside handler to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isDropdownOpen &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                chevronRef.current &&
                !chevronRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isDropdownOpen]);

    const handleDropdownItemClick = (cptCode: string) => {
        onSelectCaseType(cptCode);
        setIsDropdownOpen(false);
    };

    const handleSeeOtherSurgeonSheets = () => {
        // TODO: This button navigates to "Other Surgeons Sheets" screen (not yet implemented)
        // For now, this button is rendered but non-functional
        console.log("See Other Surgeon's Sheets clicked - screen not yet implemented");
        onSeeOtherSurgeonSheets();
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <button className={styles.backButton} onClick={onBack}>
                    <img src={BackArrow} alt="Back" />
                </button>

                <div className={`${styles.headerContent} ${isDropdownOpen ? styles.headerContentOpen : ""}`}>
                    <div className={styles.headerLeft}>
                        <span className={styles.headerLabel}>
                            {t("setup.sutureSheetNotAvailable.caseTypeLabel", {
                                defaultValue: "Case type to view details",
                            })}
                        </span>
                        <span className={styles.headerTitle}>{caseTypeName}</span>
                    </div>

                    <div className={styles.headerRight}>
                        <div className={styles.noSutureSheetBadge}>
                            <img src={WarningIcon} alt="Warning" className={styles.warningIcon} />
                            <span className={styles.badgeText}>
                                {t("setup.sutureSheetNotAvailable.noSutureSheet", {
                                    defaultValue: "No Suture Sheet",
                                })}
                            </span>
                        </div>
                        {showDropdownChevron && (
                            <img
                                ref={chevronRef}
                                src={isDropdownOpen ? WhiteCheckIcon : ChevronDownIcon}
                                alt={t("common.expand", { defaultValue: "Expand" })}
                                className={styles.chevronIcon}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            />
                        )}
                    </div>

                    {/* Dropdown */}
                    {isDropdownOpen && caseTypeSummaries && caseTypeSummaries.length > 0 ? (
                        <div className={styles.dropdown} ref={dropdownRef}>
                            {/* "Summary Sheet" combined view option */}
                            <div
                                className={styles.dropdownItem}
                                onClick={() => {
                                    setIsDropdownOpen(false);
                                    onGoToSummarySheet?.();
                                }}
                            >
                                <div className={styles.dropdownItemLeft}>
                                    {totalPacks !== undefined && (
                                        <span className={styles.dropdownCount}>
                                            {totalPacks}{" "}
                                            {totalPacks === 1
                                                ? t("setup.reviewRedundantNeedles.pack", { defaultValue: "Pack" })
                                                : t("setup.reviewRedundantNeedles.packs", { defaultValue: "Packs" })}
                                            {" | "}
                                            {totalNeedles ?? 0}{" "}
                                            {t("setup.reviewRedundantNeedles.sutureNeedles", {
                                                defaultValue: "Suture Needles",
                                            })}
                                        </span>
                                    )}
                                    <div className={styles.dropdownCaseInfo}>
                                        <span className={styles.dropdownCaseName}>
                                            {t("setup.summarySheet.title", { defaultValue: "Summary Sheet" })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* Individual case types */}
                            {caseTypeSummaries.map((caseType, index) => {
                                const isSelected = caseType.cptCode === selectedCptCode && !caseType.hasSutureSheet;
                                const packs = packCounts?.[caseType.cptCode];
                                const needles = needleCounts?.[caseType.cptCode];
                                return (
                                    <div
                                        key={index}
                                        className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemSelected : ""}`}
                                        onClick={() => {
                                            setIsDropdownOpen(false);
                                            if (caseType.hasSutureSheet) {
                                                onSelectCaseTypeWithSheet?.(caseType.cptCode);
                                            } else if (caseType.cptCode !== selectedCptCode) {
                                                onSelectCaseType(caseType.cptCode);
                                            }
                                        }}
                                    >
                                        <div className={styles.dropdownItemLeft}>
                                            {packs !== undefined && (
                                                <span className={styles.dropdownCount}>
                                                    {packs}{" "}
                                                    {packs === 1
                                                        ? t("setup.reviewRedundantNeedles.pack", {
                                                              defaultValue: "Pack",
                                                          })
                                                        : t("setup.reviewRedundantNeedles.packs", {
                                                              defaultValue: "Packs",
                                                          })}
                                                    {" | "}
                                                    {needles ?? 0}{" "}
                                                    {t("setup.reviewRedundantNeedles.sutureNeedles", {
                                                        defaultValue: "Suture Needles",
                                                    })}
                                                </span>
                                            )}
                                            <div className={styles.dropdownCaseInfo}>
                                                <span className={styles.dropdownCaseName}>{caseType.name}</span>
                                                <span className={styles.dropdownCptCode}>{caseType.cptCode}</span>
                                            </div>
                                        </div>
                                        {!caseType.hasSutureSheet && (
                                            <div className={styles.dropdownNoSheetBadge}>
                                                <img src={WarningIcon} alt="" className={styles.dropdownWarningIcon} />
                                                <span className={styles.badgeText}>
                                                    {t("setup.sutureSheetNotAvailable.noSutureSheet", {
                                                        defaultValue: "No Suture Sheet",
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : isDropdownOpen && missingCaseTypes.length > 1 ? (
                        <div className={styles.dropdown} ref={dropdownRef}>
                            {missingCaseTypes.map((caseType, index) => {
                                const isSelected = caseType.cptCode === selectedCptCode;
                                return (
                                    <div
                                        key={index}
                                        className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemSelected : ""}`}
                                        onClick={() => handleDropdownItemClick(caseType.cptCode)}
                                    >
                                        <div className={styles.dropdownCaseInfo}>
                                            <span className={styles.dropdownCaseName}>{caseType.name}</span>
                                            <span className={styles.dropdownCptCode}>{caseType.cptCode}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Main Content - Modal Card */}
            <div className={styles.mainContent}>
                <div className={styles.modalCard}>
                    <div className={styles.modalTitleRow}>
                        <img src={WarningIcon} alt="Warning" className={styles.modalWarningIcon} />
                        <h2 className={styles.modalTitle}>
                            {t("setup.sutureSheetNotAvailable.title", {
                                defaultValue: "Suture Sheet Not Available",
                            })}
                        </h2>
                    </div>

                    <p className={styles.modalSubtitle}>
                        {t("setup.sutureSheetNotAvailable.message", {
                            defaultValue:
                                "Please use surgeon {{surgeonName}}'s preference list for this case or use a suture sheet from another surgeon",
                            surgeonName: surgeonName,
                        })}
                    </p>

                    <button className={styles.seeOtherButton} onClick={handleSeeOtherSurgeonSheets}>
                        {t("setup.sutureSheetNotAvailable.seeOther", {
                            defaultValue: "See Other Surgeons' Sheets",
                        })}
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <button className={styles.confirmButton} onClick={onConfirm}>
                    {t("setup.sutureSheetNotAvailable.confirm", { defaultValue: "Confirm" })}
                </button>
            </div>
        </div>
    );
};
