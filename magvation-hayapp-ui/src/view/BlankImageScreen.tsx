import styles from "../viewcss/BlankImageScreen.module.css";
import React, { useState, useEffect, useContext, useRef } from "react";
import QuestionMessage from "../img/QuestionMessage.svg";
import { useTranslation } from "react-i18next";
import SCRHayStackButton from "../component/SCRHayStackButton";
import NeedleDriver from "../img/NeedleDriver.png";
import TrapDoor from "../img/TrapDoor.svg";
import SurroundingArea from "../img/SurroundingArea.svg";
import Drapes from "../img/Drapes.svg";
import Floor from "../img/Floor.svg";
import { AppContext } from "./App";
import HayStackDeposit from "../img/HayStackDeposit.svg";
import { useListenable } from "../util/Listenable";

export const BlankImageScreen: React.FC = () => {
    enum BlankFlowSteps {
        Initial = "initial",
        Search = "search",
        Where = "where",
        Deposit = "deposit",
    }
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [step, setStep] = useState<BlankFlowSteps>(BlankFlowSteps.Initial);
    const latestNeedleResult = useListenable(appContext.caseService.latestNeedleResult);
    // Track the result ID that was present when entering Deposit step - we should ignore it
    // So we don't instantly retrigger deposit logic on the same result
    const ignoredResultId = useRef<string | null>(null);

    // Listen for haystack button events
    useEffect(() => {
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = async (event: { button: string }) => {
            if (step === BlankFlowSteps.Initial) {
                switch (event.button) {
                    case "yes":
                        // Clear the latest needle result before going back
                        await appContext.caseService.parlayInterface.caseManager.clear_latest_needle_result();
                        appContext.caseService.scrLastImageState.set("blank");
                        // Go back to SCR Dashboard
                        appContext.navigate({ path: "scrDashboard" });
                        break;
                    case "no":
                        // Move to search step
                        setStep(BlankFlowSteps.Search);
                        break;
                    default:
                        break;
                }
            } else if (step === BlankFlowSteps.Search) {
                switch (event.button) {
                    case "yes":
                        // Needle found, move to where step
                        setStep(BlankFlowSteps.Where);
                        break;
                    case "no":
                        // Needle not found, increment misplaced and go back to dashboard
                        await appContext.caseService.parlayInterface.caseManager.increment_misplaced_needles(1);
                        await appContext.caseService.parlayInterface.caseManager.clear_latest_needle_result();
                        appContext.caseService.scrNotification.set("misplaced_count_updated");
                        appContext.caseService.scrLastImageState.set("blank");
                        appContext.navigate({ path: "scrDashboard" });
                        break;
                    default:
                        break;
                }
            } else if (step === BlankFlowSteps.Where) {
                switch (event.button) {
                    case "yes":
                        // Needle in sterile zone, move to deposit step
                        // Remember the current result ID so we ignore it in the deposit step
                        ignoredResultId.current = latestNeedleResult?.id ?? null;
                        await appContext.caseService.parlayInterface.caseManager.clear_latest_needle_result();
                        setStep(BlankFlowSteps.Deposit);

                        break;
                    case "no":
                        // Needle found in non-sterile zone — CIR will pick it up and record the type
                        await appContext.caseService.parlayInterface.caseManager.clear_latest_needle_result();
                        await appContext.caseService.parlayInterface.caseManager.increment_found_non_sterile(1);
                        appContext.caseService.scrNotification.set("misplaced_found_nonsterile");
                        appContext.caseService.scrLastImageState.set("blank");
                        appContext.navigate({ path: "scrDashboard" });
                        break;
                    default:
                        break;
                }
            }
        };
        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext, step, BlankFlowSteps]);

    // Listen for needle analysis events when on deposit step
    useEffect(() => {
        if (step !== BlankFlowSteps.Deposit) {
            return;
        }
        if (!latestNeedleResult) {
            return;
        }

        // Ignore the result that was present when we entered the Deposit step
        if (latestNeedleResult.id === ignoredResultId.current) {
            return;
        }

        if (latestNeedleResult.response_type === "NO_OBJECTS") {
            // NO_OBJECTS event, restart from initial step
            setStep(BlankFlowSteps.Initial);
        } else {
            // Good needle detected - navigate to scrDashboard
            appContext.navigate({ path: "scrDashboard" });
        }
    }, [latestNeedleResult, step, appContext, BlankFlowSteps]);

    const renderPromptScreen = ({
        promptKey,
        promptKey2,
        yesKey,
        noKey,
    }: {
        promptKey: string;
        promptKey2?: string;
        yesKey: string;
        noKey: string;
    }) => (
        <div className={styles.contentContainer}>
            <img src={QuestionMessage} className={styles.icon} />
            <div className={styles.innerContentContainer}>
                <div className={styles.textContainer}>
                    <span className={styles.text}>{t(promptKey)}</span>
                    {promptKey2 && <span className={styles.text}>{t(promptKey2)}</span>}
                </div>
                <div className={styles.haystackButtonContainer}>
                    <SCRHayStackButton
                        type="yes"
                        active
                        title={t(yesKey)}
                        circleClassName={styles.yesColor}
                        textClassName={styles.haystackButtonText}
                        imageClassName={styles.haystackButtonIcon}
                    />
                    <SCRHayStackButton
                        type="validate"
                        circleClassName={styles.grayCircle}
                        imageClassName={styles.haystackButtonIcon}
                    />
                    <SCRHayStackButton
                        type="action"
                        circleClassName={styles.grayCircle}
                        imageClassName={styles.haystackButtonIcon}
                    />
                    <SCRHayStackButton
                        type="no"
                        active
                        title={t(noKey)}
                        circleClassName={styles.noColor}
                        textClassName={styles.haystackButtonText}
                        imageClassName={styles.haystackButtonIcon}
                    />
                </div>
            </div>
        </div>
    );

    const renderSearchScreen = () => (
        <div className={styles.searchContentContainer}>
            <div className={styles.searchInnerContentContainer}>
                <div className={styles.searchTextContainer}>
                    <span className={styles.searchText}>{t("blankImage.searchText1")}</span>
                    <span className={styles.searchText}>{t("blankImage.searchText2")}</span>
                </div>
                <div className={styles.imageGridContainer}>
                    <div className={styles.imageContainer}>
                        <img src={NeedleDriver} className={styles.img} />
                        <span className={styles.imageText}>{t("blankImage.needleDriver")}</span>
                    </div>
                    <div className={styles.imageContainer}>
                        <img src={TrapDoor} className={styles.img} />
                        <span className={styles.imageText}>{t("blankImage.checkInside")}</span>
                    </div>
                    <div className={styles.imageContainer}>
                        <img src={SurroundingArea} className={styles.img} />
                        <span className={styles.imageText}>{t("blankImage.surroundingArea")}</span>
                    </div>
                    <div className={styles.imageContainer}>
                        <img src={Drapes} className={styles.img} />
                        <span className={styles.imageText}>{t("blankImage.drapesAndGowns")}</span>
                    </div>
                    <div className={styles.imageContainer}>
                        <img src={Floor} className={styles.img} />
                        <span className={styles.imageText}>{t("blankImage.floor")}</span>
                    </div>
                </div>
            </div>
            <div className={styles.haystackButtonContainer}>
                <SCRHayStackButton
                    type="yes"
                    active
                    title={t("blankImage.found")}
                    circleClassName={styles.yesColor}
                    textClassName={styles.haystackButtonText}
                    imageClassName={styles.haystackButtonIcon}
                />
                <SCRHayStackButton
                    type="validate"
                    circleClassName={styles.grayCircle}
                    imageClassName={styles.haystackButtonIcon}
                />
                <SCRHayStackButton
                    type="action"
                    circleClassName={styles.grayCircle}
                    imageClassName={styles.haystackButtonIcon}
                />
                <SCRHayStackButton
                    type="no"
                    active
                    title={t("blankImage.notFound")}
                    circleClassName={styles.noColor}
                    textClassName={styles.haystackButtonText}
                    imageClassName={styles.haystackButtonIcon}
                />
            </div>
        </div>
    );

    const renderDepositScreen = () => (
        <div className={styles.depositScreenContainer}>
            <img src={HayStackDeposit} className={styles.depositImage} />
            <div className={styles.depositTextContainer}>
                <span className={styles.depositText}>{t("blankImage.deposit")}</span>
            </div>
        </div>
    );

    return (
        <div className={styles.screenContainer}>
            {step === BlankFlowSteps.Initial &&
                renderPromptScreen({
                    promptKey: "blankImage.noObject1",
                    promptKey2: "blankImage.noObject2",
                    yesKey: "blankImage.yes",
                    noKey: "blankImage.no",
                })}
            {step === BlankFlowSteps.Search && renderSearchScreen()}
            {step === BlankFlowSteps.Where &&
                renderPromptScreen({
                    promptKey: "blankImage.where",
                    yesKey: "blankImage.sterile",
                    noKey: "blankImage.nonSterile",
                })}
            {step === BlankFlowSteps.Deposit && renderDepositScreen()}
        </div>
    );
};
