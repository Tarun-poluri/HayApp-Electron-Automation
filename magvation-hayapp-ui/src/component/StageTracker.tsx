import React from "react";
import styles from "./StageTracker.module.css";

interface StageTrackerProps {
    stage: number;
    stageNumbers: string[];
    stageLabel: string;
    activeColor?: string;
}

const StageTracker: React.FC<StageTrackerProps> = ({ stage, stageNumbers, stageLabel, activeColor }) => (
    <div className={styles.stageTrackerContainer}>
        {stageNumbers.map((label, idx) => {
            const isCurrent = stage === idx + 1;
            return (
                <React.Fragment key={idx}>
                    <div
                        className={isCurrent ? styles.currentStage : styles.stageNumberContainer}
                        style={isCurrent && activeColor ? { background: activeColor } : undefined}
                    >
                        <div className={isCurrent ? styles.currentStageNumber : styles.stageNumber}>{label}</div>
                        {isCurrent && <div className={styles.stageText}>{stageLabel}</div>}
                    </div>
                    {idx < stageNumbers.length - 1 && <div className={styles.stageDot}></div>}
                </React.Fragment>
            );
        })}
    </div>
);

export default StageTracker;
