import React from "react";
import styles from "../subviewcss/resolvePendingItems.module.css";
import { useTranslation } from "react-i18next";
import ResolvePendingItemsImg from "../../img/ResolvePendingItems.svg";

interface ResolvePendingItemsProps {
    onResolve?: () => void;
}

export const ResolvePendingItems: React.FC<ResolvePendingItemsProps> = ({ onResolve }) => {
    const { t } = useTranslation();

    const handleResolve = () => {
        if (onResolve) onResolve();
    };

    return (
        <div className={styles.contentArea}>
            <img src={ResolvePendingItemsImg} alt="" className={styles.illustration} />
            <span className={styles.instructionText}>{t("resolvePendingItems.instructionText")}</span>
            <button className={styles.resolveButton} onClick={handleResolve}>
                <span className={styles.resolveButtonText}>{t("resolvePendingItems.resolveNow")}</span>
            </button>
        </div>
    );
};
