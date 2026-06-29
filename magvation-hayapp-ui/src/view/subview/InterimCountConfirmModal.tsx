import React from "react";
import styles from "../subviewcss/interimCountConfirmModal.module.css";
import { useTranslation } from "react-i18next";
import QuestionCircleIcon from "../../img/QuestionCircle.svg";

interface InterimCountConfirmModalProps {
    onNo: () => void;
    onYes: () => void;
}

export const InterimCountConfirmModal: React.FC<InterimCountConfirmModalProps> = ({ onNo, onYes }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="interim-count-confirm-title">
            <div className={styles.card}>
                <img src={QuestionCircleIcon} alt="" className={styles.questionIcon} />
                <span id="interim-count-confirm-title" className={styles.questionText}>
                    {t("interimCount.confirmQuestion")}
                </span>
                <div className={styles.buttonRow}>
                    <button type="button" className={styles.noButton} onClick={onNo}>
                        {t("interimCount.no")}
                    </button>
                    <button type="button" className={styles.yesButton} onClick={onYes}>
                        {t("interimCount.yes")}
                    </button>
                </div>
            </div>
        </div>
    );
};
