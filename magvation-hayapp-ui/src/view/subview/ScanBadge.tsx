import React, { useContext, useEffect, useState } from "react";
import styles from "../subviewcss/scanBadge.module.css";
import { useTranslation } from "react-i18next";
import { HayAppUserType } from "../../services/StaffService";
import { AppContext } from "../App";
import { useListenable } from "../../util/Listenable";
import CIRBadgeScanImg from "../../img/CIRBadgeScan.svg";
import SCRBadgeScanImg from "../../img/SCRBadgeScan.svg";

interface ScanBadgeProps {
    role: HayAppUserType;
    onScan: (success: boolean, error?: string) => void;
    onManualLogin: () => void;
    isReloginForCirSetup?: boolean;
}

export const ScanBadge: React.FC<ScanBadgeProps> = ({ role, onScan, onManualLogin, isReloginForCirSetup }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const nfcScanResult = useListenable(appContext.caseService.nfcScanResult);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Set the expected login role when component mounts
    useEffect(() => {
        const roleName = role === HayAppUserType.Circulator ? "CIR" : "SCR";
        appContext.caseService.parlayInterface.caseManager.set_expected_login_role(roleName);
    }, [role, appContext.caseService]);

    useEffect(() => {
        if (nfcScanResult) {
            if (nfcScanResult.success) {
                // Clear error and proceed
                setErrorMessage(null);
                appContext.caseService.clearNFCScanResult();
                onScan(true);
            } else {
                // Show error message
                console.error("Badge scan failed:", nfcScanResult.error);
                setErrorMessage(nfcScanResult.error || "Badge scan failed");

                // Clear the NFC scan result immediately so it can accept new scans
                appContext.caseService.clearNFCScanResult();

                // Auto-clear error message after 3 seconds
                const timer = setTimeout(() => {
                    setErrorMessage(null);
                }, 3000);

                return () => clearTimeout(timer);
            }
        }
    }, [nfcScanResult, appContext.caseService, onScan]);

    const roleName = role === HayAppUserType.Circulator ? "CIR" : "SCR";
    const badgeImage = role === HayAppUserType.Circulator ? CIRBadgeScanImg : SCRBadgeScanImg;

    return (
        <div className={styles.container} onClick={() => onScan(true)} style={{ cursor: "pointer" }}>
            <img src={badgeImage} className={styles.scanArea} alt="Scan Badge" />
            <div className={styles.instruction}>
                {isReloginForCirSetup
                    ? t("setup.scanBadge.reloginInstruction", { role: roleName })
                    : t("setup.scanBadge.instruction", { role: roleName }) ||
                      `Scan the badge to enter as a ${roleName}`}
            </div>
            <div style={{ marginTop: "12px", fontSize: "16px", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                Tap anywhere to bypass
            </div>
            <div className={styles.orCircle} onClick={(e) => e.stopPropagation()}>
                {t("setup.scanBadge.or", { defaultValue: "Or" })}
            </div>
            <button className={styles.manualLoginButton} onClick={(e) => { e.stopPropagation(); onManualLogin(); }}>
                {t("setup.scanBadge.manualLogin", { defaultValue: "Log In Using Username and Password" })}
            </button>
            {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
        </div>
    );
};
