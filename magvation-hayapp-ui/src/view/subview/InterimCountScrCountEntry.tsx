import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/interimCountScrCountEntry.module.css";
import AskBubbles from "../../img/AskBubbles.svg";
import LeftArrow from "../../img/LeftArrow.svg";
import BlackClose from "../../img/BlackClose.svg";
import WhiteClose from "../../img/WhiteClose.svg";
import NumpadBack from "../../img/NumpadBack.svg";

const MAX_DIGITS = 5;

interface InterimCountScrCountEntryProps {
    initialCount: number;
    onConfirm: (count: number) => void | Promise<void>;
}

export const InterimCountScrCountEntry: React.FC<InterimCountScrCountEntryProps> = ({ initialCount, onConfirm }) => {
    const { t } = useTranslation();
    const [digitStr, setDigitStr] = useState(() => (initialCount > 0 ? String(initialCount) : ""));

    const displayValue = digitStr || "0";
    const hasValue = digitStr !== "" && parseInt(digitStr, 10) > 0;

    const appendDigit = useCallback((n: number) => {
        setDigitStr((prev) => {
            if (prev.length >= MAX_DIGITS) return prev;
            return prev + String(n);
        });
    }, []);

    const undo = useCallback(() => {
        setDigitStr((prev) => prev.slice(0, -1));
    }, []);

    const clearAll = useCallback(() => {
        setDigitStr("");
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!hasValue) return;
        await onConfirm(parseInt(digitStr, 10));
    }, [digitStr, hasValue, onConfirm]);

    return (
        <div className={styles.wrap}>
            <div className={styles.panels}>
                <div className={styles.leftPanel}>
                    <img src={AskBubbles} alt="" className={styles.bubbleArt} />
                    <p className={styles.instruction}>{t("interimCount.scrCountEntry.instruction")}</p>
                </div>
                <div className={styles.rightPanel}>
                    <div className={styles.innerDark}>
                        <div className={styles.toolbar}>
                            <button type="button" className={styles.undoBtn} onClick={undo} disabled={digitStr === ""}>
                                <img src={LeftArrow} alt="" className={styles.toolIcon} />
                                {t("interimCount.scrCountEntry.undo")}
                            </button>
                            <button type="button" className={styles.clearBtn} onClick={clearAll} disabled={!hasValue}>
                                {t("interimCount.scrCountEntry.clearAll")}
                                <img src={hasValue ? WhiteClose : BlackClose} alt="" className={styles.toolIcon} />
                            </button>
                        </div>
                        <div className={styles.displayWrap}>
                            <span className={hasValue ? styles.displayActive : styles.displayMuted}>
                                {displayValue}
                            </span>
                        </div>
                        <div className={styles.numpadBlock}>
                            <div className={styles.numpadRow}>
                                {[1, 2, 3].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className={styles.numpadButton}
                                        onClick={() => appendDigit(n)}
                                    >
                                        <span>{n}</span>
                                    </button>
                                ))}
                            </div>
                            <div className={styles.numpadRow}>
                                {[4, 5, 6].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className={styles.numpadButton}
                                        onClick={() => appendDigit(n)}
                                    >
                                        <span>{n}</span>
                                    </button>
                                ))}
                            </div>
                            <div className={styles.numpadRow}>
                                {[7, 8, 9].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className={styles.numpadButton}
                                        onClick={() => appendDigit(n)}
                                    >
                                        <span>{n}</span>
                                    </button>
                                ))}
                            </div>
                            <div className={styles.numpadRow}>
                                <div className={styles.blankCell} aria-hidden />
                                <button type="button" className={styles.numpadButton} onClick={() => appendDigit(0)}>
                                    <span>0</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.backCell}
                                    onClick={undo}
                                    disabled={digitStr === ""}
                                >
                                    <img src={NumpadBack} alt="" className={styles.backImg} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={styles.confirmButton}
                        disabled={!hasValue}
                        onClick={() => void handleConfirm()}
                    >
                        {t("interimCount.scrCountEntry.confirm")}
                    </button>
                </div>
            </div>
        </div>
    );
};
