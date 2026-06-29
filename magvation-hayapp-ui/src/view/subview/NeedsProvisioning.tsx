import React from "react";
import styles from "../subviewcss/systemCheck.module.css";
import { useTranslation } from "react-i18next";
interface NeedsProvisioningProps {
    onTechSupportLogin: () => void;
    onAdminPanel: () => void;
    titleKey?: string;
    messageKey?: string;
}

export const NeedsProvisioning: React.FC<NeedsProvisioningProps> = ({
    onTechSupportLogin,
    titleKey = "setup.needsProvisioning",
    messageKey,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.title}>{t(titleKey) || "Device needs to be provisioned"}</div>
                {messageKey ? <div className={styles.message}>{t(messageKey)}</div> : null}

                <div className={styles.buttonContainer}>
                    <div className={styles.proceedWrap}>
                        <button className={styles.proceedButton} onClick={onTechSupportLogin}>
                            <span>{t("setup.techSupportLogin.title") || "Tech Support Login"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
