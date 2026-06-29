/**
 * Figma Screen 3.17 (extra) / 3.22 (misplaced) / 3.49 (remaining)
 * — "Select the type of suture needle found"
 *
 * Visually identical across all variants. The downstream routing after
 * onSelectType differs per section (Section 7/10/2) and is handled by
 * the parent (CIRClosingCount) via separate enum states:
 *   - NEEDLE_FOUND_SELECTION  (Section 10 — extra needles)
 *   - MISPLACED_NEEDLE_FOUND  (Section 7  — misplaced needles)
 *   - S2_NEEDLE_FOUND         (Section 2  — remaining needles)
 */
import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/needleFoundScreen.module.css";
import Sterile from "../../img/Sterile.svg";
import Virus from "../../img/Virus.svg";
import Broken from "../../img/BrokenNoBorder.svg";
import Puzzle from "../../img/Puzzle.svg";
import Kite from "../../img/Kite.svg";
import ConvexTriangle from "../../img/ConvexTriangle.svg";
import WhiteBubbleArrow from "../../img/WhiteBubbleArrow.svg";

interface NeedleFoundScreenProps {
    onSelectType: (type: string) => void;
}

const NEEDLE_TYPE_CARDS = [
    {
        type: "sterile",
        labelKey: "needleFound.sterile",
        icon: Sterile,
        shapeClass: styles.kite,
        borderClass: styles.borderSterile,
        shapeImage: Kite,
    },
    {
        type: "contaminated",
        labelKey: "needleFound.contaminated",
        icon: Virus,
        shapeClass: styles.triangle,
        borderClass: styles.borderContaminated,
        shapeImage: ConvexTriangle,
    },
    {
        type: "broken",
        labelKey: "needleFound.broken",
        icon: Broken,
        shapeClass: styles.circle,
        borderClass: styles.borderBroken,
    },
    {
        type: "incompatible",
        labelKey: "needleFound.incompatible",
        icon: Puzzle,
        shapeClass: styles.square,
        borderClass: styles.borderIncompatible,
    },
];

export const NeedleFoundScreen: React.FC<NeedleFoundScreenProps> = ({ onSelectType }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.screenContainer}>
            <div className={styles.contentArea}>
                <h2 className={styles.title}>{t("needleFound.title")}</h2>

                <div className={styles.cardRow}>
                    {NEEDLE_TYPE_CARDS.map((card) => (
                        <button
                            key={card.type}
                            className={`${styles.card} ${card.borderClass}`}
                            onClick={() => onSelectType(card.type)}
                        >
                            <div className={`${styles.shapeContainer} ${card.shapeClass}`}>
                                {"shapeImage" in card && card.shapeImage && (
                                    <img className={styles.shapeImage} src={card.shapeImage} alt="" />
                                )}
                                <img
                                    className={`${styles.cardIcon} ${card.shapeClass === styles.kite ? styles.cardIconKite : ""}`}
                                    src={card.icon}
                                    alt={t(card.labelKey)}
                                />
                            </div>
                            <span className={styles.cardLabel}>{t(card.labelKey)}</span>
                            <span className={styles.cardSublabel}>{t("needleFound.sublabel")}</span>
                            <img className={styles.arrowIcon} src={WhiteBubbleArrow} alt="" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
