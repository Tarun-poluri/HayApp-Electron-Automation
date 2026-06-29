import React, { useContext, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppContext } from "./App";
import styles from "../viewcss/SCRActionScreen.module.css";
import ModalHeader from "../component/ModalHeader";
import SCRHayStackButton from "../component/SCRHayStackButton";
import DownArrowGray from "../img/DownArrowGray.svg";
import DownArrowOrange from "../img/DownArrowOrange.svg";
import QuestionMessage from "../img/QuestionMessage.svg";
import NeedleDriver from "../img/NeedleDriver.png";
import TrapDoor from "../img/TrapDoor.svg";
import SurroundingArea from "../img/SurroundingArea.svg";
import Drapes from "../img/Drapes.svg";
import Floor from "../img/Floor.svg";
import HaystackDepositColor from "../img/HaystackDepositColor.svg";
import { ScreenState } from "../defs/enums";
import { AnalyzeNeedleResult, CBINotificationSnapshot, SCRNotificationType } from "../services/CaseService";

const menuKeys = [
    "help",
    "foundMisplacedNeedle",
    "contaminatedNeedle",
    "brokenNeedle",
    "incompatibleNeedle",
    "interimCount",
];

const notificationMap: Record<string, SCRNotificationType | null> = {
    help: null,
    foundMisplacedNeedle: "misplaced",
    contaminatedNeedle: "contaminated",
    brokenNeedle: "broken",
    incompatibleNeedle: "incompatible",
    interimCount: null,
};

export const SCRActionScreen: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [highlightedIdx, setHighlightedIdx] = useState(0);
    const [showMisplacedNeedleScreen, setShowMisplacedNeedleScreen] = useState(false);
    const [showHayStackPrompt, setShowHayStackPrompt] = useState(false);
    const [showBlankImageScreen, setShowBlankImageScreen] = useState(false);
    // Track the result ID that was present when entering the deposit step so we can ignore it
    const ignoredNeedleResultIdRef = useRef<string | null>(null);

    useEffect(() => {
        let screenState = ScreenState.SCR_ACTION_SCREEN;
        if (showMisplacedNeedleScreen) {
            screenState = ScreenState.SCR_ACTION_SCREEN_STERILE_PROMPT;
        } else if (showHayStackPrompt) {
            screenState = ScreenState.SCR_ACTION_SCREEN_STERILE_DEPOSIT_PROMPT;
        } else if (showBlankImageScreen) {
            screenState = ScreenState.SCR_ACTION_SCREEN_BLANK_IMAGE;
        }
        appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(screenState);
    }, [
        showMisplacedNeedleScreen,
        showHayStackPrompt,
        showBlankImageScreen,
        appContext.caseService.parlayInterface.caseManager,
    ]);

    useEffect(() => {
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        let unsubscribe: (() => void) | undefined;

        if (showHayStackPrompt) {
            const handler = (event: { button: string }) => {
                if (event.button === "take_action") setShowHayStackPrompt(false);
            };
            unsubscribe = haystackDefs.button_pressed(handler);
        } else if (showMisplacedNeedleScreen) {
            const handler = (event: { button: string }) => {
                if (event.button === "yes") handleYes();
                else if (event.button === "no") handleNo();
                else if (event.button === "take_action") setShowMisplacedNeedleScreen(false);
            };
            unsubscribe = haystackDefs.button_pressed(handler);
        } else if (showBlankImageScreen) {
            const handler = (event: { button: string }) => {
                if (event.button === "yes") handleItemFound();
                else if (event.button === "no") handleItemNotFound();
            };
            unsubscribe = haystackDefs.button_pressed(handler);
        } else {
            const handler = (event: { button: string }) => {
                switch (event.button) {
                    case "yes":
                        handleConfirm();
                        break;
                    case "validate":
                        handleNext();
                        break;
                    case "take_action":
                        appContext.navigate({ path: "scrDashboard" });
                        break;
                    default:
                        break;
                }
            };
            unsubscribe = haystackDefs.button_pressed(handler);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [
        appContext.caseService.parlayInterface.hayStack,
        highlightedIdx,
        appContext,
        showHayStackPrompt,
        showMisplacedNeedleScreen,
        showBlankImageScreen,
    ]);

    useEffect(() => {
        if (!showHayStackPrompt) return;
        const callback = (result: AnalyzeNeedleResult | null) => {
            if (!result || result.id === ignoredNeedleResultIdRef.current) return;
            if (result.needle_count === 1) {
                appContext.caseService.parlayInterface.caseManager.clear_latest_needle_result();
                setShowHayStackPrompt(false);
                appContext.navigate({ path: "scrDashboard" });
            } else if (result.needle_count === 0 && result.not_a_needle_count === 0) {
                setShowHayStackPrompt(false);
                setShowBlankImageScreen(true);
            }
        };
        appContext.caseService.latestNeedleResult.addListener(callback);
        return () => {
            appContext.caseService.latestNeedleResult.removeListener(callback);
        };
    }, [showHayStackPrompt, appContext]);

    const handleNext = () => {
        setHighlightedIdx((prev) => (prev + 1) % menuKeys.length);
    };

    const handleConfirm = () => {
        const key = menuKeys[highlightedIdx];
        if (key === "foundMisplacedNeedle") {
            setShowMisplacedNeedleScreen(true);
            return;
        }
        const notificationType = notificationMap[key];
        if (notificationType) {
            appContext.caseService.triggerCBINotification(notificationType as keyof CBINotificationSnapshot, 1);
            appContext.caseService.scrNotification.set(notificationType);
            appContext.navigate({ path: "scrDashboard" });
        }
    };

    const handleNo = () => {
        appContext.caseService.triggerCBINotification("misplaced", 1);
        appContext.caseService.scrNotification.set("misplaced");
        appContext.navigate({ path: "scrDashboard" });
    };

    const handleYes = () => {
        ignoredNeedleResultIdRef.current = appContext.caseService.latestNeedleResult.value?.id ?? null;
        setShowMisplacedNeedleScreen(false);
        setShowHayStackPrompt(true);
    };

    const handleItemFound = async () => {
        await appContext.caseService.parlayInterface.caseManager.clear_latest_needle_result();
        // Capture any stale result that may still be present after clearing,
        // then batch both state changes so no intermediate render causes a flash
        ignoredNeedleResultIdRef.current = appContext.caseService.latestNeedleResult.value?.id ?? null;
        setShowBlankImageScreen(false);
        setShowHayStackPrompt(true);
    };

    const handleItemNotFound = async () => {
        await appContext.caseService.parlayInterface.caseManager.increment_misplaced_needles(1);
        await appContext.caseService.parlayInterface.caseManager.clear_latest_needle_result();
        appContext.navigate({ path: "scrDashboard" });
    };

    const renderMisplacedNeedleScreen = () => {
        return (
            <div className={styles.screenContainer}>
                <ModalHeader title={t("scrActionScreen.foundMisplacedNeedle")} hideBack hideClose showHelp={false} />
                <div className={styles.foundMisplacedContentContainer}>
                    <img src={QuestionMessage} className={styles.questionIcon} alt="question message" />
                    <div className={styles.foundMisplacedContent}>
                        <div className={styles.foundMisplacedQuestionText}>
                            {t("scrActionScreen.foundMisplacedNeedleQuestion")}
                        </div>
                    </div>
                    <div className={styles.haystackButtonContainer}>
                        <div className={styles.haystackButtons}>
                            <SCRHayStackButton
                                type="yes"
                                active
                                title={t("scrActionScreen.yes")}
                                circleClassName={styles.yesColor}
                                textClassName={styles.haystackButtonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={handleYes}
                            />
                            <SCRHayStackButton
                                type="validate"
                                circleClassName={styles.grayCircle}
                                imageClassName={styles.haystackButtonIcon}
                            />
                            <SCRHayStackButton
                                type="action"
                                active
                                title={t("scrActionScreen.backToDashboard")}
                                circleClassName={styles.actionColor}
                                textClassName={styles.haystackButtonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={() => setShowMisplacedNeedleScreen(false)}
                            />
                            <SCRHayStackButton
                                type="no"
                                active
                                title={t("scrActionScreen.no")}
                                circleClassName={styles.noColor}
                                textClassName={styles.haystackButtonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={handleNo}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderHayStackPrompt = () => {
        return (
            <div className={styles.screenContainer}>
                <ModalHeader title={t("scrActionScreen.foundMisplacedNeedle")} hideBack hideClose showHelp={false} />
                <div className={styles.hayStackPromptContainer}>
                    <img src={HaystackDepositColor} className={styles.hayStackPromptIcon} alt="haystack deposit icon" />
                    <div className={styles.hayStackPromptContentContainer}>
                        <div className={styles.hayStackPromptText}>{t("scrActionScreen.hayStackPrompt")}</div>
                        <div className={styles.haystackButtonContainer}>
                            <div className={styles.haystackButtons}>
                                <SCRHayStackButton
                                    type="yes"
                                    circleClassName={styles.grayCircle}
                                    imageClassName={styles.haystackButtonIcon}
                                />
                                <SCRHayStackButton
                                    type="validate"
                                    circleClassName={styles.grayCircle}
                                    imageClassName={styles.haystackButtonIcon}
                                />
                                <SCRHayStackButton
                                    type="action"
                                    active
                                    title={t("scrActionScreen.backToDashboard")}
                                    circleClassName={styles.actionColor}
                                    textClassName={styles.haystackButtonText}
                                    imageClassName={styles.haystackButtonIcon}
                                    onClick={() => setShowHayStackPrompt(false)}
                                />
                                <SCRHayStackButton type="no" circleClassName={styles.grayCircle} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderBlankImage = () => {
        return (
            <div className={styles.screenContainerNoHeader}>
                <div className={styles.searchContentContainer}>
                    <div className={styles.searchInnerContentContainer}>
                        <div className={styles.searchTextContainer}>
                            <span className={styles.searchText}>{t("blankImage.searchText1")}</span>
                            <span className={styles.searchText}>{t("blankImage.searchText2")}</span>
                        </div>
                        <div className={styles.imageGridContainer}>
                            <div className={styles.imageContainer}>
                                <img src={NeedleDriver} className={styles.img} alt="needle driver" />
                                <span className={styles.imageText}>{t("blankImage.needleDriver")}</span>
                            </div>
                            <div className={styles.imageContainer}>
                                <img src={TrapDoor} className={styles.img} alt="check inside haystack" />
                                <span className={styles.imageText}>{t("blankImage.checkInside")}</span>
                            </div>
                            <div className={styles.imageContainer}>
                                <img src={SurroundingArea} className={styles.img} alt="surrounding area" />
                                <span className={styles.imageText}>{t("blankImage.surroundingArea")}</span>
                            </div>
                            <div className={styles.imageContainer}>
                                <img src={Drapes} className={styles.img} alt="drapes and gowns" />
                                <span className={styles.imageText}>{t("blankImage.drapesAndGowns")}</span>
                            </div>
                            <div className={styles.imageContainer}>
                                <img src={Floor} className={styles.img} alt="floor" />
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
                            onClick={handleItemFound}
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
                            onClick={handleItemNotFound}
                        />
                    </div>
                </div>
            </div>
        );
    };

    if (showHayStackPrompt) {
        return renderHayStackPrompt();
    }

    if (showMisplacedNeedleScreen) {
        return renderMisplacedNeedleScreen();
    }

    if (showBlankImageScreen) {
        return renderBlankImage();
    }

    return (
        <div className={styles.screenContainer}>
            <ModalHeader title={t("scrActionScreen.menu")} hideBack hideClose showHelp={false} />
            <div className={styles.contentContainer}>
                <div className={styles.leftContainer}>
                    <div className={styles.menuContainer}>
                        <img src={DownArrowGray} className={styles.arrow} alt="down arrow" />
                        {menuKeys.map((key, idx) => (
                            <React.Fragment key={key}>
                                <button
                                    className={idx === highlightedIdx ? styles.highlightedButton : styles.normalButton}
                                    tabIndex={-1}
                                    style={{ pointerEvents: "none" }}
                                >
                                    <span
                                        className={
                                            idx === highlightedIdx
                                                ? styles.highlightedButtonText
                                                : styles.normalButtonText
                                        }
                                    >
                                        {t(`scrActionScreen.${key}`)}
                                    </span>
                                </button>
                                <img
                                    src={
                                        idx === menuKeys.length - 1
                                            ? highlightedIdx === idx
                                                ? DownArrowOrange
                                                : DownArrowGray
                                            : highlightedIdx === idx
                                              ? DownArrowOrange
                                              : DownArrowGray
                                    }
                                    className={styles.arrow}
                                    alt="down arrow"
                                />
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div className={styles.rightContainer}>
                    <div className={styles.haystackButtonContainer}>
                        <div className={styles.haystackButtons}>
                            <SCRHayStackButton
                                type="yes"
                                active
                                title={t("scrActionScreen.confirm")}
                                circleClassName={styles.yesColor}
                                textClassName={styles.haystackButtonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={handleConfirm}
                            />
                            <SCRHayStackButton
                                type="validate"
                                active
                                title={t("scrActionScreen.next")}
                                circleClassName={styles.validateColor}
                                textClassName={styles.haystackButtonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={handleNext}
                            />
                            <SCRHayStackButton
                                type="action"
                                active
                                title={t("scrActionScreen.backToDashboard")}
                                circleClassName={styles.actionColor}
                                textClassName={styles.haystackButtonText}
                                imageClassName={styles.haystackButtonIcon}
                                onClick={() => appContext.navigate({ path: "scrDashboard" })}
                            />
                            <SCRHayStackButton
                                type="no"
                                circleClassName={styles.grayCircle}
                                imageClassName={styles.haystackButtonIcon}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
