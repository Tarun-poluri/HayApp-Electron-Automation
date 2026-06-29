import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "../subviewcss/selectSurgeon.module.css";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import { Surgeon } from "../../services/StaffService";
import { VirtualKeyboard } from "../../component/VirtualKeyboard";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import MagGlassImg from "../../img/MagGlass.svg";
import BackArrow from "../../img/BackArrow.svg";
import CloseWhite from "../../img/CloseWhite.svg";

interface SelectSurgeonProps {
    onBack: () => void;
    onContinue: (surgeon: Surgeon) => void;
    initialSelectedSurgeon?: Surgeon | null;
    onAddCustomSurgeon?: (searchTerm: string) => void;
    excludedSurgeons?: Surgeon[];
    onClose?: () => void;
}

export const SelectSurgeon: React.FC<SelectSurgeonProps> = ({
    onBack,
    onContinue,
    initialSelectedSurgeon,
    onAddCustomSurgeon,
    excludedSurgeons = [],
    onClose,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSurgeon, setSelectedSurgeon] = useState<Surgeon | null>(initialSelectedSurgeon || null);

    // Fetch surgeons from backend on mount
    useEffect(() => {
        const fetchSurgeons = async () => {
            try {
                const fetchedSurgeons = await appContext.caseService.getSurgeons();
                setSurgeons(fetchedSurgeons);
            } catch (error) {
                console.error("Failed to fetch surgeons:", error);
            }
        };
        fetchSurgeons();
    }, [appContext.caseService]);

    const [listHeight, setListHeight] = useState<number | null>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const searchRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Visual thumb height must match CSS
    const THUMB_HEIGHT = 84;

    const filteredSurgeons = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const excludedIds = new Set(excludedSurgeons.map((s) => s.surgeon_id));
        return surgeons
            .filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(term))
            .map((s) => ({
                ...s,
                isAlreadySelected: excludedIds.has(s.surgeon_id),
            }))
            .sort((a, b) => {
                const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });
    }, [surgeons, searchTerm, excludedSurgeons]);

    const showNoResults = filteredSurgeons.length === 0;

    // Use fixed heights based on optimal layout
    const computeListHeight = () => {
        setListHeight(385);
    };

    // Measure on mount + resize + dynamic changes
    useLayoutEffect(() => {
        // Match correct screen: caret visible immediately
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
    }, [filteredSurgeons.length, listHeight]);

    const handleSurgeonSelect = (surgeon: Surgeon) => {
        setSelectedSurgeon((prev) => (prev?.surgeon_id === surgeon.surgeon_id ? null : surgeon));
    };

    const handleContinue = () => {
        if (selectedSurgeon) {
            onContinue(selectedSurgeon);
        }
    };

    const handleAddCustomSurgeon = () => {
        if (onAddCustomSurgeon && searchTerm.trim()) {
            onAddCustomSurgeon(searchTerm.trim());
        }
    };

    const getSurgeonDisplayName = (surgeon: Surgeon | null): string => {
        if (!surgeon) return t("setup.selectSurgeonNew.notSelected") || "Not Selected";
        return `${surgeon.first_name} ${surgeon.last_name}`.trim();
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

    const searchLabel = t("setup.selectSurgeonNew.searchPlaceholder") || "Search by name";
    const nothingFoundLabel =
        t("setup.selectSurgeonNew.noSurgeonFound") || "Surgeon not found. Add to the case anyway?";

    const continueLooksEnabled = !!selectedSurgeon;

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
                {onClose && (
                    <button className={styles.backButton} onClick={onClose}>
                        <img src={CloseWhite} alt="Close" />
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div className={styles.mainContent}>
                <div className={styles.listContainer}>
                    {/* Surgeon List */}
                    <div
                        className={`${styles.surgeonList} ${
                            showScrollbar ? styles.surgeonListWithRail : styles.surgeonListNoRail
                        }`}
                        ref={listRef}
                        style={listHeight ? { height: listHeight } : undefined}
                    >
                        {showNoResults ? (
                            <div className={styles.noResults}>
                                <div className={styles.noResultsText}>{nothingFoundLabel}</div>
                                <button
                                    className={styles.noResultsButton}
                                    onClick={handleAddCustomSurgeon}
                                    disabled={!searchTerm.trim()}
                                >
                                    <span className={styles.noResultsButtonText}>
                                        {t("setup.selectSurgeonNew.add") || "Add"}
                                    </span>
                                </button>
                            </div>
                        ) : (
                            filteredSurgeons.map((surgeon) => {
                                const isSelected = selectedSurgeon?.surgeon_id === surgeon.surgeon_id;
                                const isAlreadySelected = surgeon.isAlreadySelected;
                                return (
                                    <div
                                        key={surgeon.surgeon_id}
                                        className={`${styles.surgeonItem} ${
                                            isAlreadySelected ? styles.surgeonItemDisabled : ""
                                        }`}
                                        onClick={() => !isAlreadySelected && handleSurgeonSelect(surgeon)}
                                    >
                                        {/* Selected radio = solid lavender (no inner dot) */}
                                        <div
                                            className={`${styles.radioButton} ${
                                                isSelected
                                                    ? styles.radioButtonSelected
                                                    : isAlreadySelected
                                                      ? styles.radioButtonAlreadySelected
                                                      : ""
                                            }`}
                                        />
                                        <span
                                            className={`${styles.surgeonName} ${
                                                isAlreadySelected ? styles.surgeonNameDisabled : ""
                                            }`}
                                        >
                                            {`${surgeon.first_name} ${surgeon.last_name}`.trim()}
                                        </span>
                                        {isAlreadySelected && (
                                            <span className={styles.alreadySelectedText}>
                                                {t("setup.selectSurgeonNew.alreadySelected") ||
                                                    "This surgeon has already been selected for the current case"}
                                            </span>
                                        )}
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
                            dependency={filteredSurgeons}
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
                            {t("setup.selectSurgeonNew.selectedSurgeon") || "Selected surgeon:"}
                        </span>
                        <span
                            className={`${styles.selectedValue} ${
                                !selectedSurgeon ? styles.placeholder : styles.selectedValueActive
                            }`}
                        >
                            {getSurgeonDisplayName(selectedSurgeon)}
                        </span>
                    </div>
                    <button
                        className={`${styles.continueButton} ${continueLooksEnabled ? styles.continueButtonEnabled : ""}`}
                        onClick={handleContinue}
                        disabled={!selectedSurgeon}
                    >
                        {t("setup.selectSurgeonNew.continue") || "Continue"}
                    </button>
                </div>

                <div className={styles.keyboardArea}>
                    <VirtualKeyboard onKeyPress={onKeyClicked} />
                </div>
            </div>
        </div>
    );
};
