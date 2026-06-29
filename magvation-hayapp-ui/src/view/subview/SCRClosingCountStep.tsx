import React, { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/scrClosingCountStep.module.css";
import SCRHayStackButton from "../../component/SCRHayStackButton";
import BlankImageIcon from "../../img/BlankImageIcon.svg";
import { AppContext } from "../App";

type ActiveButton = "yes" | "validate";

interface SCRClosingCountStepProps {
    prefixKey: string;
    highlightKey?: string;
    suffixKey?: string;
    activeButton?: ActiveButton;
    onConfirm: () => void;
    /** Optional override for the instruction text wrapper className. */
    textWrapperClassName?: string;
}

export const SCRClosingCountStep: React.FC<SCRClosingCountStepProps> = ({
    prefixKey,
    highlightKey,
    suffixKey,
    activeButton = "yes",
    onConfirm,
    textWrapperClassName,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const lastArrowTap = useRef<{ key: string; time: number }>({ key: "", time: 0 });

    const haystackButton = activeButton === "yes" ? "yes" : "validate";

    // HayStack physical button listener
    useEffect(() => {
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            if (event.button === haystackButton) {
                onConfirm();
            }
        };
        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.caseService.parlayInterface.hayStack, onConfirm, haystackButton]);

    // Double-tap right arrow key bypass (dev testing)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight") return;

            const now = Date.now();
            const last = lastArrowTap.current;

            if (last.key === e.key && now - last.time < 400) {
                onConfirm();
                lastArrowTap.current = { key: "", time: 0 };
            } else {
                lastArrowTap.current = { key: e.key, time: now };
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onConfirm]);

    const buttonLabel = activeButton === "yes" ? t("scrClosingCount.confirm") : t("scrClosingCount.validate");

    return (
        <div className={styles.contentArea}>
            <div className={styles.card}>
                <div className={styles.imagePlaceholder}>
                    <img src={BlankImageIcon} alt="" className={styles.placeholderIcon} />
                </div>
                <div className={textWrapperClassName || styles.instructionTextWrapper}>
                    <span className={styles.instructionText}>
                        {t(prefixKey)}
                        {highlightKey && <span className={styles.highlightText}>{t(highlightKey)}</span>}
                        {suffixKey && t(suffixKey)}
                    </span>
                </div>
                <div className={styles.buttonRow}>
                    <SCRHayStackButton
                        type="yes"
                        active={activeButton === "yes"}
                        title={activeButton === "yes" ? buttonLabel : undefined}
                        circleClassName={activeButton === "yes" ? styles.confirmColor : styles.grayCircle}
                        onClick={activeButton === "yes" ? onConfirm : undefined}
                    />
                    <SCRHayStackButton
                        type="validate"
                        active={activeButton === "validate"}
                        title={activeButton === "validate" ? buttonLabel : undefined}
                        circleClassName={activeButton === "validate" ? styles.validateColor : styles.grayCircle}
                        onClick={activeButton === "validate" ? onConfirm : undefined}
                    />
                    <SCRHayStackButton type="action" circleClassName={styles.grayCircle} />
                    <SCRHayStackButton type="no" circleClassName={styles.grayCircle} />
                </div>
            </div>
        </div>
    );
};
