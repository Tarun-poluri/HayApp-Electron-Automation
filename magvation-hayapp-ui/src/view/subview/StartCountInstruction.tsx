import React from "react";
import styles from "../subviewcss/startCountInstruction.module.css";
import { useTranslation } from "react-i18next";
import RightArrowBlack from "../../img/RightArrowBlack.svg";

interface StartCountInstructionProps {
    instructionKey: string;
    defaultInstruction: string;
    showProceedButton: boolean;
    onProceed?: () => void;
    image?: string;
    imageClassName?: string; // Optional custom CSS class for image
    category?: "Open" | "JIT" | "Closing";
    instructionKey1?: string;
    instructionKey2?: string;
    defaultInstruction1?: string;
    defaultInstruction2?: string;
    proceedButtonTextKey?: string;
    showArrow?: boolean;
    overlapText?: boolean; // Allow text to overlap bottom of image
    showInstructionMarginTop?: boolean;
    suffixText?: string; // Optional suffix rendered after instructionKey2 (category variant)
    translationVars?: Record<string, string>;
}

export const StartCountInstruction: React.FC<StartCountInstructionProps> = ({
    instructionKey,
    defaultInstruction,
    showProceedButton,
    onProceed,
    image,
    imageClassName,
    category,
    instructionKey1,
    instructionKey2,
    defaultInstruction1,
    defaultInstruction2,
    proceedButtonTextKey = "footer.proceed",
    showArrow = true,
    overlapText = false,
    showInstructionMarginTop = true,
    suffixText,
    translationVars,
}) => {
    const { t } = useTranslation();

    const getLabelClass = () => {
        if (category === "Open") return styles.labelContainerOpen;
        if (category === "Closing") return styles.labelContainerClosing;
        if (category === "JIT") return styles.labelContainerJIT;
        return styles.labelContainer;
    };

    const getCategoryLabel = () => {
        if (category === "Open") return t("setup.startCount.open", { defaultValue: "Open" });
        if (category === "Closing") return t("setup.startCount.closing", { defaultValue: "Close" });
        if (category === "JIT") return t("setup.startCount.jit", { defaultValue: "JIT" });
        return "";
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {image && <img src={image} className={imageClassName || styles.cameraArea} alt="Camera Preview" />}

                <div
                    className={`${styles.instruction} ${overlapText ? styles.instructionOverlap : ""} ${!showInstructionMarginTop ? styles.instructionNoMarginTop : ""}`}
                >
                    {category && instructionKey1 && instructionKey2 ? (
                        <div className={styles.textContainer}>
                            {t(instructionKey1, { defaultValue: defaultInstruction1 || "" })}
                            <span className={getLabelClass()}>{getCategoryLabel()}</span>
                            {t(instructionKey2, { defaultValue: defaultInstruction2 || "" })}
                            {suffixText && suffixText}
                        </div>
                    ) : (
                        t(instructionKey, { defaultValue: defaultInstruction, ...translationVars })
                    )}
                </div>

                <div className={styles.buttonArea}>
                    {showProceedButton && onProceed && (
                        <button className={styles.proceedButton} onClick={onProceed}>
                            {t(proceedButtonTextKey, { defaultValue: "Proceed" })}
                            {showArrow && <img src={RightArrowBlack} alt="" className={styles.arrowIcon} />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
