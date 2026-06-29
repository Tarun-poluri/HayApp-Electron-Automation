import React from "react";
import styles from "./ErrorPopup.module.css";

interface ErrorPopupProps {
    message: string;
    onClose: () => void;
}

export const ErrorPopup: React.FC<ErrorPopupProps> = ({ message, onClose }) => (
    <div className={styles.overlay}>
        <div className={styles.popup}>
            <div className={styles.message}>{message}</div>
            <button className={styles.closeButton} onClick={onClose}>
                OK
            </button>
        </div>
    </div>
);
