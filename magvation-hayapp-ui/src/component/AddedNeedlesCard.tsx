import React from "react";
import styles from "../viewcss/CIRDashboard.module.css";
import RightArrow from "../img/RightArrow.svg";
import { useTranslation } from "react-i18next";

interface AddedNeedlesCardProps {
    addedNeedles: number;
    onAdd: () => void;
}

const AddedNeedlesCard: React.FC<AddedNeedlesCardProps> = ({ addedNeedles, onAdd }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.addedContainer}>
            <div className={styles.addedInfo}>
                <span className={styles.cardContentTitle}>{t("cirDashboard.sutureNeedlesAddedDuringSurgery")}</span>
                <span
                    className={
                        addedNeedles === 0 ? `${styles.cardNumberText} ${styles.zeroValue}` : styles.cardNumberText
                    }
                >
                    {addedNeedles}
                </span>
            </div>
            <div className={styles.addButtonContainer}>
                <button className={styles.addButton} onClick={onAdd}>
                    <span className={styles.buttonText}>{t("cirDashboard.addSutureNeedles")}</span>
                    <img src={RightArrow} alt="Right Arrow" />
                </button>
            </div>
        </div>
    );
};

export default AddedNeedlesCard;
