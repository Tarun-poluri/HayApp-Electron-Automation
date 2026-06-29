import React from "react";
import styles from "../subviewcss/abortedCase.module.css";
import { DynamicButton } from "../../component/PillButton";
import { useTranslation } from "react-i18next";
import AbortedCaseImg from "../../img/AbortedCase.svg";
import AbortedCaseShadowImg from "../../img/AbortedCaseShadow.svg";

interface AbortedCaseProps {
    onStartCase: () => void;
    onAdminPanel: () => void;
}

export const AbortedCase: React.FC<AbortedCaseProps> = ({ onStartCase, onAdminPanel }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.iconWrapper}>
                    <img src={AbortedCaseImg} className={styles.icon} alt="Case Aborted" />
                    <img src={AbortedCaseShadowImg} className={styles.iconShadow} alt="" />
                </div>

                <div className={styles.title}>
                    {t("setup.abortedCase.message", {
                        defaultValue: "The case was aborted. Click the button below to start a new case.",
                    })}
                </div>

                <div className={styles.buttonContainer}>
                    <button className={styles.startCaseButton} onClick={onStartCase}>
                        {t("setup.abortedCase.startCase", { defaultValue: "Start Case" })}
                    </button>
                </div>
            </div>

            <div className={styles.footer}>
                <DynamicButton
                    label={t("setup.abortedCase.returnToAdmin", { defaultValue: "Return to Admin Panel" })}
                    onClick={onAdminPanel}
                    bgColor="rgba(150, 150, 160, 0.45)"
                    textColor="#FFFFFF"
                    borderRadius="999px"
                    padding="12px 38px"
                    fontSize="2.04vh"
                    fontWeight="500"
                    className={styles.adminButton}
                    borderWidth="0"
                />
            </div>
        </div>
    );
};
