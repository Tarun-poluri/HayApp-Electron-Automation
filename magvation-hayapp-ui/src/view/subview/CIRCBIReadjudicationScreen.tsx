/**
 * Figma 3.10.1 / 3.10.2 / 3.10.3
 * CIR CBI Count Re-Adjudication — confirm photo or tap-to-recount per rejected CBI type
 *
 * Sequential flow per item:
 *   1. "confirm" step (3.10.1): show CBI image with ORIGINAL markers, question card
 *      - "Yes" → send original count/markers → advance
 *      - "No" → switch to "tap" step, clear markers
 *   2. "tap" step (3.10.2/3.10.3): tappable CBI image + counter UI
 *      - Confirm → send new count/markers → advance
 *   3. After last item → onComplete()
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/cirCBIReadjudicationScreen.module.css";
import { BasicHeader } from "../../component/BasicHeader";
import { AppContext } from "../App";
import { AnalyzeNeedleResult } from "../../services/CaseService";
import RedCloseNoBg from "../../img/RedCloseNoBg.svg";
import GreenCheck from "../../img/GreenCheck.svg";
import UndoBlack from "../../img/UndoBlack.svg";
import UndoWhite from "../../img/UndoWhite.svg";
import BlackClose from "../../img/BlackClose.svg";
import CloseWhite from "../../img/CloseWhite.svg";
import GreenTriangularMarker from "../../img/GreenTriangularMarker.svg";

interface Marker {
    id: number;
    x: number; // percentage of container width
    y: number; // percentage of container height
    number: number;
}

interface CIRCBIReadjudicationScreenProps {
    items: AnalyzeNeedleResult[];
    onComplete: () => void;
    onBack: () => void;
}

export const CIRCBIReadjudicationScreen: React.FC<CIRCBIReadjudicationScreenProps> = ({
    items,
    onComplete,
    onBack,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    // Stabilize items: capture on mount so parent re-renders (from DASHBOARD_UPDATEs
    // after each cbi_needles_re_adjudicated call) don't shrink the array mid-flow.
    const stableItems = useRef(items);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [step, setStep] = useState<"confirm" | "tap">("confirm");
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [nextId, setNextId] = useState(1);
    const [showMarkers, setShowMarkers] = useState(true);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    // If no items, complete immediately
    useEffect(() => {
        if (stableItems.current.length === 0) onComplete();
    }, []);

    if (stableItems.current.length === 0) return null;

    const currentItem = stableItems.current[currentIndex];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cbiData: any = currentItem?.cbi_data ?? {};
    const cbiType: string = cbiData.type || currentItem?.adjudication_reason || "broken";
    const originalCount: number = cbiData.count || 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalMarkers: any[] = cbiData.markers || [];
    const naturalWidth: number = cbiData.imageNaturalWidth || 900;
    const naturalHeight: number = cbiData.imageNaturalHeight || 875;
    const imageFilename: string = currentItem?.image_filename || "";
    const imageSrc = imageFilename ? `http://localhost:8080/hayscan_cbi_images/${imageFilename}` : "";
    const imageNumber = currentItem?.image_number ?? "";
    const receivedTime = currentItem?.received_time || "";

    const sendReAdjudication = useCallback(
        async (count: number, sentMarkers: Array<{ x: number; y: number; number: number; type: string }>) => {
            await appContext.caseService.parlayInterface.caseManager.cbi_needles_re_adjudicated(
                currentItem.id,
                cbiType,
                count,
                imageFilename,
                typeof imageNumber === "string" ? parseInt(imageNumber) || 0 : imageNumber,
                receivedTime,
                cbiData.misplaced || false,
                sentMarkers,
                naturalWidth,
                naturalHeight,
                cbiData.extra || false,
            );
        },
        [
            appContext.caseService,
            currentItem,
            cbiType,
            imageFilename,
            imageNumber,
            receivedTime,
            cbiData,
            naturalWidth,
            naturalHeight,
        ],
    );

    const advance = useCallback(() => {
        if (currentIndex + 1 < stableItems.current.length) {
            setCurrentIndex(currentIndex + 1);
            setStep("confirm");
            setMarkers([]);
            setNextId(1);
            setShowMarkers(true);
        } else {
            onComplete();
        }
    }, [currentIndex, onComplete]);

    // Yes on confirm step: accept original count, send to backend, advance
    const handleYes = useCallback(async () => {
        const mappedMarkers = originalMarkers.map((m: { x: number; y: number; number: number }, idx: number) => ({
            x: m.x,
            y: m.y,
            number: m.number ?? idx + 1,
            type: cbiType,
        }));
        await sendReAdjudication(originalCount, mappedMarkers);
        advance();
    }, [originalMarkers, cbiType, originalCount, sendReAdjudication, advance]);

    // No on confirm step: switch to tap step
    const handleNo = useCallback(() => {
        setStep("tap");
        setMarkers([]);
        setNextId(1);
        setShowMarkers(true);
    }, []);

    // Tap step: image click handler
    const handleImageClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (step !== "tap" || !imageContainerRef.current) return;
            const rect = imageContainerRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setMarkers((prev) => [...prev, { id: nextId, x, y, number: prev.length + 1 }]);
            setNextId((prev) => prev + 1);
        },
        [step, nextId],
    );

    const handleUndo = () => {
        if (markers.length === 0) return;
        setMarkers((prev) => prev.slice(0, -1).map((m, i) => ({ ...m, number: i + 1 })));
    };

    const handleClearAll = () => {
        setMarkers([]);
        setNextId(1);
    };

    // Tap step confirm: send new count/markers, advance
    const handleTapConfirm = useCallback(async () => {
        const mappedMarkers = markers.map((m) => ({
            x: (m.x / 100) * naturalWidth,
            y: (m.y / 100) * naturalHeight,
            number: m.number,
            type: cbiType,
        }));
        await sendReAdjudication(markers.length, mappedMarkers);
        advance();
    }, [markers, naturalWidth, naturalHeight, cbiType, sendReAdjudication, advance]);

    // Back button logic
    const handleBack = useCallback(() => {
        if (step === "tap") {
            // Tap → confirm (same item)
            setStep("confirm");
            setMarkers([]);
            setNextId(1);
            setShowMarkers(true);
        } else if (currentIndex > 0) {
            // Confirm (not first) → previous item's confirm step
            setCurrentIndex(currentIndex - 1);
            setStep("confirm");
            setMarkers([]);
            setNextId(1);
            setShowMarkers(true);
        } else {
            // Confirm (first item) → parent back
            onBack();
        }
    }, [step, currentIndex, onBack]);

    // Render markers for confirm step (original markers, natural coords → percentage)
    const renderOriginalMarkers = () => {
        if (!showMarkers) return null;
        return originalMarkers.map((marker: { x: number; y: number; number: number }, idx: number) => {
            const leftPercent = (marker.x / naturalWidth) * 100;
            const topPercent = (marker.y / naturalHeight) * 100;
            return (
                <div
                    key={idx}
                    className={`${styles.markerWrapper} ${
                        cbiType === "incompatible"
                            ? styles.markerWrapperIncompatible
                            : cbiType === "contaminated"
                              ? styles.markerWrapperContaminated
                              : ""
                    }`}
                    style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                >
                    {cbiType === "contaminated" && (
                        <img src={GreenTriangularMarker} className={styles.triangularMarkerSvg} alt="" />
                    )}
                    <span className={styles.markerNumber}>{marker.number ?? idx + 1}</span>
                </div>
            );
        });
    };

    // Render markers for tap step (user-placed, percentage coords)
    const renderTapMarkers = () => {
        if (!showMarkers) return null;
        return markers.map((marker) => (
            <div
                key={marker.id}
                className={`${styles.markerWrapper} ${
                    cbiType === "incompatible"
                        ? styles.markerWrapperIncompatible
                        : cbiType === "contaminated"
                          ? styles.markerWrapperContaminated
                          : ""
                }`}
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            >
                {cbiType === "contaminated" && (
                    <img src={GreenTriangularMarker} className={styles.triangularMarkerSvg} alt="" />
                )}
                <span className={styles.markerNumber}>{marker.number}</span>
            </div>
        ));
    };

    const hasAnyMarkers = step === "confirm" ? originalMarkers.length > 0 : markers.length > 0;

    return (
        <div className={styles.container}>
            <div className={styles.progressBar} />
            <BasicHeader title={t("cbiReadjudication.title")} onBack={handleBack} showHelp>
                <span className={styles.badge}>
                    {currentIndex + 1}/{stableItems.current.length}
                </span>
            </BasicHeader>

            <div className={styles.contentArea}>
                {/* Image Panel */}
                <div
                    ref={imageContainerRef}
                    className={`${styles.imageContainer} ${step === "tap" ? styles.imageContainerTappable : ""}`}
                    onClick={handleImageClick}
                >
                    <img className={styles.cbiImage} src={imageSrc} alt="CBI Box" />

                    {step === "confirm" ? renderOriginalMarkers() : renderTapMarkers()}

                    {hasAnyMarkers && (
                        <button
                            className={styles.toggleButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMarkers((prev) => !prev);
                            }}
                            type="button"
                        >
                            {showMarkers ? t("cbiReadjudication.hideNumbers") : t("cbiReadjudication.showNumbers")}
                        </button>
                    )}

                    <div className={styles.imageInfoOverlay}>
                        <span className={styles.imageInfoText}>
                            {t("cbiReadjudication.image")}
                            {imageNumber}
                        </span>
                        <span className={styles.imageInfoText}>{receivedTime}</span>
                    </div>
                </div>

                {/* Control Panel */}
                <div className={styles.controlPanel}>
                    {step === "confirm" ? (
                        <div className={styles.confirmContent}>
                            <span className={styles.confirmQuestion}>
                                {(() => {
                                    const typeKey =
                                        cbiType === "contaminated"
                                            ? "Contaminated"
                                            : cbiType === "broken"
                                              ? "Broken"
                                              : "Incompatible";
                                    const plural = originalCount === 1 ? "" : "Plural";
                                    const base = `cbiReadjudication.confirm${typeKey}${plural}`;
                                    const highlightColor =
                                        cbiType === "contaminated"
                                            ? "rgba(158, 242, 187, 1)"
                                            : cbiType === "broken"
                                              ? "rgba(253, 215, 142, 1)"
                                              : "rgba(158, 225, 254, 1)";
                                    return (
                                        <>
                                            {t(`${base}Prefix`)}
                                            <span style={{ color: highlightColor }}>
                                                {t(`${base}Highlight`, { count: originalCount })}
                                            </span>
                                            {t(`${base}Suffix`)}
                                        </>
                                    );
                                })()}
                            </span>
                            <div className={styles.buttonRow}>
                                <button className={styles.noButton} onClick={handleNo}>
                                    <span className={styles.noButtonText}>{t("cbiReadjudication.no")}</span>
                                    <img src={RedCloseNoBg} alt="" className={styles.pillButtonIcon} />
                                </button>
                                <button className={styles.yesButton} onClick={handleYes}>
                                    <span className={styles.yesButtonText}>{t("cbiReadjudication.yes")}</span>
                                    <img src={GreenCheck} alt="" className={styles.pillButtonIcon} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.tapContent}>
                            <span className={styles.tapInstruction}>
                                {t(`cbiReadjudication.tapInstructionLine1_${cbiType}`)}
                                <br />
                                <span
                                    className={
                                        cbiType === "contaminated"
                                            ? styles.tapInstructionHighlightContaminated
                                            : cbiType === "broken"
                                              ? styles.tapInstructionHighlightBroken
                                              : cbiType === "incompatible"
                                                ? styles.tapInstructionHighlightIncompatible
                                                : styles.tapInstructionHighlight
                                    }
                                >
                                    {t(`cbiReadjudication.tapInstructionLine2_${cbiType}`)}
                                </span>
                            </span>

                            <div className={styles.counterBox}>
                                <div className={styles.actionRow}>
                                    <button
                                        className={styles.undoButton}
                                        onClick={handleUndo}
                                        disabled={markers.length === 0}
                                    >
                                        {t("cbiReadjudication.undo")}{" "}
                                        <img
                                            className={styles.actionIcon}
                                            src={markers.length === 0 ? UndoBlack : UndoWhite}
                                            alt=""
                                        />
                                    </button>
                                    <button
                                        className={styles.clearButton}
                                        onClick={handleClearAll}
                                        disabled={markers.length === 0}
                                    >
                                        {t("cbiReadjudication.clearAll")}{" "}
                                        <img
                                            className={styles.actionIcon}
                                            src={markers.length === 0 ? BlackClose : CloseWhite}
                                            alt=""
                                        />
                                    </button>
                                </div>

                                <div className={styles.countDisplay}>
                                    <span
                                        className={`${styles.countNumber} ${markers.length > 0 ? styles.countNumberActive : ""}`}
                                    >
                                        {markers.length}
                                    </span>
                                </div>
                            </div>

                            <button className={styles.confirmButton} onClick={handleTapConfirm}>
                                {t("cbiReadjudication.confirm")}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
