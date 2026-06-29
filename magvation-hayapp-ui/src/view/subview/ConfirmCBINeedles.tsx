import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "../App";
import { useTranslation } from "react-i18next";
import { useListenable } from "../../util/Listenable";
import styles from "../subviewcss/confirmCBINeedles.module.css";
import ContaminatedNeedleMarkerImage from "../../img/ContaminatedNeedleMarker.svg";
import BrokenNeedleMarkerImage from "../../img/BrokenNeedleMarker.svg";
import IncompatibleNeedleMarkerImage from "../../img/IncompatibleNeedleMarker.svg";
import NeedleImage from "../../img/NeedleImage.png";

const CBI_TYPE_ORDER = ["contaminated", "broken", "incompatible"];

function getMarkerImage(type: string) {
    if (type === "broken") return BrokenNeedleMarkerImage;
    if (type === "incompatible") return IncompatibleNeedleMarkerImage;
    return ContaminatedNeedleMarkerImage;
}

const CBI_HIGHLIGHT_COLORS: Record<string, string> = {
    contaminated: "rgba(158, 242, 187, 1)",
    broken: "rgba(253, 215, 142, 1)",
    incompatible: "rgba(158, 225, 254, 1)",
};

function getQuestionBaseKey(type: string, count: number): string {
    const plural = count === 1 ? "" : "Plural";
    switch (type) {
        case "contaminated":
            return `closeCount.confirmContaminated${plural}`;
        case "broken":
            return `closeCount.confirmBroken${plural}`;
        case "incompatible":
            return `closeCount.confirmIncompatible${plural}`;
        default:
            return `closeCount.confirmContaminated${plural}`;
    }
}

function getTitleKey(type: string): string {
    switch (type) {
        case "contaminated":
            return "closeCount.contaminatedTitle";
        case "broken":
            return "closeCount.brokenTitle";
        case "incompatible":
            return "closeCount.incompatibleTitle";
        default:
            return "closeCount.contaminatedTitle";
    }
}

interface ConfirmCBINeedlesProps {
    onComplete: (hasDeniedItems: boolean) => void;
    onTypeChange?: (titleKey: string) => void;
}

export const ConfirmCBINeedles: React.FC<ConfirmCBINeedlesProps> = ({ onComplete, onTypeChange }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    const pendingCbiValidations = useListenable(appContext.caseService.pendingCbiValidations);

    // Track items already confirmed (avoids race with backend removing from listenable)
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    const [hasDeniedItems, setHasDeniedItems] = useState(false);
    const [showMarkers, setShowMarkers] = useState(true);

    // Sort remaining items by CBI type order: contaminated → broken → incompatible
    const sortedItems = useMemo(
        () =>
            [...pendingCbiValidations]
                .filter((item) => !processedIds.has(item.id) && !item.cir_confirmed)
                .sort((a, b) => CBI_TYPE_ORDER.indexOf(a.type) - CBI_TYPE_ORDER.indexOf(b.type)),
        [pendingCbiValidations, processedIds],
    );

    // If no CBI items remain, complete
    useEffect(() => {
        if (sortedItems.length === 0) {
            onComplete(hasDeniedItems);
        }
    }, [sortedItems.length, onComplete, hasDeniedItems]);

    // Notify parent of current type for header title
    useEffect(() => {
        if (sortedItems.length > 0 && onTypeChange) {
            onTypeChange(getTitleKey(sortedItems[0].type));
        }
    }, [sortedItems, onTypeChange]);

    if (sortedItems.length === 0) {
        return null;
    }

    // Always show the first remaining item
    const currentItem = sortedItems[0];
    const markers = currentItem.markers || [];
    const hasMarkers = markers.length > 0;
    const naturalWidth = currentItem.imageNaturalWidth || 900;
    const naturalHeight = currentItem.imageNaturalHeight || 875;
    const count = currentItem.count;
    const itemType = currentItem.type;
    const imageSrc = currentItem.image_filename
        ? `http://localhost:8080/hayscan_cbi_images/${currentItem.image_filename}`
        : NeedleImage;
    const imageNumber = currentItem.image_number ?? "";
    const receivedTime = currentItem.received_time ?? "";

    const questionBase = getQuestionBaseKey(itemType, count);
    const highlightColor = CBI_HIGHLIGHT_COLORS[itemType] || CBI_HIGHLIGHT_COLORS.contaminated;

    const handleConfirm = async (confirmed: boolean) => {
        if (!confirmed) setHasDeniedItems(true);
        // Immediately hide this item so the next one shows
        setProcessedIds((prev) => new Set(prev).add(currentItem.id));
        setShowMarkers(true);
        await appContext.caseService.parlayInterface.caseManager.cbi_needles_confirmed([currentItem.id], confirmed);
    };

    return (
        <div className={styles.container}>
            {/* Left Panel: CBI Image with markers */}
            <div className={styles.imagePanel}>
                <img className={styles.cbiImage} src={imageSrc} alt="CBI Box" />

                {/* Marker overlays */}
                {hasMarkers &&
                    showMarkers &&
                    markers.map((marker, idx) => {
                        const leftPercent = (marker.x / naturalWidth) * 100;
                        const topPercent = (marker.y / naturalHeight) * 100;
                        return (
                            <div
                                key={idx}
                                className={styles.needleIconWrapper}
                                style={{
                                    left: `${leftPercent}%`,
                                    top: `${topPercent}%`,
                                }}
                            >
                                <img src={getMarkerImage(itemType)} alt="" />
                                <span className={styles.needleNumber}>{marker.number}</span>
                            </div>
                        );
                    })}

                {/* Toggle button */}
                {hasMarkers && (
                    <button
                        className={styles.toggleButton}
                        onClick={() => setShowMarkers((prev) => !prev)}
                        type="button"
                    >
                        {showMarkers ? t("closeCount.hideNumbers") : t("closeCount.showNumbers")}
                    </button>
                )}

                {/* Image info */}
                <div className={styles.imageInfoOverlay}>
                    <span className={styles.imageInfoText}>Image #{imageNumber}</span>
                    <span className={styles.imageInfoText}>{receivedTime}</span>
                </div>
            </div>

            {/* Right Panel: Confirmation card */}
            <div className={styles.confirmPanel}>
                <div className={styles.confirmContent}>
                    <span className={styles.questionText}>
                        {t(`${questionBase}Prefix`)}
                        <span style={{ color: highlightColor }}>{t(`${questionBase}Highlight`, { count })}</span>
                        {t(`${questionBase}Suffix`)}
                    </span>

                    <div className={styles.buttonRow}>
                        <button className={styles.noButton} onClick={() => handleConfirm(false)}>
                            No <span className={styles.buttonIcon}>&times;</span>
                        </button>
                        <button className={styles.yesButton} onClick={() => handleConfirm(true)}>
                            Yes <span className={styles.buttonIcon}>&#10003;</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
