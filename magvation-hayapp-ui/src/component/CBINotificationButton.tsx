import React from "react";
import styles from "./CBINotificationButton.module.css";
import { useTranslation } from "react-i18next";
import RightChevron from "../img/RightChevronBlack.svg";
import ContaminatedNeedleIcon from "../img/ContaminatedNeedle.svg";
import BrokenNeedleIcon from "../img/BrokenNeedle.svg";
import IncompatibleNeedleIcon from "../img/IncompatibleNeedle.svg";
import MisplacedNeedleIcon from "../img/MisplacedNeedle.svg";
import FoundNeedleIcon from "../img/FoundNeedle.svg";

export type CBIButtonType = "contaminated" | "broken" | "incompatible" | "misplaced" | "foundNonSterile";

interface CBINotificationButtonProps {
    type: CBIButtonType;
    onClick?: () => void;
}

const CBINotificationButton: React.FC<CBINotificationButtonProps> = ({ type, onClick }) => {
    const { t } = useTranslation();

    const getIcon = () => {
        switch (type) {
            case "contaminated":
                return ContaminatedNeedleIcon;
            case "broken":
                return BrokenNeedleIcon;
            case "incompatible":
                return IncompatibleNeedleIcon;
            case "misplaced":
                return MisplacedNeedleIcon;
            case "foundNonSterile":
                return FoundNeedleIcon;
            default:
                return ContaminatedNeedleIcon;
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case "contaminated":
                return "#1DA593"; // Green
            case "broken":
                return "#E6A62F"; // Orange-gold
            case "incompatible":
                return "#6FC7ED"; // Light blue
            case "misplaced":
                return "#FFFFFF"; // White
            case "foundNonSterile":
                return "var(--text-icon-light-violet, #A7A4CC)";
            default:
                return "#1DA593";
        }
    };

    const getNotificationText = () => {
        switch (type) {
            case "contaminated":
                return t("cirDashboard.cbiNotification");
            case "broken":
                return t("cirDashboard.brokenNotification");
            case "incompatible":
                return t("cirDashboard.incompatibleNotification");
            case "misplaced":
                return t("cirDashboard.misplacedNotification");
            case "foundNonSterile":
                return t("cirDashboard.foundNonSterileNotification");
            default:
                return t("cirDashboard.cbiNotification");
        }
    };

    const getAltText = () => {
        switch (type) {
            case "contaminated":
                return "Contaminated Needle";
            case "broken":
                return "Broken Needle";
            case "incompatible":
                return "Incompatible Needle";
            case "misplaced":
                return "Misplaced Needle";
            case "foundNonSterile":
                return "Found Needle";
            default:
                return "Needle";
        }
    };

    return (
        <div className={styles.notificationContainer} onClick={onClick} style={{ borderColor: getBorderColor() }}>
            <div className={styles.notificationSubContainer}>
                <div className={styles.iconContainer}>
                    <img src={getIcon()} alt={getAltText()} className={styles.cbiNeedleIcon} />
                </div>
                <span className={styles.notificationText}>{getNotificationText()}</span>
                <div style={{ flex: 1 }}></div>
                <img src={RightChevron} alt="Arrow" className={styles.notificationArrow} />
            </div>
        </div>
    );
};

export default CBINotificationButton;
