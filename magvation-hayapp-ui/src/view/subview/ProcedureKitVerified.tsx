import React from "react";
import styles from "../subviewcss/procedureKitVerified.module.css";
import { useTranslation } from "react-i18next";
import RightArrowBlack from "../../img/RightArrowBlack.svg";
import iTraceSuccess from "../../img/iTraceSuccess.svg";

interface ProcedureKitVerifiedProps {
    onProceed: () => void;
    header?: React.ReactNode;
    message?: string;
}

export const ProcedureKitVerified: React.FC<ProcedureKitVerifiedProps> = ({ onProceed, header, message }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            {header}
            <div className={styles.content}>
                <div className={styles.card}>
                    <img src={iTraceSuccess} className={styles.checkIcon} alt="" />
                    <div className={styles.contentContainer}>
                        <div className={styles.message}>
                            {message ??
                                t("setup.startCount.procedureKitScanned", {
                                    defaultValue: "Procedure Kit scanned successfully.",
                                })}
                        </div>
                        <button className={styles.proceedButton} onClick={onProceed}>
                            {t("footer.proceed", { defaultValue: "Proceed" })}
                            <img src={RightArrowBlack} alt="" className={styles.arrowIcon} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
