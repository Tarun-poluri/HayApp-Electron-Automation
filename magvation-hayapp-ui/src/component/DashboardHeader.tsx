import React, { useContext } from "react";
import styles from "./DashboardHeader.module.css";
import { useTranslation } from "react-i18next";
import { AppContext } from "../view/App";
import { useListenable } from "../util/Listenable";
import StageTracker from "./StageTracker";
import InfoBar from "./InfoBar";
import MagIcon from "../img/magIcon.svg";
import MagTitle from "../img/magTitle.svg";
import BackArrow from "../img/BackArrow.svg";

export interface DashboardHeaderProps {
    title?: string;
    showBranding?: boolean;
    showStageTracker?: boolean;
    showInfoBar?: boolean;
    stage?: number;
    stageLabels?: string[];
    stageLabel?: string;
    className?: string;
    children?: React.ReactNode;
    showLit?: boolean;
    showPadding?: boolean;
    showAbortButton?: boolean;
    onAbortCase?: () => void;
    onBack?: () => void;
    hideBack?: boolean;
    backIcon?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    title,
    showBranding = false,
    showStageTracker = true,
    showInfoBar = true,
    stage: customStage,
    stageLabels,
    stageLabel,
    className,
    children,
    showLit,
    showPadding = false,
    showAbortButton = false,
    onAbortCase,
    onBack,
    hideBack = false,
    backIcon = BackArrow,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const contextStage = useListenable(appContext.caseService.stage);

    const stage = customStage ?? contextStage;
    const displayTitle = title ?? t("stageTracker.case");
    const displayStageLabel = stageLabel ?? t("stageTracker.stage");

    const stageNumbers = stageLabels ?? [
        t("stageTracker.stage1"),
        t("stageTracker.stage2"),
        t("stageTracker.stage3"),
        t("stageTracker.stage4"),
        t("stageTracker.stage5"),
    ];

    // Map stage numbers to colors
    const getStageColor = (stageNum: number): string | undefined => {
        switch (stageNum) {
            case 1:
                return "rgba(210, 178, 255, 1)";
            case 2:
                return "#4FE2CE";
            default:
                return undefined;
        }
    };

    return (
        <header
            className={`${styles.headerContainer} ${showPadding ? styles.headerContainerWithPadding : ""} ${showBranding ? styles.headerContainerWithBranding : ""} ${className ?? ""}`}
        >
            <div
                className={`${styles.headerTextContainer} ${showBranding ? styles.headerTextContainerWithBranding : ""}`}
            >
                {showBranding && (
                    <>
                        <div className={styles.brandingContainer}>
                            <img src={MagIcon} alt="Magvation Logo" className={styles.logo} />
                            <img src={MagTitle} alt="Magvation Title" className={styles.title} />
                        </div>
                        <div className={styles.verticalBar}></div>
                    </>
                )}
                {!showBranding && !hideBack && onBack && (
                    <button className={styles.roundButton} onClick={onBack} aria-label="Back">
                        <img src={backIcon} alt="Back" className={styles.backArrow} />
                    </button>
                )}
                <h1 className={`${styles.headerText} ${showBranding ? styles.headerTextWithBranding : ""}`}>
                    {displayTitle}
                </h1>
                {children}
            </div>
            {showStageTracker && (
                <StageTracker
                    stage={stage}
                    stageNumbers={stageNumbers}
                    stageLabel={displayStageLabel}
                    activeColor={getStageColor(stage)}
                />
            )}
            {showInfoBar && <InfoBar showLit={showLit} showAbortButton={showAbortButton} onAbortCase={onAbortCase} />}
        </header>
    );
};

export default DashboardHeader;
