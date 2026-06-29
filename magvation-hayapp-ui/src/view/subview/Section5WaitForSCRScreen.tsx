/** Section 5 — First CIR screen: wait for SCR to place remaining needles into HayStack. */
import React, { useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/waitForSCRValidations.module.css";
import { AppContext } from "../App";

interface Section5WaitForSCRScreenProps {
    onComplete: () => void;
}

export const Section5WaitForSCRScreen: React.FC<Section5WaitForSCRScreenProps> = ({ onComplete }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    // Listen for SCR confirming needle placement
    useEffect(() => {
        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            if (event.screen === "scrClosingCountS5WaitForCir") {
                onComplete();
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [onComplete, appContext.caseService.parlayInterface.caseManager]);

    return (
        <div className={styles.contentArea}>
            <div className={styles.card}>
                <div className={styles.dotRing}>
                    {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className={styles.dot} style={{ "--i": i } as React.CSSProperties} />
                    ))}
                </div>
                <span className={styles.waitText}>{t("section5.waitForScrPlacement")}</span>
            </div>
        </div>
    );
};
