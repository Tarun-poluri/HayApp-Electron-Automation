import React from "react";
import styles from "../subviewcss/scanNotValid.module.css";
import { useTranslation } from "react-i18next";
import { BasicHeader } from "../../component/BasicHeader";
import ORScanFailed from "../../img/ORScanFailed.svg";

interface ScanNotValidProps {
    onRescan: () => void;
    onBack: () => void;
}

export const ScanNotValid: React.FC<ScanNotValidProps> = ({ onRescan, onBack }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <BasicHeader title={t("setup.scanORiTrace.headerTitle")} onBack={onBack} />
            <img src={ORScanFailed} className={styles.icon} alt="Scan not valid" />
            <div className={styles.message}>{t("setup.scanORiTrace.errorMessage")}</div>
            <button className={styles.rescanButton} onClick={onRescan}>
                {t("setup.scanORiTrace.rescanButton")}
            </button>
        </div>
    );
};
