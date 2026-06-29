import React, { useState, useMemo, useLayoutEffect, useRef } from "react";
import styles from "../subviewcss/identifyNeedlesTable.module.css";
import { useTranslation } from "react-i18next";
import { SutureSheetHeader } from "../../component/SutureSheetHeader";
import { SuturePackRow, SuturePackRowData } from "../../component/SuturePackRow";
import { EnrichedSutureSheetItem } from "../../types/SutureTypes";
import { SutureNeedleCategory } from "../../component/CategoryBadge";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { SuturePackInfo } from "../../services/CaseService";
import OpenIcon from "../../img/OpenHeaderIcon.svg";
import ClosingIcon from "../../img/ClosingHeaderIcon.svg";
import JITIcon from "../../img/JITHeaderIcon.svg";
import InfoIcon from "../../img/infoWhite.svg";

interface IdentifyNeedlesTableProps {
    category: SutureNeedleCategory;
    items: EnrichedSutureSheetItem[];
    suturePackInfoMap: Record<number, SuturePackInfo>;
    onBack: () => void;
    onConfirm: () => void;
}

export const IdentifyNeedlesTable: React.FC<IdentifyNeedlesTableProps> = ({
    category,
    items,
    suturePackInfoMap,
    onBack,
    onConfirm,
}) => {
    const { t } = useTranslation();
    const [showScrollbar, setShowScrollbar] = useState(false);

    const listRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);

    const THUMB_HEIGHT = 84;

    // Filter items for this category
    const categoryItems = useMemo(() => {
        // Only show aggregated items (cptCode === null) to avoid duplicates
        // The backend returns both original (per-CPT) and aggregated items
        return items.filter((item) => item.suture_needle_category === category && item.cptCode === null);
    }, [items, category]);

    // Calculate total packs and needles
    const totalPacks = useMemo(() => {
        return categoryItems.reduce((sum, item) => sum + item.num_packs, 0);
    }, [categoryItems]);

    const totalNeedles = useMemo(() => {
        return categoryItems.reduce((sum, item) => sum + item.needles_per_pack * item.num_packs, 0);
    }, [categoryItems]);

    // Get category icon
    const getCategoryIcon = () => {
        switch (category) {
            case "Open":
                return OpenIcon;
            case "Closing":
                return ClosingIcon;
            case "JIT":
                return JITIcon;
        }
    };

    // Get category title
    const getCategoryTitle = () => {
        switch (category) {
            case "Open":
                return t("setup.identifyNeedles.openTitle", { defaultValue: "Open Suture Needles" });
            case "Closing":
                return t("setup.identifyNeedles.closingTitle", { defaultValue: "Closing Suture Needles" });
            case "JIT":
                return t("setup.identifyNeedles.jitTitle", { defaultValue: "JIT Suture Needles" });
        }
    };

    // Get category-specific info text
    const getCategoryInfoText = () => {
        switch (category) {
            case "Open":
                return t("setup.identifyNeedles.infoOpen", {
                    defaultValue: "Place suture needle packs into Open drawer.",
                });
            case "Closing":
                return t("setup.identifyNeedles.infoClosing", {
                    defaultValue: "Place suture needle packs into the Closing drawer.",
                });
            case "JIT":
                return t("setup.identifyNeedles.infoJIT", {
                    defaultValue: "Place suture needle packs into JIT drawer.",
                });
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
    }, [categoryItems]);

    const getPacksBoxColor = (cat: SutureNeedleCategory): string => {
        switch (cat) {
            case "Open":
                return "#D2B2FF";
            case "JIT":
                return "#FFFFFF";
            case "Closing":
                return "#75CAF8";
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <SutureSheetHeader
                title={getCategoryTitle()}
                onBack={onBack}
                image={getCategoryIcon()}
                packNumber={totalPacks}
                needleNumber={totalNeedles}
                redundant={false}
            />

            {/* Main Content - Scrollable rows */}
            <div className={styles.mainContent}>
                <div className={styles.tableWrapper} ref={listRef}>
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

                            return (
                                <SuturePackRow
                                    key={item.id}
                                    data={rowData}
                                    styles={styles}
                                    packsBoxColor={getPacksBoxColor(category)}
                                />
                            );
                        })}
                    </div>
                </div>

                {showScrollbar && (
                    <CustomScrollbar
                        targetRef={listRef}
                        thumbHeight={THUMB_HEIGHT}
                        dependency={categoryItems}
                        styles={styles}
                    />
                )}
            </div>

            {/* Footer */}
            <div className={styles.footer} ref={footerRef}>
                <div className={styles.infoContainer}>
                    <img className={styles.infoIcon} src={InfoIcon} alt="Info" />
                    <span className={styles.footerText}>{getCategoryInfoText()}</span>
                </div>
                <button className={styles.confirmButton} onClick={onConfirm}>
                    {t("setup.identifyNeedles.confirm", { defaultValue: "Confirm" })}
                </button>
            </div>
        </div>
    );
};
