import styles from "../subviewcss/ErrorPopup.module.css";
import React from "react";

interface ErrorPopupProps {
    errorMessage: string;
    errorTitle: string;
    onClose: () => void;
    iconSrc?: string;
    isFatal?: boolean;
}

export const ErrorPopup: React.FC<ErrorPopupProps> = ({ errorMessage, errorTitle, onClose, iconSrc, isFatal }) => {
    return (
        <div className={styles.screenContainer} onClick={isFatal ? undefined : onClose}>
            <div className={styles.container}>
                <div className={styles.errorContainer}>
                    <div className={styles.iconCircle}>
                        {iconSrc && <img src={iconSrc} alt="Error Icon" className={styles.icon} />}
                    </div>
                    <div className={styles.textContainer}>
                        <div className={styles.errorTitle}>{errorTitle}</div>
                        <div className={styles.errorMessage}>{errorMessage}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
