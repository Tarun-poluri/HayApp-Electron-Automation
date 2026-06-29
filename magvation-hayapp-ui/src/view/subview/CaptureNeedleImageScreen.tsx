import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/captureNeedleImageScreen.module.css";
import { BasicHeader } from "../../component/BasicHeader";
import CaptureContaminatedNeedleImage from "../../img/CaptureContaminatedNeedleImage.svg";
import CaptureBrokenNeedleImage from "../../img/CaptureBrokenNeedleImage.svg";
import CaptureIncompatibleNeedleImage from "../../img/CaptureIncompatibleNeedleImage.svg";

type CBINeedleType = "contaminated" | "broken" | "incompatible";

interface CaptureNeedleImageScreenProps {
    variant: CBINeedleType;
    onBack: () => void;
}

const VARIANT_CONFIG: Record<
    CBINeedleType,
    {
        headerKey: string;
        image: string;
        highlightKey: string;
        highlightClass: string;
    }
> = {
    contaminated: {
        headerKey: "section4.captureHeaderContaminated",
        image: CaptureContaminatedNeedleImage,
        highlightKey: "section4.captureHighlightContaminated",
        highlightClass: styles.contaminatedHighlight,
    },
    broken: {
        headerKey: "section4.captureHeaderBroken",
        image: CaptureBrokenNeedleImage,
        highlightKey: "section4.captureHighlightBroken",
        highlightClass: styles.brokenHighlight,
    },
    incompatible: {
        headerKey: "section4.captureHeaderIncompatible",
        image: CaptureIncompatibleNeedleImage,
        highlightKey: "section4.captureHighlightIncompatible",
        highlightClass: styles.incompatibleHighlight,
    },
};

export const CaptureNeedleImageScreen: React.FC<CaptureNeedleImageScreenProps> = ({ variant, onBack }) => {
    const { t } = useTranslation();
    const config = VARIANT_CONFIG[variant];

    return (
        <div className={styles.screenContainer}>
            <BasicHeader title={t(config.headerKey)} onBack={onBack} showHelp />
            <div className={styles.contentArea}>
                <img className={styles.captureImage} src={config.image} alt="Capture Needle" />
                <p className={styles.instructionText}>
                    {t("section4.captureInstructionPre")}
                    <span className={config.highlightClass}>{t(config.highlightKey)}</span>
                    {t("section4.captureInstructionPost")}
                </p>
            </div>
        </div>
    );
};
