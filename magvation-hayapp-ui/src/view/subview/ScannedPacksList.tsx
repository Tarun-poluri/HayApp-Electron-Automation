import styles from "../subviewcss/ScannedPacksList.module.css";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SutureSheetHeader } from "../../component/SutureSheetHeader";
import TrashIcon from "../../img/TrashIcon.svg";
import { CaseSuture, SuturePackInfo } from "../../services/CaseService";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { SuturePackRow, SuturePackRowData } from "../../component/SuturePackRow";
import { SutureNeedleCategory } from "../../component/CategoryBadge";
import OpenRowLabel from "../../img/OpenRowLabel.svg";
import CloseRowLabel from "../../img/CloseRowLabel.svg";
import JITRowLabel from "../../img/JITRowLabel.svg";
import ScannedPackSubtract from "../../img/ScannedPackSubtract.svg";
import WarningIcon from "../../img/WarningWhite.svg";

interface ScannedPacksListProps {
    caseSutures: CaseSuture[];
    suturePackInfoMap: Record<number, SuturePackInfo>;
    onRemovePack: (item: CaseSuture) => void;
    onComplete: () => void;
    onBack?: () => void;
    showNewProcedureBanner?: boolean;
    packsBeforeNewProcedure?: number;
}

export const ScannedPacksList: React.FC<ScannedPacksListProps> = ({
    caseSutures,
    suturePackInfoMap,
    onRemovePack,
    onComplete,
    onBack,
    showNewProcedureBanner = false,
    packsBeforeNewProcedure = 0,
}) => {
    const { t } = useTranslation();
    const scrollContentRef = useRef<HTMLDivElement>(null);
    const [needsScrollbar, setNeedsScrollbar] = useState(false);

    // Filter to show only newly scanned packs if in new procedure mode
    const displayedPacks = showNewProcedureBanner
        ? caseSutures.slice(0, caseSutures.length - packsBeforeNewProcedure)
        : caseSutures;

    // Check if scrollbar is needed
    const checkScrollbar = useCallback(() => {
        const el = scrollContentRef.current;
        if (el) {
            setNeedsScrollbar(el.scrollHeight > el.clientHeight);
        }
    }, []);

    useEffect(() => {
        checkScrollbar();
        window.addEventListener("resize", checkScrollbar);
        return () => window.removeEventListener("resize", checkScrollbar);
    }, [checkScrollbar, displayedPacks]);

    // Calculate totals based on ALL packs (not just displayed ones)
    const totalPacks = caseSutures.reduce((sum, caseSuture) => sum + caseSuture.num_packs, 0);

    const totalNeedles = caseSutures.reduce(
        (sum, caseSuture) => sum + caseSuture.needles_per_pack * caseSuture.num_packs,
        0,
    );

    const getCategoryRowLabel = (category: SutureNeedleCategory) => {
        switch (category) {
            case "Open":
                return OpenRowLabel;
            case "Closing":
                return CloseRowLabel;
            case "JIT":
                return JITRowLabel;
            default:
                return OpenRowLabel;
        }
    };

    const getPacksBoxColor = (cat: SutureNeedleCategory): string => {
        switch (cat) {
            case "Open":
                return "#D2B2FF";
            case "JIT":
                return "#FFFFFF";
            case "Closing":
                return "#75CAF8";
            default:
                return "#D2B2FF";
        }
    };

    const newProcedureBanner = () => (
        <div className={styles.newProcedureContainer}>
            <div className={styles.newProcedureTextContainer}>
                <div className={styles.newProcedureTitleContainer}>
                    <img src={WarningIcon} className={styles.warningIcon} alt="Warning" />
                    <span className={styles.newProcedureTitle}>
                        {t("scannedList.newProcedureTitle", { defaultValue: "New procedure added" })}
                    </span>
                </div>
                <span className={styles.newProcedureMessage}>
                    {t("scannedList.newProcedureMessage", { defaultValue: "Scan new needles" })}
                </span>
            </div>
        </div>
    );

    return (
        <div className={styles.screenContainer}>
            <SutureSheetHeader
                title={t("scannedList.title")}
                onBack={onBack}
                packNumber={totalPacks}
                needleNumber={totalNeedles}
                redundant={false}
            />
            <div className={styles.listContainer}>
                <div className={styles.mainArea}>
                    <div className={styles.leftArea}>
                        <div className={styles.scrollContent} ref={scrollContentRef}>
                            {showNewProcedureBanner && newProcedureBanner()}
                            <div className={styles.categoryRows}>
                                {displayedPacks.map((caseSuture) => {
                                    const packInfo = suturePackInfoMap[caseSuture.fda_guid];

                                    // Create data object for SuturePackRow
                                    const rowData: SuturePackRowData = {
                                        fda_gudid: caseSuture.fda_guid,
                                        nomenclature: caseSuture.nomenclature,
                                        product_code: caseSuture.product_code,
                                        suture_needle_use: caseSuture.suture_needle_use,
                                        needles_per_pack: caseSuture.needles_per_pack,
                                        num_packs: caseSuture.num_packs,
                                        image: packInfo?.image,
                                        suture_length: packInfo?.suture_length,
                                        suture_color: packInfo?.suture_color,
                                        suture_style: packInfo?.suture_style,
                                        needle_size: packInfo?.needle_size,
                                        needle_arc: packInfo?.needle_arc,
                                        needle_tip: packInfo?.needle_tip,
                                        num_sutures: packInfo?.num_sutures,
                                    };

                                    const category = caseSuture.suture_needle_category as SutureNeedleCategory;

                                    return (
                                        <div key={caseSuture.fda_guid} className={styles.rowWrapper}>
                                            <div className={styles.rowLabelContainer}>
                                                <div className={styles.rowLabelContent}>
                                                    <img
                                                        src={getCategoryRowLabel(category)}
                                                        alt="Row Label"
                                                        className={styles.rowLabel}
                                                    />
                                                </div>
                                            </div>
                                            <SuturePackRow
                                                data={rowData}
                                                styles={styles}
                                                packsBoxColor={getPacksBoxColor(category)}
                                            />
                                            <div
                                                className={styles.packDeleteContainer}
                                                onClick={() => onRemovePack(caseSuture)}
                                            >
                                                <img
                                                    src={ScannedPackSubtract}
                                                    alt="Subtract Pack"
                                                    className={styles.subtract}
                                                />
                                                <div className={styles.trashContainer}>
                                                    <img
                                                        src={TrashIcon}
                                                        alt="Trash Icon"
                                                        className={styles.trashIcon}
                                                    />
                                                    <span className={styles.removeText}>
                                                        {t("scannedList.remove", { defaultValue: "Remove" })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    {needsScrollbar && (
                        <aside className={styles.scrollbarArea}>
                            <CustomScrollbar
                                targetRef={scrollContentRef}
                                thumbHeight={100}
                                dependency={caseSutures}
                                styles={styles}
                            />
                        </aside>
                    )}
                </div>
            </div>
            <div className={styles.footerContainer}>
                <div className={styles.footerContentContainer}>
                    <button className={styles.footerButton} onClick={onComplete}>
                        <span className={styles.buttonText}>{t("scannedList.confirm")}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
