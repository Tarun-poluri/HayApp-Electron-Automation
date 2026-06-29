import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./BasicHeader.module.css";
import BackArrow from "../img/BackArrow.svg";
import HelpIcon from "../img/HelpIcon.svg";

interface BasicHeaderProps {
    title: string;
    onBack?: () => void;
    titleClassName?: string;
    leftClassName?: string;
    showHelp?: boolean;
    onHelp?: () => void;
    children?: React.ReactNode;
}

export const BasicHeader: React.FC<BasicHeaderProps> = ({
    title,
    onBack,
    titleClassName,
    leftClassName,
    showHelp,
    onHelp,
    children,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.header}>
            <div className={styles.leftSection}>
                {onBack && (
                    <button className={styles.backButton} onClick={onBack}>
                        <img src={BackArrow} alt="Back" />
                    </button>
                )}
                <div className={`${styles.left} ${leftClassName || ""}`}>
                    <div className={`${styles.title} ${titleClassName || ""}`}>{title}</div>
                    {children}
                </div>
            </div>
            {showHelp && (
                <div className={styles.helpSection}>
                    <div className={styles.verticalBar} />
                    <div
                        className={styles.helpButton}
                        onClick={onHelp}
                        role={onHelp ? "button" : undefined}
                        style={onHelp ? { cursor: "pointer" } : undefined}
                    >
                        <img src={HelpIcon} alt="Help" className={styles.helpIcon} />
                        <span className={styles.helpText}>{t("sidebar.help")}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
