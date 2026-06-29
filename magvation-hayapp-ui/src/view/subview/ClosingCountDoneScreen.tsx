import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/closingCountDoneScreen.module.css";
import Done2 from "../../img/Done2.svg";

interface ClosingCountDoneScreenProps {
    onOk?: () => void;
    /** Hide the OK button (read-only SCR mirror). */
    hideButtons?: boolean;
}

export const ClosingCountDoneScreen: React.FC<ClosingCountDoneScreenProps> = ({ onOk, hideButtons = false }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.screenContainer}>
            <div className={styles.content}>
                <div className={styles.card}>
                    <img src={Done2} className={styles.checkIcon} alt="" />
                    <div className={styles.message}>{t("closeCount.doneMessage")}</div>
                    {!hideButtons && (
                        <button className={styles.okButton} onClick={onOk}>
                            {t("extraNeedles.ok")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
