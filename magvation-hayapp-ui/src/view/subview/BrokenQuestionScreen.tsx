import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/brokenQuestionScreen.module.css";
import QuestionMessage from "../../img/QuestionMessage.svg";

interface BrokenQuestionScreenProps {
    onYes: () => void;
    onNo: () => void;
}

export const BrokenQuestionScreen: React.FC<BrokenQuestionScreenProps> = ({ onYes, onNo }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.screenContainer}>
            <div className={styles.content}>
                <div className={styles.card}>
                    <img src={QuestionMessage} className={styles.icon} alt="" />
                    <div className={styles.question}>{t("cbi.broken.question")}</div>
                    <div className={styles.buttonRow}>
                        <button className={styles.noButton} onClick={onNo}>
                            {t("cbi.broken.no")} <span className={styles.buttonIcon}>&#10005;</span>
                        </button>
                        <button className={styles.yesButton} onClick={onYes}>
                            {t("cbi.broken.yes")} <span className={styles.buttonIcon}>&#10003;</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
