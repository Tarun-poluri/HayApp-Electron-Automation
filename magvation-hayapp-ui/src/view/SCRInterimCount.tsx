import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../viewcss/SCRInterimCount.module.css";
import { TrackingHeader } from "./subview/TrackingHeader";
import { useTranslation } from "react-i18next";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import { CountReconciliationScreen } from "./subview/CountReconciliationScreen";
import { SCRClosingCountStep } from "./subview/SCRClosingCountStep";
import { WaitForCIRClosingCount } from "./subview/WaitForCIRClosingCount";
import { InterimCountScrNeedlesOnField } from "./subview/InterimCountScrNeedlesOnField";
import { InterimCountScrConfirmNeedles } from "./subview/InterimCountScrConfirmNeedles";
import { NeedleSterileFieldScreen } from "./subview/NeedleSterileFieldScreen";
import { NeedleFoundScreen } from "./subview/NeedleFoundScreen";

// ─── State enum ────────────────────────────────────────────────────────────────
// SCR-side states for interim count. Maps to CIR sections:
//   Initial         → VALIDATE_PENDING (SCR enters when CIR reaches SCR_PENDING_WAIT — no deposit steps)
//   Post-validation → WAIT_FOR_CIR (waits for CIR's routing decision)
//   Section 1       → INTERIM_COUNT_DONE (read-only mirror)
//   Section 2 SCR   → S2_* (wait/validate for CIR Section 2)
//   Section 3 SCR   → S3_* (wait/validate for CIR Section 3)
//   Section 4 SCR   → SECTION_4, S4_* (simplified — confirm recount for CIR Section 4)
//   Section 5 SCR   → SECTION_5, S5_* (like CC SCR Section 6)
//   Section 7 SCR   → S7_* (read-only mirrors for CIR Section 7 sterile field check)
//   Done variants   → read-only mirrors

enum SCRInterimCountState {
    // === Initial validation (no deposit steps — SCR enters directly at validate) ===
    VALIDATE_PENDING, // First SCR screen — "Validate" button (orange), entered from SCRDashboard
    WAIT_FOR_CIR, // Initial wait (before first validation, if CIR goes back)
    WAIT_FOR_CIR_POST_VALIDATION, // After validation return — waits for CIR post-validation routing
    WAIT_FOR_CIR_REVIEW, // CIR is re-adjudicating — SCR waits, then goes to VALIDATE_PENDING again

    // === Post-verification count entry (Koboh developing) ===
    SCR_COUNT_INPUT, // SCR "Count the number of needles on field" (CIR is entering count)
    SCR_VALIDATE_COUNT, // SCR validates CIR's entered count (yes/no buttons)
    SCR_CONFIRMED_COUNT, // Broadcast state — signals CIR to proceed with section routing
    SCR_RECOUNT, // "Recount the number of needles" (CIR recounting)

    // === Section 1 — Done (read-only mirror) ===
    INTERIM_COUNT_DONE,

    // === Section 2 SCR — remaining < 0 (like CC SCR S1) ===
    S2_WAIT_CBI_BOX,
    S2_VALIDATE_CBI,
    S2_WAIT_CIR_READJ,

    // === Section 3 SCR — remaining > 0 (like CC SCR S2) ===
    S3_WAIT_CBI_BOX,
    S3_VALIDATE_CBI,
    S3_WAIT_CIR_READJ,

    // === Section 4 SCR — Needle in sterile zone (simplified) ===
    SECTION_4, // Confirm recount screen
    S4_WAIT_FOR_CIR, // Wait for CIR to process recount

    // === Section 5 SCR — Needle in non-sterile zone (like CC SCR S6) ===
    SECTION_5,
    S5_VALIDATE_CBI,
    S5_WAIT_FOR_CIR_POST_VALIDATION,
    S5_WAIT_FOR_CIR_READJ,

    // === Section 7 SCR — Sterile field check mirrors ===
    S7_CHECK_STERILE,
    S7_NEEDLE_REGISTERED,
    S7_NEEDLE_FOUND,

    // === Done variants (read-only mirrors) ===
    INTERIM_COUNT_DONE_EXTRA,
    INTERIM_COUNT_DONE_REGISTERED,
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const SCRInterimCount: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    // ── Smart initial state (post-validation routing) ──────────────────────
    const validationSource = appContext.caseService.isInterimCountValidation.value;
    let initialState: SCRInterimCountState;

    if (validationSource === "main") {
        // Go to WAIT_FOR_CIR_POST_VALIDATION so we broadcast the screen name CIR is listening for.
        // postValidationTransitioning ref (initialized from validationSource) suppresses the wait screen flash.
        initialState = SCRInterimCountState.WAIT_FOR_CIR_POST_VALIDATION;
    } else if (validationSource === "s2") {
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        initialState = hasCbiReAdj ? SCRInterimCountState.S2_WAIT_CIR_READJ : SCRInterimCountState.S2_WAIT_CBI_BOX;
    } else if (validationSource === "s3") {
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        initialState = hasCbiReAdj ? SCRInterimCountState.S3_WAIT_CIR_READJ : SCRInterimCountState.S3_WAIT_CBI_BOX;
    } else if (validationSource === "s5") {
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        initialState = hasCbiReAdj
            ? SCRInterimCountState.S5_WAIT_FOR_CIR_READJ
            : SCRInterimCountState.S5_WAIT_FOR_CIR_POST_VALIDATION;
    } else {
        // Default: SCR enters at VALIDATE_PENDING (triggered from SCRDashboard when CIR reaches SCR_PENDING_WAIT)
        initialState = SCRInterimCountState.VALIDATE_PENDING;
    }

    const [state, setState] = useState<SCRInterimCountState>(initialState); // TODO: revert to initialState

    // ── Listenables ────────────────────────────────────────────────────────
    const startingCount = useListenable(appContext.caseService.startingCount);
    const addedNeedles = useListenable(appContext.caseService.addedNeedleCount);
    const confirmed = useListenable(appContext.caseService.confirmed);

    // ── Local state ────────────────────────────────────────────────────────
    const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null);

    // ── Refs ──────────────────────────────────────────────────────────────
    const isRevalidation = useRef(false);
    const postValidationTransitioning = useRef(
        validationSource === "main" ||
            ((validationSource === "s2" || validationSource === "s3" || validationSource === "s5") &&
                !appContext.caseService.cirReAdjudication.value.some(
                    (item) => item?.response_type === "cbi_re_adjudication",
                )),
    );
    const isRecount = useRef(false);

    // ── Clear validation flag after reading ────────────────────────────────
    useEffect(() => {
        if (appContext.caseService.isInterimCountValidation.value) {
            appContext.caseService.isInterimCountValidation.set("");
        }
    }, [appContext.caseService.isInterimCountValidation]);

    // ── Fetch CIR's entered count when entering validate state ───────────
    useEffect(() => {
        if (confirmedTotal !== null) return;
        if (
            state !== SCRInterimCountState.SCR_VALIDATE_COUNT &&
            state !== SCRInterimCountState.S4_WAIT_FOR_CIR &&
            state !== SCRInterimCountState.S7_CHECK_STERILE &&
            state !== SCRInterimCountState.INTERIM_COUNT_DONE &&
            state !== SCRInterimCountState.INTERIM_COUNT_DONE_EXTRA &&
            state !== SCRInterimCountState.INTERIM_COUNT_DONE_REGISTERED
        )
            return;
        appContext.caseService.parlayInterface.caseManager
            .get_confirmed_total()
            .then((total: number) => setConfirmedTotal(total));
    }, [state, confirmedTotal, appContext.caseService.parlayInterface.caseManager]);

    // ── screenMap broadcast ────────────────────────────────────────────────
    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;

        const screenMap: Record<SCRInterimCountState, string> = {
            [SCRInterimCountState.VALIDATE_PENDING]: "scrInterimCountValidatePending",
            [SCRInterimCountState.WAIT_FOR_CIR]: "scrInterimCountWaitForCir",
            [SCRInterimCountState.WAIT_FOR_CIR_POST_VALIDATION]: "scrInterimCountWaitForCirPostValidation",
            [SCRInterimCountState.WAIT_FOR_CIR_REVIEW]: "scrInterimCountWaitForCirReview",
            [SCRInterimCountState.SCR_COUNT_INPUT]: "scrInterimCountCountInput",
            [SCRInterimCountState.SCR_VALIDATE_COUNT]: "scrInterimCountValidateCount",
            [SCRInterimCountState.SCR_CONFIRMED_COUNT]: "scrInterimCountConfirmedCount",
            [SCRInterimCountState.SCR_RECOUNT]: "scrInterimCountRecount",
            [SCRInterimCountState.INTERIM_COUNT_DONE]: "scrInterimCountDone",

            // Section 2
            [SCRInterimCountState.S2_WAIT_CBI_BOX]: "scrInterimCountS2WaitCbiBox",
            [SCRInterimCountState.S2_VALIDATE_CBI]: "scrInterimCountS2ValidateCbi",
            [SCRInterimCountState.S2_WAIT_CIR_READJ]: "scrInterimCountS2WaitCirReadj",

            // Section 3
            [SCRInterimCountState.S3_WAIT_CBI_BOX]: "scrInterimCountS3WaitCbiBox",
            [SCRInterimCountState.S3_VALIDATE_CBI]: "scrInterimCountS3ValidateCbi",
            [SCRInterimCountState.S3_WAIT_CIR_READJ]: "scrInterimCountS3WaitCirReadj",

            // Section 4
            [SCRInterimCountState.SECTION_4]: "scrInterimCountSection4",
            [SCRInterimCountState.S4_WAIT_FOR_CIR]: "scrInterimCountS4WaitForCir",

            // Section 5
            [SCRInterimCountState.SECTION_5]: "scrInterimCountSection5",
            [SCRInterimCountState.S5_VALIDATE_CBI]: "scrInterimCountS5ValidateCbi",
            [SCRInterimCountState.S5_WAIT_FOR_CIR_POST_VALIDATION]: "scrInterimCountS5WaitForCirPostValidation",
            [SCRInterimCountState.S5_WAIT_FOR_CIR_READJ]: "scrInterimCountS5WaitForCirReadj",

            // Section 7
            [SCRInterimCountState.S7_CHECK_STERILE]: "scrInterimCountS7CheckSterile",
            [SCRInterimCountState.S7_NEEDLE_REGISTERED]: "scrInterimCountS7NeedleRegistered",
            [SCRInterimCountState.S7_NEEDLE_FOUND]: "scrInterimCountS7NeedleFound",

            // Done variants
            [SCRInterimCountState.INTERIM_COUNT_DONE_EXTRA]: "scrInterimCountDoneExtra",
            [SCRInterimCountState.INTERIM_COUNT_DONE_REGISTERED]: "scrInterimCountDoneRegistered",
        };

        appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(screenMap[state]);
    }, [state, appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    // ── Resolver stubs ─────────────────────────────────────────────────────

    // Post-validation resolver — checks re-adj, then routes to SCR count input (Koboh screens).
    // After count entry, CIR drives section routing via sync listener.
    const resolvePostValidation = useCallback(() => {
        // Decision 1: "Are there any new items in Pending CIR Adjudication / Re-Adjudication?"
        const hasPendingCIRAdj =
            appContext.caseService.cirAdjudication.value.length > 0 ||
            appContext.caseService.cirReAdjudication.value.length > 0;
        if (hasPendingCIRAdj) {
            setState(SCRInterimCountState.WAIT_FOR_CIR_REVIEW);
            return;
        }

        // Route to Koboh's SCR count input screen.
        // CIR drives section routing after count confirmation — SCR follows via sync listener.
        setState(SCRInterimCountState.SCR_COUNT_INPUT);
    }, [appContext.caseService]);

    // ── Sync listeners (stubs) ─────────────────────────────────────────────

    // Main flow sync: WAIT_FOR_CIR / WAIT_FOR_CIR_POST_VALIDATION / WAIT_FOR_CIR_REVIEW
    // + SCR_COUNT_INPUT / SCR_RECOUNT (so SCR receives CIR's count confirmation event)
    // + SCR_CONFIRMED_COUNT (broadcast-only state — must hear CIR's section routing broadcast).
    // Same pattern as CC SCR consolidated decision sync listener.
    useEffect(() => {
        if (
            state !== SCRInterimCountState.WAIT_FOR_CIR &&
            state !== SCRInterimCountState.WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRInterimCountState.WAIT_FOR_CIR_REVIEW &&
            state !== SCRInterimCountState.SCR_COUNT_INPUT &&
            state !== SCRInterimCountState.SCR_RECOUNT &&
            state !== SCRInterimCountState.SCR_CONFIRMED_COUNT
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            postValidationTransitioning.current = false;

            switch (event.screen) {
                // CIR went back to intro screens
                case "cirInterimCount":
                case "cirInterimCountChooseReason":
                case "cirInterimCountWhoIsRequesting":
                    // SCR navigates back to dashboard (no deposit steps to return to)
                    break;

                // CIR reached SCR_PENDING_WAIT — ready for SCR validation
                case "cirInterimCountScrPendingWait":
                    if (
                        state === SCRInterimCountState.WAIT_FOR_CIR ||
                        state === SCRInterimCountState.WAIT_FOR_CIR_REVIEW
                    ) {
                        isRevalidation.current = state === SCRInterimCountState.WAIT_FOR_CIR_REVIEW;
                        setState(SCRInterimCountState.VALIDATE_PENDING);
                    } else {
                        // WAIT_FOR_CIR_POST_VALIDATION → resolvePostValidation
                        resolvePostValidation();
                    }
                    break;

                // CIR entered re-adjudication
                case "cirInterimCountPostValResolveReadj":
                case "cirInterimCountPostValReadjudication":
                    setState(SCRInterimCountState.WAIT_FOR_CIR_REVIEW);
                    break;

                // CIR entered SCR count entry — SCR shows "count needles" (or "recount" on retry)
                case "cirInterimCountScrCountEntry":
                    setState(
                        isRecount.current ? SCRInterimCountState.SCR_RECOUNT : SCRInterimCountState.SCR_COUNT_INPUT,
                    );
                    break;

                // CIR confirmed count — SCR validates the entered number
                case "cirInterimCountWaitScrCountConfirm":
                    setState(SCRInterimCountState.SCR_VALIDATE_COUNT);
                    break;

                // CIR entered Section 1 (remaining < 0)
                case "cirInterimCountS2CheckCbiBox":
                    setState(SCRInterimCountState.S2_WAIT_CBI_BOX);
                    break;

                // CIR entered Section 2 (remaining > 0)
                case "cirInterimCountS3CheckCbiBox":
                    setState(SCRInterimCountState.S3_WAIT_CBI_BOX);
                    break;

                // CIR entered Section 7 (sterile field check)
                case "cirInterimCountS7CheckSterileField":
                    setState(SCRInterimCountState.S7_CHECK_STERILE);
                    break;

                // CIR reached done states
                case "cirInterimCountDone":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE);
                    break;
                case "cirInterimCountDoneExtra":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE_EXTRA);
                    break;
                case "cirInterimCountDoneRegistered":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE_REGISTERED);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, resolvePostValidation, appContext.caseService.parlayInterface.caseManager]);

    // Section 2 sync listener
    useEffect(() => {
        if (
            state !== SCRInterimCountState.S2_WAIT_CBI_BOX &&
            state !== SCRInterimCountState.S2_VALIDATE_CBI &&
            state !== SCRInterimCountState.S2_WAIT_CIR_READJ
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            postValidationTransitioning.current = false;
            switch (event.screen) {
                case "cirInterimCountS2WaitScrValidations":
                    setState(SCRInterimCountState.S2_VALIDATE_CBI);
                    break;
                case "cirInterimCountS2ResolveReadj":
                case "cirInterimCountS2CbiReadjudication":
                    setState(SCRInterimCountState.S2_WAIT_CIR_READJ);
                    break;
                case "cirInterimCountS2CheckCbiBox":
                    setState(SCRInterimCountState.S2_WAIT_CBI_BOX);
                    break;
                // Exit paths
                case "cirInterimCountDone":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE);
                    break;
                case "cirInterimCountS3CheckCbiBox":
                    setState(SCRInterimCountState.S3_WAIT_CBI_BOX);
                    break;
                case "cirInterimCountDoneExtra":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE_EXTRA);
                    break;
                case "cirInterimCountDoneRegistered":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE_REGISTERED);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 3 sync listener
    useEffect(() => {
        if (
            state !== SCRInterimCountState.S3_WAIT_CBI_BOX &&
            state !== SCRInterimCountState.S3_VALIDATE_CBI &&
            state !== SCRInterimCountState.S3_WAIT_CIR_READJ
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            postValidationTransitioning.current = false;
            switch (event.screen) {
                case "cirInterimCountS3WaitScrValidations":
                    setState(SCRInterimCountState.S3_VALIDATE_CBI);
                    break;
                case "cirInterimCountS3ResolveReadj":
                case "cirInterimCountS3Readjudication":
                    setState(SCRInterimCountState.S3_WAIT_CIR_READJ);
                    break;
                case "cirInterimCountS3CheckCbiBox":
                    setState(SCRInterimCountState.S3_WAIT_CBI_BOX);
                    break;
                case "cirInterimCountS7CheckSterileField":
                    setState(SCRInterimCountState.S7_CHECK_STERILE);
                    break;
                // Exit paths
                case "cirInterimCountDone":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE);
                    break;
                case "cirInterimCountS2CheckCbiBox":
                    setState(SCRInterimCountState.S2_WAIT_CBI_BOX);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 7 sync listener (sterile field mirrors)
    useEffect(() => {
        if (
            state !== SCRInterimCountState.S7_CHECK_STERILE &&
            state !== SCRInterimCountState.S7_NEEDLE_REGISTERED &&
            state !== SCRInterimCountState.S7_NEEDLE_FOUND
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "cirInterimCountS7NeedleFound":
                    setState(SCRInterimCountState.S7_NEEDLE_FOUND);
                    break;
                case "cirInterimCountS7NeedleRegistered":
                    setState(SCRInterimCountState.S7_NEEDLE_REGISTERED);
                    break;
                // Exit to Section 4 (sterile) or Section 5 (non-sterile)
                case "cirInterimCountS4ScrRecount":
                    setState(SCRInterimCountState.SECTION_4);
                    break;
                case "cirInterimCountSection5":
                case "cirInterimCountS5BrokenQuestion":
                    setState(SCRInterimCountState.SECTION_5);
                    break;
                case "cirInterimCountDoneRegistered":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE_REGISTERED);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 4 sync listener (recount flow)
    useEffect(() => {
        if (
            state !== SCRInterimCountState.SECTION_4 &&
            state !== SCRInterimCountState.S4_WAIT_FOR_CIR &&
            state !== SCRInterimCountState.SCR_RECOUNT &&
            state !== SCRInterimCountState.SCR_CONFIRMED_COUNT
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "cirInterimCountS4ScrRecount":
                    setState(SCRInterimCountState.SECTION_4);
                    break;
                case "cirInterimCountS4WaitScr":
                    setState(SCRInterimCountState.S4_WAIT_FOR_CIR);
                    break;
                // Exit paths
                case "cirInterimCountDone":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE);
                    break;
                case "cirInterimCountS2CheckCbiBox":
                    setState(SCRInterimCountState.S2_WAIT_CBI_BOX);
                    break;
                case "cirInterimCountS7CheckSterileField":
                    setState(SCRInterimCountState.S7_CHECK_STERILE);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 5 sync listener (non-sterile zone)
    useEffect(() => {
        if (
            state !== SCRInterimCountState.SECTION_5 &&
            state !== SCRInterimCountState.S5_VALIDATE_CBI &&
            state !== SCRInterimCountState.S5_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRInterimCountState.S5_WAIT_FOR_CIR_READJ
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            postValidationTransitioning.current = false;
            switch (event.screen) {
                case "cirInterimCountS5WaitScrValidations":
                    setState(SCRInterimCountState.S5_VALIDATE_CBI);
                    break;
                case "cirInterimCountS5ResolveReadj":
                case "cirInterimCountS5Readjudication":
                    setState(SCRInterimCountState.S5_WAIT_FOR_CIR_READJ);
                    break;
                // Exit paths
                case "cirInterimCountDone":
                    setState(SCRInterimCountState.INTERIM_COUNT_DONE);
                    break;
                case "cirInterimCountS2CheckCbiBox":
                    setState(SCRInterimCountState.S2_WAIT_CBI_BOX);
                    break;
                case "cirInterimCountS7CheckSterileField":
                    setState(SCRInterimCountState.S7_CHECK_STERILE);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, resolvePostValidation, appContext.caseService.parlayInterface.caseManager]);

    // Done states: listen for CIR exit → navigate SCR to dashboard
    useEffect(() => {
        if (
            state !== SCRInterimCountState.INTERIM_COUNT_DONE &&
            state !== SCRInterimCountState.INTERIM_COUNT_DONE_EXTRA &&
            state !== SCRInterimCountState.INTERIM_COUNT_DONE_REGISTERED
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            if (event.screen === "cirInterimCountPostDone") {
                appContext.navigate({ path: "scrDashboard" });
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager, appContext]);

    // ── renderContent ──────────────────────────────────────────────────────
    function renderContent() {
        switch (state) {
            // === Initial validation (same component as CC — SCRClosingCountStep) ===
            case SCRInterimCountState.VALIDATE_PENDING:
                return (
                    <SCRClosingCountStep
                        prefixKey={
                            isRevalidation.current
                                ? "scrClosingCount.validatePendingRevalidation"
                                : "scrClosingCount.validatePending"
                        }
                        activeButton="validate"
                        onConfirm={() => {
                            postValidationTransitioning.current = true;
                            appContext.caseService.isInterimCountValidation.set("main");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRInterimCountState.WAIT_FOR_CIR:
                return <WaitForCIRClosingCount />;
            case SCRInterimCountState.WAIT_FOR_CIR_POST_VALIDATION:
                if (postValidationTransitioning.current) return null;
                return <WaitForCIRClosingCount />;
            case SCRInterimCountState.WAIT_FOR_CIR_REVIEW:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReview" />;

            // === Post-verification count entry ===
            case SCRInterimCountState.SCR_COUNT_INPUT:
                return <InterimCountScrNeedlesOnField variant="count" />;

            case SCRInterimCountState.SCR_RECOUNT:
                return <InterimCountScrNeedlesOnField variant="recount" />;

            case SCRInterimCountState.SCR_VALIDATE_COUNT:
                return (
                    <InterimCountScrConfirmNeedles
                        count={confirmedTotal}
                        onYes={() => {
                            isRecount.current = false;
                            setState(SCRInterimCountState.SCR_CONFIRMED_COUNT);
                        }}
                        onNo={() => {
                            isRecount.current = true;
                            setState(SCRInterimCountState.SCR_RECOUNT);
                        }}
                    />
                );

            case SCRInterimCountState.SCR_CONFIRMED_COUNT:
                // Broadcast state — signals CIR to proceed. SCR follows CIR to sections via sync listener.
                return null;

            // === Section 1 — Done (read-only mirror) ===
            case SCRInterimCountState.INTERIM_COUNT_DONE: {
                const scrRemaining = startingCount + addedNeedles - confirmed;
                return (
                    <CountReconciliationScreen
                        systemCount={scrRemaining}
                        scrCount={confirmedTotal ?? scrRemaining}
                        hideButtons
                    />
                );
            }

            // === Section 2 SCR ===
            case SCRInterimCountState.S2_WAIT_CBI_BOX:
                if (postValidationTransitioning.current) return null;
                return <WaitForCIRClosingCount textKey="scrClosingCount.s2WaitCbiBox" />;
            case SCRInterimCountState.S2_VALIDATE_CBI:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section2ValidateCbi"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isInterimCountValidation.set("s2");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRInterimCountState.S2_WAIT_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReAdjudication" />;

            // === Section 3 SCR ===
            case SCRInterimCountState.S3_WAIT_CBI_BOX:
                if (postValidationTransitioning.current) return null;
                return <WaitForCIRClosingCount textKey="scrClosingCount.s2WaitCbiBox" />;
            case SCRInterimCountState.S3_VALIDATE_CBI:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section2ValidateCbi"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isInterimCountValidation.set("s3");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRInterimCountState.S3_WAIT_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReAdjudication" />;

            // === Section 4 SCR (recount flow) ===
            case SCRInterimCountState.SECTION_4:
                return <InterimCountScrNeedlesOnField variant="recount" />;
            case SCRInterimCountState.S4_WAIT_FOR_CIR:
                return (
                    <InterimCountScrConfirmNeedles
                        count={confirmedTotal}
                        onYes={() => {
                            isRecount.current = false;
                            setState(SCRInterimCountState.SCR_CONFIRMED_COUNT);
                        }}
                        onNo={() => {
                            isRecount.current = true;
                            setState(SCRInterimCountState.SCR_RECOUNT);
                        }}
                    />
                );

            // === Section 5 SCR ===
            case SCRInterimCountState.SECTION_5:
                return <WaitForCIRClosingCount />;
            case SCRInterimCountState.S5_VALIDATE_CBI:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section4ValidateCbi"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isInterimCountValidation.set("s5");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRInterimCountState.S5_WAIT_FOR_CIR_POST_VALIDATION:
                if (postValidationTransitioning.current) return null;
                return <WaitForCIRClosingCount />;
            case SCRInterimCountState.S5_WAIT_FOR_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReAdjudication" />;

            // === Section 7 SCR (sterile field mirrors) ===
            case SCRInterimCountState.S7_CHECK_STERILE: {
                const s7Delta = startingCount + addedNeedles - confirmed - (confirmedTotal ?? 0);
                return <NeedleSterileFieldScreen needleCount={s7Delta} variant="interimRemaining" hideButtons />;
            }
            case SCRInterimCountState.S7_NEEDLE_FOUND:
                return <NeedleFoundScreen onSelectType={() => {}} />;
            case SCRInterimCountState.S7_NEEDLE_REGISTERED:
                return null;

            // === Done variants ===
            case SCRInterimCountState.INTERIM_COUNT_DONE_EXTRA: {
                const scrRemainingExtra = startingCount + addedNeedles - confirmed;
                return (
                    <CountReconciliationScreen
                        systemCount={scrRemainingExtra}
                        scrCount={confirmedTotal ?? scrRemainingExtra}
                        hideButtons
                    />
                );
            }
            case SCRInterimCountState.INTERIM_COUNT_DONE_REGISTERED: {
                const scrRemainingReg = startingCount + addedNeedles - confirmed;
                return (
                    <CountReconciliationScreen
                        systemCount={scrRemainingReg}
                        scrCount={confirmedTotal ?? scrRemainingReg}
                        hideButtons
                    />
                );
            }
        }
    }

    // ── Outer JSX ──────────────────────────────────────────────────────────
    // All IC SCR states use the parent TrackingHeader (no states with own headers yet)
    const showHeader = true;

    return (
        <div className={styles.screenContainer}>
            {showHeader && (
                <TrackingHeader
                    title={t("interimCount.interimTitle")}
                    stage={2}
                    stageColor="rgba(79, 226, 206, 1)"
                    showNames={true}
                    showHelp={false}
                />
            )}
            <div className={styles.content}>{renderContent()}</div>
        </div>
    );
};
