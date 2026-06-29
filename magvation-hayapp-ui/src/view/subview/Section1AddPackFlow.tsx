/** Figma Screens 3.38–3.41 — DMC Scan / Add Pack Sub-Flow */
import React, { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/section1AddPackFlow.module.css";
import { BasicHeader } from "../../component/BasicHeader";
import { AppContext } from "../App";
import { useListenable } from "../../util/Listenable";
import { SuturePackInfo } from "../../services/CaseService";
import { ScanPackConfirmScreen } from "./ScanPackConfirmScreen";
import ScanNeedlePack from "../../img/ScanNeedlePack.svg";
import SCRDidNotConfirm from "../../img/SCRDidNotConfirm.svg";

type FlowStep = "scan" | "packDetails" | "waitSCR" | "rejected";

interface Section1AddPackFlowProps {
    onComplete: () => void;
    onRejectionConfirm: () => void;
    onViewPacks: () => void;
    onBack: () => void;
}

export const Section1AddPackFlow: React.FC<Section1AddPackFlowProps> = ({
    onComplete,
    onRejectionConfirm,
    onViewPacks,
    onBack,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const scrConfirmAnswer = useListenable(appContext.caseService.scrConfirmAnswer);
    const isConnected = useListenable(appContext.parlayWrapper.isConnected);
    const [step, setStep] = useState<FlowStep>("scan");
    const [scannedPackInfo, setScannedPackInfo] = useState<SuturePackInfo | null>(null);

    // Listen for DMC scan results
    useEffect(() => {
        const handler = (info: SuturePackInfo) => {
            setScannedPackInfo(info);
            setStep("packDetails");
        };
        const unsubscribe = appContext.caseService.parlayInterface.caseManager.suture_pack_scanned(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.caseService.parlayInterface.caseManager]);

    // Open scanner when entering scan step (only after Parlay is connected)
    useEffect(() => {
        if (step === "scan" && isConnected) {
            appContext.caseService.parlayInterface.hayScanner.open_data_matrix_scanner(0, "single");
            return () => {
                appContext.caseService.parlayInterface.hayScanner.close_active_screen();
            };
        }
    }, [step, isConnected, appContext.caseService.parlayInterface.hayScanner]);

    // TODO: Remove — dev bypass: double-tap right arrow to trigger mock DMC scan
    const lastArrowTap = useRef<{ key: string; time: number }>({ key: "", time: 0 });
    useEffect(() => {
        if (step !== "scan" || !isConnected) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight") return;
            const now = Date.now();
            const last = lastArrowTap.current;
            if (last.key === e.key && now - last.time < 400) {
                appContext.caseService.parlayInterface.caseManager.mock_datamatrix_scan_event();
                lastArrowTap.current = { key: "", time: 0 };
            } else {
                lastArrowTap.current = { key: e.key, time: now };
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [step, isConnected, appContext.caseService.parlayInterface.caseManager]);

    // TODO: Remove — dev bypass on waitSCR: double-tap right = confirmed, double-tap left = denied
    useEffect(() => {
        if (step !== "waitSCR") return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const now = Date.now();
            const last = lastArrowTap.current;
            if (last.key === e.key && now - last.time < 400) {
                if (e.key === "ArrowRight") {
                    onComplete();
                } else {
                    setStep("rejected");
                }
                lastArrowTap.current = { key: "", time: 0 };
            } else {
                lastArrowTap.current = { key: e.key, time: now };
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [step, onComplete]);

    // Listen for SCR confirmation answer
    useEffect(() => {
        if (step === "waitSCR" && scrConfirmAnswer) {
            if (scrConfirmAnswer === "confirmed") {
                appContext.caseService.scrConfirmAnswer.set("");
                onComplete();
            } else if (scrConfirmAnswer === "denied") {
                appContext.caseService.scrConfirmAnswer.set("");
                setStep("rejected");
            }
        }
    }, [step, scrConfirmAnswer, appContext.caseService, onComplete]);

    const handleAddPack = async () => {
        if (!scannedPackInfo) return;
        appContext.caseService.scrConfirmAnswer.set("");
        await appContext.caseService.parlayInterface.caseManager.scr_confirm_suture_pack(scannedPackInfo);
        appContext.caseService.scrConfirming.set(true);
        setStep("waitSCR");
    };

    const handleRejectYes = () => {
        // SCR denied the pack — proceed to exit gate decision tree
        // (remaining check → re-adj check → wait for SCR validations)
        onRejectionConfirm();
    };

    return (
        <div className={styles.screenContainer}>
            <BasicHeader
                title={t("section1.addPack.headerTitle")}
                onBack={
                    step === "scan"
                        ? onBack
                        : () => {
                              setScannedPackInfo(null);
                              setStep("scan");
                          }
                }
                showHelp
            />
            <div className={step === "packDetails" ? styles.contentAreaWithHeader : styles.contentArea}>
                {step === "scan" && (
                    <>
                        <img className={styles.scanImage} src={ScanNeedlePack} alt="Scan needle pack" />
                        <span className={styles.titleText}>
                            {t("section1.addPack.scanPromptLine1")}
                            <br />
                            {t("section1.addPack.scanPromptLine2")}
                        </span>
                    </>
                )}

                {step === "packDetails" && scannedPackInfo && (
                    <ScanPackConfirmScreen
                        scannedPackInfo={scannedPackInfo}
                        onYes={handleAddPack}
                        onNo={() => setStep("scan")}
                    />
                )}

                {step === "waitSCR" && (
                    <>
                        <div className={styles.dotRing}>
                            {Array.from({ length: 12 }, (_, i) => (
                                <div key={i} className={styles.dot} style={{ "--i": i } as React.CSSProperties} />
                            ))}
                        </div>
                        <span className={styles.titleText}>{t("section1.addPack.waiting")}</span>
                    </>
                )}

                {step === "rejected" && (
                    <>
                        <img className={styles.rejectedIcon} src={SCRDidNotConfirm} alt="SCR did not confirm" />
                        <span className={styles.rejectedText}>
                            {t("section1.addPack.rejectedLine1")}
                            <br />
                            {t("section1.addPack.rejectedLine2")}
                        </span>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.noButton}
                                onClick={() => {
                                    setScannedPackInfo(null);
                                    setStep("scan");
                                }}
                            >
                                {t("section1.addPack.no")} <span className={styles.buttonIcon}>&#10005;</span>
                            </button>
                            <button className={styles.yesButton} onClick={handleRejectYes}>
                                {t("section1.addPack.yes")} <span className={styles.buttonIcon}>&#10003;</span>
                            </button>
                        </div>
                        <button className={styles.viewPacksLink} onClick={onViewPacks}>
                            {t("section1.addPack.viewPacks")}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
