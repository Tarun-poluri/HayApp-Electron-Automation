/** Figma Screen 3.35 (Section 1) / 3.46 (Section 2) — Check CBI Box */
import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/checkCBIBoxScreen.module.css";
import CheckCBIBox from "../../img/CheckCBIBox.svg";

interface CheckCBIBoxScreenProps {
    overCount: number;
    contaminatedCount: number;
    brokenCount: number;
    incompatibleCount: number;
    variant?: "section1" | "section2" | "interimSection2" | "interimSection3";
    onCorrect: () => void;
    onMismatch: () => void;
}

export const CheckCBIBoxScreen: React.FC<CheckCBIBoxScreenProps> = ({
    overCount,
    contaminatedCount,
    brokenCount,
    incompatibleCount,
    variant = "section1",
    onCorrect,
    onMismatch,
}) => {
    const { t } = useTranslation();
    const keyPrefix =
        variant === "section1"
            ? "section1.checkCBI"
            : variant === "interimSection2"
              ? "interimCount.section2.checkCBI"
              : variant === "interimSection3"
                ? "interimCount.section3.checkCBI"
                : "section2.checkCBI";

    return (
        <div className={styles.screenContainer}>
            <div className={styles.contentArea}>
                <div className={styles.imageWrapper}>
                    <img className={styles.cbiBoxImage} src={CheckCBIBox} alt="CBI Box" />
                    <span className={`${styles.badgeNumber} ${styles.badgeContaminated}`}>{contaminatedCount}</span>
                    <span className={`${styles.badgeNumber} ${styles.badgeBroken}`}>{brokenCount}</span>
                    <span className={`${styles.badgeNumber} ${styles.badgeIncompatible}`}>{incompatibleCount}</span>
                </div>

                <div className={styles.titleRow}>
                    <span className={styles.titleText}>
                        {variant === "section2" ? (
                            <>
                                {overCount}
                                {t(
                                    overCount === 1
                                        ? `${keyPrefix}.titleSuffixSingular`
                                        : `${keyPrefix}.titleSuffixPlural`,
                                )}
                                <span className={styles.remainingBadge}>{t(`${keyPrefix}.badge`)}</span>
                            </>
                        ) : (
                            <>
                                {t(`${keyPrefix}.titlePrefix`)}
                                <span className={styles.overBadge}>{overCount}</span>
                                {t(`${keyPrefix}.titleSuffix`)}
                            </>
                        )}
                    </span>
                </div>
                <span className={styles.subtitle}>{t(`${keyPrefix}.subtitle`)}</span>

                <div className={styles.buttonRow}>
                    <button className={styles.mismatchButton} onClick={onMismatch}>
                        {t(`${keyPrefix}.mismatch`)}
                    </button>
                    <button className={styles.correctButton} onClick={onCorrect}>
                        {t(`${keyPrefix}.correct`)}
                    </button>
                </div>
            </div>
        </div>
    );
};
