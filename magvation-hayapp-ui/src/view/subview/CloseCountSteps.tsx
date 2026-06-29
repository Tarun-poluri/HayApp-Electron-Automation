import React, { useContext, useEffect, useState } from "react";
import styles from "../subviewcss/closeCountSteps.module.css";
import { useTranslation } from "react-i18next";
import { CloseCountStepper } from "../../component/CloseCountStepper";
import { AppContext } from "../App";

interface CloseCountStepsProps {
    onComplete: () => void;
}

export const CloseCountSteps: React.FC<CloseCountStepsProps> = ({ onComplete }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

    // Listen for SCR deposit confirmations via backend
    useEffect(() => {
        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "scrClosingCountDepositUnused":
                    setCurrentStep(2);
                    break;
                case "scrClosingCountDepositPacked":
                    setCurrentStep(3);
                    break;
                case "scrClosingCountWaitForCir":
                    onComplete();
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [onComplete, appContext.caseService.parlayInterface.caseManager]);

    return (
        <div className={styles.contentArea}>
            <div className={styles.card}>
                <CloseCountStepper currentStep={currentStep} totalSteps={3} />
                <span className={styles.instructionText}>
                    {t("closeCountSteps.prefix")}
                    <span className={styles.highlight}>{t(`closeCountSteps.step${currentStep}Type`)}</span>
                    {t("closeCountSteps.suffix")}
                </span>
            </div>
        </div>
    );
};
