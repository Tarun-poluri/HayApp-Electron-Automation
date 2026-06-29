import React, { useState, useContext, useEffect } from "react";
import styles from "../subviewcss/ConfirmCount.module.css";
import { useTranslation } from "react-i18next";
import { TrackingHeader } from "./TrackingHeader";
import { LogoutPopup } from "./LogoutPopUp";
import ToastNotification from "../../component/ToastNotification";
import UserLoggedOut from "../../img/UserLoggedOut.svg";
import GreenDoneNoBg from "../../img/GreenDoneNoBg.svg";
import LogoutIcon from "../../img/LogoutIcon.svg";
import { CaseSuture, SuturePackInfo } from "../../services/CaseService";
import { AppContext } from "../App";
import { useListenable } from "../../util/Listenable";
import { useLogout } from "../../hooks/useLogout";
import RedCloseNoBg from "../../img/RedCloseNoBg.svg";
import LoadingIcon from "../../img/LoadingIcon.svg";

interface ConfirmCountProps {
    caseSutures: CaseSuture[];
    suturePackInfoMap: Record<number, SuturePackInfo>;
    onComplete: () => void;
    onBack?: () => void;
}

export const ConfirmCount: React.FC<ConfirmCountProps> = ({ caseSutures, suturePackInfoMap, onComplete, onBack }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [logoutRole, setLogoutRole] = useState<"CIR" | "SCR" | null>(null);
    const [logoutToastMessage, setLogoutToastMessage] = useState<string | null>(null);
    const [showCountMismatch, setShowCountMismatch] = useState(false);
    const [fieldCount, setFieldCount] = useState(2);
    const [showWaiting, setShowWaiting] = useState(false);

    const circulatorUser = useListenable(appContext.caseService.circulator);
    const scrubUser = useListenable(appContext.caseService.scrub);

    const { logout } = useLogout();

    // Notify backend when current pack changes so SCR screen can update
    useEffect(() => {
        if (caseSutures.length === 0 || currentIndex >= caseSutures.length) return;

        const currentCaseSuture = caseSutures[currentIndex];
        appContext.caseService.parlayInterface.caseManager.set_current_confirming_pack(currentCaseSuture);
    }, [currentIndex, caseSutures, appContext.caseService.parlayInterface.caseManager]);

    // Fetch suturePackInfo for current item if not already in the map
    // (caseSutures come from suture sheets, not scanner events, so the map may be empty)
    useEffect(() => {
        if (caseSutures.length === 0 || currentIndex >= caseSutures.length) return;
        const fda_guid = caseSutures[currentIndex].fda_guid;
        if (!suturePackInfoMap[fda_guid]) {
            appContext.caseService.getSuturePackInfo(fda_guid);
        }
    }, [currentIndex, caseSutures, suturePackInfoMap, appContext.caseService]);

    // Listen for SCR confirmation to return from waiting
    useEffect(() => {
        if (!showWaiting) return;
        if (!appContext.parlayWrapper.isConnected.value) return;

        const handler = (action: "next" | "complete" | "retry") => {
            setShowWaiting(false);
            setFieldCount(2); // Reset for next time

            if (action === "next") {
                // Backend confirmed there's a next pack - trust it and increment
                setCurrentIndex(currentIndex + 1);
            } else if (action === "complete") {
                // No more packs - complete
                onComplete();
            } else if (action === "retry") {
                // SCR said no - show mismatch screen again so CIR can re-enter count
                setShowCountMismatch(true);
            }
        };

        const unsubscribe = appContext.caseService.parlayInterface.caseManager.scr_confirmed_field_count_event(handler);
        return () => unsubscribe();
    }, [showWaiting, appContext, currentIndex, caseSutures.length, onComplete]);

    // Early return after all hooks
    if (caseSutures.length === 0 || currentIndex >= caseSutures.length) {
        // No items to confirm or finished all items
        return null;
    }

    const currentCaseSuture = caseSutures[currentIndex];
    const suturePackInfo = suturePackInfoMap[currentCaseSuture.fda_guid];

    const handleNext = async () => {
        if (isProcessing) return;

        setIsProcessing(true);
        try {
            // Move to next item or complete
            if (currentIndex + 1 < caseSutures.length) {
                setCurrentIndex(currentIndex + 1);
            } else {
                onComplete();
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCountMismatch = async () => {
        setShowCountMismatch(true);
        // Notify backend so SCR shows mismatch screen
        await appContext.caseService.parlayInterface.caseManager.cir_count_mismatch(currentCaseSuture);
    };

    const handleLogoutClick = (role: "CIR" | "SCR") => {
        setLogoutRole(role);
        setShowLogoutPopup(true);
    };

    const handleConfirmLogout = async () => {
        if (!logoutRole) return;

        const bothLoggedIn = !!(circulatorUser && scrubUser);
        const loggedOutUser = logoutRole === "CIR" ? circulatorUser : scrubUser;
        const remainingUser = logoutRole === "CIR" ? scrubUser : circulatorUser;
        const remainingRole = logoutRole === "CIR" ? "SCR" : "CIR";

        const result = await logout(logoutRole, {
            shouldRestartCount: true,
            shouldNavigateToSetup: true,
            shouldReturnToCirSetup: true,
            skipRoleSelection: true,
        });

        if (result.success) {
            setShowLogoutPopup(false);
            setLogoutRole(null);

            if (bothLoggedIn && loggedOutUser && remainingUser) {
                setLogoutToastMessage(
                    t("logout.loggedOutNotification", {
                        loggedOutUser: `${loggedOutUser.first_name} ${loggedOutUser.last_name}`,
                        loggedOutRole: logoutRole,
                        remainingUser: `${remainingUser.first_name} ${remainingUser.last_name}`,
                        remainingRole: remainingRole,
                    }),
                );
            }
        }
    };

    const handleIncrementFieldCount = () => {
        setFieldCount(fieldCount + 1);
    };

    const handleDecrementFieldCount = () => {
        if (fieldCount > 0) {
            setFieldCount(fieldCount - 1);
        }
    };

    const handleConfirmFieldCount = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            // Send field count to backend with current index
            await appContext.caseService.parlayInterface.caseManager.cir_confirmed_field_count(
                currentCaseSuture,
                fieldCount,
                currentIndex,
            );
            // Show waiting screen
            setShowCountMismatch(false);
            setShowWaiting(true);
        } finally {
            setIsProcessing(false);
        }
    };

    if (showCountMismatch) {
        return (
            <div className={styles.screenContainer}>
                <TrackingHeader
                    stage={1}
                    title={t("confirmCount.startCount")}
                    stageColor="rgba(210, 178, 255, 1)"
                    onBack={() => setShowCountMismatch(false)}
                    showAbortButton={false}
                    circulatorUser={circulatorUser}
                    scrubUser={scrubUser}
                    showBadges={true}
                    onCirLogout={() => handleLogoutClick("CIR")}
                    onScrLogout={() => handleLogoutClick("SCR")}
                />
                <div className={styles.innerScreenContainer}>
                    <div className={styles.leftContainer}>
                        <div className={styles.packBackground}>
                            {suturePackInfo?.image && (
                                <img
                                    src={`http://localhost:8080/suture_pack_images/${suturePackInfo.image}`}
                                    alt="Suture Pack"
                                />
                            )}
                        </div>
                        <div className={styles.packInfoTable}>
                            <div className={styles.packInfoTableContent}>
                                <div className={styles.packInfoRow}>
                                    <span className={styles.packInfoTitle}>{t("confirmCount.nomenclature")}:</span>
                                    <span className={styles.packInfoValue}>{currentCaseSuture.nomenclature}</span>
                                </div>
                                <div className={styles.tableDivider} />
                                <div className={styles.packInfoRow}>
                                    <span className={styles.packInfoTitle}>{t("confirmCount.suturePerPack")}:</span>
                                    <span className={styles.packInfoValue}>{currentCaseSuture.needles_per_pack}</span>
                                </div>
                                <div className={styles.tableDivider} />
                                <div className={styles.packInfoRow}>
                                    <span className={styles.packInfoTitle}>{t("confirmCount.packsToOpen")}:</span>
                                    <span className={styles.packInfoValue}>{currentCaseSuture.num_packs}</span>
                                </div>
                                <div className={styles.tableDivider} />
                                <div className={styles.packInfoRow}>
                                    <span className={styles.packInfoTitle}>{t("confirmCount.sutureNeedleUse")}:</span>
                                    <span className={styles.packInfoValue}>
                                        {currentCaseSuture.suture_needle_use.join(", ")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.rightContainer}>
                        <div className={styles.mismatchContentContainer}>
                            <div className={styles.mismatchTextContainer}>
                                <span className={styles.mismatchTitleText}>{t("confirmCount.mismatchTitle")}</span>
                                <span className={styles.mismatchSmallText}>
                                    {t("confirmCount.mismatchDescription", {
                                        nomenclature: currentCaseSuture.nomenclature,
                                    })}
                                </span>
                            </div>
                            <div className={styles.mismatchCounterContainer}>
                                <span className={styles.mismatchFieldText}>{t("confirmCount.fieldCount")}</span>
                                <div className={styles.boxContainer}>
                                    <div className={styles.numberInputContainer}>
                                        <div className={styles.numberInput}>
                                            <button className={styles.numberButton} onClick={handleDecrementFieldCount}>
                                                <span className={styles.numberButtonText}>-</span>
                                            </button>
                                            <div className={styles.numberDisplay}>{fieldCount}</div>
                                            <button className={styles.numberButton} onClick={handleIncrementFieldCount}>
                                                <span className={styles.numberButtonText}>+</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.confirmMismatchButtonContainer}>
                                <button
                                    className={styles.confirmMismatchButton}
                                    onClick={handleConfirmFieldCount}
                                    disabled={isProcessing}
                                >
                                    <span className={styles.confirmMismatchButtonText}>
                                        {t("confirmCount.confirm")}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {showLogoutPopup && logoutRole && (
                    <LogoutPopup
                        iconSrc={LogoutIcon}
                        userFirstName={
                            logoutRole === "CIR" ? circulatorUser?.first_name || "" : scrubUser?.first_name || ""
                        }
                        userLastName={
                            logoutRole === "CIR" ? circulatorUser?.last_name || "" : scrubUser?.last_name || ""
                        }
                        role={logoutRole}
                        showTwoRolesMessage={false}
                        showRestartCountMessage={true}
                        onConfirm={handleConfirmLogout}
                        onClose={() => {
                            setShowLogoutPopup(false);
                            setLogoutRole(null);
                        }}
                    />
                )}
                {logoutToastMessage && (
                    <ToastNotification
                        message={logoutToastMessage}
                        icon={UserLoggedOut}
                        onDismiss={() => setLogoutToastMessage(null)}
                    />
                )}
            </div>
        );
    }

    // Show waiting screen
    if (showWaiting) {
        return (
            <div className={styles.screenContainer}>
                <div className={styles.waitingScreenContainer}>
                    <div className={styles.loadingIcon}>
                        <span className={styles.loadingIconSpinner}>
                            <img src={LoadingIcon} alt="Loading" />
                        </span>
                    </div>
                    <span className={styles.waitingText}>{t("confirmCount.waitingForSCR")}</span>
                </div>

                {showLogoutPopup && logoutRole && (
                    <LogoutPopup
                        iconSrc={LogoutIcon}
                        userFirstName={
                            logoutRole === "CIR" ? circulatorUser?.first_name || "" : scrubUser?.first_name || ""
                        }
                        userLastName={
                            logoutRole === "CIR" ? circulatorUser?.last_name || "" : scrubUser?.last_name || ""
                        }
                        role={logoutRole}
                        showTwoRolesMessage={false}
                        showRestartCountMessage={true}
                        onConfirm={handleConfirmLogout}
                        onClose={() => {
                            setShowLogoutPopup(false);
                            setLogoutRole(null);
                        }}
                    />
                )}
                {logoutToastMessage && (
                    <ToastNotification
                        message={logoutToastMessage}
                        icon={UserLoggedOut}
                        onDismiss={() => setLogoutToastMessage(null)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className={styles.screenContainer}>
            <TrackingHeader
                stage={1}
                title={t("confirmCount.startCount")}
                stageColor="rgba(210, 178, 255, 1)"
                onBack={onBack}
                showAbortButton={false}
                circulatorUser={circulatorUser}
                scrubUser={scrubUser}
                showBadges={true}
                onCirLogout={() => handleLogoutClick("CIR")}
                onScrLogout={() => handleLogoutClick("SCR")}
            />
            <div className={styles.innerScreenContainer}>
                <div className={styles.leftContainer}>
                    <div className={styles.packBackground}>
                        {suturePackInfo?.image && (
                            <img
                                src={`http://localhost:8080/suture_pack_images/${suturePackInfo.image}`}
                                alt="Suture Pack"
                            />
                        )}
                    </div>
                    <div className={styles.packInfoTable}>
                        <div className={styles.packInfoTableContent}>
                            <div className={styles.packInfoRow}>
                                <span className={styles.packInfoTitle}>{t("confirmCount.nomenclature")}</span>
                                <span className={styles.packInfoValue}>{currentCaseSuture.nomenclature}</span>
                            </div>
                            <div className={styles.tableDivider} />
                            <div className={styles.packInfoRow}>
                                <span className={styles.packInfoTitle}>{t("confirmCount.suturePerPack")}</span>
                                <span className={styles.packInfoValue}>{currentCaseSuture.needles_per_pack}</span>
                            </div>
                            <div className={styles.tableDivider} />
                            <div className={styles.packInfoRow}>
                                <span className={styles.packInfoTitle}>{t("confirmCount.packsToOpen")}</span>
                                <span className={styles.packInfoValue}>{currentCaseSuture.num_packs}</span>
                            </div>
                            <div className={styles.tableDivider} />
                            <div className={styles.packInfoRow}>
                                <span className={styles.packInfoTitle}>{t("confirmCount.sutureNeedleUse")}</span>
                                <span className={styles.packInfoValue}>
                                    {currentCaseSuture.suture_needle_use.join(", ")}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.rightContainer}>
                    <div className={styles.rightInnerContainer}>
                        <div className={styles.instructionsContainer}>
                            <div className={styles.textContainer}>
                                <div className={styles.scannedContainer}>
                                    <span className={styles.scannedNumberText}>
                                        {currentCaseSuture.needles_per_pack * currentCaseSuture.num_packs}
                                    </span>
                                    <span className={styles.scannedText}>{t("confirmCount.sutureNeedlesScanned")}</span>
                                </div>
                                <span className={styles.largeText}>
                                    {t("confirmCount.askSCR", {
                                        nomenclature: suturePackInfo?.needle_name
                                            ? currentCaseSuture.nomenclature
                                                  .replace(suturePackInfo.needle_name, "")
                                                  .trim()
                                            : currentCaseSuture.nomenclature,
                                    })}
                                </span>
                                <span className={styles.smallText}>{t("confirmCount.dontTell")} </span>
                            </div>
                        </div>
                        <div className={styles.buttonContainer}>
                            <button className={styles.noButton} onClick={handleCountMismatch} disabled={isProcessing}>
                                <span className={styles.noText}>{t("confirmCount.noMatch")}</span>
                                <img src={RedCloseNoBg} alt="No Match Icon" className={styles.icon} />
                            </button>
                            <button className={styles.yesButton} onClick={handleNext} disabled={isProcessing}>
                                <span className={styles.yesText}>{t("confirmCount.confirm")}</span>
                                <img src={GreenDoneNoBg} alt="Confirm" className={styles.icon} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logout popup with count reset warning */}
            {showLogoutPopup && logoutRole && (
                <LogoutPopup
                    iconSrc={LogoutIcon}
                    userFirstName={
                        logoutRole === "CIR" ? circulatorUser?.first_name || "" : scrubUser?.first_name || ""
                    }
                    userLastName={logoutRole === "CIR" ? circulatorUser?.last_name || "" : scrubUser?.last_name || ""}
                    role={logoutRole}
                    showTwoRolesMessage={false}
                    showRestartCountMessage={true}
                    onConfirm={handleConfirmLogout}
                    onClose={() => {
                        setShowLogoutPopup(false);
                        setLogoutRole(null);
                    }}
                />
            )}
            {logoutToastMessage && (
                <ToastNotification
                    message={logoutToastMessage}
                    icon={UserLoggedOut}
                    onDismiss={() => setLogoutToastMessage(null)}
                />
            )}
        </div>
    );
};
