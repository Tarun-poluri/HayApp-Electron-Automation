import React, { ReactNode } from "react";
import styles from "./confirmationPopup.module.css";
import WarningIcon from "../img/Warning.svg";

interface ConfirmationPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: string;
    confirmText?: string;
    cancelText?: string;
    icon?: string;
    badgeContent?: ReactNode;
    primaryText?: string;
    secondaryText?: string;
    showBadge?: boolean;
}

export const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({
    isOpen,
    onClose,
    onConfirm,
    message,
    confirmText = "Yes",
    cancelText = "No, Go Back",
    icon = WarningIcon,
    badgeContent,
    primaryText,
    secondaryText,
    showBadge = false,
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modal}>
                <div className={styles.modalContent}>
                    <div className={styles.modalIcon}>
                        <img src={icon} alt="Warning" className={styles.modalIconImage} />
                    </div>

                    {showBadge && (badgeContent || primaryText) && (
                        <div className={styles.modalBadge}>
                            {badgeContent ? (
                                badgeContent
                            ) : (
                                <>
                                    {primaryText && <span className={styles.badgePrimaryText}>{primaryText}</span>}
                                    {secondaryText && (
                                        <span className={styles.badgeSecondaryText}>{secondaryText}</span>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className={styles.modalText}>{message}</div>
                </div>

                <div className={styles.modalButtons}>
                    <button className={styles.modalCancelButton} onClick={onClose}>
                        {cancelText}
                    </button>
                    <button className={styles.modalConfirmButton} onClick={handleConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
