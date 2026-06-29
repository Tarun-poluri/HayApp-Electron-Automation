import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "../subviewcss/selectSutureSheet.module.css";
import { useTranslation } from "react-i18next";
import { VirtualKeyboard } from "../../component/VirtualKeyboard";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { Surgeon } from "../../services/StaffService";
import { SutureSheet } from "../../services/CaseService";
import MagGlassImg from "../../img/MagGlass.svg";
import BackArrow from "../../img/BackArrow.svg";
import NoResultsImg from "../../img/NoResults.svg";

export interface SurgeonSheetOption {
    surgeon: Surgeon;
    sheet: SutureSheet;
    caseTypeName: string;
    cptCode: string;
}

interface SelectSutureSheetProps {
    cptCode: string;
    caseTypeName: string;
    surgeonOptions: SurgeonSheetOption[];
    preselectedOption?: SurgeonSheetOption | null; // Option to pre-select on mount
    onBack: () => void;
    onContinue: (selectedOption: SurgeonSheetOption) => void;
}

export const SelectSutureSheet: React.FC<SelectSutureSheetProps> = ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cptCode,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    caseTypeName,
    surgeonOptions,
    preselectedOption = null,
    onBack,
    onContinue,
}) => {
    const { t } = useTranslation();

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOption, setSelectedOption] = useState<SurgeonSheetOption | null>(null);

    const [listHeight, setListHeight] = useState<number | null>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const searchRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Visual thumb height must match CSS
    const THUMB_HEIGHT = 84;

    // Set pre-selected option on mount
    useLayoutEffect(() => {
        if (preselectedOption) {
            setSelectedOption(preselectedOption);
        }
    }, [preselectedOption]);

    const filteredOptions = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return surgeonOptions.filter(
            (opt) =>
                `${opt.surgeon.first_name} ${opt.surgeon.last_name}`.toLowerCase().includes(term) ||
                opt.cptCode.toLowerCase().includes(term),
        );
    }, [surgeonOptions, searchTerm]);

    const showNoResults = filteredOptions.length === 0;

    // Compute available height for list (between search bar and top of fixed bottom section)
    const computeListHeight = () => {
        const search = searchRef.current;
        const bottom = bottomRef.current;

        if (!search || !bottom) {
            setListHeight(null);
            return;
        }

        const searchRect = search.getBoundingClientRect();
        const bottomRect = bottom.getBoundingClientRect();
        const available = bottomRect.top - searchRect.bottom - 30;
        setListHeight(Math.max(120, Math.floor(available)));
    };

    // Measure on mount + resize + dynamic changes
    useLayoutEffect(() => {
        // Match correct screen: caret visible immediately
        requestAnimationFrame(() => inputRef.current?.focus());

        computeListHeight();

        const ro = new ResizeObserver(() => computeListHeight());
        if (searchRef.current) ro.observe(searchRef.current);
        if (bottomRef.current) ro.observe(bottomRef.current);

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
    }, [filteredOptions.length, listHeight]);

    const handleOptionSelect = (option: SurgeonSheetOption) => {
        setSelectedOption(option);
    };

    const handleContinue = () => {
        if (selectedOption) {
            onContinue(selectedOption);
        }
    };

    const getSelectedDisplayName = (option: SurgeonSheetOption | null): string => {
        if (!option) return t("setup.selectSutureSheet.notSelected") || "Not Selected";
        return `${option.surgeon.first_name} ${option.surgeon.last_name}`.trim();
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

    // Rail height should match list height
    const railInlineStyle = listHeight ? { height: listHeight } : undefined;

    const searchLabel = t("setup.selectSutureSheet.searchPlaceholder") || "Search by surgeon name or CPT code";
    const nothingFoundLabel = t("setup.selectSutureSheet.nothingFound") || "Nothing found";

    const continueLooksEnabled = !!selectedOption;

    return (
        <div className={styles.container}>
            {/* Search Input (floating label style) */}
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
            </div>

            {/* Main Content Area */}
            <div className={styles.mainContent}>
                <div className={styles.listContainer}>
                    {/* Surgeon Sheet Options List */}
                    <div
                        className={`${styles.surgeonList} ${
                            showScrollbar ? styles.surgeonListWithRail : styles.surgeonListNoRail
                        }`}
                        ref={listRef}
                        style={listHeight ? { height: listHeight, marginTop: 15 } : undefined}
                    >
                        {showNoResults ? (
                            <div className={styles.noResults}>
                                <div className={styles.noResultsIcon} aria-hidden="true">
                                    <img src={NoResultsImg} alt="No results" />
                                </div>
                                <div className={styles.noResultsText}>{nothingFoundLabel}</div>
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected =
                                    selectedOption?.surgeon.surgeon_id === option.surgeon.surgeon_id &&
                                    selectedOption?.sheet.suture_sheet_id === option.sheet.suture_sheet_id;
                                return (
                                    <div
                                        key={`${option.surgeon.surgeon_id}-${option.sheet.suture_sheet_id}`}
                                        className={styles.surgeonItem}
                                        onClick={() => handleOptionSelect(option)}
                                    >
                                        {/* Selected radio = solid lavender (no inner dot) */}
                                        <div
                                            className={`${styles.radioButton} ${
                                                isSelected ? styles.radioButtonSelected : ""
                                            }`}
                                        />
                                        <div className={styles.itemContent}>
                                            <span className={styles.surgeonName}>
                                                {`${option.surgeon.first_name} ${option.surgeon.last_name}`.trim()}
                                            </span>
                                            <span className={styles.caseTypeName}>{option.cptCode}</span>
                                        </div>
                                        <span className={styles.cptCode}>{option.caseTypeName}</span>
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
                            dependency={filteredOptions}
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
                        <span className={styles.selectedLabel}>
                            {t("setup.selectSutureSheet.selectedSutureSheet") || "Selected suture sheet:"}
                        </span>
                        <span
                            className={`${styles.selectedValue} ${
                                !selectedOption ? styles.placeholder : styles.selectedValueActive
                            }`}
                        >
                            {getSelectedDisplayName(selectedOption)}
                        </span>
                    </div>
                    <button
                        className={`${styles.continueButton} ${continueLooksEnabled ? styles.continueButtonEnabled : ""}`}
                        onClick={handleContinue}
                        disabled={!selectedOption}
                    >
                        {t("setup.selectSutureSheet.continue") || "Continue"}
                    </button>
                </div>

                <div className={styles.keyboardArea}>
                    <VirtualKeyboard onKeyPress={onKeyClicked} />
                </div>
            </div>
        </div>
    );
};
