import React from "react";
import styles from "../subviewcss/systemCheck.module.css";
import { DynamicButton } from "../../component/PillButton";
import { useTranslation } from "react-i18next";
import packageJson from "../../../package.json";
import systemsCheckImg from "../../img/systemsCheck.svg";
import systemsCheckShadowImg from "../../img/systemsCheckShadow.svg";
import blackRightArrowImg from "../../img/BlackRightArrow.svg";

interface SystemCheckProps {
    onProceed: () => void;
    onAdminPanel: () => void;
    onSkipToStage2?: () => void;
}

export const SystemCheck: React.FC<SystemCheckProps> = ({ onProceed, onAdminPanel, onSkipToStage2 }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.iconWrapper}>
                    <img src={systemsCheckImg} className={styles.icon} alt="System Check" />
                    <img src={systemsCheckShadowImg} className={styles.iconShadow} alt="" />
                </div>

                <div className={styles.title}>
                    {t("setup.systemCheckSuccess") || "Systems check completed successfully"}
                </div>

                <div className={styles.buttonContainer}>
                    <div className={styles.proceedWrap}>
                        <button className={styles.proceedButton} onClick={onProceed}>
                            <span>{t("setup.proceedToSetup") || "Proceed to Setup"}</span>
                            <img src={blackRightArrowImg} className={styles.proceedArrow} alt="" />
                        </button>
                    </div>
                    {onSkipToStage2 && (
                        <div className={styles.skipButtonWrap}>
                            <button className={styles.skipButton} onClick={onSkipToStage2}>
                                <span>Skip to Stage 2</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.footer}>
                <DynamicButton
                    label={t("setup.returnToAdmin") || "Return to Admin Panel"}
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
                <div className={styles.version}>v{packageJson.version}</div>
            </div>
        </div>
    );
};
