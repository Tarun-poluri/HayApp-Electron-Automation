/**
 * Figma Screen 3.44/3.45 (variant="broken") / 3.50/3.51 (variant="incompatible")
 * / 3.101 (variant="contaminated")
 * — Tap-to-Count needles in the CBI Box image
 *
 * Same layout for all variants. Differences:
 *   - Header title and instruction text (via translation key prefix)
 *   - Marker style: amber circle (broken), blue rounded-square (incompatible),
 *     green triangle SVG (contaminated)
 */
import React, { useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/needleTapScreen.module.css";
import { BasicHeader } from "../../component/BasicHeader";
import { AppContext } from "../App";
import { useListenable } from "../../util/Listenable";
import UndoBlack from "../../img/UndoBlack.svg";
import UndoWhite from "../../img/UndoWhite.svg";
import BlackClose from "../../img/BlackClose.svg";
import CloseWhite from "../../img/CloseWhite.svg";
import GreenTriangularMarker from "../../img/GreenTriangularMarker.svg";
import ContaminatedCBI from "../../img/ContaminatedCBI.svg";
import BrokenCBI from "../../img/BrokenCBI.svg";
import IncompatibleCBI from "../../img/IncompatibleCBI.svg";

export interface NeedleMarker {
    id: number;
    x: number;
    y: number;
    number: number;
}

const KEY_PREFIXES: Record<string, string> = {
    broken: "section1.brokenNeedle",
    contaminated: "section1.contaminatedNeedle",
    incompatible: "section2.incompatibleNeedle",
};

const FALLBACK_IMAGES: Record<string, string> = {
    broken: BrokenCBI,
    contaminated: ContaminatedCBI,
    incompatible: IncompatibleCBI,
};

interface NeedleTapScreenProps {
    variant?: "broken" | "contaminated" | "incompatible";
    initialMarkers?: NeedleMarker[];
    onConfirm: (count: number, markers: NeedleMarker[]) => void;
    onBack: () => void;
}

export const NeedleTapScreen: React.FC<NeedleTapScreenProps> = ({
    variant = "broken",
    initialMarkers,
    onConfirm,
    onBack,
}) => {
    const { t } = useTranslation();
    const keyPrefix = KEY_PREFIXES[variant];
    const appContext = useContext(AppContext);
    const cbiImageResult = useListenable(appContext.caseService.cbiImage);
    const cbiImage = cbiImageResult?.image_filename
        ? `http://localhost:8080/hayscan_cbi_images/${cbiImageResult.image_filename}`
        : FALLBACK_IMAGES[variant];
    const [markers, setMarkers] = useState<NeedleMarker[]>(initialMarkers ?? []);
    const [nextId, setNextId] = useState((initialMarkers?.length ?? 0) + 1);
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const handleImageClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!imageContainerRef.current) return;
            const rect = imageContainerRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            setMarkers((prev) => [...prev, { id: nextId, x, y, number: prev.length + 1 }]);
            setNextId((prev) => prev + 1);
        },
        [nextId],
    );

    const handleUndo = () => {
        if (markers.length === 0) return;
        setMarkers((prev) => prev.slice(0, -1).map((m, i) => ({ ...m, number: i + 1 })));
    };

    const handleClearAll = () => {
        setMarkers([]);
        setNextId(1);
    };

    return (
        <div className={styles.screenContainer}>
            <BasicHeader title={t(`${keyPrefix}.title`)} onBack={onBack} showHelp />
            <div className={styles.contentArea}>
                <div className={styles.splitView}>
                    <div className={styles.imageContainer} ref={imageContainerRef} onClick={handleImageClick}>
                        <img ref={imgRef} className={styles.cbiImage} src={cbiImage} alt="CBI Box" />
                        {markers.map((marker) => (
                            <div
                                key={marker.id}
                                className={`${styles.markerWrapper} ${
                                    variant === "incompatible"
                                        ? styles.markerWrapperIncompatible
                                        : variant === "contaminated"
                                          ? styles.markerWrapperContaminated
                                          : ""
                                }`}
                                style={{
                                    left: `${marker.x}%`,
                                    top: `${marker.y}%`,
                                }}
                            >
                                {variant === "contaminated" && (
                                    <img src={GreenTriangularMarker} className={styles.triangularMarkerSvg} alt="" />
                                )}
                                <span className={styles.markerNumber}>{marker.number}</span>
                            </div>
                        ))}
                    </div>

                    <div className={styles.controlPanel}>
                        <span className={styles.instruction}>
                            {t(`${keyPrefix}.instructionText`)}
                            <span
                                className={
                                    variant === "contaminated"
                                        ? styles.instructionHighlightContaminated
                                        : variant === "broken"
                                          ? styles.instructionHighlightBroken
                                          : styles.instructionHighlightIncompatible
                                }
                            >
                                {t(`${keyPrefix}.instructionHighlight`)}
                            </span>
                        </span>

                        <div className={styles.counterBox}>
                            <div className={styles.actionRow}>
                                <button
                                    className={styles.undoButton}
                                    onClick={handleUndo}
                                    disabled={markers.length === 0}
                                >
                                    {t(`${keyPrefix}.undo`)}{" "}
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
                                    {t(`${keyPrefix}.clearAll`)}{" "}
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

                        <button className={styles.confirmButton} onClick={() => onConfirm(markers.length, markers)}>
                            {t(`${keyPrefix}.confirm`)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
