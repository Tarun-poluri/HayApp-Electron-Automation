import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/needleRegisteredScreen.module.css";
import ExtraNeedleCounter from "../../img/ExtraNeedleCounter.svg";
import MissingNeedleCounter from "../../img/MissingNeedleCounter.svg";

interface NeedleRegisteredScreenProps {
    needleCount: number;
    variant?: "extra" | "misplaced" | "remaining";
    onOk?: () => void;
    /** Hide the OK button (read-only SCR mirror). */
    hideButtons?: boolean;
}

export const NeedleRegisteredScreen: React.FC<NeedleRegisteredScreenProps> = ({
    needleCount,
    variant = "extra",
    onOk,
    hideButtons = false,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.screenContainer}>
            <div className={styles.contentArea}>
                <div className={styles.illustrationContainer}>
                    <img
                        className={`${styles.illustrationImage} ${variant === "extra" ? styles.illustrationImageExtra : styles.illustrationImageMisplaced}`}
                        src={variant === "extra" ? ExtraNeedleCounter : MissingNeedleCounter}
                        alt={
                            variant === "extra"
                                ? "Extra needles registered"
                                : variant === "remaining"
                                  ? "Remaining needles registered"
                                  : "Missing needles registered"
                        }
                    />
                    <span className={styles.illustrationCount}>{needleCount}</span>
                </div>

                <div className={styles.titleRow}>
                    <span className={styles.titleText}>
                        {needleCount}
                        {t(
                            variant === "extra"
                                ? needleCount === 1
                                    ? "extraNeedles.registeredPrefixSingular"
                                    : "extraNeedles.registeredPrefixPlural"
                                : variant === "remaining"
                                  ? needleCount === 1
                                      ? "remainingNeedles.registeredPrefixSingular"
                                      : "remainingNeedles.registeredPrefixPlural"
                                  : needleCount === 1
                                    ? "misplacedNeedles.registeredPrefixSingular"
                                    : "misplacedNeedles.registeredPrefixPlural",
                        )}
                        <span className={styles.extraBadge}>
                            {t(
                                variant === "extra"
                                    ? "extraNeedles.extra"
                                    : variant === "remaining"
                                      ? "remainingNeedles.registeredBadge"
                                      : "misplacedNeedles.registeredBadge",
                            )}
                        </span>
                    </span>
                </div>

                {!hideButtons ? (
                    <button className={styles.okButton} onClick={onOk}>
                        {t("extraNeedles.ok")}
                    </button>
                ) : (
                    <div className={styles.buttonSpacer} />
                )}
            </div>
        </div>
    );
};
