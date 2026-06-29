import styles from "../viewcss/SCRAddedNeedles.module.css";
import { useTranslation, Trans } from "react-i18next";
import { useContext, useState, useEffect } from "react";
import { AppContext } from "./App";
import ModalHeader from "../component/ModalHeader";
import SCRHayStackButton from "../component/SCRHayStackButton";
import LoadingIcon from "../img/LoadingIcon.svg";
import { ScreenState } from "../defs/enums";
import { useListenable } from "../util/Listenable";

export const SCRAddedNeedles: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [step, setStep] = useState<"question" | "waiting" | "interim">("question");
    const interimCountStarted = useListenable(appContext.caseService.interimCountStarted);

    const suturePackInfo = appContext.route?.args?.suturePackInfo;

    // Listen for interim count started from backend to move from waiting to interim
    useEffect(() => {
        if (step === "waiting" && interimCountStarted) {
            setStep("interim");
            // Reset the flag
            appContext.caseService.interimCountStarted.set(false);
        }
    }, [step, interimCountStarted, appContext.caseService.interimCountStarted]);

    const handleAnswer = async (answer: "yes" | "no") => {
        if (answer === "yes" && suturePackInfo) {
            await appContext.caseService.parlayInterface.caseManager.scr_confirmed_answer(suturePackInfo, true);
            appContext.navigate({ path: "scrDashboard" });
        } else if (answer === "no" && suturePackInfo) {
            await appContext.caseService.parlayInterface.caseManager.scr_confirmed_answer(suturePackInfo, false);
            setStep("waiting");
        }
    };

    const handleInterimYes = () => {
        appContext.navigate({ path: "scrDashboard" });
    };

    useEffect(() => {
        let screenState = ScreenState.SCR_ADDED_NEEDLES;
        if (step === "waiting") {
            screenState = ScreenState.SCR_ADDED_NEEDLES_WAITING;
        } else if (step === "interim") {
            screenState = ScreenState.SCR_ADDED_NEEDLES_INTERIM;
        }
        appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(screenState);
    }, [step, appContext.caseService.parlayInterface.caseManager]);

    useEffect(() => {
        if (step !== "question") return;
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            switch (event.button) {
                case "yes":
                    handleAnswer("yes");
                    break;
                case "no":
                    handleAnswer("no");
                    break;
                default:
                    break;
            }
        };
        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.caseService.parlayInterface.hayStack, suturePackInfo, step]);

    useEffect(() => {
        if (step !== "interim") return;
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            switch (event.button) {
                case "yes":
                    handleInterimYes();
                    break;
                default:
                    break;
            }
        };
        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.caseService.parlayInterface.hayStack, step]);

    const renderWaitingStep = () => (
        <div className={styles.screenContainerNoHeader}>
            <div className={styles.waitingContainer}>
                <div className={styles.loadingIcon}>
                    <span className={styles.loadingIconSpinner}>
                        <img src={LoadingIcon} alt="Loading" />
                    </span>
                </div>
                <span className={styles.waitingText}>{t("scrAddedNeedles.waiting")}</span>
            </div>
        </div>
    );

    const renderInterimScreen = () => (
        <div className={styles.screenContainerNoHeader}>
            <div className={styles.interimContainer}>
                <div className={styles.interimInnerContainer}>
                    <div className={styles.interimTextContainer}>
                        <span className={styles.interimText}>
                            <Trans
                                i18nKey="scrAddedNeedles.interimQuestion"
                                components={[<span className={styles.usedHighlight} />]}
                            />
                        </span>
                    </div>
                    <div className={styles.haystackButtonContainer}>
                        <SCRHayStackButton
                            type="yes"
                            active
                            title={t("scrAddedNeedles.confirm")}
                            circleClassName={styles.yesColor}
                            textClassName={styles.buttonText}
                            imageClassName={styles.haystackButtonIcon}
                            onClick={handleInterimYes}
                        />
                        <SCRHayStackButton
                            type="validate"
                            circleClassName={styles.grayCircle}
                            textClassName={styles.buttonText}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        <SCRHayStackButton
                            type="action"
                            circleClassName={styles.grayCircle}
                            textClassName={styles.buttonText}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        <SCRHayStackButton
                            type="no"
                            circleClassName={styles.grayCircle}
                            textClassName={styles.buttonText}
                            imageClassName={styles.haystackButtonIcon}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderQuestionStep = () => (
        <div className={styles.screenContainer}>
            <ModalHeader title={t("scrAddedNeedles.addSutureNeedles")} hideBack hideClose showHelp={false} />
            <div className={styles.contentContainer}>
                <div className={styles.packInfoContainer}>
                    <div className={styles.packBackground}>
                        {suturePackInfo?.image && (
                            <img
                                src={`http://localhost:8080/suture_pack_images/${suturePackInfo.image}`}
                                alt="Suture Pack"
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                        )}
                    </div>
                    <div className={styles.packInfoTable}>
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrAddedNeedles.needlesPerPack")}:</span>
                            <span className={styles.packInfoValue}>{suturePackInfo?.num_needles}</span>
                        </div>
                        <div className={styles.tableDivider} />
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrAddedNeedles.size")}:</span>
                            <span className={styles.packInfoValue}>{suturePackInfo?.suture_gauge}</span>
                        </div>
                        <div className={styles.tableDivider} />
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrAddedNeedles.sutureType")}:</span>
                            <span className={styles.packInfoValue}>{suturePackInfo?.manufacturer}</span>
                        </div>
                        <div className={styles.tableDivider} />
                        <div className={styles.packInfoRow}>
                            <span className={styles.packInfoTitle}>{t("scrAddedNeedles.needleName")}:</span>
                            <span className={styles.packInfoValue}>{suturePackInfo?.needle_name}</span>
                        </div>
                    </div>
                </div>
                <div className={styles.controlsContainer}>
                    <div className={styles.controlsContentContainer}>
                        <span className={styles.questionText}>{t("scrAddedNeedles.question")}</span>
                        <div className={styles.haystackButtonContainer}>
                            <SCRHayStackButton
                                type="yes"
                                active
                                title={t("scrAddedNeedles.yes")}
                                circleClassName={styles.yesColor}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={() => handleAnswer("yes")}
                            />
                            <SCRHayStackButton
                                type="validate"
                                circleClassName={styles.grayCircle}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                            />
                            <SCRHayStackButton
                                type="action"
                                circleClassName={styles.grayCircle}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                            />
                            <SCRHayStackButton
                                type="no"
                                active
                                title={t("scrAddedNeedles.no")}
                                circleClassName={styles.noColor}
                                textClassName={styles.buttonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={() => handleAnswer("no")}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div>
            {step === "question" && renderQuestionStep()}
            {step === "waiting" && renderWaitingStep()}
            {step === "interim" && renderInterimScreen()}
        </div>
    );
};
