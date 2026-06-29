import React from "react";
import { useTranslation } from "react-i18next";
import { getTipTypeIcon } from "../util/needleTipUtils";
import { formatNeedleUse } from "../util/setupHelpers";

export interface SuturePackRowData {
    fda_gudid: number;
    nomenclature: string;
    product_code: string;
    suture_needle_use: string[];
    needles_per_pack: number;
    num_packs: number;
    image?: string;
    // From SuturePackInfo
    suture_length?: string;
    suture_color?: string;
    suture_style?: string;
    needle_size?: string;
    needle_arc?: string;
    needle_tip?: string;
    num_sutures?: number;
}

interface SuturePackRowProps {
    data: SuturePackRowData;
    styles: Record<string, string>;
    packsBoxColor?: string;
}

/**
 * Reusable SuturePackRow component for displaying suture pack information
 * Used in SummarySheet, IdentifyNeedlesTable, ReviewRedundantNeedles, and ScannedPacksList
 */
export const SuturePackRow: React.FC<SuturePackRowProps> = ({ data, styles, packsBoxColor }) => {
    const { t } = useTranslation();

    const numSutures = data.num_sutures || 1;
    const needlesPerSuture = Math.round(data.needles_per_pack / numSutures);
    const totalNeedles = data.needles_per_pack * data.num_packs;

    const sutureNeedleUses = data.suture_needle_use;

    return (
        <div className={styles.rowContentContainer}>
            <div className={styles.rowImageContainer}>
                {data.image && (
                    <img
                        src={`http://localhost:8080/suture_pack_images/${data.image}`}
                        alt={data.nomenclature}
                        className={styles.rowImage}
                    />
                )}
            </div>
            <div className={styles.rowTableContainer}>
                <div className={styles.rowTableTopContainer}>
                    <div className={styles.rowTableTitleContainer}>
                        <div className={styles.rowTableTitleContent}>
                            <span className={styles.rowTableTitleText}>{data.nomenclature}</span>
                            <div className={styles.rowTableCode}>
                                <span className={styles.rowTableCodeText}>{data.product_code}</span>
                            </div>
                        </div>
                        {/* Render a use container for each intended use */}
                        {sutureNeedleUses.map((use, index) => (
                            <div key={index} className={styles.rowTableUseContainer}>
                                <span className={styles.rowTableUseTitleText}>
                                    {t("setup.reviewRedundantNeedles.intendedUse", {
                                        defaultValue: "Intended Use:",
                                    })}
                                </span>
                                <div className={styles.rowTableUse}>
                                    <span className={styles.rowTableUseText}>{formatNeedleUse(use)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={styles.rowTableBottomContainer}>
                    <div className={styles.rowSutureInfoTableContainer}>
                        <span className={styles.rowSutureInfoTitleText}>
                            {t("setup.reviewRedundantNeedles.sutureInformation", {
                                defaultValue: "Suture Information",
                            })}
                        </span>
                        <div className={styles.rowTableSutureInfoTable}>
                            <div className={styles.sutureInfoTableCell}>
                                <span className={styles.cellHeaderText}>{data.suture_length || "N/A"}</span>
                                <span className={styles.cellTitleText}>
                                    {t("setup.reviewRedundantNeedles.length", {
                                        defaultValue: "Length",
                                    })}
                                </span>
                            </div>
                            <div className={styles.sutureInfoTableCell}>
                                <span className={styles.cellHeaderText}>{data.suture_color || "N/A"}</span>
                                <span className={styles.cellTitleText}>
                                    {t("setup.reviewRedundantNeedles.color", {
                                        defaultValue: "Color",
                                    })}
                                </span>
                            </div>
                            <div className={styles.sutureInfoTableCell}>
                                <span className={styles.cellHeaderText}>{data.suture_style || "N/A"}</span>
                                <span className={styles.cellTitleText}>
                                    {t("setup.reviewRedundantNeedles.style", {
                                        defaultValue: "Style",
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.needleInfoTable}>
                        <div className={styles.needleInfoTopTable}>
                            <div
                                className={packsBoxColor ? styles.needleInfoPacksCell : styles.needleInfoTopCell}
                                style={packsBoxColor ? { background: packsBoxColor } : undefined}
                            >
                                <span
                                    className={
                                        packsBoxColor ? styles.needleInfoPacksNumber : styles.needleInfoTopNumber
                                    }
                                >
                                    {data.num_packs}
                                </span>
                                <span className={packsBoxColor ? styles.needleInfoPacksText : styles.needleInfoTopText}>
                                    {t("setup.reviewRedundantNeedles.packs", {
                                        defaultValue: "Packs",
                                    })}
                                </span>
                            </div>
                            <div className={styles.needleInfoTopCell}>
                                <span className={styles.needleInfoTopNumber}>{numSutures}</span>
                                <span className={styles.needleInfoTopText}>
                                    {t("setup.reviewRedundantNeedles.suturesPerPack", {
                                        defaultValue: "Sutures per Pack",
                                    })}
                                </span>
                            </div>
                            <div className={styles.needleInfoTopCell}>
                                <span className={styles.needleInfoTopNumber}>{needlesPerSuture}</span>
                                <span className={styles.needleInfoTopText}>
                                    {t("setup.reviewRedundantNeedles.needlesPerSuture", {
                                        defaultValue: "Needles per Suture",
                                    })}
                                </span>
                            </div>
                            <div className={styles.needleInfoTopCell}>
                                <span className={styles.needleInfoTopNumber}>{totalNeedles}</span>
                                <span className={styles.needleInfoTopText}>
                                    {t("setup.reviewRedundantNeedles.totalNeedles", {
                                        defaultValue: "Total Needles",
                                    })}
                                </span>
                            </div>
                        </div>
                        <div className={styles.needleInfoBottomTable}>
                            <span className={styles.needleInfoBottomTitle}>
                                {t("setup.reviewRedundantNeedles.needleInformation", {
                                    defaultValue: "Needle Information",
                                })}
                            </span>
                            <div className={styles.needleInfoBottomTableContent}>
                                <div className={styles.needleInfoBottomCell}>
                                    <span className={styles.cellHeaderText}>{data.needle_size || "N/A"}</span>
                                    <span className={styles.cellTitleText}>
                                        {t("setup.reviewRedundantNeedles.size", {
                                            defaultValue: "Size",
                                        })}
                                    </span>
                                </div>
                                <div className={styles.needleInfoBottomCell}>
                                    <span className={styles.cellHeaderText}>{data.needle_arc || "N/A"}</span>
                                    <span className={styles.cellTitleText}>
                                        {t("setup.reviewRedundantNeedles.arc", {
                                            defaultValue: "Arc",
                                        })}
                                    </span>
                                </div>
                                <div className={styles.needleInfoBottomCell}>
                                    <div className={styles.tipTypeContainer}>
                                        <img
                                            className={styles.tipTypeIcon}
                                            src={getTipTypeIcon(data.needle_tip)}
                                            alt="Tip Type"
                                        />
                                        <span className={styles.cellHeaderText}>{data.needle_tip || "N/A"}</span>
                                    </div>
                                    <span className={styles.cellTitleText}>
                                        {t("setup.reviewRedundantNeedles.tipType", {
                                            defaultValue: "Tip Type",
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
