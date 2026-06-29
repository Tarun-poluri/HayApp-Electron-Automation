import React, { useState, useContext } from "react";
import styles from "../subviewcss/trackingHeader.module.css";
import StageTracker from "../../component/StageTracker";
import { useTranslation } from "react-i18next";
import { ConfirmationPopup } from "../../component/ConfirmationPopup";
import HeaderLoginIcon from "../../img/HeaderLogin.svg";
import HeaderLogoutIcon from "../../img/HeaderLogout.svg";
import HelpIcon from "../../img/HelpIcon.svg";
import { HayAppUser } from "../../services/StaffService";
import BackArrowImg from "../../img/BackArrow.svg";
import RightChevron from "../../img/RightChevron.svg";
import { AppContext } from "../App";
import { useSurgeonsView } from "../../contexts/SurgeonsViewContext";
import { useListenable } from "../../util/Listenable";

interface TrackingHeaderProps {
    stage: number;
    onBack?: () => void;
    title?: string;
    showAbortButton?: boolean;
    onAbortCase?: () => void;
    circulatorUser?: HayAppUser;
    scrubUser?: HayAppUser;
    showBadges?: boolean;
    onCirLogout?: () => void;
    onScrLogout?: () => void;
    onCirLogin?: () => void;
    onScrLogin?: () => void;
    onViewSurgeons?: () => void; // Optional - if provided, overrides default context behavior
    showSurgeonBadge?: boolean; // Optional - controls whether surgeon badge is shown. Defaults to true.
    showHelp?: boolean;
    onHelp?: () => void;
    stageColor?: string;
    showNames?: boolean;
    /** When set with showAbortButton, overrides the default abort label (e.g. "Abort Count"). */
    abortButtonLabel?: string;
    /** Hide the stage tracker strip (e.g. interim count reason screen). */
    hideStageTracker?: boolean;
    /** Render Help before Abort; adds an extra divider before Abort. */
    flipHelpAndAbort?: boolean;
}

export const TrackingHeader: React.FC<TrackingHeaderProps> = ({
    stage,
    onBack,
    title,
    showAbortButton = false,
    onAbortCase,
    circulatorUser,
    scrubUser,
    showBadges = false,
    onCirLogout,
    onScrLogout,
    onCirLogin,
    onScrLogin,
    onViewSurgeons,
    showSurgeonBadge = true,
    showHelp = true,
    onHelp,
    stageColor,
    showNames = false,
    abortButtonLabel,
    hideStageTracker = false,
    flipHelpAndAbort = false,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const { showSurgeonsView, surgeonFlowActive, surgeonFlowMode } = useSurgeonsView();
    const [showAbortModal, setShowAbortModal] = useState(false);

    // Use reactive properties from CaseService
    const surgeonCount = useListenable(appContext.caseService.surgeonCount);
    const firstSurgeonName = useListenable(appContext.caseService.firstSurgeonName);
    const surgeon = useListenable(appContext.caseService.surgeon);
    const circulator = useListenable(appContext.caseService.circulator);
    const scrub = useListenable(appContext.caseService.scrub);

    const handleViewSurgeons = () => {
        if (onViewSurgeons) {
            // Use custom callback if provided (for Setup.tsx navigation)
            onViewSurgeons();
        } else {
            // Otherwise use global context to show modal overlay
            showSurgeonsView();
        }
    };

    const stageNumbers = [
        t("stageTracker.stage1"),
        t("stageTracker.stage2"),
        t("stageTracker.stage3"),
        t("stageTracker.stage4"),
        t("stageTracker.stage5"),
    ];
    const stageLabel = t("stageTracker.stage");

    return (
        <div className={styles.header}>
            {onBack && (
                <button className={styles.backButton} onClick={onBack}>
                    <img src={BackArrowImg} alt="Back" />
                </button>
            )}
            <div className={styles.left}>
                <div className={styles.title}>{title || "Setup"}</div>
            </div>

            {!hideStageTracker && (
                <div className={styles.stages}>
                    <StageTracker
                        stage={stage}
                        stageNumbers={stageNumbers}
                        stageLabel={stageLabel}
                        activeColor={stageColor}
                    />
                </div>
            )}

            {((showSurgeonBadge && surgeonCount > 0 && !(surgeonFlowActive && surgeonFlowMode === "add")) ||
                showBadges ||
                showNames ||
                showAbortButton ||
                showHelp) && (
                <div className={styles.rightSection}>
                    {/* Default layout: Help first (before badges), matching dev branch */}
                    {!flipHelpAndAbort && showHelp && (
                        <>
                            <div className={styles.verticalBar} />
                            <div
                                className={styles.helpButton}
                                onClick={onHelp}
                                role={onHelp ? "button" : undefined}
                                style={onHelp ? { cursor: "pointer" } : undefined}
                            >
                                <img src={HelpIcon} alt="Help" className={styles.helpIcon} />
                                <span className={styles.helpText}>{t("sidebar.help")}</span>
                            </div>
                            <div className={styles.verticalBar} />
                        </>
                    )}

                    {/* Multi-surgeon badge display */}
                    {showSurgeonBadge && surgeonCount > 0 && !(surgeonFlowActive && surgeonFlowMode === "add") && (
                        <>
                            <div className={styles.userBadge}>
                                <div className={styles.badgeInfo}>
                                    <div className={styles.badgeRole}>
                                        {surgeonCount === 1
                                            ? t("setup.header.surgeon")
                                            : t("setup.header.surgeons", { defaultValue: "surgeons" })}
                                    </div>
                                    <div className={styles.badgeName}>
                                        {surgeonCount === 1 && firstSurgeonName
                                            ? firstSurgeonName
                                            : `${surgeonCount} ${surgeonCount === 1 ? t("setup.header.surgeon") : t("setup.header.surgeonsLower", { defaultValue: "surgeons" })}`}
                                    </div>
                                </div>
                                <div className={styles.badgeActionView} onClick={handleViewSurgeons} role="button">
                                    <img
                                        src={RightChevron}
                                        alt={t("setup.header.viewSurgeons", { defaultValue: "View" })}
                                        className={styles.badgeChevron}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {showNames && (
                        <>
                            <div className={styles.staffInfo}>
                                <div className={styles.userRole}>
                                    {surgeonCount > 1 ? t("infoBar.surgeons") : t("infoBar.surgeon")}
                                </div>
                                <div className={styles.userName}>
                                    {surgeonCount > 1
                                        ? `${surgeonCount} ${t("infoBar.surgeonsLower")}`
                                        : firstSurgeonName ||
                                          (surgeon ? `${surgeon.first_name} ${surgeon.last_name}` : "-")}
                                </div>
                            </div>
                            <div className={styles.verticalBar} />
                            <div className={styles.staffInfo}>
                                <div className={styles.userRole}>{t("infoBar.cir")}</div>
                                <div className={styles.userName}>
                                    {circulator ? `${circulator.first_name} ${circulator.last_name}` : "-"}
                                </div>
                            </div>
                            <div className={styles.verticalBar} />
                            <div className={styles.staffInfo}>
                                <div className={styles.userRole}>{t("infoBar.scr")}</div>
                                <div className={styles.userName}>
                                    {scrub ? `${scrub.first_name} ${scrub.last_name}` : "-"}
                                </div>
                            </div>
                        </>
                    )}
                    {showBadges && (
                        <>
                            {/* CIR Badge */}
                            <div className={styles.userBadge}>
                                <div className={styles.badgeInfo}>
                                    <div className={styles.badgeRole}>{t("setup.header.cir")}</div>
                                    <div className={styles.badgeName}>
                                        {circulatorUser
                                            ? `${circulatorUser.first_name} ${circulatorUser.last_name}`
                                            : "-"}
                                    </div>
                                </div>
                                <div
                                    className={circulatorUser ? styles.badgeActionLogout : styles.badgeActionLogin}
                                    onClick={circulatorUser ? onCirLogout || undefined : onCirLogin || undefined}
                                >
                                    <img
                                        src={circulatorUser ? HeaderLogoutIcon : HeaderLoginIcon}
                                        alt={circulatorUser ? t("setup.header.logout") : t("setup.header.login")}
                                        className={styles.badgeIcon}
                                    />
                                    <span className={styles.badgeActionLabel}>
                                        {circulatorUser ? t("setup.header.logout") : t("setup.header.login")}
                                    </span>
                                </div>
                            </div>
                            {/* SCR Badge */}
                            <div className={styles.userBadge}>
                                <div className={styles.badgeInfo}>
                                    <div className={styles.badgeRole}>{t("setup.header.scr")}</div>
                                    <div className={styles.badgeName}>
                                        {scrubUser ? `${scrubUser.first_name} ${scrubUser.last_name}` : "-"}
                                    </div>
                                </div>
                                <div
                                    className={scrubUser ? styles.badgeActionLogout : styles.badgeActionLogin}
                                    onClick={scrubUser ? onScrLogout || undefined : onScrLogin || undefined}
                                >
                                    <img
                                        src={scrubUser ? HeaderLogoutIcon : HeaderLoginIcon}
                                        alt={scrubUser ? t("setup.header.logout") : t("setup.header.login")}
                                        className={styles.badgeIcon}
                                    />
                                    <span className={styles.badgeActionLabel}>
                                        {scrubUser ? t("setup.header.logout") : t("setup.header.login")}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                    {flipHelpAndAbort ? (
                        <>
                            {showHelp && showAbortButton && <div className={styles.verticalBar} />}
                            {showHelp && (
                                <div
                                    className={styles.helpButton}
                                    onClick={onHelp}
                                    role={onHelp ? "button" : undefined}
                                    style={onHelp ? { cursor: "pointer" } : undefined}
                                >
                                    <img src={HelpIcon} alt="Help" className={styles.helpIcon} />
                                    <span className={styles.helpText}>{t("sidebar.help")}</span>
                                </div>
                            )}
                            {showHelp && showAbortButton && <div className={styles.verticalBar} />}
                            {showAbortButton && (
                                <button
                                    className={`${styles.abortButton} ${showHelp ? styles.abortButtonAfterFlip : ""}`}
                                    onClick={() => setShowAbortModal(true)}
                                >
                                    <span className={styles.abortText}>
                                        {abortButtonLabel ?? t("infoBar.abortCase")}
                                    </span>
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {showAbortButton && (
                                <button className={styles.abortButton} onClick={() => setShowAbortModal(true)}>
                                    <span className={styles.abortText}>
                                        {abortButtonLabel ?? t("infoBar.abortCase")}
                                    </span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            <ConfirmationPopup
                isOpen={showAbortModal}
                onClose={() => setShowAbortModal(false)}
                onConfirm={() => {
                    if (onAbortCase) {
                        onAbortCase();
                    }
                }}
                message={t("setup.abortCase.confirmMessage", {
                    defaultValue: "Are you sure you want to abort this case? Your progress will be lost.",
                })}
                confirmText={t("setup.abortCase.yes", { defaultValue: "Yes" })}
                cancelText={t("setup.abortCase.noGoBack", { defaultValue: "No, Go Back" })}
            />
        </div>
    );
};
