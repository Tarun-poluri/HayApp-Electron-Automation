/**
 * Figma Screen 3.16 (variant="extra") / 3.21 (variant="misplaced") / 3.47 (variant="remaining")
 * — Check Sterile Field for Suture Needles
 */
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/needleSterileFieldScreen.module.css";
import CheckInsideHaystack from "../../img/CheckInsideHaystack.svg";
import NeedleDriver from "../../img/NeedleDriver.svg";
import HaystackSurroundingArea from "../../img/HaystackSurroundingArea.svg";
import Drapes from "../../img/Drapes.svg";
import Floor from "../../img/Floor.svg";

interface NeedleSterileFieldScreenProps {
    needleCount: number;
    variant?: "extra" | "misplaced" | "remaining" | "interimRemaining";
    onNeedleFound?: () => void;
    onNeedleNotFound?: () => void;
    /** Hide the Found/Not Found buttons (read-only SCR mirror). */
    hideButtons?: boolean;
}

const INSTRUCTION_CARDS = [
    { number: 1, labelKey: "extraNeedles.card1", image: NeedleDriver },
    { number: 2, labelKey: "extraNeedles.card2", image: CheckInsideHaystack },
    { number: 3, labelKey: "extraNeedles.card3", image: HaystackSurroundingArea },
    { number: 4, labelKey: "extraNeedles.card4", image: Drapes },
    { number: 5, labelKey: "extraNeedles.card5", image: Floor },
];

export const NeedleSterileFieldScreen: React.FC<NeedleSterileFieldScreenProps> = ({
    needleCount,
    variant = "extra",
    onNeedleFound,
    onNeedleNotFound,
    hideButtons = false,
}) => {
    const { t } = useTranslation();
    const lastArrowTap = useRef<{ key: string; time: number }>({ key: "", time: 0 });

    // Double-tap right arrow to trigger "Suture Needle Found" (dev testing)
    // Disabled when hideButtons is true (SCR read-only mode handles its own bypass).
    useEffect(() => {
        if (hideButtons || !onNeedleFound) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight") return;
            const now = Date.now();
            const last = lastArrowTap.current;
            if (last.key === e.key && now - last.time < 400) {
                onNeedleFound();
                lastArrowTap.current = { key: "", time: 0 };
            } else {
                lastArrowTap.current = { key: e.key, time: now };
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onNeedleFound, hideButtons]);

    return (
        <div className={styles.screenContainer}>
            <div className={styles.contentArea}>
                <div className={styles.titleRow}>
                    <span className={styles.titleText}>
                        {variant === "interimRemaining" ? (
                            <>
                                {t("interimRemainingNeedles.titlePrefix")}
                                <span className={styles.interimBadge}>{needleCount}</span>
                                {t("interimRemainingNeedles.titleSuffix")}
                            </>
                        ) : variant === "extra" ? (
                            <>
                                {t("extraNeedles.titlePrefix")}
                                <span className={styles.extraBadge}>
                                    {needleCount} {t("extraNeedles.extra")}
                                </span>
                                {t(
                                    needleCount === 1
                                        ? "extraNeedles.titleSuffixSingular"
                                        : "extraNeedles.titleSuffixPlural",
                                )}
                            </>
                        ) : variant === "misplaced" ? (
                            <>
                                {needleCount}
                                {t(
                                    needleCount === 1
                                        ? "misplacedNeedles.titlePrefixSingular"
                                        : "misplacedNeedles.titlePrefixPlural",
                                )}
                                <span className={styles.extraBadge}>{t("misplacedNeedles.badge")}</span>
                            </>
                        ) : (
                            <>
                                {needleCount}
                                {t(
                                    needleCount === 1
                                        ? "remainingNeedles.titlePrefixSingular"
                                        : "remainingNeedles.titlePrefixPlural",
                                )}
                                <span className={styles.remainingBadge}>{t("remainingNeedles.badge")}</span>
                            </>
                        )}
                    </span>
                </div>
                <span className={styles.subtitle}>
                    {t(
                        variant === "interimRemaining"
                            ? "interimRemainingNeedles.subtitle"
                            : variant === "extra"
                              ? "extraNeedles.subtitle"
                              : variant === "misplaced"
                                ? needleCount === 1
                                    ? "misplacedNeedles.subtitleSingular"
                                    : "misplacedNeedles.subtitlePlural"
                                : needleCount === 1
                                  ? "remainingNeedles.subtitleSingular"
                                  : "remainingNeedles.subtitlePlural",
                    )}
                </span>

                <div className={styles.cardRow}>
                    {INSTRUCTION_CARDS.map((card) => (
                        <div key={card.number} className={styles.card}>
                            <img className={styles.cardImage} src={card.image} alt={t(card.labelKey)} />
                            <span className={styles.cardLabel}>
                                {card.number}. {t(card.labelKey)}
                            </span>
                        </div>
                    ))}
                </div>

                {!hideButtons && (
                    <div className={styles.buttonRow}>
                        <button className={styles.notFoundButton} onClick={onNeedleNotFound}>
                            {t("extraNeedles.notFound")} <span className={styles.buttonIcon}>&#10005;</span>
                        </button>
                        <button className={styles.foundButton} onClick={onNeedleFound}>
                            {t("extraNeedles.found")} <span className={styles.buttonIcon}>&#10003;</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
