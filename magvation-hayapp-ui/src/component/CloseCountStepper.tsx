import React from "react";
import styles from "./CloseCountStepper.module.css";
import WhiteCheck from "../img/WhiteCheck.svg";

interface CloseCountStepperProps {
    currentStep: number;
    totalSteps: number;
}

export const CloseCountStepper: React.FC<CloseCountStepperProps> = ({ currentStep, totalSteps }) => {
    const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

    const getStepState = (step: number): "completed" | "active" | "inactive" => {
        if (step < currentStep) return "completed";
        if (step === currentStep) return "active";
        return "inactive";
    };

    return (
        <div className={styles.stepperContainer}>
            {steps.map((step, index) => (
                <React.Fragment key={step}>
                    <div className={styles[`step_${getStepState(step)}`]}>
                        {getStepState(step) === "active" && (
                            <>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <div key={i} className={styles.dot} style={{ "--i": i } as React.CSSProperties} />
                                ))}
                                <span className={styles.stepNumber}>{step}</span>
                            </>
                        )}
                        {getStepState(step) === "completed" && (
                            <img src={WhiteCheck} alt="" className={styles.checkIcon} />
                        )}
                    </div>
                    {index < totalSteps - 1 && (
                        <div className={step < currentStep ? styles.lineCompleted : styles.lineInactive} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};
