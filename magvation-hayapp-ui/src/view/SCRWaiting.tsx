import { useContext, useEffect, useState } from "react";
import { AppContext } from "./App";
import styles from "../viewcss/SCRWaiting.module.css";
import LoadingIcon from "../img/LoadingIcon.svg";
import LogoPlusText from "../img/LogoPlusText.svg";
import { useTranslation } from "react-i18next";
import { NFCScanResult } from "../services/CaseService";

/**
 * SCRWaiting component
 *
 * This is the initial screen for the SCR renderer.
 * Before SCR logs in, it shows the app logo.
 * After SCR logs in, it shows a waiting spinner
 * while CIR completes setup. Once setup is complete, it navigates to scrSetupScreen.
 *
 */
export const SCRWaiting: React.FC = () => {
    const appContext = useContext(AppContext);
    const { t } = useTranslation();
    const [scrubLoggedIn, setScrubLoggedIn] = useState(false);
    const [cirLoggedIn, setCirLoggedIn] = useState(false);

    useEffect(() => {
        const handler = (result: NFCScanResult | null) => {
            if (result?.success && result.logged_in_role === "SCR") {
                setScrubLoggedIn(true);
            }
            if (result?.success && result.logged_in_role === "CIR") {
                setCirLoggedIn(true);
            }
        };
        appContext.caseService.nfcScanResult.addListener(handler);
        return () => appContext.caseService.nfcScanResult.removeListener(handler);
    }, [appContext]);

    useEffect(() => {
        const unsubscribe = appContext.caseService.listenForCaseCleared(() => {
            setScrubLoggedIn(false);
            setCirLoggedIn(false);
        });
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [appContext]);

    useEffect(() => {
        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = async (event: { screen: string }) => {
            // Navigate to setup screen (normal flow after second user login)
            if (event.screen === "scrSetupScreen") {
                appContext.caseService.setRole("SCR");
                appContext.navigate({ path: "scrSetupScreen" });
            }
            // Navigate to dashboard (demo skip flow)
            else if (
                event.screen === "SCR_DASHBOARD_VALIDATE_ACTIVE" ||
                event.screen === "SCR_DASHBOARD_VALIDATE_INACTIVE"
            ) {
                appContext.caseService.setRole("SCR");
                appContext.navigate({ path: "scrDashboard" });
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [appContext]);

    if (scrubLoggedIn && cirLoggedIn) {
        return (
            <div className={styles.screenContainer}>
                <div className={styles.waitContainer}>
                    <div className={styles.loadingIcon}>
                        <span className={styles.loadingIconSpinner}>
                            <img src={LoadingIcon} alt="Loading" />
                        </span>
                    </div>
                    <span className={styles.loginText}>{t("scrWaiting.wait")}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.screenContainer}>
            <img src={LogoPlusText} alt="Magvation" className={styles.logoImage} />
        </div>
    );
};
