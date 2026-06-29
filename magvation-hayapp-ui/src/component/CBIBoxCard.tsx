import React from "react";
import styles from "../viewcss/CIRDashboard.module.css";
import RightArrow from "../img/RightArrow.svg";
import HalfIcon from "../img/HalfIcon.svg";
import { useTranslation } from "react-i18next";

interface CBIBoxCardProps {
    contaminated: number;
    incompatible: number;
    broken: number;
    onCaptureClick: () => void;
    onRemoveClick: () => void;
}

const CBIBoxCard: React.FC<CBIBoxCardProps> = ({
    contaminated,
    incompatible,
    broken,
    onCaptureClick,
    onRemoveClick,
}) => {
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

    const isEmpty = contaminated === 0 && incompatible === 0 && broken === 0;

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
            <button className={styles.captureButton} onClick={onCaptureClick}>
                <span className={styles.buttonText}>{t("cirDashboard.identifyAndRecord")}</span>
                <img src={RightArrow} alt="Right Arrow" />
            </button>
            {!isEmpty && (
                <button className={styles.removeButton} onClick={onRemoveClick}>
                    <span className={styles.removeText}>{t("cirDashboard.remove")}</span>
                </button>
            )}
        </div>
    );
};

export default CBIBoxCard;
