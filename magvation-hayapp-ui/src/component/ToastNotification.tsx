import React, { useEffect } from "react";
import styles from "./ToastNotification.module.css";

interface ToastNotificationProps {
    message: string;
    icon?: string;
    duration?: number;
    onDismiss: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, icon, duration = 3000, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, duration);
        return () => clearTimeout(timer);
    }, [duration, onDismiss]);

    return (
        <div className={styles.toastWrapper}>
            <div className={styles.toastContainer}>
                <div className={styles.toastSubContainer}>
                    {icon && (
                        <div className={styles.iconContainer}>
                            <img src={icon} alt="" className={styles.toastIcon} />
                        </div>
                    )}
                    <span className={styles.toastText}>{message}</span>
                </div>
            </div>
        </div>
    );
};

export default ToastNotification;
