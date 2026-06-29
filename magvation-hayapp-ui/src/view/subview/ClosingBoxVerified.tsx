import React from "react";
import styles from "../subviewcss/closingBoxVerified.module.css";
import { useTranslation } from "react-i18next";
import iTraceSuccess from "../../img/iTraceSuccess.svg";
import RightArrowBlack from "../../img/RightArrowBlack.svg";

interface ClosingBoxVerifiedProps {
    onOk: () => void;
}

export const ClosingBoxVerified: React.FC<ClosingBoxVerifiedProps> = ({ onOk }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.card}>
                    <img src={iTraceSuccess} className={styles.checkIcon} alt="" />
                    <div className={styles.contentContainer}>
                        <div className={styles.message}>
                            {t("setup.startCount.verificationCompleted", {
                                defaultValue: "iTrace mark verification completed.",
                            })}
                        </div>
                        <button className={styles.proceedButton} onClick={onOk}>
                            {t("footer.proceed", { defaultValue: "Proceed" })}
                            <img src={RightArrowBlack} alt="" className={styles.arrowIcon} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
