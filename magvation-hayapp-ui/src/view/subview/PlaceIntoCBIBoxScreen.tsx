import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/placeIntoCBIBoxScreen.module.css";
import { BasicHeader } from "../../component/BasicHeader";
import PlaceIntoCBIBoxContaminated from "../../img/PlaceIntoCBIBoxContaminated.svg";
import PlaceIntoCBIBoxBroken from "../../img/PlaceIntoCBIBoxBroken.svg";
import PlaceIntoCBIBoxIncompatible from "../../img/PlaceIntoCBIBoxIncompatible.svg";
import BlackRightArrow from "../../img/BlackRightArrow.svg";

type CBINeedleType = "contaminated" | "broken" | "incompatible";

interface PlaceIntoCBIBoxScreenProps {
    variant: CBINeedleType;
    onTakePhoto: () => void;
    onBack: () => void;
    /** Section 6 only: broken question answer determines instruction text. */
    brokenHasFragment?: boolean;
}

const VARIANT_CONFIG: Record<
    CBINeedleType,
    {
        titleKey: string;
        image: string;
        preKey: string;
        highlightKey: string;
        postKey: string;
        highlightClass: string;
    }
> = {
    contaminated: {
        titleKey: "section4.titleContaminated",
        image: PlaceIntoCBIBoxContaminated,
        preKey: "section4.instructionContaminatedPre",
        highlightKey: "section4.highlightContaminated",
        postKey: "section4.instructionContaminatedPost",
        highlightClass: styles.contaminatedHighlight,
    },
    broken: {
        titleKey: "section4.titleBroken",
        image: PlaceIntoCBIBoxBroken,
        preKey: "section4.instructionBrokenPre",
        highlightKey: "section4.highlightBroken",
        postKey: "section4.instructionBrokenPost",
        highlightClass: styles.brokenHighlight,
    },
    incompatible: {
        titleKey: "section4.titleIncompatible",
        image: PlaceIntoCBIBoxIncompatible,
        preKey: "section4.instructionIncompatiblePre",
        highlightKey: "section4.highlightIncompatible",
        postKey: "section4.instructionIncompatiblePost",
        highlightClass: styles.incompatibleHighlight,
    },
};

/** Parse a translation string with <highlight>...</highlight> tags into React nodes. */
const renderHighlightedText = (text: string, highlightClass: string): React.ReactNode[] => {
    const parts = text.split(/<highlight>|<\/highlight>/);
    return parts.map((part, i) =>
        i % 2 === 1 ? (
            <span key={i} className={highlightClass}>
                {part}
            </span>
        ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
        ),
    );
};

export const PlaceIntoCBIBoxScreen: React.FC<PlaceIntoCBIBoxScreenProps> = ({
    variant,
    onTakePhoto,
    onBack,
    brokenHasFragment,
}) => {
    const { t } = useTranslation();
    const config = VARIANT_CONFIG[variant];

    // Section 6 broken variant: use single-string instruction based on fragment answer
    const useS6BrokenInstruction = variant === "broken" && brokenHasFragment !== undefined;
    const s6InstructionKey = brokenHasFragment
        ? "cbi.broken.captureItem.instructionSelectYes"
        : "cbi.broken.captureItem.instructionSelectNo";

    return (
        <div className={styles.screenContainer}>
            <BasicHeader title={t(config.titleKey)} onBack={onBack} showHelp />
            <div className={styles.contentArea}>
                <img className={styles.cbiBoxImage} src={config.image} alt="CBI Box" />
                <p className={styles.instructionText}>
                    {useS6BrokenInstruction ? (
                        renderHighlightedText(t(s6InstructionKey), config.highlightClass)
                    ) : (
                        <>
                            {t(config.preKey)}
                            <span className={config.highlightClass}>{t(config.highlightKey)}</span>
                            {t(config.postKey)}
                        </>
                    )}
                </p>
                <div className={styles.buttonContainer}>
                    <button className={styles.takePhotoButton} onClick={onTakePhoto}>
                        {t("section4.proceed")}
                        <img src={BlackRightArrow} alt="" className={styles.buttonArrow} />
                    </button>
                </div>
            </div>
        </div>
    );
};
