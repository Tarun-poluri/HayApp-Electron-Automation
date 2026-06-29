import React from "react";
import styles from "../subviewcss/closeCountConfirm.module.css";
import { useTranslation } from "react-i18next";
import QuestionMessageIcon from "../../img/QuestionMessage.svg";
import RedCloseNoBg from "../../img/RedCloseNoBg.svg";
import GreenCheck from "../../img/GreenCheck.svg";

interface CloseCountConfirmProps {
    onNo: () => void;
    onYes: () => void;
}

export const CloseCountConfirm: React.FC<CloseCountConfirmProps> = ({ onNo, onYes }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.contentArea}>
            <div className={styles.card}>
                <img src={QuestionMessageIcon} alt="" className={styles.questionIcon} />
                <span className={styles.questionText}>{t("closeCount.confirmQuestion")}</span>
                <div className={styles.buttonRow}>
                    <button className={styles.noButton} onClick={onNo}>
                        <span className={styles.noButtonText}>{t("closeCount.no")}</span>
                        <img src={RedCloseNoBg} alt="" className={styles.buttonIcon} />
                    </button>
                    <button className={styles.yesButton} onClick={onYes}>
                        <span className={styles.yesButtonText}>{t("closeCount.yes")}</span>
                        <img src={GreenCheck} alt="" className={styles.buttonIcon} />
                    </button>
                </div>
            </div>
        </div>
    );
};
