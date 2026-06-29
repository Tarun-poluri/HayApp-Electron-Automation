/** Figma Screen 3.36 — Check Wrappers */
import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/checkWrappersScreen.module.css";
import CheckWrappers from "../../img/CheckWrappers.svg";

interface CheckWrappersScreenProps {
    overCount: number;
    onMatch: () => void;
    onIncorrect: () => void;
    onViewPacks: () => void;
}

export const CheckWrappersScreen: React.FC<CheckWrappersScreenProps> = ({
    overCount,
    onMatch,
    onIncorrect,
    onViewPacks,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.screenContainer}>
            <div className={styles.contentArea}>
                <img className={styles.wrapperImage} src={CheckWrappers} alt="Check Wrappers" />

                <div className={styles.titleRow}>
                    <span className={styles.titleText}>
                        {t("section1.checkWrappers.titlePrefix")}
                        <span className={styles.overBadge}>{overCount}</span>
                        {t("section1.checkWrappers.titleSuffix")}
                    </span>
                </div>
                <span className={styles.subtitle}>{t("section1.checkWrappers.subtitle")}</span>

                <div className={styles.buttonRow}>
                    <button className={styles.incorrectButton} onClick={onIncorrect}>
                        {t("section1.checkWrappers.incorrect")} <span className={styles.buttonIcon}>&#10005;</span>
                    </button>
                    <button className={styles.matchButton} onClick={onMatch}>
                        {t("section1.checkWrappers.match")} <span className={styles.buttonIcon}>&#10003;</span>
                    </button>
                </div>

                <button className={styles.viewPacksLink} onClick={onViewPacks}>
                    {t("section1.checkWrappers.viewPacks")}
                </button>
            </div>
        </div>
    );
};
