import styles from "../viewcss/SCRValidation.module.css";
import { useTranslation, Trans } from "react-i18next";
import ModalHeader from "../component/ModalHeader";
import NeedleImage from "../img/NeedleImage.png";
import SCRHayStackButton from "../component/SCRHayStackButton";
import { useContext, useState, useEffect, useRef } from "react";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import { AnalyzeNeedleResult, PendingCBIValidation } from "../services/CaseService";
import { ScreenState } from "../defs/enums";
import ContaminatedNeedleMarkerImage from "../img/GreenTriangularMarker.svg";
import BrokenNeedleMarkerImage from "../img/BrokenNeedleMarker.svg";
import IncompatibleNeedleMarkerImage from "../img/IncompatibleNeedleMarker.svg";

const reasonPromptMap: Record<string, string> = {
    "": "scrValidation.oneCompletePrompt",
    contaminated: "scrValidation.oneCompletePrompt",
    broken: "scrValidation.brokenPrompt",
    blade: "scrValidation.bladePrompt",
    other: "scrValidation.otherPrompt",
    multiple: "scrValidation.multiplePrompt",
    "k-wire": "scrValidation.kwirePrompt",
    hypo: "scrValidation.hypoPrompt",
};

type SCRValidationResult = {
    id: string;
    reason: string;
    validation: "yes" | "no";
    hasOtherPiece?: boolean;
};

type NormalizedValidationItem = {
    id: string;
    imageSrc: string;
    reason: string;
    receivedTime?: string;
    imageNumber?: string | number;
    type?: string;
    count?: number;
    source: "scr" | "cbi";
    hasOtherPiece?: boolean;
    otherCustomInput?: string;
    markers?: Array<{ x: number; y: number; number: number; type: string }>;
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
    // cbi_removed fields
    isRemovedCbi?: boolean;
    previousImageSrc?: string;
    previousMarkers?: Array<{ x: number; y: number; number: number; type: string }>;
    previousImageNaturalWidth?: number;
    previousImageNaturalHeight?: number;
    previousReceivedTime?: string;
    previousImageNumber?: number;
};

function getMarkerImage(type: string) {
    if (type === "incompatible") return IncompatibleNeedleMarkerImage;
    if (type === "broken") return BrokenNeedleMarkerImage;
    return ContaminatedNeedleMarkerImage;
}

function normalizeValidationItems(
    scrValidation: AnalyzeNeedleResult[],
    pendingCbiValidations: PendingCBIValidation[],
): NormalizedValidationItem[] {
    const scrItems: NormalizedValidationItem[] = (scrValidation ?? []).map((item) => {
        const imageFilename = item?.results?.[0]?.image_filename_used?.split(/[/\\]/).pop();
        return {
            id: item?.id,
            imageSrc: imageFilename ? `http://localhost:8080/haystack_object_images/${imageFilename}` : NeedleImage,
            reason: (item?.adjudication_reason || "").toLowerCase(),
            receivedTime: item?.received_time,
            imageNumber: item?.image_number,
            count: item?.adjudicated_needle_count ?? item?.needle_count,
            source: "scr" as const,
            hasOtherPiece: item?.hasOtherPiece ?? false,
            otherCustomInput: item?.other_custom_input ?? "",
        };
    });

    // Only include CBI items that have been CIR confirmed (dual confirmation flow).
    // Re-adjudicated items (source === "cbi_re_adjudication") are implicitly CIR-confirmed
    // since CIR already re-counted the needles before sending them back for SCR validation.
    // Exclude cbi_removed items — those are handled separately below.
    const cbiItems: NormalizedValidationItem[] = (pendingCbiValidations ?? [])
        .filter(
            (item) =>
                (item.cir_confirmed === true || item.source === "cbi_re_adjudication") && item.source !== "cbi_removed",
        )
        .map((item) => ({
            id: item.id,
            imageSrc: item.image_filename
                ? `http://localhost:8080/hayscan_cbi_images/${item.image_filename}`
                : NeedleImage,
            reason: item.type || "",
            receivedTime: item.received_time,
            imageNumber: item.image_number,
            type: item.type,
            count: item.count,
            source: "cbi" as const,
            markers: item.markers || [],
            imageNaturalWidth: item.imageNaturalWidth || 900,
            imageNaturalHeight: item.imageNaturalHeight || 875,
        }));

    const cbiRemovedItems: NormalizedValidationItem[] = (pendingCbiValidations ?? [])
        .filter((item) => item.source === "cbi_removed")
        .map((item) => ({
            id: item.id,
            imageSrc: item.image_filename
                ? `http://localhost:8080/hayscan_cbi_images/${item.image_filename}`
                : NeedleImage,
            reason: item.type || "",
            receivedTime: item.received_time,
            imageNumber: item.image_number,
            type: item.type,
            count: item.count,
            source: "cbi" as const,
            markers: item.markers || [],
            imageNaturalWidth: item.imageNaturalWidth || 900,
            imageNaturalHeight: item.imageNaturalHeight || 875,
            isRemovedCbi: true,
            previousImageSrc: item.previous_image_filename
                ? `http://localhost:8080/hayscan_cbi_images/${item.previous_image_filename}`
                : undefined,
            previousMarkers: item.previous_markers || [],
            previousImageNaturalWidth: item.previousImageNaturalWidth || 900,
            previousImageNaturalHeight: item.previousImageNaturalHeight || 875,
            previousReceivedTime: item.previous_received_time,
            previousImageNumber: item.previous_image_number,
        }));

    return [...scrItems, ...cbiItems, ...cbiRemovedItems];
}

function getPromptKeyAndCount(item: NormalizedValidationItem): { key: string; count?: number; customText?: string } {
    if (item.source === "cbi") {
        if (item.reason === "broken") {
            return {
                key: "scrValidation.cbiBrokenPrompt",
                count: item.count,
            };
        }
        if (item.reason === "contaminated") {
            return {
                key: "scrValidation.contaminatedPrompt",
                count: item.count,
            };
        }
        if (item.reason === "incompatible") {
            return {
                key: "scrValidation.incompatiblePrompt",
                count: item.count,
            };
        }
    }
    if (item.reason === "other") {
        return {
            key: "scrValidation.otherPrompt",
            customText: item.otherCustomInput || "hair",
        };
    }
    const fallbackKey = reasonPromptMap[item.reason] || "scrValidation.oneCompletePrompt";
    return { key: fallbackKey, count: item.count };
}

export const SCRValidation: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    const scrValidation = useListenable(appContext.caseService.scrValidation);
    const pendingCbiValidations = useListenable(appContext.caseService.pendingCbiValidations);
    const validationItems = normalizeValidationItems(scrValidation, pendingCbiValidations);

    const isClosingCount = appContext.caseService.isClosingCountValidation.value;
    const isInterimCount = appContext.caseService.isInterimCountValidation.value;
    const exitPath = isClosingCount ? "scrClosingCount" : isInterimCount ? "scrInterimCount" : "scrDashboard";

    const [currentIndex, setCurrentIndex] = useState(0);
    const [results, setResults] = useState<SCRValidationResult[]>([]);
    const [cbiResults, setCbiResults] = useState<{ id: string; confirmed: boolean }[]>([]);
    const [showMarkers, setShowMarkers] = useState(true);
    const [closingCountStepIdx, setClosingCountStepIdx] = useState(0);
    const [showReviewCbiRemoved, setShowReviewCbiRemoved] = useState(false);
    const isProcessingRef = useRef(false);

    // For closing/interim count: split items into sequential steps (SCR → contaminated → broken → incompatible)
    let activeItems: NormalizedValidationItem[];
    let totalClosingSteps = 0;
    if (isClosingCount || isInterimCount) {
        const steps: NormalizedValidationItem[][] = [];
        const scrOnly = validationItems.filter((i) => i.source === "scr");
        if (scrOnly.length > 0) steps.push(scrOnly);
        const contaminated = validationItems.filter((i) => i.source === "cbi" && i.reason === "contaminated");
        if (contaminated.length > 0) steps.push(contaminated);
        const broken = validationItems.filter((i) => i.source === "cbi" && i.reason === "broken");
        if (broken.length > 0) steps.push(broken);
        const incompatible = validationItems.filter((i) => i.source === "cbi" && i.reason === "incompatible");
        if (incompatible.length > 0) steps.push(incompatible);
        totalClosingSteps = steps.length;
        activeItems = steps[closingCountStepIdx] ?? [];
    } else {
        activeItems = validationItems;
    }

    useEffect(() => {
        setShowMarkers(true);
        setShowReviewCbiRemoved(false);
    }, [currentIndex, closingCountStepIdx]);

    if (!activeItems.length || currentIndex >= activeItems.length) {
        appContext.navigate({ path: exitPath });
        return null;
    }

    const currentItem = activeItems[currentIndex];
    const markers = currentItem.markers || [];
    const hasMarkers = currentItem.source === "cbi" && markers.length > 0;

    const { key: promptKey, count: promptCount, customText: promptCustomText } = getPromptKeyAndCount(currentItem);

    const isCbiPrompt =
        promptKey === "scrValidation.contaminatedPrompt" ||
        promptKey === "scrValidation.incompatiblePrompt" ||
        promptKey === "scrValidation.cbiBrokenPrompt";

    let prompt: string | React.ReactNode = "";
    if (isCbiPrompt) {
        const base = promptCount === 1 ? promptKey : `${promptKey}Plural`;
        const count = promptCount ?? 0;
        const highlightColor =
            promptKey === "scrValidation.contaminatedPrompt"
                ? "rgba(158, 242, 187, 1)"
                : promptKey === "scrValidation.cbiBrokenPrompt"
                  ? "rgba(253, 215, 142, 1)"
                  : "rgba(158, 225, 254, 1)";
        prompt = (
            <>
                {t(`${base}Prefix`)}
                <span style={{ color: highlightColor }}>{t(`${base}Highlight`, { count })}</span>
                {t(`${base}Suffix`)}
            </>
        );
    } else if (promptKey === "scrValidation.otherPrompt") {
        prompt = t(promptKey, { customText: promptCustomText || "hair" });
    } else {
        prompt = t(promptKey, { count: promptCount });
    }
    const imageSrc = currentItem.imageSrc || NeedleImage;
    const receivedTime = currentItem.receivedTime || "";
    const imageNumber = currentItem.imageNumber ?? "";

    useEffect(() => {
        const screen =
            currentItem?.isRemovedCbi && !showReviewCbiRemoved
                ? ScreenState.SCR_VALIDATION_REMOVED_PROMPT
                : ScreenState.SCR_VALIDATION;
        appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(screen);
    }, [appContext.caseService.parlayInterface.caseManager, currentItem?.isRemovedCbi, showReviewCbiRemoved]);

    useEffect(() => {
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            switch (event.button) {
                case "yes":
                    if (currentItem.isRemovedCbi && !showReviewCbiRemoved) {
                        setShowReviewCbiRemoved(true);
                    } else {
                        handleValidate("yes");
                    }
                    break;
                case "no":
                    handleValidate("no");
                    break;
                case "validate":
                    break;
                case "take_action":
                    if (!(isClosingCount || isInterimCount)) handleDashboard();
                    break;
                default:
                    break;
            }
        };
        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [
        appContext.caseService.parlayInterface.hayStack,
        results,
        cbiResults,
        currentIndex,
        validationItems,
        closingCountStepIdx,
    ]);

    const sendResultsAndExit = async (
        finalResults: SCRValidationResult[],
        finalCbiResults: { id: string; confirmed: boolean }[],
    ) => {
        if (finalResults.length > 0) {
            await appContext.caseService.parlayInterface.caseManager.scr_validated_needles(finalResults);
        }
        if (finalCbiResults.length > 0) {
            const confirmedIds = finalCbiResults.filter((r) => r.confirmed).map((r) => r.id);
            const notConfirmedIds = finalCbiResults.filter((r) => !r.confirmed).map((r) => r.id);
            if (confirmedIds.length > 0) {
                await appContext.caseService.parlayInterface.caseManager.cbi_needles_confirmed(confirmedIds, true);
            }
            if (notConfirmedIds.length > 0) {
                await appContext.caseService.parlayInterface.caseManager.cbi_needles_confirmed(notConfirmedIds, false);
            }
        }
        appContext.navigate({ path: exitPath });
    };

    const handleValidate = async (validation: "yes" | "no") => {
        if (isProcessingRef.current) return;

        if (currentItem.isRemovedCbi && validation === "no") {
            const isLastInStep = currentIndex >= activeItems.length - 1;
            const isLastStep = !(isClosingCount || isInterimCount) || closingCountStepIdx >= totalClosingSteps - 1;
            if (!showReviewCbiRemoved) {
                // Initial prompt "No": the removal is being dismissed entirely
                isProcessingRef.current = true;
                await appContext.caseService.parlayInterface.caseManager.cbi_removed_dismissed(currentItem.id);
                isProcessingRef.current = false;
                if (!isLastInStep) {
                    setCurrentIndex(currentIndex + 1);
                } else if (!isLastStep) {
                    setClosingCountStepIdx(closingCountStepIdx + 1);
                    setCurrentIndex(0);
                } else {
                    await sendResultsAndExit(results, cbiResults);
                }
            } else {
                // Review screen "No": SCR disputes the count — send back to CIR for re-adjudication
                const newCbiResults = [...cbiResults, { id: currentItem.id, confirmed: false }];
                if (!isLastInStep) {
                    setCbiResults(newCbiResults);
                    setCurrentIndex(currentIndex + 1);
                } else if (!isLastStep) {
                    setCbiResults(newCbiResults);
                    setClosingCountStepIdx(closingCountStepIdx + 1);
                    setCurrentIndex(0);
                } else {
                    isProcessingRef.current = true;
                    await sendResultsAndExit(results, newCbiResults);
                }
            }
            return;
        }

        const isLastInStep = currentIndex >= activeItems.length - 1;
        const isLastStep = !(isClosingCount || isInterimCount) || closingCountStepIdx >= totalClosingSteps - 1;

        if (currentItem.source === "cbi") {
            const confirmed = validation === "yes";
            const newCbiResults = [...cbiResults, { id: currentItem.id, confirmed }];
            if (!isLastInStep) {
                setCbiResults(newCbiResults);
                setCurrentIndex(currentIndex + 1);
            } else if (!isLastStep) {
                setCbiResults(newCbiResults);
                setClosingCountStepIdx(closingCountStepIdx + 1);
                setCurrentIndex(0);
            } else {
                isProcessingRef.current = true;
                await sendResultsAndExit(results, newCbiResults);
            }
        } else {
            const newResults = [
                ...results,
                {
                    id: currentItem.id,
                    reason: currentItem.reason,
                    validation,
                    hasOtherPiece: currentItem.reason === "broken" ? currentItem.hasOtherPiece : undefined,
                },
            ];
            if (!isLastInStep) {
                setResults(newResults);
                setCurrentIndex(currentIndex + 1);
            } else if (!isLastStep) {
                setResults(newResults);
                setClosingCountStepIdx(closingCountStepIdx + 1);
                setCurrentIndex(0);
            } else {
                isProcessingRef.current = true;
                await sendResultsAndExit(newResults, cbiResults);
            }
        }
    };

    const handleDashboard = async () => {
        if (isClosingCount || isInterimCount) return;
        if (results.length > 0) {
            await appContext.caseService.parlayInterface.caseManager.scr_validated_needles(results);
        }
        if (cbiResults.length > 0) {
            const confirmedIds = cbiResults.filter((r) => r.confirmed).map((r) => r.id);
            const notConfirmedIds = cbiResults.filter((r) => !r.confirmed).map((r) => r.id);
            if (confirmedIds.length > 0) {
                await appContext.caseService.parlayInterface.caseManager.cbi_needles_confirmed(confirmedIds, true);
            }
            if (notConfirmedIds.length > 0) {
                await appContext.caseService.parlayInterface.caseManager.cbi_needles_confirmed(notConfirmedIds, false);
            }
        }
        appContext.navigate({ path: exitPath });
    };

    const removedCbi = (item: NormalizedValidationItem) => {
        const removedTypeNames: Record<string, string> = {
            contaminated: t("scrValidation.contaminated"),
            broken: t("scrValidation.broken"),
            incompatible: t("scrValidation.incompatible"),
        };
        const removedLocalizedType = removedTypeNames[item.type ?? item.reason ?? ""] ?? item.type ?? item.reason;
        return (
            <div className={styles.removedCbiPromptContainer}>
                <div className={styles.removedCbiPromptContent}>
                    <span className={styles.promptText}>
                        {t("scrValidation.removedCbi", { type: removedLocalizedType })}
                    </span>
                    <div className={styles.removedCbiHaystackButtonContainer}>
                        <SCRHayStackButton
                            type="yes"
                            active
                            title={t("scrValidation.yes")}
                            circleClassName={styles.yesColor}
                            textClassName={styles.buttonText}
                            imageClassName={styles.haystackButtonIcon}
                            onClick={() => setShowReviewCbiRemoved(true)}
                        />
                        <SCRHayStackButton
                            type="validate"
                            circleClassName={styles.grayCircle}
                            textClassName={styles.buttonText}
                            imageClassName={styles.haystackButtonIcon}
                        />
                        <SCRHayStackButton
                            type="action"
                            active
                            title={t("scrValidation.dashboard")}
                            circleClassName={styles.actionColor}
                            textClassName={styles.buttonText}
                            imageClassName={styles.haystackButtonIcon}
                            onClick={handleDashboard}
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
        );
    };

    const reviewCbiRemoved = (item: NormalizedValidationItem) => {
        const newMarkersCount = item.markers?.length ?? 0;
        const itemType = item.type ?? item.reason ?? "";
        const isBroken = itemType === "broken";

        const reviewTypeNames: Record<string, string> = {
            contaminated: t("scrValidation.contaminated"),
            broken: t("scrValidation.broken"),
            incompatible: t("scrValidation.incompatible"),
        };
        const localizedType = (reviewTypeNames[itemType] ?? itemType).toLowerCase();

        const typeHighlightClass =
            itemType === "contaminated"
                ? styles.contaminatedHighlight
                : itemType === "broken"
                  ? styles.brokenHighlight
                  : styles.incompatibleHighlight;

        const prevNatW = item.previousImageNaturalWidth ?? 900;
        const prevNatH = item.previousImageNaturalHeight ?? 875;
        const newNatW = item.imageNaturalWidth ?? 900;
        const newNatH = item.imageNaturalHeight ?? 875;
        const previousMarkers = item.previousMarkers ?? [];
        const newMarkers = item.markers ?? [];

        return (
            <div className={styles.reviewScreen}>
                <div className={styles.reviewHeader}>
                    <span className={styles.reviewHeaderText}>
                        <Trans
                            i18nKey={
                                isBroken ? "scrValidation.reviewRemovedBroken" : "scrValidation.reviewRemovedNeedles"
                            }
                            values={{ num: newMarkersCount, type: localizedType }}
                            components={{
                                cnt: <span className={typeHighlightClass} />,
                                tp: <span className={typeHighlightClass} />,
                            }}
                        />
                    </span>
                </div>
                <div className={styles.reviewImagesContainer}>
                    <div className={styles.reviewImage}>
                        <img
                            src={item.previousImageSrc ?? NeedleImage}
                            alt="Previous"
                            className={styles.reviewImageImg}
                        />
                        {previousMarkers.map((marker, idx) => {
                            const leftPercent = (marker.x / prevNatW) * 100;
                            const topPercent = (marker.y / prevNatH) * 100;
                            return (
                                <div
                                    key={idx}
                                    className={`${styles.needleIconWrapper} ${marker.type === "contaminated" ? styles.needleIconWrapperContaminated : ""}`}
                                    style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                                >
                                    <img src={getMarkerImage(marker.type)} alt="" />
                                    <span className={styles.needleNumber}>{marker.number}</span>
                                </div>
                            );
                        })}
                        <div className={styles.reviewImageInfoOverlay}>
                            <span className={styles.reviewImageInfoText}>{t("scrValidation.previousImage")}</span>
                            <div className={styles.reviewImageInfoRight}>
                                <span className={styles.reviewImageInfoText}>
                                    {t("scrValidation.image")}
                                    {item.previousImageNumber ?? ""}
                                </span>
                                <span className={styles.reviewImageInfoText}>{item.previousReceivedTime ?? ""}</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.reviewImage}>
                        <img src={item.imageSrc ?? NeedleImage} alt="New" className={styles.reviewImageImg} />
                        {newMarkers.map((marker, idx) => {
                            const leftPercent = (marker.x / newNatW) * 100;
                            const topPercent = (marker.y / newNatH) * 100;
                            return (
                                <div
                                    key={idx}
                                    className={`${styles.needleIconWrapper} ${marker.type === "contaminated" ? styles.needleIconWrapperContaminated : ""}`}
                                    style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                                >
                                    <img src={getMarkerImage(marker.type)} alt="" />
                                    <span className={styles.needleNumber}>{marker.number}</span>
                                </div>
                            );
                        })}
                        <div className={styles.reviewImageInfoOverlay}>
                            <span className={styles.reviewImageInfoText}>{t("scrValidation.newImage")}</span>
                            <div className={styles.reviewImageInfoRight}>
                                <span className={styles.reviewImageInfoText}>
                                    {t("scrValidation.image")}
                                    {item.imageNumber ?? ""}
                                </span>
                                <span className={styles.reviewImageInfoText}>{item.receivedTime ?? ""}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.reviewHayStackButtonContainer}>
                    <SCRHayStackButton
                        type="yes"
                        active
                        title={t("scrValidation.yes")}
                        circleClassName={styles.reviewYesColor}
                        textClassName={styles.reviewButtonText}
                        imageClassName={styles.reviewHaystackButtonIcon}
                        onClick={() => handleValidate("yes")}
                    />
                    <SCRHayStackButton
                        type="validate"
                        circleClassName={styles.reviewGrayCircle}
                        textClassName={styles.reviewButtonText}
                        imageClassName={styles.reviewHaystackButtonIcon}
                    />
                    <SCRHayStackButton
                        type="action"
                        active
                        title={t("scrValidation.dashboard")}
                        circleClassName={styles.reviewActionColor}
                        textClassName={styles.reviewButtonText}
                        imageClassName={styles.reviewHaystackButtonIcon}
                        onClick={handleDashboard}
                    />
                    <SCRHayStackButton
                        type="no"
                        active
                        title={t("scrValidation.no")}
                        circleClassName={styles.reviewNoColor}
                        textClassName={styles.reviewButtonText}
                        imageClassName={styles.reviewHaystackButtonIcon}
                        onClick={() => handleValidate("no")}
                    />
                </div>
            </div>
        );
    };

    if (currentItem.isRemovedCbi && showReviewCbiRemoved) {
        return reviewCbiRemoved(currentItem);
    }

    return (
        <div className={styles.validationContainer}>
            <div className={styles.headerContainer}>
                <div className={styles.progressBar}></div>
                <ModalHeader
                    title={t("scrValidation.scrValidation")}
                    hideBack
                    hideClose
                    showHelp={false}
                    className={styles.headerContentContainer}
                >
                    {!(isClosingCount || isInterimCount) && (
                        <div className={styles.itemChip}>
                            <span className={styles.itemChipText}>
                                {currentIndex + 1}/{validationItems.length}
                            </span>
                        </div>
                    )}
                    {(isClosingCount || isInterimCount) && (
                        <span className={styles.progressBadge}>
                            {currentIndex + 1}/{activeItems.length}
                        </span>
                    )}
                </ModalHeader>
            </div>
            <div className={styles.contentContainer}>
                {currentItem.isRemovedCbi ? (
                    removedCbi(currentItem)
                ) : (
                    <>
                        <div className={styles.imageContainer}>
                            <img className={styles.image} src={imageSrc} alt="Validation" />

                            {/* Marker toggle button - TODO: potentially hook up to a HayStack button in the future */}
                            {/* {hasMarkers && (
                        <button
                            className={styles.markerToggleButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setShowMarkers((prev) => !prev);
                            }}
                            type="button"
                        >
                            {showMarkers ? t("scrValidation.hideMarkers") : t("scrValidation.showMarkers")}
                        </button>
                    )} */}

                            {/* Marker overlay - check showMarkers state */}
                            {hasMarkers &&
                                showMarkers &&
                                markers.map((marker, idx) => {
                                    const naturalWidth = currentItem.imageNaturalWidth || 900;
                                    const naturalHeight = currentItem.imageNaturalHeight || 875;
                                    const leftPercent = (marker.x / naturalWidth) * 100;
                                    const topPercent = (marker.y / naturalHeight) * 100;
                                    return (
                                        <div
                                            key={idx}
                                            className={`${styles.needleIconWrapper} ${marker.type === "contaminated" ? styles.needleIconWrapperContaminated : ""}`}
                                            style={{
                                                left: `${leftPercent}%`,
                                                top: `${topPercent}%`,
                                            }}
                                        >
                                            <img src={getMarkerImage(marker.type)} alt="" />
                                            <span className={styles.needleNumber}>{marker.number}</span>
                                        </div>
                                    );
                                })}

                            {/* Image info overlay */}
                            <div className={styles.imageInfoOverlay}>
                                <span
                                    className={
                                        currentItem.source === "cbi" ? styles.reviewImageInfoText : styles.imageInfoText
                                    }
                                >
                                    {t("scrValidation.image")}
                                    {imageNumber}
                                </span>
                                <span
                                    className={
                                        currentItem.source === "cbi" ? styles.reviewImageInfoText : styles.imageInfoText
                                    }
                                >
                                    {receivedTime}
                                </span>
                            </div>
                        </div>
                        <div className={styles.controlContainer}>
                            <div className={styles.controlContentContainer}>
                                <span className={styles.questionText}>
                                    {promptKey === "scrValidation.oneCompletePrompt" ? (
                                        <Trans
                                            i18nKey="scrValidation.oneCompletePrompt"
                                            components={[<span className={styles.highlight} />]}
                                        />
                                    ) : (
                                        prompt
                                    )}
                                </span>
                                <div className={styles.haystackButtonContainer}>
                                    <SCRHayStackButton
                                        type="yes"
                                        active
                                        title={t("scrValidation.yes")}
                                        circleClassName={styles.yesColor}
                                        textClassName={styles.buttonText}
                                        imageClassName={styles.haystackButtonIcon}
                                        onClick={() => handleValidate("yes")}
                                    />
                                    <SCRHayStackButton
                                        type="validate"
                                        circleClassName={styles.grayCircle}
                                        textClassName={styles.buttonText}
                                        imageClassName={styles.haystackButtonIcon}
                                    />
                                    {isClosingCount || isInterimCount ? (
                                        <SCRHayStackButton
                                            type="action"
                                            circleClassName={styles.grayCircle}
                                            textClassName={styles.buttonText}
                                            imageClassName={styles.haystackButtonIcon}
                                        />
                                    ) : (
                                        <SCRHayStackButton
                                            type="action"
                                            active
                                            title={t("scrValidation.dashboard")}
                                            circleClassName={styles.actionColor}
                                            textClassName={styles.buttonText}
                                            imageClassName={styles.haystackButtonIcon}
                                            onClick={handleDashboard}
                                        />
                                    )}
                                    <SCRHayStackButton
                                        type="no"
                                        active
                                        title={t("scrValidation.no")}
                                        circleClassName={styles.noColor}
                                        textClassName={styles.buttonText}
                                        imageClassName={styles.haystackButtonIcon}
                                        onClick={() => handleValidate("no")}
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
