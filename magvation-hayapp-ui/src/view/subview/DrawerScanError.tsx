import React from "react";
import styles from "../subviewcss/drawerScanError.module.css";
import { useTranslation } from "react-i18next";
import ScanError from "../../img/ScanError.svg";

interface DrawerScanErrorProps {
    onRescan: () => void;
}

export const DrawerScanError: React.FC<DrawerScanErrorProps> = ({ onRescan }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.card}>
                    <img src={ScanError} alt="Drawer Scan Error" className={styles.errorImage} />
                    <div className={styles.textContainer}>
                        <div className={styles.errorTitle}>
                            {t("setup.startCount.drawerScanError", {
                                defaultValue: "iTrace mark Scan Error.",
                            })}
                        </div>
                        <div className={styles.errorDescription}>
                            {t("setup.startCount.closingDrawerNotVerified", {
                                defaultValue: "The Closing Drawer could not be verified.",
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
