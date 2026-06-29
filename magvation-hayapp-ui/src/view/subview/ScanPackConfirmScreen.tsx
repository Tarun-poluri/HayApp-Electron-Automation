/** Figma Screen 3.39 — Scanned Pack Confirmation */
import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/scanPackConfirmScreen.module.css";
import { SuturePackInfo } from "../../services/CaseService";

interface ScanPackConfirmScreenProps {
    scannedPackInfo: SuturePackInfo;
    onYes: () => void;
    onNo: () => void;
}

export const ScanPackConfirmScreen: React.FC<ScanPackConfirmScreenProps> = ({ scannedPackInfo, onYes, onNo }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.panelRow}>
            <div className={styles.imagePanel}>
                <div className={styles.imageBackground}>
                    <img
                        className={styles.packImage}
                        src={`http://localhost:8080/suture_pack_images/${scannedPackInfo.image}`}
                        alt={t("section1.addPack.packImageAlt")}
                    />
                </div>
            </div>

            <div className={styles.detailsPanel}>
                <span className={styles.titleText}>{t("section1.addPack.packQuestion")}</span>

                <div className={styles.detailRows}>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{t("addedNeedles.needlesPerPack")}</span>
                        <span className={styles.detailValue}>{scannedPackInfo.num_needles}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{t("addedNeedles.size")}</span>
                        <span className={styles.detailValue}>{scannedPackInfo.needle_size}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{t("addedNeedles.sutureType")}</span>
                        <span className={styles.detailValue}>{scannedPackInfo.suture_type}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>{t("addedNeedles.needleName")}</span>
                        <span className={styles.detailValue}>{scannedPackInfo.needle_name}</span>
                    </div>
                </div>

                <div className={styles.buttonRow}>
                    <button className={styles.noButton} onClick={onNo}>
                        {t("section1.addPack.no")} <span className={styles.buttonIcon}>&#10005;</span>
                    </button>
                    <button className={styles.yesButton} onClick={onYes}>
                        {t("section1.addPack.yes")} <span className={styles.buttonIcon}>&#10003;</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
