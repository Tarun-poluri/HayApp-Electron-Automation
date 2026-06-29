import React from "react";
import styles from "../subviewcss/procedureKitScanError.module.css";
import { useTranslation } from "react-i18next";
import ScanError from "../../img/ScanError.svg";

interface ProcedureKitScanErrorProps {
    onRescan: () => void;
    header?: React.ReactNode;
}

export const ProcedureKitScanError: React.FC<ProcedureKitScanErrorProps> = ({ onRescan, header }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            {header}
            <div className={styles.content}>
                <div className={styles.card}>
                    <img src={ScanError} alt="Scan Error" className={styles.errorImage} />
                    <div className={styles.textContainer}>
                        <div className={styles.errorTitle}>
                            {t("setup.startCount.procedureKitScanError", {
                                defaultValue: "Procedure Kit Scan Error",
                            })}
                        </div>
                        <div className={styles.errorDescription}>
                            {t("setup.startCount.procedureKitNotVerified", {
                                defaultValue: "The Procedure Kit could not be verified.",
                            })}
                        </div>
                    </div>
                    <button className={styles.rescanButton} onClick={onRescan}>
                        {t("setup.startCount.rescan", { defaultValue: "Rescan" })}
                    </button>
                </div>
            </div>
        </div>
    );
};
