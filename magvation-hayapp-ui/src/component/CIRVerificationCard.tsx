import React from "react";
import Done from "../img/Done.svg";
import GreyClose from "../img/GreyClose.svg";
import GreenDoneNoBg from "../img/GreenDoneNoBg.svg";
import RedCloseNoBg from "../img/RedCloseNoBg.svg";
import ActiveZoom from "../img/ActiveZoom.svg";
import InactiveZoom from "../img/InactiveZoom.svg";
import { useTranslation } from "react-i18next";

export interface CIRVerificationCardProps {
    isActive: boolean;
    reviewed: boolean;
    yesSelected: boolean;
    noSelected: boolean;
    gridImageUrl: string;
    i: number;
    handleReviewImageClick: () => void;
    handleCardAction: (i: number, value: "yes" | "no") => void;
    activeIndex: number;
    imageNumber: number | undefined;
    time: string | undefined;
    yesLabel?: string;
    noLabel?: string;
    reviewedLabel?: string;
    styles: Record<string, string>;
}

export const CIRVerificationCard: React.FC<CIRVerificationCardProps> = ({
    isActive,
    reviewed,
    yesSelected,
    noSelected,
    gridImageUrl,
    i,
    handleReviewImageClick,
    handleCardAction,
    activeIndex,
    imageNumber,
    time,
    yesLabel,
    noLabel,
    styles,
}) => {
    const { t } = useTranslation();
    const resolvedYesLabel = yesLabel ?? t("cirVerification.completeNeedle");
    const resolvedNoLabel = noLabel ?? t("cirVerification.notCompleteNeedle");

    let cardClass = styles.card;
    if (isActive) {
        if (reviewed && i !== activeIndex) {
            cardClass = styles.reviewedActiveCard;
        } else if (i === activeIndex) {
            cardClass = styles.activeCard;
        }
    }
    return (
        <div className={cardClass}>
            <div className={isActive ? styles.activeCardInner : styles.innerCard}>
                <div
                    className={isActive ? styles.activeCardImage : styles.cardImage}
                    style={
                        isActive
                            ? {
                                  backgroundImage: `url(${gridImageUrl})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  cursor: "pointer",
                                  position: "relative",
                              }
                            : { cursor: "pointer", position: "relative" }
                    }
                    onClick={handleReviewImageClick}
                >
                    {isActive && (
                        <img src={gridImageUrl} alt={`Needle ${i + 1}`} loading="lazy" style={{ display: "none" }} />
                    )}
                    <div style={{ position: "absolute", bottom: "1.48vh", left: "0.83vw" }}>
                        <img
                            src={isActive || reviewed ? ActiveZoom : InactiveZoom}
                            alt="Zoom"
                            className={isActive || reviewed ? styles.activeZoom : styles.inactiveZoom}
                        />
                    </div>
                    <div style={{ position: "absolute", bottom: "1.48vh", right: "0.83vw" }}>
                        <span className={isActive ? styles.activeImageText : styles.imageText}>{time}</span>
                    </div>
                </div>
                <div className={isActive ? styles.activeCardReview : styles.cardReview}>
                    <span
                        className={
                            reviewed ? styles.reviewedText : isActive ? styles.activeReviewText : styles.reviewText
                        }
                    >
                        {imageNumber ? `Image #${imageNumber}` : "Image"}
                    </span>
                    <div className={isActive ? styles.activeReviewButtonContainer : styles.reviewButtonContainer}>
                        <button
                            className={[
                                styles.reviewButtonBase,
                                isActive ? styles.activeReviewButton : styles.reviewButton,
                                yesSelected ? styles.selected : "",
                                yesSelected ? styles.selectedYes : "",
                            ].join(" ")}
                            onClick={() => handleCardAction(i, "yes")}
                        >
                            <span
                                className={[
                                    styles.reviewButtonTextBase,
                                    isActive ? styles.activeReviewButtonText : styles.reviewButtonText,
                                    yesSelected ? styles.selectedButtonText : "",
                                ].join(" ")}
                            >
                                {resolvedYesLabel}
                            </span>
                            <img src={isActive ? GreenDoneNoBg : Done} alt="Done" />
                        </button>
                        <button
                            className={[
                                styles.reviewButtonBase,
                                isActive ? styles.activeNoReviewButton : styles.reviewButton,
                                noSelected ? styles.selected : "",
                                noSelected ? styles.selectedNo : "",
                            ].join(" ")}
                            onClick={() => handleCardAction(i, "no")}
                        >
                            <span
                                className={[
                                    styles.reviewButtonTextBase,
                                    isActive ? styles.activeNoReviewButtonText : styles.reviewButtonText,
                                    noSelected ? styles.selectedButtonText : "",
                                ].join(" ")}
                            >
                                {resolvedNoLabel}
                            </span>
                            <img src={isActive ? RedCloseNoBg : GreyClose} alt="Close" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
