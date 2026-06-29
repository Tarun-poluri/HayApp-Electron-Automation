/** Figma Screen 3.37 — List of Added Needle Packs */
import React, { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/addedPacksListScreen.module.css";
import { AppContext } from "../App";
import { SuturePackInfo } from "../../services/CaseService";
import { BasicHeader } from "../../component/BasicHeader";

interface AddedPacksListScreenProps {
    onBack: () => void;
}

export const AddedPacksListScreen: React.FC<AddedPacksListScreenProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [packs, setPacks] = useState<SuturePackInfo[]>([]);

    useEffect(() => {
        appContext.caseService
            .getAddedNeedles()
            .then((result) => {
                setPacks(result);
            })
            .catch(() => {});
    }, [appContext.caseService]);

    const totalNeedles = packs.reduce((sum, p) => sum + p.num_sutures * p.num_needles, 0);

    return (
        <div className={styles.screenContainer}>
            <BasicHeader title={t("section1.addedPacks.title")} onBack={onBack} />
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr className={styles.headerRow}>
                            <th className={styles.headerCell}>{t("section1.addedPacks.nomenclature")}</th>
                            <th className={styles.headerCell}>{t("section1.addedPacks.packsOpened")}</th>
                            <th className={styles.headerCell}>{t("section1.addedPacks.suturesPerPack")}</th>
                            <th className={styles.headerCell}>{t("section1.addedPacks.sutureUse")}</th>
                            <th className={styles.headerCell}>{t("section1.addedPacks.addedCount")}</th>
                            <th className={styles.headerCell}>{t("section1.addedPacks.addedDuringCase")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {packs.map((pack, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === packs.length - 1;
                            const isOdd = idx % 2 === 0;

                            let rowClass = styles.dataRow;
                            if (isOdd) rowClass += ` ${styles.oddRow}`;
                            else rowClass += ` ${styles.evenRow}`;
                            if (isFirst) rowClass += ` ${styles.firstRow}`;
                            if (isLast) rowClass += ` ${styles.lastRow}`;

                            const addedCount = pack.num_sutures * pack.num_needles;

                            return (
                                <tr key={idx} className={rowClass}>
                                    <td className={`${styles.cell} ${styles.nomenclatureCell}`}>
                                        <div className={styles.nomenclatureName}>{pack.needle_name}</div>
                                        <div className={styles.nomenclatureSubLabel}>{pack.product_code}</div>
                                    </td>
                                    <td className={`${styles.cell} ${styles.numericCell}`}>{pack.num_sutures}</td>
                                    <td className={`${styles.cell} ${styles.numericCell}`}>{pack.num_needles}</td>
                                    <td className={styles.cell}>{pack.suture_needle_use?.join(", ") || "-"}</td>
                                    <td className={`${styles.cell} ${styles.boldCell}`}>{addedCount}</td>
                                    <td className={styles.cell}>Yes</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className={styles.footer}>
                <span className={styles.footerLabel}>{t("section1.addedPacks.total")}</span>
                <span className={styles.footerBadge}>{totalNeedles}</span>
            </div>
        </div>
    );
};
