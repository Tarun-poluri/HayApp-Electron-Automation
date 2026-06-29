import styles from "../viewcss/CIRAddedNeedles.module.css";
import RedCloseNoBg from "../img/RedCloseNoBg.svg";
import GreenDoneNoBg from "../img/GreenDoneNoBg.svg";
import LoadingIcon from "../img/LoadingIcon.svg";
import ScanWrapperImg from "../img/ScanWrapper.svg";
import EmptyWrapperImg from "../img/EmptyWrapper.svg";
import React, { useState, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import { SuturePackInfo } from "../services/CaseService";
import ModalHeader from "../component/ModalHeader";
import StopAdded from "../img/StopAdded.svg";
import AddSuturePack from "../img/AddSuturePack.svg";
import Bell from "../img/Bell.svg";

export const CIRAddedNeedles: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [step, setStep] = useState<"question" | "scan" | "needleInfo" | "dropZone" | "waiting" | "denied">(
        "question",
    );
    const [showRestartNotification, setShowRestartNotification] = useState(false);
    const [scannedPackInfo, setScannedPackInfo] = useState<SuturePackInfo | null>(null);
    const scrConfirmAnswer = useListenable(appContext.caseService.scrConfirmAnswer);

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirAddedNeedles");
    }, [appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    useEffect(() => {
        const handler = (info: SuturePackInfo) => {
            setScannedPackInfo(info);
            setStep("needleInfo");
        };
        const unsubscribe = appContext.caseService.parlayInterface.caseManager.suture_pack_scanned(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.caseService.parlayInterface.caseManager]);

    useEffect(() => {
        if (step === "waiting" && scrConfirmAnswer) {
            if (scrConfirmAnswer === "confirmed") {
                appContext.navigate({ path: "cirDashboard" });
                appContext.caseService.scrConfirmAnswer.set("");
            } else if (scrConfirmAnswer === "denied") {
                setStep("denied");
                appContext.caseService.scrConfirmAnswer.set("");
            }
        }
    }, [step, scrConfirmAnswer, scannedPackInfo, appContext]);

    useEffect(() => {
        if (step === "scan") {
            setShowRestartNotification(false);
            appContext.caseService.parlayInterface.hayScanner.open_data_matrix_scanner(45000, "single");
        }
    }, [step, appContext.caseService.parlayInterface.hayScanner]);

    useEffect(() => {
        if (step !== "scan") return;

        const hayScanner = appContext.caseService.parlayInterface.hayScanner;
        const unsubscribe = hayScanner.scanner_error((event) => {
            if (event.screen_type === "DataMatrix") {
                hayScanner.close_active_screen();
                setShowRestartNotification(true);
            }
        });
        return () => {
            unsubscribe();
        };
    }, [step, appContext.caseService.parlayInterface.hayScanner]);

    const handleNo = () => {
        if (step === "needleInfo") {
            setStep("scan");
            setScannedPackInfo(null);
        } else if (step === "waiting") {
            // If saying no from waiting, cancel the SCR confirmation
            appContext.caseService.scrConfirming.set(false);
            setScannedPackInfo(null);
            appContext.navigate({ path: "cirDashboard" });
        } else {
            // Clean up state when exiting from other steps
            if (step === "scan") {
                appContext.caseService.parlayInterface.hayScanner.close_active_screen();
            }
            setScannedPackInfo(null);
            appContext.navigate({ path: "cirDashboard" });
        }
    };

    const handleYes = async () => {
        if (step === "needleInfo") {
            setStep("dropZone");
        } else if (step === "dropZone") {
            // Clear any previous answer before requesting new confirmation
            appContext.caseService.scrConfirmAnswer.set("");

            // Request SCR confirmation
            if (scannedPackInfo) {
                await appContext.caseService.parlayInterface.caseManager.scr_confirm_suture_pack(scannedPackInfo);
            }
            appContext.caseService.scrConfirming.set(true);
            setStep("waiting");
        } else if (step === "denied") {
            // Start interim count - this will notify SCR to transition to interim screen
            await appContext.caseService.parlayInterface.caseManager.start_interim_count();
            appContext.navigate({ path: "cirDashboard" });
        } else {
            setStep("scan");
        }
    };

    const handleBack = () => {
        if (step === "scan") {
            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
            setStep("question");
        } else if (step === "needleInfo") {
            setStep("scan");
            setScannedPackInfo(null);
        } else if (step === "dropZone") {
            setStep("needleInfo");
        } else if (step === "waiting") {
            // If going back from waiting, cancel the SCR confirmation
            appContext.caseService.scrConfirming.set(false);
            setStep("dropZone");
        } else {
            appContext.navigate({ path: "cirDashboard" });
        }
    };

    const handleClose = () => {
        // Clean up state when closing
        if (step === "waiting") {
            appContext.caseService.scrConfirming.set(false);
        }
        if (step === "scan") {
            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
        }
        setScannedPackInfo(null);
        appContext.navigate({ path: "cirDashboard" });
    };

    const renderRestartScannerNotification = () => (
        <div className={styles.restartScannerContainer}>
            <div className={styles.restartScannerContent}>
                <div className={styles.restartScannerLeft}>
                    <div className={styles.restartScannerIconContainer}>
                        <div className={styles.redCircle}></div>
                        <div className={styles.restartScannerRing}>
                            <img src={Bell} alt="Alert" className={styles.bellIcon} />
                        </div>
                    </div>
                    <span className={styles.restartText}>{t("addedNeedles.restartNoti")}</span>
                </div>
                <button
                    className={styles.restartButton}
                    onClick={() => {
                        setShowRestartNotification(false);
                        appContext.caseService.parlayInterface.hayScanner.open_data_matrix_scanner(45000, "single");
                    }}
                >
                    <span className={styles.restartButtonText}>{t("addedNeedles.restartScanner")}</span>
                </button>
            </div>
        </div>
    );

    const renderQuestionStep = () => (
        <div className={styles.screenContainer}>
            <ModalHeader
                title={t("addedNeedles.addSutureNeedlesInstructionHeader")}
                onBack={handleBack}
                onClose={handleClose}
            />
            <div className={styles.contentContainer}>
                <div className={styles.innerContentContainer}>
                    <img src={AddSuturePack} className={styles.addImage} alt="Add Suture Pack" />
                    <span className={styles.instructionText}>{t("addedNeedles.addSutureNeedlesInstructions")}</span>
                    <button className={styles.continueButton} onClick={handleYes}>
                        <span className={styles.continueButtonText}>{t("addedNeedles.understood")}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderScanStep = () => (
        <div className={styles.screenContainer}>
            <ModalHeader title={t("addedNeedles.addSutureNeedles")} onBack={handleBack} onClose={handleClose} />
            <div className={styles.scanStepContainer}>
                <div className={styles.scanStepContentContainer}>
                    <img src={ScanWrapperImg} alt="Scan" className={styles.scanImage} />
                    <span className={styles.scanStepText}>{t("addedNeedles.scanPrompt")}</span>
                </div>
            </div>
            {showRestartNotification && renderRestartScannerNotification()}
        </div>
    );

    const renderNeedleInfoStep = () => (
        <div className={styles.screenContainer}>
            <ModalHeader title={t("addedNeedles.addSutureNeedles")} onBack={handleBack} onClose={handleClose} />
            <div className={styles.needleInfoStepContainer}>
                <div className={styles.needlePackImageConatiner}>
                    <div className={styles.needlePackBackground}>
                        {scannedPackInfo?.image && (
                            <img
                                src={`http://localhost:8080/suture_pack_images/${scannedPackInfo.image}`}
                                alt="Suture Pack"
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                        )}
                    </div>
                </div>
                <div className={styles.needleInfoContainer}>
                    <div className={styles.needleInfoContentContainer}>
                        <div className={styles.needleInfo}>
                            <div className={styles.needleInfoHeaderContainer}>
                                <span className={styles.needleAddText}>{t("addedNeedles.needleScanQuestion")}</span>
                                <span className={styles.needleInfoHeaderSmallText}>{t("addedNeedles.dontTell")}</span>
                            </div>
                            <div className={styles.infoSection}>
                                <div className={styles.infoTable}>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoRowTitle}>{t("addedNeedles.needlesPerPack")}</span>
                                        <span className={styles.infoRowValue}>
                                            {scannedPackInfo?.num_needles ?? ""}
                                        </span>
                                    </div>
                                    <div className={styles.infoTableDivider} />
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoRowTitle}>{t("addedNeedles.size")}</span>
                                        <span className={styles.infoRowValue}>
                                            {scannedPackInfo?.suture_gauge ?? ""}
                                        </span>
                                    </div>
                                    <div className={styles.infoTableDivider} />
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoRowTitle}>{t("addedNeedles.sutureType")}</span>
                                        <span className={styles.infoRowValue}>
                                            {scannedPackInfo?.manufacturer ?? ""}
                                        </span>
                                    </div>
                                    <div className={styles.infoTableDivider} />
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoRowTitle}>{t("addedNeedles.needleName")}</span>
                                        <span className={styles.infoRowValue}>
                                            {scannedPackInfo?.needle_name ?? ""}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.needleInfoButtonContainer}>
                            <button className={styles.noButton} onClick={handleNo}>
                                <span className={styles.noText}>{t("addedNeedles.no")}</span>
                                <img src={RedCloseNoBg} alt="No" className={styles.buttonIcon} />
                            </button>
                            <button className={styles.yesButton} onClick={handleYes}>
                                <span className={styles.yesText}>{t("addedNeedles.yes")}</span>
                                <img src={GreenDoneNoBg} alt="Yes" className={styles.buttonIcon} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderDropZoneStep = () => (
        <div className={styles.screenContainer}>
            <ModalHeader title={t("addedNeedles.addSutureNeedles")} onBack={handleBack} onClose={handleClose} />
            <div className={styles.scanStepContainer}>
                <div className={styles.dropZoneContentContainer}>
                    <img src={EmptyWrapperImg} alt="Scan" />
                    <div className={styles.dropZoneTextAndButton}>
                        <span className={styles.scanStepText}>{t("addedNeedles.dropZonePrompt")}</span>
                        <button className={styles.dropZoneConfirmButton} onClick={handleYes}>
                            <span className={styles.dropZoneConfirmText}>{t("addedNeedles.confirm")}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderWaitingStep = () => (
        <div className={styles.screenContainerNoHeader}>
            <div className={styles.waitingContainer}>
                <div className={styles.loadingIcon}>
                    <span className={styles.loadingIconSpinner}>
                        <img src={LoadingIcon} alt="Loading" />
                    </span>
                </div>
                <span className={styles.waitingText}>{t("addedNeedles.waiting")}</span>
            </div>
        </div>
    );

    const renderDeniedStep = () => (
        <div className={styles.screenContainer}>
            <ModalHeader title={t("addedNeedles.addSutureNeedles")} hideBack hideClose />
            <div className={styles.deniedStepContainer}>
                <div className={styles.deniedStepContentContainer}>
                    <img src={StopAdded} alt="Denied" className={styles.deniedStepImage} />
                    <div className={styles.deniedStepTextContainer}>
                        <span className={styles.deniedStepLargeText}>{t("addedNeedles.notConfirmed")}</span>
                        <span className={styles.deniedStepSmallText}>{t("addedNeedles.startInterim")}</span>
                    </div>

                    <button className={styles.dropZoneConfirmButton} onClick={handleYes}>
                        <span className={styles.dropZoneConfirmText}>{t("addedNeedles.interimButtonText")}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div>
            {step === "question" && renderQuestionStep()}
            {step === "scan" && renderScanStep()}
            {step === "needleInfo" && renderNeedleInfoStep()}
            {step === "dropZone" && renderDropZoneStep()}
            {step === "waiting" && renderWaitingStep()}
            {step === "denied" && renderDeniedStep()}
        </div>
    );
};
