/**
 * Figma Screen 3.15 — "Waiting for SCR validation"
 *
 * Visually identical across all usages. The downstream routing after
 * onComplete differs per section and is handled by the parent
 * (CIRClosingCount) via separate enum states:
 *   - SCR_PENDING_WAIT        (main flow — routes via resolvePostValidation)
 *   - S1_WAIT_SCR_VALIDATIONS (Section 1 — routes via resolveSection1Exit)
 *   - S2_WAIT_SCR_VALIDATIONS (Section 2 — routes via resolveSection2Exit)
 *
 * Note: Figma 3.40 (wait after 3.39 pack scan) is a separate inline
 * implementation inside Section1AddPackFlow's "waitSCR" step.
 *
 * Race condition fix: scr_screen_changed often arrives before the
 * DASHBOARD_UPDATE that carries re-adjudication items. If we fire
 * onComplete immediately, the parent's resolve function checks
 * cirReAdjudication.value and finds it empty. Instead, we wait for
 * the next DASHBOARD_UPDATE (signalled by cirReAdjudication listener)
 * before firing onComplete. A 500ms safety timeout covers the rare
 * case where DASHBOARD_UPDATE arrived first.
 */
import React, { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/waitForSCRValidations.module.css";
import { AppContext } from "../App";

// SCR screen names that indicate validation is complete and SCR is waiting for CIR.
// When scr_screen_changed fires with one of these, CIR knows SCR has finished validating.
const POST_VALIDATION_SCR_SCREENS = [
    "scrClosingCountWaitForCirPostValidation", // main flow (default wait screen)
    "scrClosingCountWaitForCirReview", // main flow (SCR skips directly to review wait when re-adj items exist)
    "scrClosingCountS1WaitCbiBox", // main flow (SCR skips directly to S1 when remaining < 0)
    "scrClosingCountS2WaitCbiBox", // main flow (SCR skips directly to S2 when remaining > 0)
    "scrClosingCountS7CheckSterile", // main flow (SCR skips directly to S7 when remaining=0 + misplaced > 0)
    "scrClosingCountS1WaitCirWrappers", // Section 1 (SCR returns here after S1 validation — accepted)
    "scrClosingCountS1WaitCirReadj", // Section 1 (SCR returns here after S1 validation — rejected, re-adj)
    "scrClosingCountS2CheckSterile", // Section 2 (SCR returns here after S2 validation — accepted)
    "scrClosingCountS2WaitCirReadj", // Section 2 (SCR returns here after S2 validation — rejected, re-adj)
    "scrClosingCountS3WaitForCirPostValidation", // Section 3 (SCR returns here after S3 validation)
    "scrClosingCountS4WaitForCirPostValidation", // Section 4 (SCR returns here after S4 CBI validation — accepted)
    "scrClosingCountS4WaitForCirReadj", // Section 4 (SCR returns here after S4 CBI validation — rejected, re-adj)
    "scrClosingCountDone", // Section 4 (SCR goes directly to done when accepted + no misplaced)
    "scrClosingCountS5WaitForCirPostValidation", // Section 5 (SCR returns here after S5 validation — accepted)
    "scrClosingCountS5WaitForCirReadj", // Section 5 (SCR returns here after S5 validation — rejected, re-adj)
    "scrClosingCountS5CheckSterile", // Section 5 (SCR skips directly to sterile check when accepted + remaining > 0)
    "scrClosingCountS6WaitForCirPostValidation", // Section 6 (SCR returns here after S6 CBI validation — accepted)
    "scrClosingCountS6WaitForCirReadj", // Section 6 (SCR returns here after S6 CBI validation — rejected, re-adj)
    "scrClosingCountS6CheckSterile", // Section 6 (SCR skips directly to sterile check when accepted + remaining > 0)
    "scrClosingCountS10CheckSterile", // Section 5/6 (SCR skips directly to S10 when accepted + remaining ≤ 0 + extra > 0)
    // ── Interim Count SCR post-validation screen names ──────────────────────
    "scrInterimCountWaitForCirPostValidation", // main flow (default wait)
    "scrInterimCountWaitForCirReview", // main flow (re-adj items exist)
    "scrInterimCountDone", // main flow (remaining == 0, direct to done)
    "scrInterimCountS2WaitCbiBox", // main flow → S2
    "scrInterimCountS3WaitCbiBox", // main flow → S3
    "scrInterimCountS2WaitCirReadj", // S2 rejected (re-adj)
    "scrInterimCountS3WaitCirReadj", // S3 rejected (re-adj)
    "scrInterimCountS5WaitForCirPostValidation", // S5 accepted
    "scrInterimCountS5WaitForCirReadj", // S5 rejected (re-adj)
    "scrInterimCountS7CheckSterile", // S3 → sterile field check
];

interface WaitForSCRValidationsProps {
    onComplete: () => void;
}

export const WaitForSCRValidations: React.FC<WaitForSCRValidationsProps> = ({ onComplete }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const lastArrowTap = useRef<{ key: string; time: number }>({ key: "", time: 0 });
    const pendingCompletion = useRef(false);
    const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listen for SCR validation completion via Parlay event.
    // When SCR finishes validating and navigates back to scrClosingCount,
    // it lands on a post-validation wait state and broadcasts its screen name.
    // We set a pending flag and wait for the next DASHBOARD_UPDATE before
    // firing onComplete, ensuring cirReAdjudication is current.
    useEffect(() => {
        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            if (POST_VALIDATION_SCR_SCREENS.includes(event.screen)) {
                pendingCompletion.current = true;
                // Safety net: if DASHBOARD_UPDATE already arrived before
                // scr_screen_changed, fire after a short delay.
                safetyTimeoutRef.current = setTimeout(() => {
                    if (pendingCompletion.current) {
                        pendingCompletion.current = false;
                        onComplete();
                    }
                }, 500);
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
            if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        };
    }, [onComplete, appContext.caseService.parlayInterface.caseManager]);

    // Wait for DASHBOARD_UPDATE (via cirReAdjudication listener) after
    // scr_screen_changed to ensure re-adjudication data is current.
    useEffect(() => {
        const listener = () => {
            if (pendingCompletion.current) {
                pendingCompletion.current = false;
                if (safetyTimeoutRef.current) {
                    clearTimeout(safetyTimeoutRef.current);
                    safetyTimeoutRef.current = null;
                }
                onComplete();
            }
        };

        appContext.caseService.cirReAdjudication.addListener(listener);
        return () => {
            appContext.caseService.cirReAdjudication.removeListener(listener);
        };
    }, [onComplete, appContext.caseService.cirReAdjudication]);

    // Double-tap right arrow key to bypass (dev testing)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight") return;

            const now = Date.now();
            const last = lastArrowTap.current;

            if (last.key === e.key && now - last.time < 400) {
                onComplete();
                lastArrowTap.current = { key: "", time: 0 };
            } else {
                lastArrowTap.current = { key: e.key, time: now };
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onComplete]);

    return (
        <div className={styles.contentArea}>
            <div className={styles.card}>
                <div className={styles.dotRing}>
                    {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className={styles.dot} style={{ "--i": i } as React.CSSProperties} />
                    ))}
                </div>
                <span className={styles.waitText}>
                    {t("closeCount.waitForSCRLine1")}
                    <br />
                    {t("closeCount.waitForSCRLine2")}
                </span>
            </div>
        </div>
    );
};
