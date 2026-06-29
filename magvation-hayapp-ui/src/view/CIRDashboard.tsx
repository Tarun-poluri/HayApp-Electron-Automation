import Sidebar from "../component/Sidebar";
import DashboardHeader from "../component/DashboardHeader";
import styles from "../viewcss/CIRDashboard.module.css";
import defaultCardStyles from "../component/DefaultCard.module.css";
import { useTranslation } from "react-i18next";
import { useContext, useEffect, useState } from "react";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import SubtractedRectangle from "../img/SubtractedRectangle.svg";
import TotalArrowIcon from "../img/TotalArrow.svg";
import CombinedSubtract from "../img/CombinedSubtract.svg";
import Minus from "../img/Minus.svg";
import HalfIcon from "../img/HalfIcon.svg";
import EqualsIcon from "../img/Equals.svg";
import DefaultCard from "../component/DefaultCard";
import AddedNeedlesCard from "../component/AddedNeedlesCard";
import CBIBoxCard from "../component/CBIBoxCard";
import VerificationCard from "../component/VerificationCard";
import CBINotificationButton from "../component/CBINotificationButton";
import type { CBIButtonType } from "../component/CBINotificationButton";
import { AnalyzeNeedleResult } from "../services/CaseService";
import { InterimCountConfirmModal } from "./subview/InterimCountConfirmModal";
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

export const CIRDashboard: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [interimConfirmOpen, setInterimConfirmOpen] = useState(false);
    const addedNeedles = useListenable(appContext.caseService.addedNeedleCount);
    const interimAddedNeedles = useListenable(appContext.caseService.interimAddedNeedleCount);
    const startingCount = useListenable(appContext.caseService.startingCount);

    const cirVerification = useListenable(appContext.caseService.cirVerification);
    const cirVerificationCount = cirVerification.length;

    const cirAdjudication = useListenable(appContext.caseService.cirAdjudication);
    const cirAdjudicationCount = cirAdjudication.length;
    const cirReAdjudication = useListenable(appContext.caseService.cirReAdjudication);
    const cirReAdjudicationCount = cirReAdjudication.length;
    const haystack = useListenable(appContext.caseService.haystack);

    const cbiNotifications = useListenable(appContext.caseService.cbiNotifications);
    const contaminated = useListenable(appContext.caseService.contaminatedNeedleCount);
    const incompatible = useListenable(appContext.caseService.incompatibleNeedleCount);
    const broken = useListenable(appContext.caseService.brokenNeedleCount);
    const misplaced = useListenable(appContext.caseService.misplaced);
    const wholeMisplaced = useListenable(appContext.caseService.wholeMisplaced);
    const foundNonSterileCount = useListenable(appContext.caseService.foundNonSterileCount);
    const totalScanned = startingCount + (addedNeedles ?? 0);
    const haystackReasonCounts = useListenable(appContext.caseService.haystackReasonCounts);
    const confirmed = useListenable(appContext.caseService.confirmed);
    const remaining = totalScanned - confirmed;
    const scrValidation = useListenable(appContext.caseService.scrValidation);
    const pendingCbiValidations = useListenable(appContext.caseService.pendingCbiValidations);
    const otherSharpsCounts = getOtherSharpsSummary(scrValidation);
    const scrValidationBrokenCount = scrValidation.filter(
        (needle) => needle.adjudication_reason && needle.adjudication_reason.toLowerCase() === "broken",
    ).length;
    const perRow = 2;

    const otherSharpEntries = Object.entries(otherSharpsCounts);
    const rows = splitIntoRows(otherSharpEntries, perRow);
    const otherSharpsCount = otherSharpEntries.length;
    const otherSharpsContainerStyle = otherSharpsCount >= 3 ? { marginTop: "-20px" } : undefined;
    const otherSharpsTotal = otherSharpEntries.reduce((sum, [, count]) => sum + count, 0);
    const brokenPairs = Math.floor(scrValidationBrokenCount / 2);
    const hasHalf = scrValidationBrokenCount % 2 === 1;
    const displayCount =
        scrValidation.length -
        scrValidationBrokenCount -
        otherSharpsTotal +
        brokenPairs +
        (pendingCbiValidations?.length ?? 0);

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirDashboard");
    }, [appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        if (interimConfirmOpen) {
            void appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirInterimCountConfirm");
        }
    }, [
        interimConfirmOpen,
        appContext.parlayWrapper.isConnected.value,
        appContext.caseService.parlayInterface.caseManager,
    ]);

    const handleAddNeedles = () => {
        appContext.navigate({ path: "cirAddedNeedles" });
    };

    const handleVerificationClick = () => {
        if (cirVerificationCount > 0) {
            appContext.navigate({ path: "cirVerification", args: { numCards: cirVerificationCount } });
        }
    };

    const handleAdjudicationClick = () => {
        appContext.navigate({ path: "cirAdjudication", args: { source: "cirAdjudication" } });
    };

    const handleReAdjudicationClick = () => {
        appContext.navigate({ path: "cirAdjudication", args: { source: "cirReAdjudication" } });
    };

    // Navigation handlers for CBI screens
    const handleCBINotificationClick = () => {
        appContext.navigate({ path: "cirCbiNeedles" });
    };

    const handleIncompatibleNotificationClick = () => {
        appContext.navigate({ path: "cirIncompatibleNeedles" });
    };

    const handleBrokenNotificationClick = () => {
        appContext.navigate({ path: "cirBrokenNeedles" });
    };

    const handleMisplacedNotificationClick = () => {
        appContext.navigate({ path: "cirMisplacedNeedles" });
    };

    const handleCaptureItemClick = () => {
        appContext.navigate({ path: "cirCbiSelectType", args: { needleType: "select" } });
    };

    const handleFoundNonSterileClick = () => {
        appContext.navigate({ path: "cirCbiSelectType", args: { needleType: "select", fromFoundNonSterile: true } });
    };

    // Notification entries for rendering notification buttons
    const notifications: Record<string, number> = {
        contaminated: cbiNotifications.contaminated,
        incompatible: cbiNotifications.incompatible,
        broken: cbiNotifications.broken,
        misplaced: cbiNotifications.misplaced,
    };

    const notificationEntries = Object.entries(notifications).filter(([, count]) => (count ?? 0) > 0);

    // Expand each type into N individual buttons so stacked notifications each appear separately
    const notificationButtons = notificationEntries.flatMap(([type, count]) =>
        Array.from({ length: count }, (_, i) => ({ type, index: i })),
    );

    const getNotificationHandler = (type: string) => {
        switch (type) {
            case "contaminated":
                return handleCBINotificationClick;
            case "incompatible":
                return handleIncompatibleNotificationClick;
            case "broken":
                return handleBrokenNotificationClick;
            case "misplaced":
                return handleMisplacedNotificationClick;
            default:
                return handleCBINotificationClick;
        }
    };

    const getMisplacedNumberContent = (number: number, wholeNumber: number) => {
        if (number <= 0 && wholeNumber <= 0)
            return <span className={`${styles.cardNumberText} ${styles.zeroValue}`}>0</span>;
        const divided = number / 2;
        const displayNumber = Math.floor(divided) + wholeNumber;
        const showHalf = divided % 1 === 0.5;
        if (displayNumber === 0 && showHalf) {
            return (
                <div className={styles.numberContainer}>
                    <div className={styles.halfIcon}>
                        <img src={HalfIcon} alt="Half Icon" />
                    </div>
                </div>
            );
        }
        return (
            <div className={styles.numberContainer}>
                <span
                    className={
                        displayNumber === 0 ? `${styles.cardNumberText} ${styles.zeroValue}` : styles.cardNumberText
                    }
                >
                    {displayNumber}
                </span>
                {displayNumber !== 0 && showHalf && <div className={styles.verticalRectangle} />}
                {showHalf && (
                    <div className={styles.halfIcon}>
                        <img src={HalfIcon} alt="Half Icon" />
                    </div>
                )}
            </div>
        );
    };

    const getHaystackNumberContent = (haystack: number, haystackReasonCounts: Record<string, number>) => {
        const brokenCount = haystackReasonCounts?.broken ?? 0;
        const value = haystack + Math.floor(brokenCount / 2);
        const isOdd = brokenCount % 2 === 1;

        if (value === 0 && isOdd) {
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
                <span className={value === 0 ? `${styles.cardNumberText} ${styles.zeroValue}` : styles.cardNumberText}>
                    {value}
                </span>
            );
        }
        return (
            <div className={styles.numberContainer}>
                <span className={value === 0 ? `${styles.cardNumberText} ${styles.zeroValue}` : styles.cardNumberText}>
                    {value}
                </span>
                <div className={styles.verticalRectangle} />
                <div className={styles.halfIcon}>
                    <img src={HalfIcon} alt="Half Icon" />
                </div>
            </div>
        );
    };

    return (
        <div className={styles.dashboardContainer}>
            {interimConfirmOpen && (
                <InterimCountConfirmModal
                    onNo={() => {
                        setInterimConfirmOpen(false);
                        if (appContext.parlayWrapper.isConnected.value) {
                            void appContext.caseService.parlayInterface.caseManager.set_current_cir_screen(
                                "cirDashboard",
                            );
                        }
                    }}
                    onYes={() => {
                        setInterimConfirmOpen(false);
                        if (appContext.parlayWrapper.isConnected.value) {
                            void appContext.caseService.parlayInterface.caseManager.set_current_cir_screen(
                                "cirInterimCountReasonSelect",
                            );
                        }
                        appContext.navigate({ path: "cirInterimCount", args: { interimSkipConfirm: true } });
                    }}
                />
            )}
            <Sidebar onInterimCountClick={() => setInterimConfirmOpen(true)} />
            <div className={styles.mainArea}>
                <DashboardHeader />
                <div className={styles.countArea}>
                    <div className={styles.activeCaseMainAreaContainer}>
                        <div className={styles.activeCaseRow}>
                            <DefaultCard title={t("cirDashboard.startCount")} number={startingCount} />
                            <div className={styles.subtractedRectangleContainer}>
                                <img src={SubtractedRectangle} alt="" />
                            </div>
                            <AddedNeedlesCard addedNeedles={addedNeedles} onAdd={handleAddNeedles} />
                            <div className={styles.overlayContainer}>
                                <img src={CombinedSubtract} className={styles.subtractSvg} />
                                <div className={styles.totalCard}>
                                    <span className={styles.totalTitle}>{t("cirDashboard.totalScanned")}</span>
                                    <span className={styles.totalNumber}>{totalScanned}</span>
                                    <img src={Minus} className={styles.minus} alt="minus" />
                                </div>
                            </div>
                            <img src={TotalArrowIcon} className={styles.totalArrow} />
                        </div>
                        <div className={styles.activeCaseRow}>
                            <CBIBoxCard
                                contaminated={contaminated}
                                incompatible={incompatible}
                                broken={broken}
                                onCaptureClick={handleCaptureItemClick}
                                onRemoveClick={() => appContext.navigate({ path: "removeFromCBI" })}
                            />
                            <div className={styles.subtractedRectangleContainer}>
                                <img src={SubtractedRectangle} alt="" />
                            </div>
                            <DefaultCard
                                title={t("cirDashboard.haystack")}
                                number={haystack}
                                numberContent={getHaystackNumberContent(haystack, haystackReasonCounts)}
                            />
                            <div className={styles.subtractedRectangleContainer}>
                                <img src={SubtractedRectangle} alt="" />
                            </div>
                            <DefaultCard
                                title={t("cirDashboard.misplaced")}
                                number={misplaced}
                                numberContent={getMisplacedNumberContent(misplaced, wholeMisplaced)}
                                className={misplaced > 0 || wholeMisplaced > 0 ? defaultCardStyles.activeMisplaced : ""}
                            />
                            <div className={styles.overlayContainer}>
                                <div className={styles.totalCard}>
                                    <span className={styles.totalTitle}>{t("cirDashboard.totalConfirmed")}</span>
                                    <span className={styles.totalNumber}>{confirmed}</span>
                                    <div className={styles.totalReasonContainer}>
                                        {["blade", "k-wire", "hypo"].map((reasonKey) => {
                                            const count = haystackReasonCounts[reasonKey] ?? 0;
                                            if (count > 0) {
                                                return (
                                                    <div
                                                        key={reasonKey}
                                                        className={styles.totalReason}
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                            textAlign: "center",
                                                        }}
                                                    >
                                                        <span className={styles.totalReasonText}>
                                                            {count} {t(`scrDashboard.${reasonKey}`)}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>
                                    <img src={EqualsIcon} className={styles.equals} alt="equals" />
                                </div>
                            </div>
                            <img src={TotalArrowIcon} className={styles.totalArrow} />
                        </div>
                        <div className={styles.activeCaseRow}>
                            <div className={styles.verificationContainer}>
                                <VerificationCard
                                    title={t("cirDashboard.cirVerification")}
                                    number={cirVerificationCount}
                                    active={cirVerificationCount !== 0}
                                    buttonText={t("cirDashboard.verify")}
                                    variant="verification"
                                    onClick={handleVerificationClick}
                                />
                                <VerificationCard
                                    title={t("cirDashboard.cirAdjudication")}
                                    number={cirAdjudicationCount}
                                    active={cirAdjudicationCount !== 0}
                                    buttonText={t("cirDashboard.adjudicate")}
                                    variant="adjudication"
                                    onClick={handleAdjudicationClick}
                                />
                                <VerificationCard
                                    title={t("cirDashboard.cirReAdjudication")}
                                    number={cirReAdjudicationCount}
                                    active={cirReAdjudicationCount !== 0}
                                    buttonText={t("cirDashboard.reAdjudicate")}
                                    variant="readjudication"
                                    onClick={handleReAdjudicationClick}
                                />
                                <DefaultCard
                                    title={t("cirDashboard.scrValidation")}
                                    number={displayCount}
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
                                    <div className={styles.otherSharpsContainer} style={otherSharpsContainerStyle}>
                                        {rows.map((row, rowIdx) => (
                                            <div key={rowIdx} className={styles.otherSharpsRow}>
                                                {row.map(([reason, count]) => (
                                                    <div
                                                        key={reason}
                                                        className={styles.otherSharps}
                                                        style={{ flex: 1, textAlign: "center" }}
                                                    >
                                                        <span className={styles.otherSharpsText}>
                                                            {count}{" "}
                                                            {t(`cirDashboard.${reason}`, {
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
                                </DefaultCard>
                            </div>
                            <TotalRemainingCard
                                title={t("cirDashboard.totalRemaining")}
                                remaining={remaining}
                                extraNeedleCount={interimAddedNeedles ?? 0}
                                variant="cir"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.dashboardNotificationContainer}>
                {notificationButtons.map(({ type, index }) => (
                    <CBINotificationButton
                        key={`${type}-${index}`}
                        type={type as CBIButtonType}
                        onClick={getNotificationHandler(type)}
                    />
                ))}
                {Array.from({ length: foundNonSterileCount ?? 0 }, (_, i) => (
                    <CBINotificationButton
                        key={`foundNonSterile-${i}`}
                        type="foundNonSterile"
                        onClick={handleFoundNonSterileClick}
                    />
                ))}
            </div>
        </div>
    );
};
