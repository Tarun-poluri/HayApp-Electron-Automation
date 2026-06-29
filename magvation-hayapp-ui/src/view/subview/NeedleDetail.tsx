import React from "react";
import styles from "../subviewcss/needleDetail.module.css";
import { useTranslation } from "react-i18next";
import { BasicHeader } from "../../component/BasicHeader";
import { CategoryBadge } from "../../component/CategoryBadge";
import { RedundantPackCounter } from "../../component/RedundantPackCounter";
import { RedundantNeedleItem } from "../../types/SutureTypes";
import { NeedleDetailSpecifications } from "../../types/NeedleDetailTypes";
import { formatNeedleUse } from "../../util/setupHelpers";

export type NeedleDetailSource = "summarySheet" | "reviewRedundantNeedles";

interface NeedleDetailProps {
    item: RedundantNeedleItem;
    specifications: NeedleDetailSpecifications;
    source: NeedleDetailSource;
    onBack: () => void;
    onUpdateRedundantPack: (id: string, newValue: number) => void;
}

const SpecRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className={styles.specRow}>
        <span className={styles.specLabel}>{label}</span>
        <span className={styles.specValue}>{value}</span>
    </div>
);

export const NeedleDetail: React.FC<NeedleDetailProps> = ({
    item,
    specifications,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    source,
    onBack,
    onUpdateRedundantPack,
}) => {
    const { t } = useTranslation();

    const totalNeedles = item.needlesPerPack * item.packsToOpen;
    const totalSuturePacks = item.packsToOpen - item.potentialRedundantPack;
    const finalTotalNeedles = totalSuturePacks * item.needlesPerPack;

    return (
        <div className={styles.container}>
            <BasicHeader
                title={t("setup.needleDetail.title", { defaultValue: "Suture Needle Pack Details" })}
                onBack={onBack}
                titleClassName={styles.headerTitle}
                leftClassName={styles.headerLeft}
            />

            <div className={styles.mainContent}>
                <div className={styles.topSection}>
                    <table className={styles.table}>
                        <thead>
                            <tr className={styles.headerRow}>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.nomenclature", { defaultValue: "Nomenclature" })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.needlesPerPack", {
                                        defaultValue: "Suture Needles\nper Pack",
                                    })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.packsToOpen", { defaultValue: "Packs\nto Open" })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.totalNeedles", { defaultValue: "Total Suture\nNeedles" })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.sutureNeedleUse", { defaultValue: "Suture Needle Use" })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.category", { defaultValue: "Suture Needle\nCategory" })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.redundantPack", {
                                        defaultValue: "Potential\nRedundant Pack",
                                    })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.totalPacks", { defaultValue: "Total Suture\nNeedle Packs" })}
                                </th>
                                <th className={styles.headerCell}>
                                    {t("setup.needleDetail.finalTotalNeedles", {
                                        defaultValue: "Total Suture\nNeedles",
                                    })}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className={`${styles.dataRow} ${styles.singleRow}`}>
                                <td className={`${styles.cell} ${styles.nomenclatureCell}`}>
                                    <div className={styles.nomenclatureName}>{item.nomenclature}</div>
                                    <div className={styles.nomenclatureSubLabel}>{item.subLabel}</div>
                                </td>
                                <td className={`${styles.cell} ${styles.numericCell}`}>{item.needlesPerPack}</td>
                                <td className={`${styles.cell} ${styles.numericCell}`}>{item.packsToOpen}</td>
                                <td className={`${styles.cell} ${styles.numericCell}`}>{totalNeedles}</td>
                                <td className={styles.cell}>
                                    <div className={styles.sutureUseText}>{formatNeedleUse(item.sutureNeedleUse)}</div>
                                </td>
                                <td className={styles.cell}>
                                    <CategoryBadge category={item.sutureNeedleCategory} />
                                </td>
                                <td className={styles.cell}>
                                    <RedundantPackCounter
                                        value={item.potentialRedundantPack}
                                        min={0}
                                        max={item.packsToOpen}
                                        onChange={(newValue) => onUpdateRedundantPack(item.id, newValue)}
                                    />
                                </td>
                                <td className={`${styles.cell} ${styles.boldCell}`}>{totalSuturePacks}</td>
                                <td className={`${styles.cell} ${styles.boldCell}`}>{finalTotalNeedles}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className={styles.bottomSection}>
                    <div className={styles.imageCard}>
                        <div className={styles.imageBackground}>
                            <img
                                src={`http://localhost:8080/suture_pack_images/${specifications.image}`}
                                alt={t("setup.needleDetail.packImageAlt", { defaultValue: "Needle pack example" })}
                                className={styles.packImage}
                            />
                        </div>
                    </div>

                    <div className={styles.specsCard}>
                        <div className={styles.specsColumns}>
                            <div className={styles.specsColumn}>
                                <SpecRow
                                    label={t("setup.needleDetail.type", { defaultValue: "Type" })}
                                    value={specifications.suture.type}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.gauge", { defaultValue: "Gauge" })}
                                    value={specifications.suture.gauge}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.length", { defaultValue: "Length" })}
                                    value={specifications.suture.length}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.color", { defaultValue: "Color" })}
                                    value={specifications.suture.color}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.style", { defaultValue: "Style" })}
                                    value={specifications.suture.style}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.parLevel", { defaultValue: "Par level" })}
                                    value={specifications.suture.parLevel}
                                />
                            </div>
                            <div className={styles.specsColumn}>
                                <SpecRow
                                    label={t("setup.needleDetail.needleType", { defaultValue: "Type" })}
                                    value={specifications.needle.type}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.size", { defaultValue: "Size" })}
                                    value={specifications.needle.size}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.arc", { defaultValue: "ARC" })}
                                    value={specifications.needle.arc}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.tip", { defaultValue: "TIP" })}
                                    value={specifications.needle.tip}
                                />
                                <SpecRow
                                    label={t("setup.needleDetail.manufacturer", { defaultValue: "Manufacturer" })}
                                    value={specifications.needle.manufacturer}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
