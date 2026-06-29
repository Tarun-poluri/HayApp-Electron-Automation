import React, { useState, useMemo, useLayoutEffect, useRef, useEffect } from "react";
import styles from "../subviewcss/summarySheet.module.css";
import { useTranslation } from "react-i18next";
import BackArrow from "../../img/BackArrow.svg";
import ChevronDownIcon from "../../img/downChevron.svg";
import WhiteCheckIcon from "../../img/WhiteCheck.svg";
import WarningTriangleIcon from "../../img/WarningTriangle.svg";
import InfoIcon from "../../img/infoWhite.svg";
import { SuturePackRow, SuturePackRowData } from "../../component/SuturePackRow";
import { EnrichedSutureSheetItem } from "../../types/SutureTypes";
import { SutureNeedleCategory } from "../../component/CategoryBadge";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { CaseTypeSummaryInfo } from "../Setup";
import OpenCategoryLabel from "../../img/OpenCategoryLabel.svg";
import CloseCategoryLabel from "../../img/CloseCategoryLabel.svg";
import JITCategoryLabel from "../../img/JITCategoryLabel.svg";
import { SuturePackInfo } from "src/services/CaseService";
import RightArrow from "../../img/RightArrowBlack.svg";

interface SummarySheetProps {
    items: EnrichedSutureSheetItem[];
    totalCount?: number;
    caseTypeSummaries?: CaseTypeSummaryInfo[];
    suturePackInfoMap: Record<number, SuturePackInfo>;
    onBack: () => void;
    onConfirm: () => void;
    onMoreInfo?: (item: EnrichedSutureSheetItem) => void;
    openCompleted?: boolean;
    jitCompleted?: boolean;
    closingCompleted?: boolean;
    onSetAsideOpen?: () => void;
    onSetAsideJit?: () => void;
    onSetAsideClosing?: () => void;
    headerComponent?: React.ReactNode; // If provided, replaces the default dropdown header
    hideFooter?: boolean;
    onCaseTypeWithoutSheetSelected?: (cptCode: string, caseTypeName: string) => void; // Called when user selects a case type with no suture sheet
    instructionText?: string;
}

const CATEGORY_OPEN: SutureNeedleCategory = "Open";
const CATEGORY_CLOSING: SutureNeedleCategory = "Closing";
const CATEGORY_JIT: SutureNeedleCategory = "JIT";

export const SummarySheet: React.FC<SummarySheetProps> = ({
    items,
    totalCount,
    caseTypeSummaries,
    suturePackInfoMap,
    onBack,
    onConfirm,
    openCompleted = false,
    jitCompleted = false,
    closingCompleted = false,
    onSetAsideOpen,
    onSetAsideJit,
    onSetAsideClosing,
    headerComponent,
    hideFooter = false,
    onCaseTypeWithoutSheetSelected,
    instructionText,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SutureNeedleCategory>(CATEGORY_OPEN);
    const [listHeight, setListHeight] = useState<number | null>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedCptCode, setSelectedCptCode] = useState<string | null>(null); // null = "Summary Sheet" (show all)

    const listRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const chevronRef = useRef<HTMLImageElement>(null);
    const openSectionRef = useRef<HTMLDivElement>(null);
    const closingSectionRef = useRef<HTMLDivElement>(null);
    const jitSectionRef = useRef<HTMLDivElement>(null);
    const isProgrammaticScrollRef = useRef(false);
    const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const THUMB_HEIGHT = 84;

    // Filter items based on selected case type (null = show all)
    const filteredItems = useMemo(() => {
        if (selectedCptCode === null) {
            // Combined "Summary Sheet" view: Show only aggregated items (where cptCode is null/undefined)
            // Use loose equality to catch both null and undefined
            return items.filter((item) => item.cptCode == null);
        }
        // Individual case type view: Show only original items for that specific CPT code
        // Exclude aggregated items (cptCode=null) and JIT items
        return items.filter((item) => item.cptCode === selectedCptCode && item.suture_needle_category !== CATEGORY_JIT);
    }, [items, selectedCptCode]);

    // Group filtered items by category
    const openItems = useMemo(
        () => filteredItems.filter((i) => i.suture_needle_category === CATEGORY_OPEN),
        [filteredItems],
    );
    const closingItems = useMemo(
        () => filteredItems.filter((i) => i.suture_needle_category === CATEGORY_CLOSING),
        [filteredItems],
    );
    const jitItems = useMemo(
        () => filteredItems.filter((i) => i.suture_needle_category === CATEGORY_JIT),
        [filteredItems],
    );

    // Calculate total needle count for combined "Summary Sheet" (only aggregated items where cptCode=null)
    const allItemsTotalCount = useMemo(() => {
        return items
            .filter((item) => item.cptCode == null)
            .reduce((sum, item) => sum + item.needles_per_pack * item.num_packs, 0);
    }, [items]);

    // Calculate total pack count for combined "Summary Sheet"
    const allItemsTotalPacks = useMemo(() => {
        return items.filter((item) => item.cptCode == null).reduce((sum, item) => sum + item.num_packs, 0);
    }, [items]);

    // Calculate total needle count for filtered items
    const filteredTotalCount = useMemo(() => {
        return filteredItems.reduce((sum, item) => sum + item.needles_per_pack * item.num_packs, 0);
    }, [filteredItems]);

    // Calculate total pack count for filtered items
    const filteredTotalPacks = useMemo(() => {
        return filteredItems.reduce((sum, item) => sum + item.num_packs, 0);
    }, [filteredItems]);

    // Display counts
    const itemCount = totalCount ?? filteredTotalCount;
    const packCount = filteredTotalPacks;

    // Calculate needle counts per case type from original items (not aggregated)
    const caseTypeNeedleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (caseTypeSummaries) {
            for (const caseType of caseTypeSummaries) {
                // Only count original items for this CPT code (not aggregated items where cptCode=null)
                const caseItems = items.filter((item) => item.cptCode === caseType.cptCode);
                counts[caseType.cptCode] = caseItems.reduce(
                    (sum, item) => sum + item.needles_per_pack * item.num_packs,
                    0,
                );
            }
        }
        return counts;
    }, [items, caseTypeSummaries]);

    // Calculate pack counts per case type from original items (not aggregated)
    const caseTypePackCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (caseTypeSummaries) {
            for (const caseType of caseTypeSummaries) {
                // Only count original items for this CPT code (not aggregated items where cptCode=null)
                const caseItems = items.filter((item) => item.cptCode === caseType.cptCode);
                counts[caseType.cptCode] = caseItems.reduce((sum, item) => sum + item.num_packs, 0);
            }
        }
        return counts;
    }, [items, caseTypeSummaries]);

    // Header title: show "Summary Sheet" when All is selected, otherwise show the selected case type name
    const headerTitle = useMemo(() => {
        if (selectedCptCode === null) {
            return t("setup.summarySheet.title", { defaultValue: "Summary Sheet" });
        }
        const selectedCaseType = caseTypeSummaries?.find((ct) => ct.cptCode === selectedCptCode);
        return selectedCaseType?.name ?? t("setup.summarySheet.title", { defaultValue: "Summary Sheet" });
    }, [selectedCptCode, caseTypeSummaries, t]);

    const computeListHeight = () => {
        const listEl = listRef.current;
        const footer = footerRef.current;

        if (!listEl) {
            setListHeight(null);
            return;
        }

        if (!footer) {
            // No footer - use remaining space to bottom of container
            const listRect = listEl.getBoundingClientRect();
            const available = window.innerHeight - listRect.top - 20;
            setListHeight(Math.max(120, Math.floor(available)));
            return;
        }

        const listRect = listEl.getBoundingClientRect();
        const footerRect = footer.getBoundingClientRect();
        const available = footerRect.top - listRect.top - 20;
        setListHeight(Math.max(120, Math.floor(available)));
    };

    useLayoutEffect(() => {
        computeListHeight();
        const onResize = () => computeListHeight();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useLayoutEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const update = () => setShowScrollbar(el.scrollHeight > el.clientHeight + 1);
        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [filteredItems, listHeight]);

    // Scroll-based active tab sync
    useEffect(() => {
        const listEl = listRef.current;
        if (!listEl) return;

        const handleScroll = () => {
            if (isProgrammaticScrollRef.current) return;
            const scrollTop = listEl.scrollTop;
            const offset = 50;

            const sections: Array<{ ref: React.RefObject<HTMLDivElement | null>; category: SutureNeedleCategory }> = [
                { ref: openSectionRef, category: CATEGORY_OPEN },
                { ref: jitSectionRef, category: CATEGORY_JIT },
                { ref: closingSectionRef, category: CATEGORY_CLOSING },
            ];

            let current: SutureNeedleCategory = CATEGORY_OPEN;
            for (const { ref, category } of sections) {
                if (ref.current && ref.current.offsetTop <= scrollTop + offset) {
                    current = category;
                }
            }
            setActiveTab(current);
        };

        listEl.addEventListener("scroll", handleScroll, { passive: true });
        return () => listEl.removeEventListener("scroll", handleScroll);
    }, [selectedCptCode]);

    // Click-outside handler to close dropdown
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

    const DROPDOWN_OFFSET_VH = 5.28;
    const railInlineStyle = listHeight
        ? { height: isDropdownOpen ? `calc(${listHeight}px - ${DROPDOWN_OFFSET_VH}vh)` : listHeight }
        : undefined;

    const tabs: SutureNeedleCategory[] =
        selectedCptCode === null
            ? [CATEGORY_OPEN, CATEGORY_JIT, CATEGORY_CLOSING] // Show all tabs for combined view (new order)
            : [CATEGORY_OPEN, CATEGORY_JIT, CATEGORY_CLOSING]; // Show all tabs for individual views (new order)

    const handleTabClick = (tab: SutureNeedleCategory) => {
        setActiveTab(tab);

        const sectionRef =
            tab === CATEGORY_OPEN ? openSectionRef : tab === CATEGORY_CLOSING ? closingSectionRef : jitSectionRef;

        if (sectionRef.current && listRef.current) {
            isProgrammaticScrollRef.current = true;
            if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);

            const sectionTop = sectionRef.current.offsetTop;
            listRef.current.scrollTo({
                top: sectionTop,
                behavior: "smooth",
            });

            programmaticScrollTimerRef.current = setTimeout(() => {
                isProgrammaticScrollRef.current = false;
            }, 600);
        }
    };

    const getCategoryLabel = (cat: SutureNeedleCategory) => {
        switch (cat) {
            case "Open":
                return t("components.categoryBadge.open", { defaultValue: "Open" });
            case "Closing":
                return t("components.categoryBadge.closing", { defaultValue: "Closing" });
            case "JIT":
                return t("components.categoryBadge.jit", { defaultValue: "JIT" });
        }
    };

    const renderCategorySection = (
        category: SutureNeedleCategory,
        categoryItems: EnrichedSutureSheetItem[],
        sectionRef?: React.RefObject<HTMLDivElement | null>,
    ) => {
        const getCategoryLabelSvg = (cat: SutureNeedleCategory) => {
            switch (cat) {
                case "Open":
                    return OpenCategoryLabel;
                case "Closing":
                    return CloseCategoryLabel;
                case "JIT":
                    return JITCategoryLabel;
            }
        };

        const getBannerClassName = (cat: SutureNeedleCategory) => {
            switch (cat) {
                case "Open":
                    return `${styles.categoryBanner} ${styles.categoryBannerOpen}`;
                case "Closing":
                    return `${styles.categoryBanner} ${styles.categoryBannerClose}`;
                case "JIT":
                    return `${styles.categoryBanner} ${styles.categoryBannerJit}`;
            }
        };

        // Calculate total packs and needles for this category
        const totalPacks = categoryItems.reduce((sum, item) => sum + item.num_packs, 0);
        const totalNeedles = categoryItems.reduce((sum, item) => sum + item.needles_per_pack * item.num_packs, 0);

        return (
            <div className={styles.categorySection} key={category} ref={sectionRef}>
                {/* Category Banner */}
                <div className={getBannerClassName(category)}>
                    <div className={styles.bannerInfo}>
                        <span className={styles.bannerInfoText}>
                            {totalPacks + " "}
                            {totalPacks === 1
                                ? t("setup.summarySheet.pack", { defaultValue: "Pack" })
                                : t("setup.summarySheet.packs", { defaultValue: "Packs" })}
                        </span>
                        <span className={styles.bannerInfoDivider}>|</span>
                        <span className={styles.bannerInfoText}>
                            {totalNeedles + " "}
                            {t("setup.summarySheet.sutureNeedle", { defaultValue: "Suture Needles" })}
                        </span>
                    </div>
                    <img src={getCategoryLabelSvg(category)} className={styles.bannerCategoryLabel} />
                </div>

                {/* Rows - only show if there are items */}
                {categoryItems.length > 0 && (
                    <div className={styles.categoryRows}>
                        {categoryItems.map((item) => {
                            // Look up full pack info from suturePackInfoMap
                            const packInfo = suturePackInfoMap[item.fda_gudid];

                            // Create data object for SuturePackRow
                            const rowData: SuturePackRowData = {
                                fda_gudid: item.fda_gudid,
                                nomenclature: item.nomenclature,
                                product_code: item.product_code,
                                suture_needle_use: item.suture_needle_use,
                                needles_per_pack: item.needles_per_pack,
                                num_packs: item.num_packs,
                                image: packInfo?.image,
                                suture_length: packInfo?.suture_length,
                                suture_color: packInfo?.suture_color,
                                suture_style: packInfo?.suture_style,
                                needle_size: packInfo?.needle_size,
                                needle_arc: packInfo?.needle_arc,
                                needle_tip: packInfo?.needle_tip,
                                num_sutures: packInfo?.num_sutures,
                            };

                            return <SuturePackRow key={item.id} data={rowData} styles={styles} />;
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            {headerComponent ? (
                <>
                    {headerComponent}
                    <div style={{ height: "154px", flexShrink: 0 }} />
                </>
            ) : (
                <div className={styles.header}>
                    <button className={styles.backButton} onClick={onBack}>
                        <img src={BackArrow} alt={t("common.back", { defaultValue: "Back" })} />
                    </button>

                    <div className={`${styles.headerContent} ${isDropdownOpen ? styles.headerContentOpen : ""}`}>
                        <div className={styles.headerLeft}>
                            <span className={styles.headerLabel}>
                                {t("setup.summarySheet.caseTypeLabel", {
                                    defaultValue: "Case type to view details",
                                })}
                            </span>
                            <div className={styles.headerTitleRow}>
                                <span className={styles.headerTitle}>{headerTitle}</span>
                                <div className={styles.itemCountChip}>
                                    <div className={styles.itemCount}>
                                        <span className={styles.itemCountText}>
                                            {packCount}{" "}
                                            {packCount === 1
                                                ? t("setup.summarySheet.pack", { defaultValue: "Pack" })
                                                : t("setup.summarySheet.packs", { defaultValue: "Packs" })}
                                            {" | "}
                                            {itemCount}{" "}
                                            {t("setup.summarySheet.sutureNeedle", { defaultValue: "Suture Needles" })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.headerRight}>
                            <img
                                ref={chevronRef}
                                src={isDropdownOpen ? WhiteCheckIcon : ChevronDownIcon}
                                alt={t("common.expand", { defaultValue: "Expand" })}
                                className={styles.chevronIcon}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            />
                        </div>

                        {/* Dropdown */}
                        {isDropdownOpen && caseTypeSummaries && caseTypeSummaries.length > 0 && (
                            <div className={styles.dropdown} ref={dropdownRef}>
                                {/* "Summary Sheet" option - shows all case types combined */}
                                <div
                                    className={`${styles.dropdownItem} ${selectedCptCode === null ? styles.dropdownItemSelected : ""}`}
                                    onClick={() => {
                                        setSelectedCptCode(null);
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    <div className={styles.dropdownItemLeft}>
                                        <span className={styles.dropdownCount}>
                                            {allItemsTotalPacks}{" "}
                                            {allItemsTotalPacks === 1
                                                ? t("setup.reviewRedundantNeedles.pack", { defaultValue: "Pack" })
                                                : t("setup.reviewRedundantNeedles.packs", { defaultValue: "Packs" })}
                                            {" | "}
                                            {allItemsTotalCount}{" "}
                                            {t("setup.reviewRedundantNeedles.sutureNeedles", {
                                                defaultValue: "Suture Needles",
                                            })}
                                        </span>
                                        <div className={styles.dropdownCaseInfo}>
                                            <span className={styles.dropdownCaseName}>
                                                {t("setup.summarySheet.title", { defaultValue: "Summary Sheet" })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Individual case type options */}
                                {caseTypeSummaries.map((caseType, index) => {
                                    const caseTypeCount = caseTypeNeedleCounts[caseType.cptCode] || 0;
                                    const caseTypePacks = caseTypePackCounts[caseType.cptCode] || 0;
                                    return (
                                        <div
                                            key={index}
                                            className={`${styles.dropdownItem} ${selectedCptCode === caseType.cptCode ? styles.dropdownItemSelected : ""}`}
                                            onClick={() => {
                                                // If case type has no suture sheet, trigger the callback instead
                                                if (!caseType.hasSutureSheet && onCaseTypeWithoutSheetSelected) {
                                                    onCaseTypeWithoutSheetSelected(caseType.cptCode, caseType.name);
                                                    setIsDropdownOpen(false);
                                                } else {
                                                    setSelectedCptCode(caseType.cptCode);
                                                    setIsDropdownOpen(false);
                                                }
                                            }}
                                        >
                                            <div className={styles.dropdownItemLeft}>
                                                <span className={styles.dropdownCount}>
                                                    {caseTypePacks}{" "}
                                                    {caseTypePacks === 1
                                                        ? t("setup.reviewRedundantNeedles.pack", {
                                                              defaultValue: "Pack",
                                                          })
                                                        : t("setup.reviewRedundantNeedles.packs", {
                                                              defaultValue: "Packs",
                                                          })}
                                                    {" | "}
                                                    {caseTypeCount}{" "}
                                                    {t("setup.reviewRedundantNeedles.sutureNeedles", {
                                                        defaultValue: "Suture Needles",
                                                    })}
                                                </span>
                                                <div className={styles.dropdownCaseInfo}>
                                                    <span className={styles.dropdownCaseName}>{caseType.name}</span>
                                                    <span className={styles.dropdownCptCode}>{caseType.cptCode}</span>
                                                </div>
                                            </div>
                                            {!caseType.hasSutureSheet && (
                                                <div className={styles.dropdownNoSheetBadge}>
                                                    <img
                                                        src={WarningTriangleIcon}
                                                        alt=""
                                                        className={styles.dropdownWarningIcon}
                                                    />
                                                    <span>
                                                        {t("setup.summarySheet.noSutureSheet", {
                                                            defaultValue: "No Suture Sheet",
                                                        })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab Bar */}
            <div className={styles.tabBar}>
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        className={activeTab === tab ? styles.activeTab : styles.tab}
                        onClick={() => handleTabClick(tab)}
                    >
                        {getCategoryLabel(tab)}
                    </button>
                ))}
            </div>

            {/* Main Content - Scrollable sections */}
            <div className={styles.mainContent}>
                <div className={styles.tableWrapper} ref={listRef}>
                    {/* Open Section */}
                    {renderCategorySection(CATEGORY_OPEN, openItems, openSectionRef)}

                    {/* JIT Section - only show in combined view */}
                    {selectedCptCode === null && renderCategorySection(CATEGORY_JIT, jitItems, jitSectionRef)}

                    {/* Close Section */}
                    {renderCategorySection(CATEGORY_CLOSING, closingItems, closingSectionRef)}
                </div>

                {showScrollbar && (
                    <div
                        className={`${styles.scrollbarWrapper} ${isDropdownOpen ? styles.scrollbarWrapperDropdownOpen : ""}`}
                    >
                        <CustomScrollbar
                            targetRef={listRef}
                            thumbHeight={THUMB_HEIGHT}
                            dependency={filteredItems}
                            styles={styles}
                            containerStyle={railInlineStyle}
                        />
                    </div>
                )}
            </div>

            {/* Footer */}
            {!hideFooter && (
                <div className={styles.footer} ref={footerRef}>
                    <div className={styles.footerLeft}>
                        <img
                            src={InfoIcon}
                            alt={t("common.info", { defaultValue: "Info" })}
                            className={styles.infoIcon}
                        />
                        <span className={styles.instructionText}>
                            {instructionText ??
                                t("setup.summarySheet.instruction", {
                                    defaultValue:
                                        "Place packs into Open, JIT, and Closing boxes according to the procedure plan.",
                                })}
                        </span>
                    </div>
                    <button
                        className={styles.confirmButton}
                        onClick={() => {
                            if (!openCompleted && onSetAsideOpen) {
                                onSetAsideOpen();
                            } else if (openCompleted && !jitCompleted && onSetAsideJit) {
                                onSetAsideJit();
                            } else if (openCompleted && jitCompleted && !closingCompleted && onSetAsideClosing) {
                                onSetAsideClosing();
                            } else if (openCompleted && jitCompleted && closingCompleted) {
                                onConfirm();
                            }
                        }}
                    >
                        {t("setup.summarySheet.proceed", { defaultValue: "Proceed" })}
                        <img src={RightArrow} alt="" className={styles.confirmArrowIcon} />
                    </button>
                </div>
            )}
        </div>
    );
};
