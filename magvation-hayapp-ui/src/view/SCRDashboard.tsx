import DashboardHeader from "../component/DashboardHeader";
import styles from "../viewcss/SCRDashboard.module.css";
import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect } from "react";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import SubtractedRectangle from "../img/SubtractedRectangle.svg";
import TotalArrowIcon from "../img/TotalArrow.svg";
import SCRCombinedSubtract from "../img/SCRCombinedSubtract.svg";
import Minus from "../img/Minus.svg";
import NeedleImage from "../img/NeedleImage.png";
import SCRDefaultCard from "../component/SCRDefaultCard";
import SCRValidationCard from "../component/SCRValidationCard";
import EqualsIcon from "../img/Equals.svg";
import SCRAddedNeedlesCard from "../component/SCRAddedNeedlesCard";
import SCRCBIBoxCard from "../component/SCRCBIBoxCard";

import HalfIcon from "../img/HalfIcon.svg";
import SCRHayStackButton from "../component/SCRHayStackButton";
import SCRDefaultCardStyles from "../component/SCRDefaultCard.module.css";
import { AnalyzeNeedleResult, SCRNotificationType } from "../services/CaseService";
import HayStackNeedlePrompt from "../img/HayStackNeedlePrompt.svg";
import BlankImageWarning from "../img/BlankImageWanring.svg";
import WhiteCheck from "../img/WhiteCheck.svg";
import { ScreenState } from "../defs/enums";
import { TotalRemainingCard } from "../component/TotalRemainingCard";

function getOtherSharpsSummary(scrValidation: AnalyzeNeedleResult[]) {
    const counts: Record<string, number> = {};
    for (const needle of scrValidation) {
        const reason = needle.adjudication_reason;
        if (!reason) continue;
        const key = reason.toLowerCase();
        if (key === "broken" || key === "multiple") continue;
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

function splitIntoRows<T>(arr: T[], perRow: number): T[][] {
    const rows: T[][] = [];
    for (let i = 0; i < arr.length; i += perRow) {
        rows.push(arr.slice(i, i + perRow));
    }
    return rows;
}

const notificationMessages: Record<SCRNotificationType, string> = {
    contaminated: "The request to report a contaminated needle was sent to the CIR nurse",
    incompatible: "The request to report an incompatible needle was sent to the CIR nurse",
    broken: "The request to report a broken needle was sent to the CIR nurse",
    misplaced: "The request to report a found misplaced needle was sent to the CIR nurse",
    misplaced_count_updated: "Misplaced suture needle was added to the count.",
    misplaced_found_nonsterile: "The request to report a found suture needle was sent to the CIR role",
};

const Notification: React.FC<{ message: string; type: SCRNotificationType }> = ({ message, type }) => {
    const isCountUpdate = type === "misplaced_count_updated";
    const containerClass = isCountUpdate ? styles.notificationContainerRed : styles.notificationContainer;
    const iconContainerClass = isCountUpdate ? styles.notificationIconContainerRed : styles.notificationIconContainer;
    return (
        <div className={containerClass}>
            <div className={styles.notificationInnerContainer}>
                <div className={iconContainerClass}>
                    <img src={WhiteCheck} alt="Notification Icon" className={styles.notificationIcon} />
                </div>
                <span className={styles.notificationText}>{message}</span>
            </div>
        </div>
    );
};

export const SCRDashboard: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const addedNeedles = useListenable(appContext.caseService.addedNeedleCount);
    const interimAddedNeedles = useListenable(appContext.caseService.interimAddedNeedleCount);
    const contaminated = useListenable(appContext.caseService.contaminatedNeedleCount);
    const incompatible = useListenable(appContext.caseService.incompatibleNeedleCount);
    const broken = useListenable(appContext.caseService.brokenNeedleCount);
    const startingCount = useListenable(appContext.caseService.startingCount);
    const scrNotification = useListenable(appContext.caseService.scrNotification);
    const [showNotification, setShowNotification] = useState<SCRNotificationType | null>(null);
    const lastImageState = useListenable(appContext.caseService.scrLastImageState);
    const scrConfirmSuturePack = useListenable(appContext.caseService.scrConfirmSuturePack);
    const cirVerification = useListenable(appContext.caseService.cirVerification);
    const cirVerificationCount = cirVerification.length;
    const latestNeedleResult = useListenable(appContext.caseService.latestNeedleResult);
    const needleImageCaptured = useListenable(appContext.caseService.needleImageCaptured);
    const filename = needleImageCaptured?.image_filename_used?.split(/[/\\]/).pop();
    const cirAdjudication = useListenable(appContext.caseService.cirAdjudication);
    const cirAdjudicationCount = cirAdjudication.length;
    const scrValidation = useListenable(appContext.caseService.scrValidation);
    const pendingCbiValidations = useListenable(appContext.caseService.pendingCbiValidations);
    // Count CBI validations ready for SCR: either CIR-confirmed (first-pass) or re-adjudicated items
    const confirmedCbiValidations =
        pendingCbiValidations?.filter((item) => item.cir_confirmed === true || item.source === "cbi_re_adjudication") ??
        [];
    const scrValidationCount = scrValidation.length + confirmedCbiValidations.length;
    const cirReAdjudication = useListenable(appContext.caseService.cirReAdjudication);
    const cirReAdjudicationCount = cirReAdjudication.length;
    const haystack = useListenable(appContext.caseService.haystack);

    const totalScanned = startingCount + addedNeedles;
    const misplaced = useListenable(appContext.caseService.misplaced);
    const wholeMisplaced = useListenable(appContext.caseService.wholeMisplaced);
    const haystackReasonCounts = useListenable(appContext.caseService.haystackReasonCounts);
    const confirmed = useListenable(appContext.caseService.confirmed);
    const remaining = totalScanned - confirmed;
    const bladeCount = haystackReasonCounts["blade"] ?? 0;
    const kWireCount = haystackReasonCounts["k-wire"] ?? 0;
    const hypoCount = haystackReasonCounts["hypo"] ?? 0;

    const totalReasons: { count: number; label: string }[] = [];
    if (bladeCount > 0) totalReasons.push({ count: bladeCount, label: t("scrDashboard.blade") });
    if (kWireCount > 0) totalReasons.push({ count: kWireCount, label: t("scrDashboard.k-wire") });
    if (hypoCount > 0) totalReasons.push({ count: hypoCount, label: t("scrDashboard.hypo") });

    const totalReasonRows = splitIntoRows(totalReasons, 2);

    const otherSharpsCounts = getOtherSharpsSummary(scrValidation);
    const perRow = 2;
    const otherSharpEntries = Object.entries(otherSharpsCounts);
    const rows = splitIntoRows(otherSharpEntries, perRow);
    const otherSharpsCount = otherSharpEntries.length;
    const otherSharpsContainerStyle = otherSharpsCount >= 3 ? { marginTop: "-20px" } : undefined;
    const imageNumber = needleImageCaptured?.image_number ?? "";
    const receivedTime = needleImageCaptured?.received_time ?? "";
    const scrValidationBrokenCount = scrValidation.filter(
        (needle) => needle.adjudication_reason && needle.adjudication_reason.toLowerCase() === "broken",
    ).length;
    const otherSharpsTotal = otherSharpEntries.reduce((sum, [, count]) => sum + count, 0);
    const brokenPairs = Math.floor(scrValidationBrokenCount / 2);
    const hasHalf = scrValidationBrokenCount % 2 === 1;
    const displayCount =
        scrValidation.length -
        scrValidationBrokenCount -
        otherSharpsTotal +
        brokenPairs +
        confirmedCbiValidations.length;

    const handleValidate = () => {
        if (scrValidationCount > 0) {
            appContext.navigate({
                path: "scrValidation",
                args: { needles: scrValidation },
            });
        }
    };

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        const screenState =
            scrValidationCount > 0
                ? ScreenState.SCR_DASHBOARD_VALIDATE_ACTIVE
                : ScreenState.SCR_DASHBOARD_VALIDATE_INACTIVE;
        appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(screenState);
    }, [
        scrValidationCount,
        appContext.caseService.parlayInterface.caseManager,
        appContext.parlayWrapper.isConnected.value,
    ]);

    useEffect(() => {
        if (scrConfirmSuturePack) {
            appContext.navigate({
                path: "scrAddedNeedles",
                args: { suturePackInfo: scrConfirmSuturePack },
            });
        }
    }, [scrConfirmSuturePack, appContext]);

    useEffect(() => {
        if (scrNotification) {
            setShowNotification(scrNotification);
            const timeout = setTimeout(() => {
                setShowNotification(null);
                appContext.caseService.scrNotification.set(null);
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [scrNotification, appContext.caseService.scrNotification]);

    // Navigate to closing count when CIR initiates it (CIR presses "Yes" on confirm screen).
    // CIR transitions CONFIRM → STEPS, broadcasting "cirCloseCountSteps" via set_current_cir_screen.
    useEffect(() => {
        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            if (event.screen === "cirCloseCountSteps") {
                console.log("[SCR Dashboard] CIR initiated closing count → navigating to scrClosingCount");
                appContext.navigate({ path: "scrClosingCount" });
            }
            if (event.screen === "cirInterimCountScrPendingWait") {
                console.log("[SCR Dashboard] CIR interim count reached SCR validation → navigating to scrInterimCount");
                appContext.navigate({ path: "scrInterimCount" });
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [appContext]);

    useEffect(() => {
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            switch (event.button) {
                case "yes":
                    break;
                case "no":
                    break;
                case "validate":
                    handleValidate();
                    break;
                case "take_action":
                    appContext.navigate({ path: "scrActionScreen" });
                    break;
                default:
                    break;
            }
        };
        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.caseService.parlayInterface.hayStack, appContext, scrValidation, scrValidationCount]);

    function getNumberContent({
        count,
        brokenCount = 0,
        showHalfFromBroken = false,
        alwaysWhite = false,
        wholeCount = 0,
    }: {
        count: number;
        brokenCount?: number;
        showHalfFromBroken?: boolean;
        alwaysWhite?: boolean;
        wholeCount?: number;
    }) {
        let value = count;
        let isOdd = false;

        if (showHalfFromBroken) {
            value = count + Math.floor(brokenCount / 2);
            isOdd = brokenCount % 2 === 1;
        } else {
            const divided = count / 2;
            value = Math.floor(divided) + wholeCount;
            isOdd = divided % 1 === 0.5;
        }

        if (value === 0 && (!showHalfFromBroken ? isOdd : brokenCount === 1)) {
            return (
                <div className={styles.numberContainer}>
                    <div className={styles.halfIcon}>
                        <img src={HalfIcon} alt="Half Icon" />
                    </div>
                </div>
            );
        }
        if (!isOdd) {
            return (
                <span
                    className={
                        alwaysWhite
                            ? styles.cardNumberText
                            : value === 0
                              ? `${styles.cardNumberText} ${styles.zeroValue}`
                              : styles.cardNumberText
                    }
                >
                    {value}
                </span>
            );
        }
        return (
            <div className={styles.numberContainer}>
                <span
                    className={
                        alwaysWhite
                            ? styles.cardNumberText
                            : value === 0
                              ? `${styles.cardNumberText} ${styles.zeroValue}`
                              : styles.cardNumberText
                    }
                >
                    {value}
                </span>
                <div className={styles.verticalRectangle} />
                <div className={styles.halfIcon}>
                    <img src={HalfIcon} alt="Half Icon" />
                </div>
            </div>
        );
    }

    useEffect(() => {
        if (appContext.route?.args) {
            const { completeNeedles = 0, notCompleteNeedles = 0 } = appContext.route.args;
            if (completeNeedles || notCompleteNeedles) {
                appContext.caseService.cirAdjudication.set(cirAdjudicationCount + notCompleteNeedles);
                appContext.caseService.haystack.set(haystack + completeNeedles);
                appContext.route.args = {};
            }
        }
    }, [appContext.route]);

    // Navigate to BlankImageScreen when NO_OBJECTS is received
    useEffect(() => {
        if (latestNeedleResult?.response_type === "NO_OBJECTS") {
            appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(ScreenState.SCR_BLANK_IMAGE);
            appContext.navigate({ path: "blankImageScreen" });
        }
    }, [latestNeedleResult, appContext]);

    useEffect(() => {
        if (!latestNeedleResult) return;
        if (latestNeedleResult.response_type === "NO_OBJECTS") {
            appContext.caseService.scrLastImageState.set("blank");
        } else {
            appContext.caseService.scrLastImageState.set("good");
        }
    }, [latestNeedleResult, appContext.caseService]);

    return (
        <div className={styles.dashboardContainer}>
            {showNotification && (
                <div style={{ position: "absolute", right: 0, zIndex: 2000 }}>
                    <Notification message={notificationMessages[showNotification]} type={showNotification} />
                </div>
            )}
            <DashboardHeader showBranding={true} />
            <div className={styles.mainArea}>
                <div className={styles.activeCaseMainAreaContainer}>
                    <div className={styles.activeCaseRow}>
                        <SCRDefaultCard title={t("cirDashboard.startCount")} number={startingCount} />
                        <div className={styles.subtractedRectangleContainer}>
                            <img src={SubtractedRectangle} alt="" />
                        </div>
                        <SCRAddedNeedlesCard addedNeedles={addedNeedles} />
                        <div className={styles.overlayContainer}>
                            <img src={SCRCombinedSubtract} className={styles.subtractSvg} />
                            <div className={styles.totalCard}>
                                <span className={styles.totalTitle}>{t("cirDashboard.totalScanned")}</span>
                                <span className={styles.totalNumber}>{totalScanned}</span>
                                <img src={Minus} className={styles.minus} alt="minus" />
                            </div>
                        </div>
                        <img src={TotalArrowIcon} className={styles.totalArrow} />
                    </div>
                    <div className={styles.activeCaseRow}>
                        <SCRCBIBoxCard contaminated={contaminated} incompatible={incompatible} broken={broken} />
                        <div className={styles.subtractedRectangleContainer}>
                            <img src={SubtractedRectangle} alt="" />
                        </div>
                        <SCRDefaultCard
                            title={t("cirDashboard.haystack")}
                            number={haystack}
                            numberContent={getNumberContent({
                                count: haystack,
                                brokenCount: haystackReasonCounts?.broken ?? 0,
                                showHalfFromBroken: true,
                            })}
                        />
                        <div className={styles.subtractedRectangleContainer}>
                            <img src={SubtractedRectangle} alt="" />
                        </div>
                        <SCRDefaultCard
                            title={t("cirDashboard.misplaced")}
                            number={misplaced}
                            numberContent={getNumberContent({
                                count: misplaced,
                                showHalfFromBroken: false,
                                wholeCount: wholeMisplaced,
                            })}
                            className={misplaced > 0 || wholeMisplaced > 0 ? SCRDefaultCardStyles.activeMisplaced : ""}
                        />
                        <div className={styles.overlayContainer}>
                            <div className={styles.totalCard}>
                                <span className={styles.totalTitle}>{t("cirDashboard.totalConfirmed")}</span>
                                <span className={styles.totalNumber}>{confirmed}</span>
                                <div
                                    className={styles.totalReasonRowsContainer}
                                    style={totalReasons.length === 3 ? { marginTop: "-30px" } : undefined}
                                >
                                    {totalReasonRows.length > 0 ? (
                                        totalReasonRows.map((row, rowIdx) => (
                                            <div key={rowIdx} className={styles.totalReasonRow}>
                                                {row.length === 1 ? (
                                                    <div className={`${styles.totalReasonCell} ${styles.single}`}>
                                                        <span className={styles.totalReasonText}>
                                                            {row[0].count} {row[0].label}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    row.map((item, i) => (
                                                        <div key={i} className={styles.totalReasonCell}>
                                                            <span className={styles.totalReasonText}>
                                                                {item.count} {item.label}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <span style={{ visibility: "hidden", display: "block", height: 28 }}>
                                            &nbsp;
                                        </span>
                                    )}
                                </div>
                                <img src={EqualsIcon} className={styles.equals} alt="equals" />
                            </div>
                        </div>
                        <img src={TotalArrowIcon} className={styles.totalArrow} />
                    </div>
                    <div className={styles.activeCaseRow}>
                        <div className={styles.verificationContainer}>
                            <SCRValidationCard
                                title={t("cirDashboard.scrValidation")}
                                number={displayCount}
                                active={displayCount !== 0 || hasHalf || otherSharpsTotal > 0}
                                numberContent={
                                    hasHalf ? (
                                        <div className={styles.numberContainer}>
                                            <span className={styles.cardNumberText}>{displayCount}</span>
                                            <div className={styles.verticalRectangle} />
                                            <div className={styles.halfIcon}>
                                                <img src={HalfIcon} alt="Half Icon" />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className={styles.cardNumberText}>{displayCount}</span>
                                    )
                                }
                            >
                                <div className={styles.otherSharpContainer} style={otherSharpsContainerStyle}>
                                    {rows.map((row, rowIdx) => (
                                        <div key={rowIdx} className={styles.otherSharpRow}>
                                            {row.map(([reason, count]) => (
                                                <div
                                                    key={reason}
                                                    className={styles.otherSharp}
                                                    style={{ flex: 1, textAlign: "center" }}
                                                >
                                                    <span className={styles.otherSharpText}>
                                                        {count}{" "}
                                                        {t(`scrDashboard.${reason}`, {
                                                            defaultValue: reason.replace(/^(.)/, (c) =>
                                                                c.toUpperCase(),
                                                            ),
                                                        })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </SCRValidationCard>
                            <SCRDefaultCard title={t("cirDashboard.cirVerification")} number={cirVerificationCount} />
                            <SCRDefaultCard title={t("cirDashboard.cirAdjudication")} number={cirAdjudicationCount} />
                            <SCRDefaultCard
                                title={t("cirDashboard.cirReAdjudication")}
                                number={cirReAdjudicationCount}
                            />
                        </div>
                        <TotalRemainingCard
                            title={t("cirDashboard.totalRemaining")}
                            remaining={remaining}
                            extraNeedleCount={interimAddedNeedles ?? 0}
                            variant="scr"
                        />
                    </div>
                </div>
                <div className={styles.scrControlContainer}>
                    {needleImageCaptured && lastImageState !== "blank" ? (
                        <div className={styles.scrImageContainer}>
                            <img
                                src={
                                    filename ? `http://localhost:8080/haystack_object_images/${filename}` : NeedleImage
                                }
                                className={styles.scrImage}
                                alt="SCR"
                            />
                            <div className={styles.scrImageInfoContainer}>
                                <span className={styles.scrImageInfoText}>
                                    {t("scrDashboard.image")}
                                    {imageNumber}
                                </span>
                                <span className={styles.scrImageTimeText}>{receivedTime}</span>
                            </div>
                        </div>
                    ) : lastImageState === "blank" ? (
                        <div className={styles.scrEmptyImageContainer}>
                            <img
                                src={BlankImageWarning}
                                alt="Blank Image"
                                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                            />
                        </div>
                    ) : (
                        <div className={styles.scrEmptyImageContainer}>
                            <img
                                src={HayStackNeedlePrompt}
                                alt="Prompt"
                                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                            />
                        </div>
                    )}
                    <div className={styles.scrCommandContainer}>
                        <span className={styles.scrCommandTitle}>{t("scrDashboard.haystackCommandInterface")}</span>
                        <div className={styles.haystackButtonContainer}>
                            <SCRHayStackButton
                                type="yes"
                                active={false}
                                circleClassName={styles.grayCircle}
                                imageClassName={styles.buttonIcons}
                            />
                            <SCRHayStackButton
                                type="validate"
                                active={scrValidationCount > 0}
                                title={scrValidationCount > 0 ? t("scrDashboard.validate") : undefined}
                                circleClassName={scrValidationCount > 0 ? styles.validateColor : styles.grayCircle}
                                imageClassName={styles.buttonIcons}
                                onClick={handleValidate}
                            />
                            <SCRHayStackButton
                                type="action"
                                active
                                title={t("scrDashboard.action")}
                                circleClassName={styles.actionColor}
                                imageClassName={styles.buttonIcons}
                                onClick={() => appContext.navigate({ path: "scrActionScreen" })}
                            />
                            <SCRHayStackButton
                                type="no"
                                active={false}
                                circleClassName={styles.grayCircle}
                                imageClassName={styles.buttonIcons}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
