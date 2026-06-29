import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/needleXrayScreen.module.css";
import ExtraNeedleXRay from "../../img/ExtraNeedleXRay.svg";

interface NeedleXrayScreenProps {
    needleCount: number;
    variant?: "extra" | "misplaced";
    onNeedleFound?: () => void;
    onNeedleNotFound?: () => void;
    /** Hide the Found/Not Found buttons (read-only SCR mirror). */
    hideButtons?: boolean;
}

export const NeedleXrayScreen: React.FC<NeedleXrayScreenProps> = ({
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
                <img className={styles.xrayImage} src={ExtraNeedleXRay} alt="X-ray machine" />

                <div className={styles.titleRow}>
                    <span className={styles.titleText}>
                        {variant === "extra" ? (
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
                        ) : (
                            <>
                                {needleCount}
                                {t(
                                    needleCount === 1
                                        ? "misplacedNeedles.xrayTitlePrefixSingular"
                                        : "misplacedNeedles.xrayTitlePrefixPlural",
                                )}
                                <span className={styles.extraBadge}>{t("misplacedNeedles.badge")}</span>
                            </>
                        )}
                    </span>
                </div>
                <span className={styles.subtitle}>
                    {t(
                        variant === "extra"
                            ? "extraNeedles.subtitleXray"
                            : needleCount === 1
                              ? "misplacedNeedles.subtitleXraySingular"
                              : "misplacedNeedles.subtitleXrayPlural",
                    )}
                </span>

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
