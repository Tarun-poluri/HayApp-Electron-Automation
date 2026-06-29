import React from "react";
import styles from "../subviewcss/setupWorkflow.module.css";
import { useTranslation } from "react-i18next";
import ScanORITraceWhiteImg from "../../img/ScanORITraceWhite.svg";
import ScanORITraceImg from "../../img/ScanORITrace.svg";
import BlackCheckImg from "../../img/BlackCheck.svg";
import BlackRightArrowImg from "../../img/BlackRightArrow.svg";
import SurgeonWhiteImg from "../../img/SurgeonWhite.svg";
import SurgeonImg from "../../img/Surgeon.svg";
import SurgeonGreyImg from "../../img/SurgeonGrey.svg";
import PrimaryCaseTypeImg from "../../img/primaryCaseType.svg";
import PrimaryCaseTypeGreyImg from "../../img/primaryCaseTypeGrey.svg";

interface SetupWorkflowProps {
    activeStep: 1 | 2 | 3;
    onStep1Action: () => void; // Scan or Rescan
    onStep2Action: () => void; // Select Surgeon
    onStep3Action: () => void; // Select Case Type
}

export const SetupWorkflow: React.FC<SetupWorkflowProps> = ({
    activeStep,
    onStep1Action,
    onStep2Action,
    onStep3Action,
}) => {
    const { t } = useTranslation();

    const isStep1Completed = activeStep > 1;
    const isStep2Completed = activeStep > 2;

    return (
        <div className={styles.container}>
            {/* Card 1: Scan OR iTrace */}
            <div
                className={`${styles.card} ${
                    activeStep === 1 ? styles.activeCard : isStep1Completed ? styles.completedCard : styles.inactiveCard
                }`}
                onClick={onStep1Action}
                style={{ cursor: "pointer" }}
            >
                <div className={styles.iconWrapper}>
                    <div
                        className={`${styles.iconCircle} ${
                            activeStep === 1
                                ? styles.activeIconCircle
                                : isStep1Completed
                                  ? styles.completedIconCircle
                                  : ""
                        }`}
                    >
                        <img
                            src={isStep1Completed ? ScanORITraceWhiteImg : ScanORITraceImg}
                            className={styles.icon}
                            alt="Scan"
                        />
                    </div>

                    {isStep1Completed && (
                        <div className={styles.checkmark}>
                            <img src={BlackCheckImg} alt="✓" style={{ width: 17.33, height: 13 }} />
                        </div>
                    )}
                </div>

                <div className={styles.title}>{t("setup.roomScan.step1")}</div>

                {activeStep === 1 ? (
                    <button
                        className={styles.scanButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onStep1Action();
                        }}
                    >
                        {t("setup.roomScan.scanButton")}{" "}
                        <img src={BlackRightArrowImg} alt="->" style={{ width: 16, height: 16 }} />
                    </button>
                ) : (
                    <div className={styles.doneText}>{t("setup.roomScan.done", { defaultValue: "Done" })}</div>
                )}
            </div>

            {/* Connector 1 */}
            <div className={styles.connector} aria-hidden="true">
                <span className={styles.connectorArrow} />
            </div>

            {/* Card 2: Select Surgeon */}
            <div
                className={`${styles.card} ${
                    activeStep === 2 ? styles.activeCard : isStep2Completed ? styles.completedCard : styles.inactiveCard
                }`}
                onClick={activeStep >= 2 ? onStep2Action : undefined}
                style={activeStep >= 2 ? { cursor: "pointer" } : undefined}
            >
                <div className={styles.iconWrapper}>
                    <div
                        className={`${styles.iconCircle} ${
                            activeStep === 2
                                ? styles.activeIconCircle
                                : isStep2Completed
                                  ? styles.completedIconCircle
                                  : ""
                        }`}
                    >
                        <img
                            src={isStep2Completed ? SurgeonWhiteImg : activeStep >= 2 ? SurgeonImg : SurgeonGreyImg}
                            className={styles.icon}
                            alt="Surgeon"
                        />
                    </div>

                    {isStep2Completed && (
                        <div className={styles.checkmark}>
                            <img src={BlackCheckImg} alt="✓" style={{ width: 17.33, height: 13 }} />
                        </div>
                    )}
                </div>

                <div className={styles.title}>{t("setup.roomScan.step2")}</div>

                {activeStep === 2 && (
                    <button
                        className={styles.scanButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onStep2Action();
                        }}
                    >
                        {t("setup.roomScan.selectButton")}{" "}
                        <img src={BlackRightArrowImg} alt="->" style={{ width: 16, height: 16 }} />
                    </button>
                )}

                {isStep2Completed && (
                    <button
                        className={styles.rescanButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onStep2Action();
                        }}
                    >
                        {t("setup.roomScan.selectAnotherButton", { defaultValue: "Change Surgeon" })}
                    </button>
                )}
            </div>

            {/* Connector 2 */}
            <div className={styles.connector} aria-hidden="true">
                <span className={styles.connectorArrow} />
            </div>

            {/* Card 3: Select Primary Case Type */}
            <div
                className={`${styles.card} ${activeStep === 3 ? styles.activeCard : styles.inactiveCard}`}
                onClick={activeStep === 3 ? onStep3Action : undefined}
                style={activeStep === 3 ? { cursor: "pointer" } : undefined}
            >
                <div className={styles.iconWrapper}>
                    <div className={`${styles.iconCircle} ${activeStep === 3 ? styles.activeIconCircle : ""}`}>
                        <img
                            src={activeStep === 3 ? PrimaryCaseTypeImg : PrimaryCaseTypeGreyImg}
                            className={styles.icon}
                            alt="Case Type"
                        />
                    </div>
                </div>

                <div className={styles.title}>{t("setup.roomScan.step3")}</div>

                {activeStep === 3 && (
                    <button
                        className={styles.scanButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onStep3Action();
                        }}
                    >
                        {t("setup.roomScan.selectButton")}{" "}
                        <img src={BlackRightArrowImg} alt="->" style={{ width: 16, height: 16 }} />
                    </button>
                )}
            </div>
        </div>
    );
};
