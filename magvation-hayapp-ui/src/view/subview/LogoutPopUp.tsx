import styles from "../subviewcss/LogoutPopup.module.css";
import React from "react";
import { useTranslation } from "react-i18next";

interface LogoutPopupProps {
    userFirstName: string;
    userLastName: string;
    role: "CIR" | "SCR";
    showTwoRolesMessage: boolean;
    showRestartCountMessage?: boolean;
    onConfirm: () => void;
    onClose: () => void;
    iconSrc?: string;
    cancelButtonText?: string;
}

export const LogoutPopup: React.FC<LogoutPopupProps> = ({
    userFirstName,
    userLastName,
    role,
    showTwoRolesMessage,
    showRestartCountMessage = false,
    onConfirm,
    onClose,
    iconSrc,
    cancelButtonText,
}) => {
    const { t } = useTranslation();
    const fullName = `${userFirstName} ${userLastName}`;

    return (
        <div
            className={styles.screenContainer}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={styles.container}>
                <div className={styles.errorContainer}>
                    <div className={styles.iconCircle}>
                        {iconSrc && <img src={iconSrc} alt="Logout Icon" className={styles.icon} />}
                    </div>
                    <div className={styles.contentContainer}>
                        <div className={styles.textContainer}>
                            <div className={styles.logoutNameContainer}>
                                <span className={styles.logoutNameText}>
                                    {t("logout.logoutUser", { user: fullName, role: role })}
                                </span>
                            </div>
                            {showRestartCountMessage ? (
                                <span className={styles.logoutText}>{t("logout.restartCount")}</span>
                            ) : showTwoRolesMessage ? (
                                <span className={styles.logoutText}>{t("logout.twoRoles", { user: fullName })}</span>
                            ) : (
                                <span className={styles.logoutText}>{t("logout.oneRole")}</span>
                            )}
                        </div>
                        <div className={styles.buttonContainer}>
                            <button className={styles.cancelButton} onClick={onClose}>
                                <span className={styles.cancelButtonText}>
                                    {cancelButtonText ?? t("logout.cancel")}
                                </span>
                            </button>
                            <button className={styles.logoutButton} onClick={onConfirm}>
                                <span className={styles.logoutButtonText}>{t("logout.logout")}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
