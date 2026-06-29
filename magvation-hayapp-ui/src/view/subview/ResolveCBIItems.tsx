import React from "react";
import styles from "../subviewcss/resolvePendingItems.module.css";
import { useTranslation } from "react-i18next";
import ResolvePendingItemsImg from "../../img/ResolvePendingItems.svg";

interface ResolveCBIItemsProps {
    onResolve?: () => void;
}

export const ResolveCBIItems: React.FC<ResolveCBIItemsProps> = ({ onResolve }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.contentArea}>
            <img src={ResolvePendingItemsImg} alt="" className={styles.illustration} />
            <span className={styles.instructionText}>
                {t("resolveCBIItems.instructionTextLine1")}
                <br />
                {t("resolveCBIItems.instructionTextLine2")}
            </span>
            <button className={styles.resolveButton} onClick={onResolve}>
                <span className={styles.resolveButtonText}>{t("resolveCBIItems.reAdjudicate")}</span>
            </button>
        </div>
    );
};
