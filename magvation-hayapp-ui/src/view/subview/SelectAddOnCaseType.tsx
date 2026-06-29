import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "../subviewcss/selectAddOnCaseType.module.css";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import { CaseType } from "../../services/CaseService";
import { VirtualKeyboard } from "../../component/VirtualKeyboard";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import WarningIcon from "../../img/Warning.svg";
import MagGlassImg from "../../img/MagGlass.svg";
import NoResultsImg from "../../img/NoResults.svg";
import BlackCheck from "../../img/BlackCheck.svg";
import BackArrow from "../../img/BackArrow.svg";
import CloseWhite from "../../img/CloseWhite.svg";
import { Surgeon } from "../../services/StaffService";

interface SelectAddOnCaseTypeProps {
    onBack: () => void;
    onContinue: (addOns: CaseType[]) => void;
    primaryCaseType: CaseType | null;
    initialSelectedAddOns?: CaseType[];
    fromCaseSummary?: boolean;
    onCancelToSummary?: () => void;
    selectedSurgeon?: Surgeon | null;
    onClose?: () => void;
}

export const SelectAddOnCaseType: React.FC<SelectAddOnCaseTypeProps> = ({
    onBack,
    primaryCaseType,
    onContinue,
    initialSelectedAddOns,
    onCancelToSummary,
    selectedSurgeon,
    fromCaseSummary,
    onClose,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [allCaseTypes, setAllCaseTypes] = useState<CaseType[]>([]);

    // Fetch case types on mount
    useEffect(() => {
        const loadCaseTypes = async () => {
            try {
                const types = await appContext.caseService.fetchAllCaseTypes();
                setAllCaseTypes(types);
            } catch (error) {
                console.error("Failed to load case types:", error);
            }
        };
        loadCaseTypes();
    }, [appContext]);

    // Show all add-on case types (ignore secondary_cpt_codes field for now)
    const addOnCaseTypes = useMemo(() => {
        return allCaseTypes.filter((ct) => ct.is_primary === false);
    }, [allCaseTypes]);

    // Check suture sheet availability for add-on case types
    useEffect(() => {
        if (!selectedSurgeon) return;

        const checkSheetAvailability = async () => {
            const availability: Record<string, boolean> = {};

            for (const caseType of addOnCaseTypes) {
                if (caseType.cpt_code) {
                    try {
                        const hasSheet = await appContext.caseService.surgeonHasSutureSheetForCpt(
                            selectedSurgeon.surgeon_id,
                            caseType.cpt_code,
                        );
                        availability[caseType.case_type_id] = hasSheet;
                    } catch (error) {
                        console.error(`Failed to check sheet availability for ${caseType.cpt_code}:`, error);
                        availability[caseType.case_type_id] = false;
                    }
                }
            }
        };

        if (addOnCaseTypes.length > 0) {
            checkSheetAvailability();
        }
    }, [selectedSurgeon, addOnCaseTypes, appContext.caseService]);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAddOns, setSelectedAddOns] = useState<CaseType[]>(initialSelectedAddOns || []);

    const [listHeight, setListHeight] = useState<number | null>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const searchRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Visual thumb height must match CSS
    const THUMB_HEIGHT = 84;

    const filteredAddOns = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return addOnCaseTypes
            .filter(
                (c) => c.name.toLowerCase().includes(term) || (c.cpt_code && c.cpt_code.toLowerCase().includes(term)),
            )
            .sort((a, b) => {
                // Sort by CPT code (lowest to highest)
                const cptA = a.cpt_code || "";
                const cptB = b.cpt_code || "";
                return cptA.localeCompare(cptB, undefined, { numeric: true });
            });
    }, [addOnCaseTypes, searchTerm]);

    const showNoResults = filteredAddOns.length === 0;

    // Use fixed heights based on optimal layout
    const computeListHeight = () => {
        setListHeight(385);
    };

    // Measure on mount + resize + dynamic changes
    useLayoutEffect(() => {
        requestAnimationFrame(() => inputRef.current?.focus());

        computeListHeight();

        const ro = new ResizeObserver(() => computeListHeight());
        if (searchRef.current) ro.observe(searchRef.current);

        const onResize = () => computeListHeight();
        window.addEventListener("resize", onResize);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", onResize);
        };
    }, []);

    // Only show the scroll rail when the list actually scrolls
    useLayoutEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const update = () => setShowScrollbar(el.scrollHeight > el.clientHeight + 1);
        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [filteredAddOns.length, listHeight]);

    const handleAddOnToggle = (addOn: CaseType) => {
        setSelectedAddOns((prev) => {
            const exists = prev.find((p) => p.case_type_id === addOn.case_type_id);
            if (exists) {
                return prev.filter((p) => p.case_type_id !== addOn.case_type_id);
            } else {
                return [...prev, addOn];
            }
        });
    };

    const handleContinue = () => {
        onContinue(selectedAddOns);
    };

    const getSelectedAddOnsDisplay = (): string => {
        if (selectedAddOns.length === 0) {
            return t("setup.selectAddOnCaseType.notSelected") || "Not Selected";
        }
        return selectedAddOns.map((addOn) => `+${addOn.cpt_code || addOn.name}`).join(", ");
    };

    // Handle keyboard input
    const onKeyClicked = (keyValue: string) => {
        if (keyValue === "backspace") {
            setSearchTerm((prev) => prev.slice(0, -1));
        } else if (keyValue === "enter") {
            // Do nothing
        } else if (keyValue === "space") {
            setSearchTerm((prev) => prev + " ");
        } else if (keyValue.length === 1) {
            setSearchTerm((prev) => prev + keyValue);
        }
    };

    // Rail height (slightly smaller than list for visual balance)
    const railInlineStyle = listHeight ? { height: 350 } : undefined;

    const basePlaceholder = t("setup.selectAddOnCaseType.searchPlaceholder") || "Search by CPT code or surgical name";
    const surgeonName = selectedSurgeon ? `${selectedSurgeon.first_name} ${selectedSurgeon.last_name}` : "";
    const searchLabel = surgeonName ? `${basePlaceholder} ${surgeonName}` : basePlaceholder;
    const nothingFoundLabel = t("setup.selectAddOnCaseType.nothingFound") || "Nothing found";

    // Continue is enabled unless we are in a "no results" search state
    const continueLooksEnabled = !showNoResults;

    return (
        <div className={styles.container}>
            {/* Search Input */}
            <div className={styles.searchContainer} ref={searchRef}>
                {!fromCaseSummary && (
                    <button className={styles.backButton} onClick={onBack}>
                        <img src={BackArrow} alt="Back" />
                    </button>
                )}
                <div
                    className={`${styles.searchField} ${isSearchFocused ? styles.searchFieldFocused : ""}`}
                    onMouseDown={(e) => {
                        // allow click anywhere in the container to focus input (keeps caret behavior stable)
                        if (e.target !== inputRef.current) {
                            e.preventDefault();
                            inputRef.current?.focus();
                        }
                    }}
                >
                    <img src={MagGlassImg} className={styles.magnifyIcon} alt="" />
                    <div className={`${styles.searchLabel} ${searchTerm ? styles.searchLabelFloating : ""}`}>
                        {searchLabel}
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        className={`${styles.searchText} ${searchTerm ? styles.searchTextActive : ""}`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
                {fromCaseSummary ? (
                    <button className={styles.closeButton} onClick={onBack}>
                        <img src={CloseWhite} alt="Close" />
                    </button>
                ) : onClose ? (
                    <button className={styles.backButton} onClick={onClose}>
                        <img src={CloseWhite} alt="Close" />
                    </button>
                ) : null}
            </div>

            {/* Main Content Area */}
            <div className={styles.mainContent}>
                <div className={styles.listContainer}>
                    {/* Add-on List */}
                    <div
                        className={`${styles.caseTypeList} ${
                            showScrollbar ? styles.caseTypeListWithRail : styles.caseTypeListNoRail
                        }`}
                        ref={listRef}
                        style={listHeight ? { height: listHeight } : undefined}
                    >
                        {showNoResults ? (
                            <div className={styles.noResults}>
                                <div className={styles.noResultsIcon} aria-hidden="true">
                                    <img src={NoResultsImg} alt="No results" />
                                </div>
                                <div className={styles.noResultsText}>{nothingFoundLabel}</div>
                            </div>
                        ) : (
                            filteredAddOns.map((addOn) => {
                                const isSelected = selectedAddOns.some((s) => s.case_type_id === addOn.case_type_id);

                                return (
                                    <div
                                        key={addOn.case_type_id}
                                        className={styles.caseTypeItem}
                                        onClick={() => handleAddOnToggle(addOn)}
                                    >
                                        <div
                                            className={`${styles.checkbox} ${isSelected ? styles.checkboxSelected : ""}`}
                                        >
                                            {isSelected && (
                                                <div className={styles.checkboxInner}>
                                                    <img
                                                        src={BlackCheck}
                                                        className={styles.icon}
                                                        alt="Black checkmark"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {addOn.cpt_code && <span className={styles.cptCode}>+{addOn.cpt_code}</span>}
                                        <span className={styles.caseTypeName}>{addOn.name}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Custom Scroll Rail (only when needed) */}
                    {showScrollbar && (
                        <CustomScrollbar
                            targetRef={listRef}
                            thumbHeight={THUMB_HEIGHT}
                            dependency={filteredAddOns}
                            styles={styles}
                            containerStyle={{ ...railInlineStyle, marginTop: 15 }}
                        />
                    )}
                </div>
            </div>

            {/* Bottom Section */}
            <div className={styles.bottomSection} ref={bottomRef}>
                <div className={styles.bottomBar}>
                    <div className={styles.selectedInfo}>
                        <div className={styles.topRow}>
                            <div className={styles.surgeonSection}>
                                <span className={styles.surgeonLabel}>
                                    {t("setup.selectAddOnCaseType.surgeon") || "Surgeon: "}
                                </span>
                                <span className={styles.surgeonValue}>
                                    {selectedSurgeon
                                        ? `${selectedSurgeon.first_name} ${selectedSurgeon.last_name}`
                                        : "Unknown"}
                                </span>
                            </div>
                            <div className={styles.primarySection}>
                                <span className={styles.primaryLabel}>
                                    {t("setup.selectAddOnCaseType.primaryCaseType") || "Primary case type: "}
                                </span>
                                <span className={styles.primaryValue}>{primaryCaseType?.cpt_code || "None"}</span>
                            </div>
                        </div>
                        <div>
                            <span className={styles.selectedLabel}>
                                {t("setup.selectAddOnCaseType.selectedAddOns") || "Selected secondary case types: "}
                            </span>
                            <span
                                className={`${styles.selectedValue} ${
                                    selectedAddOns.length === 0 ? styles.placeholder : styles.selectedValueActive
                                }`}
                            >
                                {getSelectedAddOnsDisplay()}
                            </span>
                        </div>
                    </div>
                    <button
                        className={`${styles.continueButton} ${continueLooksEnabled ? styles.continueButtonEnabled : ""}`}
                        onClick={handleContinue}
                    >
                        {fromCaseSummary
                            ? t("setup.selectAddOnCaseType.save") || "Save"
                            : t("setup.selectAddOnCaseType.continue") || "Continue"}
                    </button>
                </div>

                <div className={styles.keyboardArea}>
                    <VirtualKeyboard onKeyPress={onKeyClicked} />
                </div>
            </div>

            {showLeaveModal && (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div className={styles.modal}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalIcon}>
                                <img src={WarningIcon} alt="Warning" className={styles.modalIconImage} />
                            </div>

                            <div className={styles.modalText}>
                                <div className={styles.modalTitle}>
                                    {t("setup.selectAddOnCaseType.leaveWithoutSavingTitle", {
                                        defaultValue: "Leave without saving?",
                                    })}
                                </div>
                                <div className={styles.modalSubtitle}>
                                    {t("setup.selectAddOnCaseType.leaveWithoutSavingSubtitle", {
                                        defaultValue: "All unsaved changes will be lost.",
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalButtons}>
                            <button className={styles.modalCancelButton} onClick={() => setShowLeaveModal(false)}>
                                {t("setup.selectAddOnCaseType.no", { defaultValue: "No" })}
                            </button>
                            <button
                                className={styles.modalConfirmButton}
                                onClick={() => {
                                    setShowLeaveModal(false);
                                    if (onCancelToSummary) {
                                        onCancelToSummary();
                                    } else {
                                        onBack();
                                    }
                                }}
                            >
                                {t("setup.selectAddOnCaseType.yes", { defaultValue: "Yes" })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
