import React from "react";
import styles from "./SCRAddedNeedlesCard.module.css";
import { useTranslation } from "react-i18next";

interface SCRAddedNeedlesCardProps {
    addedNeedles: number;
}

const SCRAddedNeedlesCard: React.FC<SCRAddedNeedlesCardProps> = ({ addedNeedles }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.addedContainer}>
            <div className={styles.addedInfo}>
                <span className={styles.addedTitle}>{t("cirDashboard.sutureNeedlesAddedDuringSurgery")}</span>
                <span
                    className={
                        addedNeedles === 0 ? `${styles.addedNumberText} ${styles.zeroValue}` : styles.addedNumberText
                    }
                >
                    {addedNeedles}
                </span>
            </div>
        </div>
    );
};

export default SCRAddedNeedlesCard;
