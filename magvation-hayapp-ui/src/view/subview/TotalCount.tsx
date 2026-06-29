import React, { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { TrackingHeader } from "./TrackingHeader";
import { LogoutPopup } from "./LogoutPopUp";
import ToastNotification from "../../component/ToastNotification";
import UserLoggedOut from "../../img/UserLoggedOut.svg";
import { ConfirmationPopup } from "../../component/ConfirmationPopup";
import styles from "../subviewcss/TotalCount.module.css";
import BlackClose from "../../img/BlackClose.svg";
import NumpadBack from "../../img/NumpadBack.svg";
import WhiteClose from "../../img/WhiteClose.svg";
import LogoutIcon from "../../img/LogoutIcon.svg";
import AskBubbles from "../../img/AskBubbles.svg";
import { AppContext } from "../App";
import { useListenable } from "../../util/Listenable";
import { useLogout } from "../../hooks/useLogout";
import SCRNotConfirmTotal from "../../img/SCRNotConfirmTotal.svg";
import { ValueTooLow } from "../../component/ValueTooLow";
import { ValueTooLow3Digits } from "../../component/ValueTooLow3Digits";
import { ValueTooHigh } from "../../component/ValueTooHigh";
import { ValueTooHigh3Digits } from "../../component/ValueTooHigh3Digits";

type TotalCountView = "entry" | "mismatch" | "tooLow" | "tooHigh" | "waiting";

interface TotalCountProps {
    onComplete: (total: number) => void;
    onBack?: () => void;
    onEnterNewNumber?: () => void;
    view?: TotalCountView;
    confirmedTotal?: number;
    onAbortCase?: () => void;
}

export const TotalCount: React.FC<TotalCountProps> = ({
    onComplete,
    onBack,
    onEnterNewNumber,
    view = "entry",
    confirmedTotal,
    onAbortCase,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [totalValue, setTotalValue] = useState("");
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [logoutRole, setLogoutRole] = useState<"CIR" | "SCR" | null>(null);
    const [logoutToastMessage, setLogoutToastMessage] = useState<string | null>(null);
    const [showBackConfirmPopup, setShowBackConfirmPopup] = useState(false);

    const circulatorUser = useListenable(appContext.caseService.circulator);
    const scrubUser = useListenable(appContext.caseService.scrub);

    const handleNumberClick = (num: number) => {
        setTotalValue((prev) => prev + num.toString());
    };

    const handleNumpadBackClick = () => {
        setTotalValue((prev) => prev.slice(0, -1));
    };

    const { logout } = useLogout();

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

    const handleClearAll = () => {
        setTotalValue("");
    };

    const handleHeaderBackClick = () => {
        setShowBackConfirmPopup(true);
    };

    const handleConfirmBack = () => {
        if (onBack) {
            onBack();
        }
    };

    const displayValue = totalValue || "0";
    const hasValue = totalValue !== "" && parseInt(totalValue || "0", 10) > 0;

    const renderTotalMismatch = () => (
        <div className={styles.mismatchContainer}>
            <div className={styles.mismatchInnerContainer}>
                <img src={SCRNotConfirmTotal} className={styles.scrNotConfirmImage} />
                <div className={styles.mismatchContentContainer}>
                    <div className={styles.mismatchTextContainer}>
                        <span className={styles.mismatchLargeText}>{t("totalCount.scrNotConfirm")}</span>
                        <span className={styles.mismatchSmallText}>{t("totalCount.askSCR")}</span>
                    </div>
                    <div className={styles.mismatchButtonContainer}>
                        <button
                            className={styles.newNumberButton}
                            onClick={() => {
                                handleClearAll();
                                if (onEnterNewNumber) onEnterNewNumber();
                            }}
                        >
                            <span className={styles.newNumberButtonText}>{t("totalCount.newNumber")}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderWrongCount = (isTooLow: boolean) => {
        const usedTotal = confirmedTotal || parseInt(totalValue || "0", 10);
        const digitCount = usedTotal.toString().length;

        // Select component based on digit count and whether value is too low or too high
        let ValueComponent;
        if (isTooLow) {
            ValueComponent = digitCount >= 3 ? ValueTooLow3Digits : ValueTooLow;
        } else {
            ValueComponent = digitCount >= 3 ? ValueTooHigh3Digits : ValueTooHigh;
        }

        return (
            <div className={styles.mismatchContainer}>
                <div className={styles.mismatchInnerContainer}>
                    <ValueComponent value={usedTotal} />
                    <div className={styles.valueContentContainer}>
                        <div className={styles.valueTextContainer}>
                            <span className={styles.valueText}>{t("totalCount.valueDoesNotMatch")}</span>
                            <div className={styles.valueSpecialTextContainer}>
                                <span className={styles.valueText}>{t("totalCount.valueToo")}</span>
                                <div className={styles.valuebadgeContainer}>
                                    <div className={styles.valueBadge}>
                                        <span className={styles.valueText}>
                                            {t(isTooLow ? "totalCount.low" : "totalCount.high")}
                                        </span>
                                    </div>
                                    <span className={styles.valueText}>.</span>
                                </div>
                                <span className={styles.valueText}>{t("totalCount.pleaseEnter")}</span>
                            </div>
                        </div>
                        <div className={styles.mismatchButtonContainer}>
                            <button
                                className={styles.newNumberButton}
                                onClick={() => {
                                    handleClearAll();
                                    if (onEnterNewNumber) onEnterNewNumber();
                                }}
                            >
                                <span className={styles.newNumberButtonText}>{t("totalCount.newNumber")}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.screenContainer}>
            <TrackingHeader
                stage={1}
                title={t("confirmCount.startCount")}
                stageColor="rgba(210, 178, 255, 1)"
                onBack={onBack ? handleHeaderBackClick : undefined}
                showAbortButton={true}
                onAbortCase={onAbortCase}
                circulatorUser={circulatorUser}
                scrubUser={scrubUser}
                showBadges={true}
                onCirLogout={() => handleLogoutClick("CIR")}
                onScrLogout={() => handleLogoutClick("SCR")}
            />

            {/* Show different views based on the view prop */}
            {view === "mismatch" && renderTotalMismatch()}
            {view === "tooLow" && renderWrongCount(true)}
            {view === "tooHigh" && renderWrongCount(false)}

            {(view === "entry" || view === "waiting") && (
                <>
                    <div className={styles.innerScreenContainer}>
                        <div className={styles.leftContainer}>
                            <img src={AskBubbles} />
                            <span className={styles.text}>
                                {view === "waiting" ? t("totalCount.waitingForSCR") : t("totalCount.prompt")}
                            </span>
                        </div>
                        <div className={styles.rightContainer}>
                            <div className={styles.rightContainerContent}>
                                <span className={hasValue ? styles.totalTextActive : styles.totalText}>
                                    {displayValue}
                                </span>
                                <button
                                    className={hasValue ? styles.clearButtonActive : styles.clearButton}
                                    onClick={handleClearAll}
                                    disabled={!hasValue || view === "waiting"}
                                >
                                    <span className={hasValue ? styles.clearButtonActiveText : styles.clearText}>
                                        {t("totalCount.clearAll")}
                                    </span>
                                    <img
                                        className={styles.clearIcon}
                                        src={hasValue ? WhiteClose : BlackClose}
                                        alt="Close Icon"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className={styles.numpadContainer}>
                        <div className={styles.numpadContentContainer}>
                            <div className={styles.numpad}>
                                <div className={styles.numpadRow}>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(1)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>1</span>
                                    </button>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(2)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>2</span>
                                    </button>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(3)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>3</span>
                                    </button>
                                </div>
                                <div className={styles.numpadRow}>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(4)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>4</span>
                                    </button>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(5)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>5</span>
                                    </button>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(6)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>6</span>
                                    </button>
                                </div>
                                <div className={styles.numpadRow}>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(7)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>7</span>
                                    </button>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(8)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>8</span>
                                    </button>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(9)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>9</span>
                                    </button>
                                </div>
                                <div className={styles.numpadRow}>
                                    <div className={styles.blankNumpadButton}></div>
                                    <button
                                        className={styles.numpadButton}
                                        onClick={() => handleNumberClick(0)}
                                        disabled={view === "waiting"}
                                    >
                                        <span className={styles.numpadNumber}>0</span>
                                    </button>
                                    <img
                                        src={NumpadBack}
                                        className={styles.backNumpadButton}
                                        onClick={handleNumpadBackClick}
                                        alt="Back"
                                        style={{
                                            opacity: view === "waiting" ? 0.5 : 1,
                                            pointerEvents: view === "waiting" ? "none" : "auto",
                                        }}
                                    />
                                </div>
                            </div>
                            <button
                                className={styles.confirmButton}
                                onClick={() => onComplete(parseInt(totalValue, 10))}
                                disabled={!hasValue || view === "waiting"}
                            >
                                <span className={styles.confirmText}>{t("totalCount.confirm")}</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

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

            {/* Back button confirmation popup */}
            <ConfirmationPopup
                isOpen={showBackConfirmPopup}
                onClose={() => setShowBackConfirmPopup(false)}
                onConfirm={handleConfirmBack}
                message={t("totalCount.restart")}
                confirmText={t("totalCount.yesRestart")}
                cancelText={t("totalCount.cancel")}
            />
        </div>
    );
};
