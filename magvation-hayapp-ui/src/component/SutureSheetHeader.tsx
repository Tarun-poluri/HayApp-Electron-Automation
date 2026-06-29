import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./SutureSheetHeader.module.css";
import BackArrow from "../img/BackArrow.svg";
import UndoWhite from "../img/UndoWhite.svg";
import Help from "../img/HelpIcon.svg";
import CloseWhite from "../img/CloseWhite.svg";

interface SutureSheetHeaderProps {
    title: string;
    onBack?: () => void;
    image?: string;
    packNumber: number;
    needleNumber: number;
    redundant: boolean;
    onSkip?: () => void;
    onClose?: () => void;
}

export const SutureSheetHeader: React.FC<SutureSheetHeaderProps> = ({
    title,
    onBack,
    image,
    packNumber,
    needleNumber,
    redundant,
    onSkip,
    onClose,
}) => {
    const { t } = useTranslation();

    const packText = redundant
        ? `${t("sutureSheetHeader.redundant")} ${packNumber} ${t("sutureSheetHeader.packs")}`
        : `${packNumber} ${t("sutureSheetHeader.packs")}`;

    const needleText = `${needleNumber} ${t("sutureSheetHeader.sutureNeedles")}`;

    return (
        <div className={styles.header}>
            <div className={styles.headerInnerContainer}>
                <div className={styles.backButton} onClick={onBack}>
                    <img src={BackArrow} className={styles.backArrow} alt={t("Back")} />
                </div>
                <div className={styles.leftContainer}>
                    <div className={styles.titleContainer}>
                        {image && <img src={image} className={styles.categoryIcon} alt={t("Category")} />}
                        <div className={styles.titleTextContainer}>
                            <span className={styles.titleText}>{title}</span>
                            {redundant && <span className={styles.skipText}>{t("sutureSheetHeader.skipMessage")}</span>}
                        </div>
                    </div>
                    <div className={styles.chipContainer}>
                        <div className={styles.chip}>
                            <span className={styles.chipText}>{packText}</span>
                            <span className={styles.dividerText}>|</span>
                            <span className={styles.chipText}>{needleText}</span>
                        </div>
                    </div>
                </div>
                <div className={styles.rightContainer}>
                    <div className={styles.divider}></div>
                    <div className={styles.helpContainer}>
                        <img src={Help} className={styles.helpIcon} alt={t("Help")} />
                        <span className={styles.helpText}>{t("sutureSheetHeader.help")}</span>
                    </div>
                    {redundant && (
                        <>
                            <div className={styles.divider}></div>
                            <button className={styles.skipButton} onClick={onSkip}>
                                <img src={UndoWhite} className={styles.undoIcon} alt={t("Undo")} />
                                <span className={styles.skipButtonText}>{t("sutureSheetHeader.skipButton")}</span>
                            </button>
                        </>
                    )}
                    {onClose && (
                        <>
                            <div className={styles.divider}></div>
                            <div
                                className={styles.backButton}
                                onClick={onClose}
                                role="button"
                                style={{ cursor: "pointer" }}
                            >
                                <img src={CloseWhite} className={styles.backArrow} alt={t("Close")} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
