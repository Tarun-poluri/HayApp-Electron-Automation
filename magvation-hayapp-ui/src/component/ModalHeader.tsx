import React from "react";
import styles from "./ModalHeader.module.css";
import { useTranslation } from "react-i18next";
import BackArrow from "../img/BackArrow.svg";
import HelpIcon from "../img/HelpIcon.svg";
import WhiteClose from "../img/WhiteClose.svg";

export interface ModalHeaderProps {
    /** Title text to display */
    title: string;
    /** Callback when back button is clicked */
    onBack?: () => void;
    /** Callback when close button is clicked */
    onClose?: () => void;
    /** Whether to hide the back button */
    hideBack?: boolean;
    /** Whether to hide the close button */
    hideClose?: boolean;
    /** Whether to show the help section */
    showHelp?: boolean;
    /** Custom help text (defaults to translation key "addedNeedles.help") */
    helpText?: string;
    /** Callback when help is clicked */
    onHelp?: () => void;
    /** Custom class name for the header container */
    className?: string;
    /** Custom back button icon */
    backIcon?: string;
    /** Custom close button icon */
    closeIcon?: string;
    /** Custom help icon */
    helpIcon?: string;
    /** Children to render between title and help section */
    children?: React.ReactNode;
    /** Whether to hide the vertical divider after help text */
    hideHelpDivider?: boolean;
    /** Whether to show left padding */
    showLeftPadding?: boolean;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({
    title,
    onBack,
    onClose,
    hideBack = false,
    hideClose = false,
    showHelp = true,
    helpText,
    onHelp,
    className,
    backIcon = BackArrow,
    closeIcon = WhiteClose,
    helpIcon = HelpIcon,
    children,
    hideHelpDivider = false,
    showLeftPadding = false,
}) => {
    const { t } = useTranslation();
    const displayHelpText = helpText ?? t("addedNeedles.help");

    return (
        <header
            className={`${styles.headerContainer} ${showLeftPadding ? styles.headerContainerWithLeftPadding : ""} ${className ?? ""}`}
        >
            <div className={styles.leftSection}>
                {!hideBack && (
                    <button className={styles.roundButton} onClick={onBack} aria-label="Back">
                        <img src={backIcon} alt="Back" className={styles.backArrow} />
                    </button>
                )}
                <div className={styles.headerTextContainer}>
                    <h1 className={styles.headerText}>{title}</h1>
                </div>
                {children}
            </div>
            <div className={styles.rightSection}>
                {showHelp && (
                    <div className={styles.helpContainer}>
                        <div
                            className={styles.helpContentContainer}
                            onClick={onHelp}
                            role={onHelp ? "button" : undefined}
                            style={onHelp ? { cursor: "pointer" } : undefined}
                        >
                            <div className={styles.helpTextContainer}>
                                <div className={styles.helpIcon}>
                                    <img src={helpIcon} alt="Help" />
                                </div>
                                <span className={styles.helpText}>{displayHelpText}</span>
                            </div>
                            {!hideHelpDivider && <div className={styles.verticalBar} />}
                        </div>
                    </div>
                )}
                {!hideClose && (
                    <button className={styles.roundButton} onClick={onClose} aria-label="Close">
                        <img src={closeIcon} alt="Close" />
                    </button>
                )}
            </div>
        </header>
    );
};

export default ModalHeader;
