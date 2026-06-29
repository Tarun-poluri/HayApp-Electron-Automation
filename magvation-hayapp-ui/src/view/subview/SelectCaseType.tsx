import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "../subviewcss/selectCaseType.module.css";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import { CaseType } from "../../services/CaseService";
import { VirtualKeyboard } from "../../component/VirtualKeyboard";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import WarningIcon from "../../img/Warning.svg";
import { Surgeon } from "../../services/StaffService";
import MagGlassImg from "../../img/MagGlass.svg";
import NoResultsImg from "../../img/NoResults.svg";
import BackArrow from "../../img/BackArrow.svg";
import CloseWhite from "../../img/CloseWhite.svg";

interface SelectCaseTypeProps {
    onBack: () => void;
    onContinue: (caseType: CaseType) => void;
    initialSelectedCaseType?: CaseType | null;
    fromCaseSummary?: boolean;
    onCancelToSummary?: () => void;
    selectedSurgeon?: Surgeon | null;
    onClose?: () => void;
}

export const SelectCaseType: React.FC<SelectCaseTypeProps> = ({
    onBack,
    onContinue,
    initialSelectedCaseType,
    onCancelToSummary,
    selectedSurgeon,
    onClose,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCaseType, setSelectedCaseType] = useState<CaseType | null>(initialSelectedCaseType || null);

    const [listHeight, setListHeight] = useState<number | null>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const searchRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Visual thumb height must match CSS
    const THUMB_HEIGHT = 84;

    // Fetch case types on mount - only show primary case types
    useEffect(() => {
        const loadCaseTypes = async () => {
            try {
                const types = await appContext.caseService.fetchAllCaseTypes();
                // Filter to only show primary case types
                const primaryTypes = types.filter((ct) => ct.is_primary === true);
                setCaseTypes(primaryTypes);
            } catch (error) {
                console.error("Failed to load case types:", error);
            }
        };
        loadCaseTypes();
    }, [appContext]);

    // Check suture sheet availability for each case type when surgeon is selected
    useEffect(() => {
        if (!selectedSurgeon) return;

        const checkSheetAvailability = async () => {
            const availability: Record<string, boolean> = {};

            for (const caseType of caseTypes) {
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

        if (caseTypes.length > 0) {
            checkSheetAvailability();
        }
    }, [selectedSurgeon, caseTypes, appContext.caseService]);

    const filteredCaseTypes = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return caseTypes
            .filter(
                (c) => c.name.toLowerCase().includes(term) || (c.cpt_code && c.cpt_code.toLowerCase().includes(term)),
            )
            .sort((a, b) => {
                // Sort by CPT code (lowest to highest)
                const cptA = a.cpt_code || "";
                const cptB = b.cpt_code || "";
                return cptA.localeCompare(cptB, undefined, { numeric: true });
            });
    }, [caseTypes, searchTerm]);

    const showNoResults = filteredCaseTypes.length === 0;

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
    }, [filteredCaseTypes.length, listHeight]);

    const handleCaseTypeSelect = (caseType: CaseType) => {
        setSelectedCaseType((prev) => (prev?.case_type_id === caseType.case_type_id ? null : caseType));
    };

    const handleContinue = () => {
        if (selectedCaseType) {
            onContinue(selectedCaseType);
        }
    };

    const getCaseTypeDisplayName = (caseType: CaseType | null): string => {
        if (!caseType) return t("setup.selectCaseTypeNew.notSelected") || "Not Selected";
        return caseType.cpt_code || caseType.name;
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

    const basePlaceholder = t("setup.selectCaseTypeNew.searchPlaceholder") || "Search by CPT code or surgical name";
    const surgeonName = selectedSurgeon ? `${selectedSurgeon.first_name} ${selectedSurgeon.last_name}` : "";
    const searchLabel = surgeonName ? `${basePlaceholder} ${surgeonName}` : basePlaceholder;
    const nothingFoundLabel = t("setup.selectCaseTypeNew.nothingFound") || "Nothing found";

    const continueLooksEnabled = !!selectedCaseType;

    return (
        <div className={styles.container}>
            {/* Search Input */}
            <div className={styles.searchContainer} ref={searchRef}>
                <button className={styles.backButton} onClick={onBack}>
                    <img src={BackArrow} alt="Back" />
                </button>
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
                {onClose && (
                    <button className={styles.backButton} onClick={onClose}>
                        <img src={CloseWhite} alt="Close" />
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div className={styles.mainContent}>
                <div className={styles.listContainer}>
                    {/* Case Type List */}
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
                            filteredCaseTypes.map((caseType) => {
                                const isSelected = selectedCaseType?.case_type_id === caseType.case_type_id;

                                return (
                                    <div
                                        key={caseType.case_type_id}
                                        className={styles.caseTypeItem}
                                        onClick={() => handleCaseTypeSelect(caseType)}
                                    >
                                        <div
                                            className={`${styles.radioButton} ${
                                                isSelected ? styles.radioButtonSelected : ""
                                            }`}
                                        />
                                        {caseType.cpt_code && (
                                            <span className={styles.cptCode}>{caseType.cpt_code}</span>
                                        )}
                                        <span className={styles.caseTypeName}>{caseType.name}</span>
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
                            dependency={filteredCaseTypes}
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
                        <div>
                            <span className={styles.surgeonLabel}>
                                {t("setup.selectCaseTypeNew.surgeon") || "Surgeon: "}
                            </span>
                            <span className={styles.surgeonValue}>
                                {selectedSurgeon
                                    ? `${selectedSurgeon.first_name} ${selectedSurgeon.last_name}`
                                    : "Unknown"}
                            </span>
                        </div>
                        <div>
                            <span className={styles.selectedLabel}>
                                {t("setup.selectCaseTypeNew.selectedCaseType") || "Selected primary case:"}
                            </span>
                            <span
                                className={`${styles.selectedValue} ${
                                    !selectedCaseType ? styles.placeholder : styles.selectedValueActive
                                }`}
                            >
                                {getCaseTypeDisplayName(selectedCaseType)}
                            </span>
                        </div>
                    </div>
                    <button
                        className={`${styles.continueButton} ${continueLooksEnabled ? styles.continueButtonEnabled : ""}`}
                        onClick={handleContinue}
                        disabled={!selectedCaseType}
                    >
                        {t("setup.selectCaseTypeNew.continue") || "Continue"}
                    </button>
                </div>

                <div className={styles.keyboardArea}>
                    <VirtualKeyboard onKeyPress={onKeyClicked} />
                </div>
            </div>

            {showCancelModal && (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div className={styles.modal}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalIcon}>
                                <img src={WarningIcon} alt="Warning" className={styles.modalIconImage} />
                            </div>

                            <div className={styles.modalText}>
                                {t("setup.selectCaseTypeNew.cancelConfirmation", {
                                    defaultValue: "Are you sure you want to cancel adding one more case?",
                                })}
                            </div>
                        </div>

                        <div className={styles.modalButtons}>
                            <button className={styles.modalCancelButton} onClick={() => setShowCancelModal(false)}>
                                {t("setup.selectCaseTypeNew.no", { defaultValue: "No" })}
                            </button>
                            <button
                                className={styles.modalDeleteButton}
                                onClick={() => {
                                    setShowCancelModal(false);
                                    if (onCancelToSummary) {
                                        onCancelToSummary();
                                    } else {
                                        onBack();
                                    }
                                }}
                            >
                                {t("setup.selectCaseTypeNew.yesCancel", { defaultValue: "Yes, Cancel" })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
