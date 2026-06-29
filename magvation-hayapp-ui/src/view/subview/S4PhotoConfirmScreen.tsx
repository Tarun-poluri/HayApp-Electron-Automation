import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/s4PhotoConfirmScreen.module.css";
import { BasicHeader } from "../../component/BasicHeader";
import { AppContext } from "../App";
import { useListenable } from "../../util/Listenable";
import ContaminatedCBI from "../../img/ContaminatedCBI.svg";
import BrokenCBI from "../../img/BrokenCBI.svg";
import IncompatibleCBI from "../../img/IncompatibleCBI.svg";

type CBINeedleType = "contaminated" | "broken" | "incompatible";

interface S4PhotoConfirmScreenProps {
    variant: CBINeedleType;
    imageSrc: string | null;
    onRetake: () => void;
    onConfirm: () => void;
    onBack: () => void;
}

const VARIANT_CONFIG: Record<CBINeedleType, string> = {
    contaminated: "section4.captureHeaderContaminated",
    broken: "section4.captureHeaderBroken",
    incompatible: "section4.captureHeaderIncompatible",
};

const FALLBACK_IMAGES: Record<string, string> = {
    broken: BrokenCBI,
    contaminated: ContaminatedCBI,
    incompatible: IncompatibleCBI,
};

export const S4PhotoConfirmScreen: React.FC<S4PhotoConfirmScreenProps> = ({
    variant,
    imageSrc,
    onRetake,
    onConfirm,
    onBack,
}) => {
    const { t } = useTranslation();
    const headerKey = VARIANT_CONFIG[variant];
    const appContext = useContext(AppContext);
    const cbiImageResult = useListenable(appContext.caseService.cbiImage);
    const displayImage =
        imageSrc ??
        (cbiImageResult?.image_filename
            ? `http://localhost:8080/hayscan_cbi_images/${cbiImageResult.image_filename}`
            : FALLBACK_IMAGES[variant]);

    return (
        <div className={styles.screenContainer}>
            <BasicHeader title={t(headerKey)} onBack={onBack} showHelp />
            <div className={styles.contentArea}>
                <div className={styles.imagePanel}>
                    <img className={styles.capturedImage} src={displayImage} alt="CBI Box" />
                </div>
                <div className={styles.confirmPanel}>
                    <p className={styles.confirmTitle}>{t("section4.keepThisImage")}</p>
                    <div className={styles.buttonRow}>
                        <button className={styles.retakeButton} onClick={onRetake}>
                            {t("section4.retake")}
                        </button>
                        <button className={styles.yesButton} onClick={onConfirm}>
                            {t("section4.yes")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
