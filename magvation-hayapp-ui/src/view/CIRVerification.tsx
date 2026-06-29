import React, { useRef, useState, useContext, useEffect } from "react";
import { AppContext } from "./App";
import styles from "../viewcss/CIRVerification.module.css";
import { VerificationScrollbar } from "../component/VerificationScroller";
import { CIRVerificationCard } from "../component/CIRVerificationCard";
import ModalHeader from "../component/ModalHeader";
import LeftArrow from "../img/LeftArrow.svg";
import GreenDone from "../img/GreenDone.svg";
import RedClose from "../img/RedClose.svg";
import RedCloseNoBg from "../img/RedCloseNoBg.svg";
import GreenDoneNoBg from "../img/GreenDoneNoBg.svg";
import NeedleImage from "../img/NeedleImage.png";
import { useTranslation } from "react-i18next";
import { useListenable } from "../util/Listenable";
import { ConfirmationPopup } from "../component/ConfirmationPopup";

interface CIRVerificationProps {
    numCards?: number;
}

const EnlargedCIRVerification: React.FC<{
    indices: number[];
    progress: number;
    onConfirm: (value: "yes" | "no") => void;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: any[];
    totalNeedles?: number;
    selection?: "yes" | "no";
}> = ({ indices, progress, onConfirm, onClose, results, totalNeedles, selection }) => {
    const { t } = useTranslation();
    const currentIdx = indices[progress];
    const [showOverlay, setShowOverlay] = useState(false);
    const result = results[currentIdx]?.results?.[0] ?? {};
    const filename = result.image_filename_used?.split(/[/\\]/).pop();
    const imageNumber = results[currentIdx]?.image_number;
    const receivedTime = results[currentIdx]?.received_time;

    let imageUrl: string;
    if (filename) {
        imageUrl = showOverlay
            ? `http://localhost:8080/haystack_object_images/${filename}-out.png`
            : `http://localhost:8080/haystack_object_images/${filename}`;
    } else {
        imageUrl = NeedleImage;
    }

    const needleCount = totalNeedles ?? 0;

    return (
        <div className={styles.enlargedCIRVerification}>
            <div className={styles.backgroundBlur}>
                <div className={styles.progressBarContainer}>
                    {Array.from({ length: needleCount }).map((_, idx) => {
                        const isFilled = idx <= currentIdx;
                        const nextIsFilled = idx + 1 <= currentIdx;
                        const marginRight = idx === needleCount - 1 ? 0 : isFilled && nextIsFilled ? 0 : 4;
                        return (
                            <div
                                key={idx}
                                className={isFilled ? styles.progressBarSectionActive : styles.progressBarSection}
                                style={{ marginRight }}
                            />
                        );
                    })}
                </div>
                <ModalHeader
                    title={t("cirVerification.reviewImage")}
                    onBack={onClose}
                    backIcon={LeftArrow}
                    hideClose
                    hideHelpDivider
                    helpText={t("cirVerification.help")}
                >
                    <div className={styles.itemChip}>
                        <span className={styles.itemChipText}>
                            {currentIdx + 1}/{needleCount}
                        </span>
                    </div>
                </ModalHeader>
                <div className={styles.enlargedContentContainer}>
                    <div className={styles.enlargedImageContainer}>
                        <img src={imageUrl} alt="Needle" className={styles.enlargedImage} loading="lazy" />
                        <div className={styles.enlargedImageTextContainer}>
                            <button
                                className={showOverlay ? styles.overlayButtonHide : styles.overlayButton}
                                onClick={() => setShowOverlay((s) => !s)}
                            >
                                <span className={showOverlay ? styles.overlayButtonHideText : styles.overlayButtonText}>
                                    {showOverlay ? t("cirVerification.hideOverlay") : t("cirVerification.showOverlay")}
                                </span>
                            </button>
                            <div className={styles.imageInfoTextContainer}>
                                <span className={styles.imageInfoText}>
                                    {t("cirVerification.imageNumber")}
                                    {imageNumber}
                                </span>
                                <span className={styles.imageInfoText}>{receivedTime}</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.needleInfoContainer}>
                        <div className={styles.needleInfoContentContainer}>
                            <span className={styles.detailsText}>{t("cirVerification.details")}</span>
                            <div className={styles.needleInfoContent}>
                                <div className={styles.needleInfoTable}>
                                    <div className={styles.needleInfoRow}>
                                        <span className={styles.needleInfoRowTitle}>{t("cirVerification.image")}</span>
                                        <span className={styles.needleInfoRowValue}>#{imageNumber}</span>
                                    </div>
                                    <div className={styles.needleInfoTableDivider} />
                                    <div className={styles.needleInfoRow}>
                                        <span className={styles.needleInfoRowTitle}>
                                            {t("cirVerification.needleLength")}
                                        </span>
                                        <span className={styles.needleInfoRowValue}>
                                            {result.needle_length_mm != null
                                                ? result.needle_length_mm.toFixed(2) + " mm"
                                                : "-"}
                                        </span>
                                    </div>
                                    <div className={styles.needleInfoTableDivider} />
                                    <div className={styles.needleInfoRow}>
                                        <span className={styles.needleInfoRowTitle}>
                                            {t("cirVerification.chordLength")}
                                        </span>
                                        <span className={styles.needleInfoRowValue}>
                                            {result.needle_point_to_tail_chord_length_mm != null
                                                ? result.needle_point_to_tail_chord_length_mm.toFixed(2) + " mm"
                                                : "-"}
                                        </span>
                                    </div>
                                    <div className={styles.needleInfoTableDivider} />
                                    <div className={styles.needleInfoRow}>
                                        <span className={styles.needleInfoRowTitle}>{t("cirVerification.arc")}</span>
                                        <span className={styles.needleInfoRowValue}>
                                            {result.needle_arc_length_px !== null
                                                ? `${(result.needle_arc_length_px / 55).toFixed(2)} mm`
                                                : "#"}
                                        </span>
                                    </div>
                                    <div className={styles.needleInfoTableDivider} />
                                    <div className={styles.needleInfoRow}>
                                        <span className={styles.needleInfoRowTitle}>{t("cirVerification.lit")}</span>
                                        <span className={styles.needleInfoRowValue}>{receivedTime || ""}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.needleInfoButtonContainer}>
                                <button
                                    className={[
                                        styles.needleInfoNoButton,
                                        selection === "no" ? styles.selected : "",
                                        selection === "no" ? styles.selectedNo : "",
                                    ].join(" ")}
                                    onClick={() => onConfirm("no")}
                                >
                                    <span
                                        className={[
                                            styles.needleInfoNoText,
                                            selection === "no" ? styles.selectedButtonText : "",
                                        ].join(" ")}
                                    >
                                        {t("cirVerification.notOneCompleteNeedle")}
                                    </span>
                                    <img
                                        className={styles.enlargedIcon}
                                        src={RedCloseNoBg}
                                        alt="Not One Complete Needle"
                                    />
                                </button>
                                <button
                                    className={[
                                        styles.needleInfoYesButton,
                                        selection === "yes" ? styles.selected : "",
                                        selection === "yes" ? styles.selectedYes : "",
                                    ].join(" ")}
                                    onClick={() => onConfirm("yes")}
                                >
                                    <span
                                        className={[
                                            styles.needleInfoYesText,
                                            selection === "yes" ? styles.selectedButtonText : "",
                                        ].join(" ")}
                                    >
                                        {t("cirVerification.oneCompleteNeedle")}
                                    </span>
                                    <img
                                        className={styles.enlargedIcon}
                                        src={GreenDoneNoBg}
                                        alt="One Complete Needle"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CIRVerification: React.FC<CIRVerificationProps> = () => {
    const contentRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [showWarning, setShowWarning] = useState(false);

    const cirVerificationResults = useListenable(appContext.caseService.cirVerification);
    const numCards = cirVerificationResults.length;

    const [activeIndex, setActiveIndex] = useState(0);
    const [activatedIndices, setActivatedIndices] = useState<Set<number>>(new Set([0]));
    const [showEnlarged, setShowEnlarged] = useState(false);
    const [enlargedIndices, setEnlargedIndices] = useState<number[]>([]);
    const [enlargedProgress, setEnlargedProgress] = useState(0);
    const [cardSelections, setCardSelections] = useState<Record<number, "yes" | "no" | undefined>>({});
    const completeNeedles = Object.values(cardSelections).filter((v) => v === "yes").length;
    const notCompleteNeedles = Object.values(cardSelections).filter((v) => v === "no").length;

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirVerification");
    }, [appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    const handleReviewImageClick = (idx: number) => {
        setEnlargedIndices([idx]);
        setEnlargedProgress(0);
        setShowEnlarged(true);
    };
    const handleEnlargedConfirm = (value: "yes" | "no") => {
        const idx = enlargedIndices[enlargedProgress];
        setCardSelections((prev) => ({ ...prev, [idx]: value }));
        setActivatedIndices((prev) => {
            const newSet = new Set(prev);
            newSet.add(idx + 1);
            return newSet;
        });
        setActiveIndex(idx + 1 < numCards ? idx + 1 : idx);
        if (enlargedProgress < enlargedIndices.length - 1) {
            setEnlargedProgress(enlargedProgress + 1);
        } else {
            setShowEnlarged(false);
        }
    };
    const handleCardAction = (index: number, value: "yes" | "no") => {
        setCardSelections((prev) => ({ ...prev, [index]: value }));
        setActivatedIndices((prev) => {
            const newSet = new Set(prev);
            newSet.add(index + 1);
            return newSet;
        });
        setActiveIndex((prev) => Math.min(prev + 1, numCards - 1));
    };

    const handleBackClick = () => {
        setShowWarning(true);
    };

    const handleWarningConfirm = () => {
        setShowWarning(false);
        appContext.navigate({ path: "cirDashboard" });
    };

    const handleWarningCancel = () => {
        setShowWarning(false);
    };

    const handleConfirm = async () => {
        const completeNeedleIds: string[] = [];
        const notCompleteNeedleIds: string[] = [];

        cirVerificationResults.forEach((result, idx) => {
            const id = result?.id;
            const selection = cardSelections[idx];
            if (selection === "yes" && id) {
                completeNeedleIds.push(id);
            } else if (selection === "no" && id) {
                notCompleteNeedleIds.push(id);
            }
        });

        await appContext.caseService.parlayInterface.caseManager.cir_verified_needles(
            completeNeedleIds,
            notCompleteNeedleIds,
        );

        appContext.navigate({
            path: "cirDashboard",
            args: {
                completeNeedles: completeNeedleIds.length,
                notCompleteNeedles: notCompleteNeedleIds.length,
            },
        });
    };

    const anyReviewed = Object.values(cardSelections).some((v) => v !== undefined);

    return (
        <div className={styles.verificationContainer}>
            <div className={styles.backgroundBlur}>
                <div className={styles.progressBarContainer}>
                    {Array.from({ length: numCards }).map((_, idx) => {
                        const isFilled = idx < Object.keys(cardSelections).length && cardSelections[idx] !== undefined;
                        const nextIsFilled =
                            idx + 1 < Object.keys(cardSelections).length && cardSelections[idx + 1] !== undefined;
                        const marginRight = idx === numCards - 1 ? 0 : isFilled && nextIsFilled ? 0 : 4;
                        return (
                            <div
                                key={idx}
                                className={isFilled ? styles.progressBarSectionActive : styles.progressBarSection}
                                style={{ marginRight }}
                            />
                        );
                    })}
                </div>
                <ModalHeader
                    title={t("cirVerification.verification")}
                    onBack={handleBackClick}
                    backIcon={LeftArrow}
                    hideClose
                    hideHelpDivider
                    helpText={t("cirVerification.help")}
                >
                    <div className={styles.itemChip}>
                        <span className={styles.itemChipText}>
                            {numCards} {t("cirVerification.items")}
                        </span>
                    </div>
                </ModalHeader>

                <main className={styles.mainArea}>
                    <section className={styles.leftArea}>
                        <div className={styles.cardScroll} ref={contentRef}>
                            <div className={styles.cardGrid}>
                                {cirVerificationResults.map((result, i) => {
                                    const isActive = activatedIndices.has(i);
                                    const selection = cardSelections[i];
                                    const yesSelected = selection === "yes";
                                    const noSelected = selection === "no";
                                    const reviewed = selection === "yes" || selection === "no";
                                    const gridResult = cirVerificationResults[i]?.results?.[0] ?? {};
                                    const time = cirVerificationResults[i]?.received_time;
                                    const imageNumber = cirVerificationResults[i]?.image_number;
                                    const gridFilename = gridResult.image_filename_used?.split(/[/\\]/).pop();
                                    const gridImageUrl = gridFilename
                                        ? `http://localhost:8080/haystack_object_images/${gridFilename}`
                                        : NeedleImage;
                                    return (
                                        <CIRVerificationCard
                                            key={i}
                                            isActive={isActive}
                                            reviewed={reviewed}
                                            yesSelected={yesSelected}
                                            noSelected={noSelected}
                                            gridImageUrl={gridImageUrl}
                                            i={i}
                                            handleReviewImageClick={() => handleReviewImageClick(i)}
                                            handleCardAction={handleCardAction}
                                            activeIndex={activeIndex}
                                            imageNumber={imageNumber}
                                            time={time}
                                            styles={styles}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <aside className={styles.scrollbarArea}>
                        <VerificationScrollbar
                            scrollContentRef={contentRef as React.RefObject<HTMLDivElement>}
                            height="68.33vh"
                        />
                    </aside>
                </main>

                <footer className={styles.footerContainer}>
                    <div className={styles.footerContentContainer}>
                        <div className={styles.footerCountContainer}>
                            <div className={styles.footerInnerCountContainer}>
                                <div className={styles.footerCountSection}>
                                    <div className={styles.confirmedIcon}>
                                        <img src={GreenDone} alt="Confirmed" />
                                    </div>
                                    <span className={styles.countNumber}>{completeNeedles}</span>
                                    <span className={styles.countLabel}>{t("cirVerification.completeNeedle")}</span>
                                </div>
                                <div className={styles.verticalRectangle} />
                                <div className={styles.footerCountSection}>
                                    <div className={styles.confirmedIcon}>
                                        <img src={RedClose} alt="NotConfirmed" />
                                    </div>
                                    <span className={styles.countNumber}>{notCompleteNeedles}</span>
                                    <span className={styles.countLabel}>{t("cirVerification.notCompleteNeedle")}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            className={`${styles.confirmButton} ${!anyReviewed ? styles.confirmButtonDisabled : ""}`}
                            onClick={handleConfirm}
                            disabled={!anyReviewed}
                        >
                            <span className={styles.confirmButtonText}>{t("cirVerification.confirm")}</span>
                        </button>
                    </div>
                </footer>
                <ConfirmationPopup
                    isOpen={showWarning}
                    onClose={handleWarningCancel}
                    onConfirm={handleWarningConfirm}
                    message={t("cirVerification.warningMessage")}
                    confirmText={t("cirVerification.leave")}
                    cancelText={t("cirVerification.stay")}
                />
                {showEnlarged && (
                    <EnlargedCIRVerification
                        indices={enlargedIndices}
                        progress={enlargedProgress}
                        onConfirm={handleEnlargedConfirm}
                        onClose={() => setShowEnlarged(false)}
                        results={cirVerificationResults}
                        totalNeedles={numCards}
                        selection={cardSelections[enlargedIndices[enlargedProgress]]}
                    />
                )}
            </div>
        </div>
    );
};
