import React from "react";
import styles from "./SCRCBIBoxCard.module.css";
import HalfIcon from "../img/HalfIcon.svg";
import { useTranslation } from "react-i18next";

interface SCRCBIBoxCardProps {
    contaminated: number;
    incompatible: number;
    broken: number;
}

const SCRCBIBoxCard: React.FC<SCRCBIBoxCardProps> = ({ contaminated, incompatible, broken }) => {
    const { t } = useTranslation();

    // Calculate broken display value (divide by 2, show half for odd)
    const brokenDivided = broken / 2;
    const brokenDisplayNumber = Math.floor(brokenDivided);
    const showBrokenHalf = brokenDivided % 1 === 0.5;

    const getBrokenContent = () => {
        if (brokenDisplayNumber === 0 && showBrokenHalf) {
            return (
                <div className={styles.numberContainer}>
                    <div className={styles.halfIcon}>
                        <img src={HalfIcon} alt="Half Icon" />
                    </div>
                </div>
            );
        }
        if (!showBrokenHalf) {
            return (
                <span
                    className={
                        brokenDisplayNumber === 0
                            ? `${styles.cardNumberText} ${styles.zeroValue}`
                            : styles.cardNumberText
                    }
                >
                    {brokenDisplayNumber}
                </span>
            );
        }
        return (
            <div className={styles.numberContainer}>
                <span
                    className={
                        brokenDisplayNumber === 0
                            ? `${styles.cardNumberText} ${styles.zeroValue}`
                            : styles.cardNumberText
                    }
                >
                    {brokenDisplayNumber}
                </span>
                <div className={styles.verticalRectangle} />
                <div className={styles.halfIcon}>
                    <img src={HalfIcon} alt="Half Icon" />
                </div>
            </div>
        );
    };

    return (
        <div className={styles.cbiBoxContainer}>
            <div className={styles.cbiBoxInfoContainer}>
                <span className={styles.cbiBoxText}>{t("cirDashboard.cbiBox")}</span>
                <div className={styles.cbiNeedleInfoContainer}>
                    <div className={styles.cbiNeedleInfoSection}>
                        <span className={styles.cbiNeedleInfoText}>{t("cirDashboard.contaminated")}</span>
                        <span
                            className={
                                contaminated === 0
                                    ? `${styles.cardNumberText} ${styles.zeroValue}`
                                    : styles.cardNumberText
                            }
                        >
                            {contaminated}
                        </span>
                    </div>
                    <div className={styles.cbiNeedleInfoSection}>
                        <span className={styles.cbiNeedleInfoText}>{t("cirDashboard.broken")}</span>
                        {getBrokenContent()}
                    </div>
                    <div className={styles.cbiNeedleInfoSection}>
                        <span className={styles.cbiNeedleInfoText}>{t("cirDashboard.incompatible")}</span>
                        <span
                            className={
                                incompatible === 0
                                    ? `${styles.cardNumberText} ${styles.zeroValue}`
                                    : styles.cardNumberText
                            }
                        >
                            {incompatible}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SCRCBIBoxCard;
