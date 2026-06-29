import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../viewcss/SCRClosingCount.module.css";
import stepStyles from "./subviewcss/scrClosingCountStep.module.css";
import { TrackingHeader } from "./subview/TrackingHeader";
import { useTranslation } from "react-i18next";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import { SCRClosingCountStep } from "./subview/SCRClosingCountStep";
import { WaitForCIRClosingCount } from "./subview/WaitForCIRClosingCount";
import { ClosingCountDoneScreen } from "./subview/ClosingCountDoneScreen";
import { NeedleSterileFieldScreen } from "./subview/NeedleSterileFieldScreen";
import { NeedleXrayScreen } from "./subview/NeedleXrayScreen";
import { NeedleRegisteredScreen } from "./subview/NeedleRegisteredScreen";
import { SCRScanPackConfirmScreen } from "./subview/SCRScanPackConfirmScreen";

enum SCRClosingCountState {
    DEPOSIT_USED, // Figma 3.80 (SCRClosingCountStep — Yes button active)
    DEPOSIT_UNUSED, // Figma 3.81 (SCRClosingCountStep — Yes button active)
    DEPOSIT_PACKED, // Figma 3.82 (SCRClosingCountStep — Yes button active)
    WAIT_FOR_CIR, // Figma 3.83 (WaitForCIRClosingCount — waits for CIR to reach SCR_PENDING_WAIT / CIR Figma 3.15)
    VALIDATE_PENDING, // Figma 3.84 (SCRClosingCountStep — Validate button active, orange)
    // Figma 3.85–3.88: SCR validation screens (navigates to scrValidation view, returns here after)
    WAIT_FOR_CIR_POST_VALIDATION, // Reuses WaitForCIRClosingCount — waits for CIR post-validation decision tree
    // Post-validation decision tree:
    // 1. "Pending CIR Adjudication / Re-Adjudication items?" → Yes: 3.89 (wait for CIR review) → loop
    // 2. "Is remaining needles == 0?" → No: Section 1 (remaining<0) or Section 2 (remaining>0)
    // 3. remaining==0 → Decision Node 9: "Misplaced needles?" → Yes: Section 7, No: Done
    WAIT_FOR_CIR_REVIEW, // Figma 3.89 (WaitForCIRClosingCount — "Please wait until the CIR reviews all newly added items...")
    CLOSING_COUNT_DONE, // Reuses ClosingCountDoneScreen (same as CIR Figma 3.20)
    // SCR waiting screen after CIR presses OK on closing count done — "Please wait while CIR scans..."
    WAIT_CIR_SCAN,
    // Section 1 — "Remaining below 0" (more needles confirmed than expected)
    S1_WAIT_CBI_BOX, // Figma 3.96 (WaitForCIRClosingCount — "Please wait while CIR checks the CBI Box count...")
    S1_EXTRA_REGISTERED, // Read-only mirror of CIR S1_EXTRA_REGISTERED (NeedleRegisteredScreen variant="extra", no buttons)
    S1_CONFIRM_PACK, // Figma 3.99 (SCRScanPackConfirmScreen — CIR found discrepancy, SCR confirms pack details)
    S1_VALIDATE_CBI, // Figma 3.100 (first-pass CBI mismatch → "CIR updated CBI Box counts")
    S1_WAIT_CIR_READJ, // Figma 3.89 variant — SCR waits while CIR reviews re-adjudication items
    // Section 2 — "Remaining above 0" (needles still unaccounted for)
    S2_WAIT_CBI_BOX, // Wait while CIR checks CBI box (3.46)
    S2_CHECK_STERILE, // Figma 3.104 — read-only mirror of CIR 3.47 (NeedleSterileFieldScreen, no buttons)
    S2_REGISTERED, // Figma 3.105 — read-only mirror of CIR NEEDLE_REGISTERED (NeedleRegisteredScreen, no buttons)
    S2_VALIDATE_CBI, // CBI mismatch path — SCR validates CBI changes
    S2_WAIT_CIR_READJ, // SCR waits while CIR reviews re-adjudication items (S2 variant)
    // Section 10 — Extra needles flow (SCR read-only mirrors of CIR Section 10 screens)
    S10_CHECK_STERILE, // Read-only mirror of CIR EXTRA_NEEDLES_CHECK_STERILE
    S10_XRAY, // Read-only mirror of CIR EXTRA_NEEDLES_XRAY
    S10_WAIT_NEEDLE_TYPE, // Wait for CIR NEEDLE_FOUND_SELECTION decision
    S10_REGISTERED, // Read-only mirror of CIR EXTRA_NEEDLES_REGISTERED
    // Section 7 — Misplaced needles flow (SCR read-only mirrors of CIR Section 7 screens)
    S7_CHECK_STERILE, // Figma 3.21 (read-only mirror of CIR 3.21 — NeedleSterileFieldScreen, no buttons)
    S7_XRAY, // Figma 3.94 (read-only mirror of CIR 3.33 — NeedleXrayScreen, no buttons)
    S7_WAIT_NEEDLE_TYPE, // Wait for CIR 3.22 decision (sterile vs contaminated/broken/incompatible)
    // Section 3 & 4 — entry points after CIR 3.22 needle type selection (from Section 7)
    SECTION_3, // Section 3 — SCR places misplaced needles into HayStack
    S3_WAIT_FOR_CIR, // Section 3 — SCR confirmed placement, waiting for CIR
    S3_VALIDATE_PENDING, // Figma 3.107 — SCRClosingCountStep with "Validate" button (misplaced needles)
    S3_WAIT_FOR_CIR_POST_VALIDATION, // WaitForCIRClosingCount — post-validation wait
    S3_WAIT_FOR_CIR_READJ, // WaitForCIRClosingCount — readjudication wait
    SECTION_4, // Section 4 — misplaced needle found in non-sterile zone (wait screen)
    S4_VALIDATE_CBI, // Section 4 — navigate to scrValidation for CBI count
    S4_WAIT_FOR_CIR_POST_VALIDATION, // Section 4 — wait for CIR post-validation
    S4_WAIT_FOR_CIR_READJ, // Section 4 — wait for CIR re-adjudication
    // Section 5 — remaining needle found in sterile zone (from S2 3.49)
    SECTION_5, // SCR places remaining needles into haystack (SCRClosingCountStep)
    S5_WAIT_FOR_CIR, // SCR confirmed placement, waiting for CIR review
    S5_VALIDATE_PENDING, // SCR validates remaining needles (individual needle validation)
    S5_WAIT_FOR_CIR_POST_VALIDATION, // Post-validation wait
    S5_WAIT_FOR_CIR_READJ, // Re-adjudication wait
    S5_CHECK_STERILE, // Read-only mirror of CIR S5_CHECK_STERILE (3.111 variant="remaining")
    S5_NEEDLE_REGISTERED, // Read-only mirror of CIR S5_NEEDLE_REGISTERED (3.105 variant="remaining")
    S5_NEEDLE_FOUND, // Wait while CIR selects needle type on 3.49
    // Section 6 — remaining needle found in non-sterile zone (from S2 3.49, CBI batch flow)
    SECTION_6, // Wait screen while CIR processes CBI needle capture
    S6_VALIDATE_CBI, // Navigate to scrValidation for CBI count
    S6_WAIT_FOR_CIR_POST_VALIDATION, // Wait for CIR post-validation
    S6_WAIT_FOR_CIR_READJ, // Wait for CIR re-adjudication
    S6_CHECK_STERILE, // Read-only mirror of CIR S6_CHECK_STERILE
    S6_NEEDLE_REGISTERED, // Read-only mirror of CIR S6_NEEDLE_REGISTERED
    S6_NEEDLE_FOUND, // Wait while CIR selects needle type
    // CIR 3.34 — read-only mirror of NeedleRegisteredScreen (x-ray → needle not found path)
    S7_REGISTERED,
    // CIR 3.20 — read-only mirror of ClosingCountDoneScreen (misplaced done, no button)
    S7_DONE,
    // SCR waiting screen after CIR presses OK on misplaced done — "Please wait while CIR scans..."
    S7_WAIT_CIR_SCAN,
}

export const SCRClosingCount: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    // If returning from closing count validation, resume at the correct post-validation wait
    const validationSource = appContext.caseService.isClosingCountValidation.value;
    let initialState: SCRClosingCountState;
    if (validationSource === "main") {
        initialState = SCRClosingCountState.WAIT_FOR_CIR_POST_VALIDATION;
    } else if (validationSource === "s1") {
        // After SCR S1 validation, check if re-adjudication items were created (SCR rejected).
        // If so, go straight to S1_WAIT_CIR_READJ to avoid flashing S1_WAIT_CBI_BOX first.
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        initialState = hasCbiReAdj ? SCRClosingCountState.S1_WAIT_CIR_READJ : SCRClosingCountState.S1_WAIT_CBI_BOX;
    } else if (validationSource === "s2") {
        // After SCR S2 validation, check if re-adjudication items were created (SCR rejected).
        // If so, go straight to S2_WAIT_CIR_READJ to avoid flashing S2_CHECK_STERILE first.
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        initialState = hasCbiReAdj ? SCRClosingCountState.S2_WAIT_CIR_READJ : SCRClosingCountState.S2_CHECK_STERILE;
    } else if (validationSource === "s3") {
        initialState = SCRClosingCountState.S3_WAIT_FOR_CIR_POST_VALIDATION;
    } else if (validationSource === "s4") {
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        if (hasCbiReAdj) {
            initialState = SCRClosingCountState.S4_WAIT_FOR_CIR_READJ;
        } else {
            // Mirror CIR's resolveS4Exit: misplaced > 0 → Section 7 loop, else → done
            const misplaced = appContext.caseService.misplaced.value + appContext.caseService.wholeMisplaced.value;
            initialState =
                misplaced > 0
                    ? SCRClosingCountState.S4_WAIT_FOR_CIR_POST_VALIDATION
                    : SCRClosingCountState.CLOSING_COUNT_DONE;
        }
    } else if (validationSource === "s5") {
        // After SCR S5 validation, check if re-adjudication items were created (SCR rejected).
        const hasReAdj = appContext.caseService.cirReAdjudication.value.length > 0;
        if (hasReAdj) {
            initialState = SCRClosingCountState.S5_WAIT_FOR_CIR_READJ;
        } else {
            // Mirror CIR's resolveS5Exit: remaining > 0 → loop, else (≤ 0) → Decision Node 9
            const startingCount = appContext.caseService.startingCount.value;
            const addedNeedles = appContext.caseService.addedNeedleCount.value;
            const confirmed = appContext.caseService.confirmed.value;
            const remaining = startingCount + addedNeedles - confirmed;
            if (remaining > 0) {
                initialState = SCRClosingCountState.S5_CHECK_STERILE;
            } else {
                // Full Decision Node 9: misplaced → Section 7, extra → Section 10, else → done
                const misplaced = appContext.caseService.misplaced.value + appContext.caseService.wholeMisplaced.value;
                const extra = addedNeedles;
                if (misplaced > 0) {
                    initialState = SCRClosingCountState.S5_WAIT_FOR_CIR_POST_VALIDATION;
                } else if (extra > 0) {
                    initialState = SCRClosingCountState.S10_CHECK_STERILE;
                } else {
                    initialState = SCRClosingCountState.CLOSING_COUNT_DONE;
                }
            }
        }
    } else if (validationSource === "s6") {
        // After SCR S6 validation, check if re-adjudication items were created (SCR rejected).
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        if (hasCbiReAdj) {
            initialState = SCRClosingCountState.S6_WAIT_FOR_CIR_READJ;
        } else {
            // Mirror CIR's resolveS6Exit: remaining > 0 → loop, else (≤ 0) → Decision Node 9
            const startingCount = appContext.caseService.startingCount.value;
            const addedNeedles = appContext.caseService.addedNeedleCount.value;
            const confirmed = appContext.caseService.confirmed.value;
            const remaining = startingCount + addedNeedles - confirmed;
            if (remaining > 0) {
                initialState = SCRClosingCountState.S6_CHECK_STERILE;
            } else {
                // Full Decision Node 9: misplaced → Section 7, extra → Section 10, else → done
                const misplaced = appContext.caseService.misplaced.value + appContext.caseService.wholeMisplaced.value;
                const extra = addedNeedles;
                if (misplaced > 0) {
                    initialState = SCRClosingCountState.S6_WAIT_FOR_CIR_POST_VALIDATION;
                } else if (extra > 0) {
                    initialState = SCRClosingCountState.S10_CHECK_STERILE;
                } else {
                    initialState = SCRClosingCountState.CLOSING_COUNT_DONE;
                }
            }
        }
    } else {
        initialState = SCRClosingCountState.DEPOSIT_USED; // dev override (production: DEPOSIT_USED)
    }
    const [state, setState] = useState<SCRClosingCountState>(initialState);

    // When returning from main validation, suppress rendering until the sync listener
    // routes to the correct state. This avoids flashing the WaitForCIR spinner.
    const postValidationTransitioning = useRef(validationSource === "main");

    // Clear the flag after using it for initial state
    useEffect(() => {
        if (appContext.caseService.isClosingCountValidation.value) {
            appContext.caseService.isClosingCountValidation.set("");
        }
    }, []);

    const misplacedHalves = useListenable(appContext.caseService.misplaced);
    const wholeMisplaced = useListenable(appContext.caseService.wholeMisplaced);
    const misplacedCount = misplacedHalves + wholeMisplaced;
    // Track whether the current VALIDATE_PENDING is a re-validation (after CIR re-adjudication)
    // so we can show different instruction text.
    const isRevalidation = useRef(false);

    // Capture remaining count when CIR broadcasts "Not Found" registered screen,
    // since DASHBOARD_UPDATE (which updates misplacedCount) hasn't arrived yet.
    const scrNotFoundCountRef = useRef(0);
    const startingCountVal = useListenable(appContext.caseService.startingCount);
    const addedNeedleCountVal = useListenable(appContext.caseService.addedNeedleCount);
    const confirmedVal = useListenable(appContext.caseService.confirmed);

    const scrConfirmSuturePack = useListenable(appContext.caseService.scrConfirmSuturePack);

    // Section 1: how many more needles were confirmed than expected (always positive)
    const extraCount = Math.abs(confirmedVal - (startingCountVal + addedNeedleCountVal));

    // Track current screen for backend state restoration
    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        const screenMap: Record<SCRClosingCountState, string> = {
            [SCRClosingCountState.DEPOSIT_USED]: "scrClosingCountDepositUsed",
            [SCRClosingCountState.DEPOSIT_UNUSED]: "scrClosingCountDepositUnused",
            [SCRClosingCountState.DEPOSIT_PACKED]: "scrClosingCountDepositPacked",
            [SCRClosingCountState.WAIT_FOR_CIR]: "scrClosingCountWaitForCir",
            [SCRClosingCountState.VALIDATE_PENDING]: "scrClosingCountValidatePending",
            [SCRClosingCountState.WAIT_FOR_CIR_POST_VALIDATION]: "scrClosingCountWaitForCirPostValidation",
            [SCRClosingCountState.WAIT_FOR_CIR_REVIEW]: "scrClosingCountWaitForCirReview",
            [SCRClosingCountState.CLOSING_COUNT_DONE]: "scrClosingCountDone",
            [SCRClosingCountState.WAIT_CIR_SCAN]: "scrClosingCountWaitCirScan",
            [SCRClosingCountState.S1_WAIT_CBI_BOX]: "scrClosingCountS1WaitCbiBox",
            [SCRClosingCountState.S1_EXTRA_REGISTERED]: "scrClosingCountS1ExtraRegistered",
            [SCRClosingCountState.S1_CONFIRM_PACK]: "scrClosingCountS1ConfirmPack",
            [SCRClosingCountState.S1_VALIDATE_CBI]: "scrClosingCountS1ValidateCbi",
            [SCRClosingCountState.S1_WAIT_CIR_READJ]: "scrClosingCountS1WaitCirReadj",
            [SCRClosingCountState.S2_WAIT_CBI_BOX]: "scrClosingCountS2WaitCbiBox",
            [SCRClosingCountState.S2_CHECK_STERILE]: "scrClosingCountS2CheckSterile",
            [SCRClosingCountState.S2_REGISTERED]: "scrClosingCountS2Registered",
            [SCRClosingCountState.S2_VALIDATE_CBI]: "scrClosingCountS2ValidateCbi",
            [SCRClosingCountState.S2_WAIT_CIR_READJ]: "scrClosingCountS2WaitCirReadj",
            [SCRClosingCountState.S10_CHECK_STERILE]: "scrClosingCountS10CheckSterile",
            [SCRClosingCountState.S10_XRAY]: "scrClosingCountS10Xray",
            [SCRClosingCountState.S10_WAIT_NEEDLE_TYPE]: "scrClosingCountS10WaitNeedleType",
            [SCRClosingCountState.S10_REGISTERED]: "scrClosingCountS10Registered",
            [SCRClosingCountState.S7_CHECK_STERILE]: "scrClosingCountS7CheckSterile",
            [SCRClosingCountState.S7_XRAY]: "scrClosingCountS7Xray",
            [SCRClosingCountState.S7_WAIT_NEEDLE_TYPE]: "scrClosingCountS7WaitNeedleType",
            [SCRClosingCountState.SECTION_3]: "scrClosingCountSection3",
            [SCRClosingCountState.S3_WAIT_FOR_CIR]: "scrClosingCountS3WaitForCir",
            [SCRClosingCountState.S3_VALIDATE_PENDING]: "scrClosingCountS3ValidatePending",
            [SCRClosingCountState.S3_WAIT_FOR_CIR_POST_VALIDATION]: "scrClosingCountS3WaitForCirPostValidation",
            [SCRClosingCountState.S3_WAIT_FOR_CIR_READJ]: "scrClosingCountS3WaitForCirReadj",
            [SCRClosingCountState.SECTION_4]: "scrClosingCountS7Section4",
            [SCRClosingCountState.S4_VALIDATE_CBI]: "scrClosingCountS4ValidateCbi",
            [SCRClosingCountState.S4_WAIT_FOR_CIR_POST_VALIDATION]: "scrClosingCountS4WaitForCirPostValidation",
            [SCRClosingCountState.S4_WAIT_FOR_CIR_READJ]: "scrClosingCountS4WaitForCirReadj",
            [SCRClosingCountState.SECTION_5]: "scrClosingCountSection5",
            [SCRClosingCountState.S5_WAIT_FOR_CIR]: "scrClosingCountS5WaitForCir",
            [SCRClosingCountState.S5_VALIDATE_PENDING]: "scrClosingCountS5ValidatePending",
            [SCRClosingCountState.S5_WAIT_FOR_CIR_POST_VALIDATION]: "scrClosingCountS5WaitForCirPostValidation",
            [SCRClosingCountState.S5_WAIT_FOR_CIR_READJ]: "scrClosingCountS5WaitForCirReadj",
            [SCRClosingCountState.S5_CHECK_STERILE]: "scrClosingCountS5CheckSterile",
            [SCRClosingCountState.S5_NEEDLE_REGISTERED]: "scrClosingCountS5NeedleRegistered",
            [SCRClosingCountState.S5_NEEDLE_FOUND]: "scrClosingCountS5NeedleFound",
            [SCRClosingCountState.SECTION_6]: "scrClosingCountS2Section6",
            [SCRClosingCountState.S6_VALIDATE_CBI]: "scrClosingCountS6ValidateCbi",
            [SCRClosingCountState.S6_WAIT_FOR_CIR_POST_VALIDATION]: "scrClosingCountS6WaitForCirPostValidation",
            [SCRClosingCountState.S6_WAIT_FOR_CIR_READJ]: "scrClosingCountS6WaitForCirReadj",
            [SCRClosingCountState.S6_CHECK_STERILE]: "scrClosingCountS6CheckSterile",
            [SCRClosingCountState.S6_NEEDLE_REGISTERED]: "scrClosingCountS6NeedleRegistered",
            [SCRClosingCountState.S6_NEEDLE_FOUND]: "scrClosingCountS6NeedleFound",
            [SCRClosingCountState.S7_REGISTERED]: "scrClosingCountS7Registered",
            [SCRClosingCountState.S7_DONE]: "scrClosingCountS7Done",
            [SCRClosingCountState.S7_WAIT_CIR_SCAN]: "scrClosingCountS7WaitCirScan",
        };
        appContext.caseService.parlayInterface.caseManager.set_current_scr_screen(screenMap[state]);
    }, [state, appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    // Double-tap left arrow to reset to step 1 (dev testing)
    const lastArrowTap = useRef<{ key: string; time: number }>({ key: "", time: 0 });
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowLeft") return;
            const now = Date.now();
            const last = lastArrowTap.current;
            if (last.key === e.key && now - last.time < 400) {
                setState(SCRClosingCountState.DEPOSIT_USED);
                lastArrowTap.current = { key: "", time: 0 };
            } else {
                lastArrowTap.current = { key: e.key, time: now };
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const resolvePostValidation = useCallback(() => {
        // Decision 1: "Are there any new items in Pending CIR Adjudication / Re-Adjudication?"
        // If yes, CIR needs to review them → show 3.89 wait screen → loop back when done.
        const hasPendingCIRAdj =
            appContext.caseService.cirAdjudication.value.length > 0 ||
            appContext.caseService.cirReAdjudication.value.length > 0;
        if (hasPendingCIRAdj) {
            setState(SCRClosingCountState.WAIT_FOR_CIR_REVIEW);
            return;
        }

        // Decision 2: "Is the remaining needles number equal to 0?"
        const startingCount = appContext.caseService.startingCount.value;
        const addedNeedles = appContext.caseService.addedNeedleCount.value;
        const confirmed = appContext.caseService.confirmed.value;
        const remaining = startingCount + addedNeedles - confirmed;
        const misplaced = appContext.caseService.misplaced.value + appContext.caseService.wholeMisplaced.value;

        if (remaining !== 0) {
            // "What seems to be the issue?"
            // remaining < 0 → Section 1: more needles confirmed than expected
            // remaining > 0 → Section 2: fewer needles confirmed than expected
            setState(remaining < 0 ? SCRClosingCountState.S1_WAIT_CBI_BOX : SCRClosingCountState.S2_WAIT_CBI_BOX);
            return;
        }

        // Decision Node 9: "Are there any misplaced needles in the system?"
        if (misplaced > 0) {
            setState(SCRClosingCountState.S7_CHECK_STERILE);
            return;
        }

        // Clean completion — no misplaced, remaining == 0 → closing count done
        setState(SCRClosingCountState.CLOSING_COUNT_DONE);
    }, [appContext.caseService]);

    // CIR decision sync: When SCR is waiting for CIR (pre-validation, post-validation,
    // or re-adj review), listen for the CIR screen broadcast that tells SCR where to go.
    useEffect(() => {
        if (
            state !== SCRClosingCountState.WAIT_FOR_CIR &&
            state !== SCRClosingCountState.WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.WAIT_FOR_CIR_REVIEW
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            // Clear transitioning flag so the wait screen renders normally on future visits
            postValidationTransitioning.current = false;

            switch (event.screen) {
                // CIR went back to CONFIRM or STEPS — SCR restarts deposit flow
                case "cirCloseCount":
                case "cirCloseCountSteps":
                    setState(SCRClosingCountState.DEPOSIT_USED);
                    break;
                // CIR reached SCR_PENDING_WAIT — ready for SCR validation.
                // Pre-validation or post-re-adjudication: SCR must validate.
                // Post-validation (no re-adj): SCR resolves directly.
                case "cirClosingCountScrPendingWait":
                    if (
                        state === SCRClosingCountState.WAIT_FOR_CIR ||
                        state === SCRClosingCountState.WAIT_FOR_CIR_REVIEW
                    ) {
                        isRevalidation.current = state === SCRClosingCountState.WAIT_FOR_CIR_REVIEW;
                        setState(SCRClosingCountState.VALIDATE_PENDING);
                    } else {
                        resolvePostValidation();
                    }
                    break;
                // CIR entered re-adjudication resolve/review → SCR waits for CIR
                case "cirClosingCountPostValResolveReadj":
                case "cirClosingCountPostValReadjudication":
                    setState(SCRClosingCountState.WAIT_FOR_CIR_REVIEW);
                    break;
                // CIR entered Section 7 (misplaced needles)
                case "cirClosingCountScreen7MisplacedNeedles":
                    setState(SCRClosingCountState.S7_CHECK_STERILE);
                    break;
                // CIR entered Section 1 (remaining < 0)
                case "cirClosingCountS1CheckCbiBox":
                    setState(SCRClosingCountState.S1_WAIT_CBI_BOX);
                    break;
                // CIR entered Section 2 (remaining > 0)
                case "cirClosingCountS2CheckCbiBox":
                    setState(SCRClosingCountState.S2_WAIT_CBI_BOX);
                    break;
                // CIR reached closing count done
                case "cirClosingCountDone":
                    setState(SCRClosingCountState.CLOSING_COUNT_DONE);
                    break;
                // TODO: CIR entered Section 8 (misplaced == extra, balanced)
                // case "cirClosingCountSection8Done":
                //     setState(SCRClosingCountState.SECTION_8_DONE);
                //     break;
                case "cirClosingCountScreen10ExtraNeedles":
                    setState(SCRClosingCountState.S10_CHECK_STERILE);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, resolvePostValidation, appContext.caseService.parlayInterface.caseManager]);

    // Closing count done → wait for CIR scan: When SCR is on the generic
    // CLOSING_COUNT_DONE screen (non-S7 path), listen for CIR's broadcast
    // after pressing OK so SCR transitions to the waiting screen.
    useEffect(() => {
        if (state !== SCRClosingCountState.CLOSING_COUNT_DONE) return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "cirClosingCountPostDone":
                    setState(SCRClosingCountState.WAIT_CIR_SCAN);
                    break;
                // CIR entered Section 10 — SCR mirrors with read-only screens
                case "cirClosingCountScreen10ExtraNeedles":
                    setState(SCRClosingCountState.S10_CHECK_STERILE);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 10 — Extra needles: SCR read-only mirrors of CIR Section 10 screens.
    // When CIR finds a needle and routes to Section 5/6, SCR transitions to participate.
    useEffect(() => {
        if (
            state !== SCRClosingCountState.S10_CHECK_STERILE &&
            state !== SCRClosingCountState.S10_XRAY &&
            state !== SCRClosingCountState.S10_WAIT_NEEDLE_TYPE &&
            state !== SCRClosingCountState.S10_REGISTERED
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "cirClosingCountScreen10ExtraNeedles":
                    setState(SCRClosingCountState.S10_CHECK_STERILE);
                    break;
                case "cirClosingCountExtraNeedlesXray":
                    setState(SCRClosingCountState.S10_XRAY);
                    break;
                case "cirClosingCountNeedleFoundSelection":
                    setState(SCRClosingCountState.S10_WAIT_NEEDLE_TYPE);
                    break;
                case "cirClosingCountExtraNeedlesRegistered":
                    setState(SCRClosingCountState.S10_REGISTERED);
                    break;
                case "cirClosingCountDone":
                    setState(SCRClosingCountState.CLOSING_COUNT_DONE);
                    break;
                // CIR found a needle → Section 5 (sterile) or Section 6 (C/B/I)
                case "cirClosingCountSection5":
                case "cirClosingCountS5WaitForScr":
                    setState(SCRClosingCountState.SECTION_5);
                    break;
                case "cirClosingCountSection6":
                case "cirClosingCountS6BrokenQuestion":
                    setState(SCRClosingCountState.SECTION_6);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 1 — Listen for CIR screen changes to advance SCR through S1 screens.
    // Covers the full S1 lifecycle:
    //   S1_WAIT_CBI_BOX → S1_EXTRA_REGISTERED (CIR correct path)
    //   S1_WAIT_CBI_BOX → S1_VALIDATE_CBI (CIR mismatch path: 3.35→3.42→3.44→3.15, Figma 3.100)
    // Also handles exit paths: loop back to S1, Decision Node 9, or section exits.
    useEffect(() => {
        if (
            state !== SCRClosingCountState.S1_WAIT_CBI_BOX &&
            state !== SCRClosingCountState.S1_EXTRA_REGISTERED &&
            state !== SCRClosingCountState.S1_VALIDATE_CBI &&
            state !== SCRClosingCountState.S1_WAIT_CIR_READJ
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                // CIR CBI correct → SCR shows read-only registered screen
                case "cirClosingCountS1ExtraRegistered":
                    setState(SCRClosingCountState.S1_EXTRA_REGISTERED);
                    break;
                // CIR reached S1_WAIT_SCR_VALIDATIONS (3.15) → SCR shows validate button
                // Figma 3.100: "CIR updated CBI Box counts"
                case "cirClosingCountS1WaitScrValidations":
                    setState(SCRClosingCountState.S1_VALIDATE_CBI);
                    break;
                // CIR entered re-adjudication → SCR waits for CIR review
                case "cirClosingCountS1ResolveReadj":
                case "cirClosingCountS1CbiReadjudication":
                    setState(SCRClosingCountState.S1_WAIT_CIR_READJ);
                    break;
                // --- Exit paths (CIR's resolveSection1Exit) ---
                // CIR looped back to S1 (remaining still != 0)
                case "cirClosingCountS1CheckCbiBox":
                    setState(SCRClosingCountState.S1_WAIT_CBI_BOX);
                    break;
                // Decision Node 9 outcomes:
                case "cirClosingCountScreen7MisplacedNeedles":
                    setState(SCRClosingCountState.S7_CHECK_STERILE);
                    break;
                case "cirClosingCountDone":
                    setState(SCRClosingCountState.CLOSING_COUNT_DONE);
                    break;
                case "cirClosingCountS2CheckCbiBox":
                    setState(SCRClosingCountState.S2_WAIT_CBI_BOX);
                    break;
                case "cirClosingCountScreen10ExtraNeedles":
                    setState(SCRClosingCountState.S10_CHECK_STERILE);
                    break;
                // TODO: CIR entered Section 8 (misplaced == extra, balanced)
                // case "cirClosingCountSection8Done":
                //     setState(SCRClosingCountState.SECTION_8_DONE);
                //     break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 1 — Listen for CIR sending a pack for SCR confirmation (Figma 3.99).
    // When CIR finds a discrepancy and scans a pack, it calls scr_confirm_suture_pack
    // which sets scrConfirmSuturePack to the pack info. SCR shows the confirm screen.
    useEffect(() => {
        if (!scrConfirmSuturePack) return;
        if (state !== SCRClosingCountState.S1_WAIT_CBI_BOX && state !== SCRClosingCountState.S1_EXTRA_REGISTERED)
            return;
        setState(SCRClosingCountState.S1_CONFIRM_PACK);
    }, [scrConfirmSuturePack, state]);

    // Section 2 — Listen for CIR screen changes to advance SCR through S2 screens.
    // Covers the full S2 lifecycle:
    //   S2_WAIT_CBI_BOX → S2_CHECK_STERILE (CIR correct path: 3.46→3.47→3.48)
    //   S2_WAIT_CBI_BOX → S2_VALIDATE_CBI (CIR mismatch path: 3.46→3.42→3.44→3.15)
    // Also handles exit paths: loop back to S2, Decision Node 9, or section exits.
    useEffect(() => {
        if (
            state !== SCRClosingCountState.S2_WAIT_CBI_BOX &&
            state !== SCRClosingCountState.S2_CHECK_STERILE &&
            state !== SCRClosingCountState.S2_REGISTERED &&
            state !== SCRClosingCountState.S2_VALIDATE_CBI &&
            state !== SCRClosingCountState.S2_WAIT_CIR_READJ &&
            state !== SCRClosingCountState.SECTION_5 &&
            state !== SCRClosingCountState.SECTION_6 &&
            state !== SCRClosingCountState.S6_VALIDATE_CBI &&
            state !== SCRClosingCountState.S6_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.S6_WAIT_FOR_CIR_READJ &&
            state !== SCRClosingCountState.S6_CHECK_STERILE &&
            state !== SCRClosingCountState.S6_NEEDLE_REGISTERED &&
            state !== SCRClosingCountState.S6_NEEDLE_FOUND
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                // CBI correct path
                case "cirClosingCountS2CheckSterileField":
                    // Capture remaining count BEFORE "Not Found" increments misplaced
                    // (same pattern as S5/S6 CheckSterile). By the time NeedleRegistered
                    // arrives, DASHBOARD_UPDATE will have already bumped confirmed → |remaining| = 0.
                    scrNotFoundCountRef.current = Math.abs(
                        appContext.caseService.startingCount.value +
                            appContext.caseService.addedNeedleCount.value -
                            appContext.caseService.confirmed.value,
                    );
                    setState(SCRClosingCountState.S2_CHECK_STERILE);
                    break;
                case "cirClosingCountS2NeedleRegistered":
                    setState(SCRClosingCountState.S2_REGISTERED);
                    break;
                // CBI mismatch path — SCR waits during CBI selection/taps,
                // then shows validate when CIR reaches WAIT_SCR_VALIDATIONS
                case "cirClosingCountS2WaitScrValidations":
                    setState(SCRClosingCountState.S2_VALIDATE_CBI);
                    break;
                // --- Exit/loop paths (from resolveSection2Exit) ---
                case "cirClosingCountS2CheckCbiBox":
                    setState(SCRClosingCountState.S2_WAIT_CBI_BOX);
                    break;
                // Re-adj: SCR waits while CIR reviews
                case "cirClosingCountS2ResolveReadj":
                case "cirClosingCountS2Readjudication":
                    setState(SCRClosingCountState.S2_WAIT_CIR_READJ);
                    break;
                // Decision Node 9 outcomes (same exit paths as S1)
                case "cirClosingCountScreen7MisplacedNeedles":
                    setState(SCRClosingCountState.S7_CHECK_STERILE);
                    break;
                case "cirClosingCountDone":
                    setState(SCRClosingCountState.CLOSING_COUNT_DONE);
                    break;
                // TODO: CIR entered Section 10 (extra needles). Currently SCR goes
                case "cirClosingCountScreen10ExtraNeedles":
                    setState(SCRClosingCountState.S10_CHECK_STERILE);
                    break;
                // CIR back to needle type selection (3.49) — SCR falls back to sterile check mirror.
                // To add a dedicated wait screen (like S7_WAIT_NEEDLE_TYPE for Section 7):
                //   1. Add S2_WAIT_NEEDLE_TYPE enum state + screenMap entry
                //   2. Route this case to S2_WAIT_NEEDLE_TYPE instead of S2_CHECK_STERILE
                //   3. Add render case using <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRNeedleType" />
                //   4. Add S2_WAIT_NEEDLE_TYPE to the S2 sync listener state guard
                case "cirClosingCountS2NeedleFound":
                    setState(SCRClosingCountState.S2_CHECK_STERILE);
                    break;
                // Section 5/6 — CIR selected needle type on 3.49
                case "cirClosingCountS5WaitForScr":
                    setState(SCRClosingCountState.SECTION_5);
                    break;
                case "cirClosingCountSection6":
                    setState(SCRClosingCountState.SECTION_6);
                    break;
                // Section 6 sub-states — CIR CBI capture flow (SCR waits)
                case "cirClosingCountS6BrokenQuestion":
                case "cirClosingCountS6CapturePlaceholder":
                case "cirClosingCountS6PhotoConfirm":
                case "cirClosingCountS6NeedleTap":
                    setState(SCRClosingCountState.SECTION_6);
                    break;
                case "cirClosingCountS6WaitScrValidations":
                    setState(SCRClosingCountState.S6_VALIDATE_CBI);
                    break;
                case "cirClosingCountS6ResolveReadj":
                case "cirClosingCountS6Readjudication":
                    setState(SCRClosingCountState.S6_WAIT_FOR_CIR_READJ);
                    break;
                // Section 6 exit loop states
                case "cirClosingCountS6CheckSterile":
                    scrNotFoundCountRef.current = Math.abs(
                        appContext.caseService.startingCount.value +
                            appContext.caseService.addedNeedleCount.value -
                            appContext.caseService.confirmed.value,
                    );
                    setState(SCRClosingCountState.S6_CHECK_STERILE);
                    break;
                case "cirClosingCountS6NeedleRegistered":
                    setState(SCRClosingCountState.S6_NEEDLE_REGISTERED);
                    break;
                case "cirClosingCountS6NeedleFound":
                    setState(SCRClosingCountState.S6_NEEDLE_FOUND);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 7 — Listen for CIR screen changes and mirror on SCR.
    // Maps any CIR S7 screen to its SCR equivalent regardless of current SCR state,
    // so CIR pressing back and taking a different path is handled correctly.
    useEffect(() => {
        if (
            state !== SCRClosingCountState.S7_CHECK_STERILE &&
            state !== SCRClosingCountState.S7_XRAY &&
            state !== SCRClosingCountState.S7_WAIT_NEEDLE_TYPE &&
            state !== SCRClosingCountState.SECTION_3 &&
            state !== SCRClosingCountState.S3_WAIT_FOR_CIR &&
            state !== SCRClosingCountState.S3_VALIDATE_PENDING &&
            state !== SCRClosingCountState.S3_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.S3_WAIT_FOR_CIR_READJ &&
            state !== SCRClosingCountState.SECTION_4 &&
            state !== SCRClosingCountState.S4_VALIDATE_CBI &&
            state !== SCRClosingCountState.S4_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.S4_WAIT_FOR_CIR_READJ &&
            state !== SCRClosingCountState.S7_REGISTERED &&
            state !== SCRClosingCountState.S7_DONE &&
            state !== SCRClosingCountState.S7_WAIT_CIR_SCAN
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "cirClosingCountScreen7MisplacedNeedles":
                    setState(SCRClosingCountState.S7_CHECK_STERILE);
                    break;
                case "cirClosingCountScreen7MisplacedXray":
                    setState(SCRClosingCountState.S7_XRAY);
                    break;
                case "cirClosingCountScreen7MisplacedNeedleFound":
                    setState(SCRClosingCountState.S7_WAIT_NEEDLE_TYPE);
                    break;
                case "cirClosingCountScreen7MisplacedRegistered":
                    setState(SCRClosingCountState.S7_REGISTERED);
                    break;
                case "cirClosingCountScreen7MisplacedDone":
                    setState(SCRClosingCountState.S7_DONE);
                    break;
                case "cirClosingCountS3WaitForScr":
                    setState(SCRClosingCountState.SECTION_3);
                    break;
                case "cirClosingCountS3ScrPendingWait":
                    setState(SCRClosingCountState.S3_VALIDATE_PENDING);
                    break;
                case "cirClosingCountS3ResolveReadj":
                case "cirClosingCountS3Readjudication":
                    setState(SCRClosingCountState.S3_WAIT_FOR_CIR_READJ);
                    break;
                case "cirClosingCountDone":
                    setState(SCRClosingCountState.CLOSING_COUNT_DONE);
                    break;
                case "cirClosingCountS4BrokenQuestion":
                case "cirClosingCountSection4":
                case "cirClosingCountS4CapturePlaceholder":
                case "cirClosingCountS4PhotoConfirm":
                case "cirClosingCountS4NeedleTap":
                    setState(SCRClosingCountState.SECTION_4);
                    break;
                case "cirClosingCountS4WaitScrValidations":
                    setState(SCRClosingCountState.S4_VALIDATE_CBI);
                    break;
                case "cirClosingCountS4ResolveReadj":
                case "cirClosingCountS4Readjudication":
                    setState(SCRClosingCountState.S4_WAIT_FOR_CIR_READJ);
                    break;
                case "cirClosingCountPostSection7":
                    setState(SCRClosingCountState.S7_WAIT_CIR_SCAN);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    // Section 7 dev bypass: double-tap right arrow = "green" path (found/sterile),
    // double-tap down arrow = "red" path (not found/contaminated).
    useEffect(() => {
        if (
            state !== SCRClosingCountState.S7_CHECK_STERILE &&
            state !== SCRClosingCountState.S7_XRAY &&
            state !== SCRClosingCountState.S7_WAIT_NEEDLE_TYPE &&
            state !== SCRClosingCountState.SECTION_3 &&
            state !== SCRClosingCountState.S3_WAIT_FOR_CIR &&
            state !== SCRClosingCountState.S3_VALIDATE_PENDING &&
            state !== SCRClosingCountState.S3_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.S3_WAIT_FOR_CIR_READJ &&
            state !== SCRClosingCountState.SECTION_4 &&
            state !== SCRClosingCountState.S4_VALIDATE_CBI &&
            state !== SCRClosingCountState.S4_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.S4_WAIT_FOR_CIR_READJ &&
            state !== SCRClosingCountState.S7_REGISTERED &&
            state !== SCRClosingCountState.S7_DONE &&
            state !== SCRClosingCountState.S7_WAIT_CIR_SCAN
        )
            return;

        const lastTap = { key: "", time: 0 };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowDown") return;
            const now = Date.now();
            if (lastTap.key === e.key && now - lastTap.time < 400) {
                if (state === SCRClosingCountState.S7_CHECK_STERILE) {
                    setState(
                        e.key === "ArrowRight"
                            ? SCRClosingCountState.S7_WAIT_NEEDLE_TYPE // CIR found (green)
                            : SCRClosingCountState.S7_XRAY,
                    ); // CIR not found (red)
                } else if (state === SCRClosingCountState.S7_XRAY) {
                    setState(
                        e.key === "ArrowRight"
                            ? SCRClosingCountState.S7_WAIT_NEEDLE_TYPE // CIR found (green)
                            : SCRClosingCountState.S7_REGISTERED,
                    ); // CIR not found → registered
                } else if (state === SCRClosingCountState.S7_WAIT_NEEDLE_TYPE) {
                    setState(
                        e.key === "ArrowRight"
                            ? SCRClosingCountState.SECTION_3 // Sterile
                            : SCRClosingCountState.SECTION_4,
                    ); // Contaminated/Broken/Incompatible
                } else if (state === SCRClosingCountState.S7_REGISTERED) {
                    setState(SCRClosingCountState.S7_DONE); // CIR pressed OK → done
                } else if (state === SCRClosingCountState.S7_DONE) {
                    setState(SCRClosingCountState.S7_WAIT_CIR_SCAN); // CIR pressed OK → wait for scan
                }
                lastTap.key = "";
                lastTap.time = 0;
            } else {
                lastTap.key = e.key;
                lastTap.time = now;
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [state]);

    // Section 5 — Listen for CIR screen changes to advance SCR through S5 screens.
    // Section 5 is an individual needle verification/adjudication flow (like Section 3).
    // Entry from S2 sync listener (cirClosingCountSection5 → SECTION_5).
    useEffect(() => {
        if (
            state !== SCRClosingCountState.SECTION_5 &&
            state !== SCRClosingCountState.S5_WAIT_FOR_CIR &&
            state !== SCRClosingCountState.S5_VALIDATE_PENDING &&
            state !== SCRClosingCountState.S5_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.S5_WAIT_FOR_CIR_READJ &&
            state !== SCRClosingCountState.S5_CHECK_STERILE &&
            state !== SCRClosingCountState.S5_NEEDLE_REGISTERED &&
            state !== SCRClosingCountState.S5_NEEDLE_FOUND &&
            state !== SCRClosingCountState.SECTION_6 &&
            state !== SCRClosingCountState.S6_VALIDATE_CBI &&
            state !== SCRClosingCountState.S6_WAIT_FOR_CIR_POST_VALIDATION &&
            state !== SCRClosingCountState.S6_WAIT_FOR_CIR_READJ &&
            state !== SCRClosingCountState.S6_CHECK_STERILE &&
            state !== SCRClosingCountState.S6_NEEDLE_REGISTERED &&
            state !== SCRClosingCountState.S6_NEEDLE_FOUND
        )
            return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                // CIR back to S5 wait (re-entry from S5 sterile field loop)
                case "cirClosingCountS5WaitForScr":
                case "cirClosingCountSection5":
                    setState(SCRClosingCountState.SECTION_5);
                    break;
                // CIR in verification/adjudication — SCR waits
                case "cirClosingCountS5Verification":
                case "cirClosingCountS5Adjudication":
                    setState(SCRClosingCountState.S5_WAIT_FOR_CIR);
                    break;
                // CIR reached S5_SCR_PENDING_WAIT — SCR validates
                case "cirClosingCountS5ScrPendingWait":
                    setState(SCRClosingCountState.S5_VALIDATE_PENDING);
                    break;
                // CIR in re-adjudication — SCR waits
                case "cirClosingCountS5ResolveReadj":
                case "cirClosingCountS5Readjudication":
                    setState(SCRClosingCountState.S5_WAIT_FOR_CIR_READJ);
                    break;
                // CIR S5 exit screens — SCR mirrors
                case "cirClosingCountS5CheckSterile":
                    scrNotFoundCountRef.current = Math.abs(
                        appContext.caseService.startingCount.value +
                            appContext.caseService.addedNeedleCount.value -
                            appContext.caseService.confirmed.value,
                    );
                    setState(SCRClosingCountState.S5_CHECK_STERILE);
                    break;
                case "cirClosingCountS5NeedleRegistered":
                    setState(SCRClosingCountState.S5_NEEDLE_REGISTERED);
                    break;
                case "cirClosingCountS5NeedleFound":
                    setState(SCRClosingCountState.S5_NEEDLE_FOUND);
                    break;
                // --- Exit paths (from CIR resolveS5Exit → resolveDecisionNode9) ---
                case "cirClosingCountSection6":
                    setState(SCRClosingCountState.SECTION_6);
                    break;
                case "cirClosingCountDone":
                    setState(SCRClosingCountState.CLOSING_COUNT_DONE);
                    break;
                case "cirClosingCountScreen7MisplacedNeedles":
                    setState(SCRClosingCountState.S7_CHECK_STERILE);
                    break;
                case "cirClosingCountScreen10ExtraNeedles":
                    setState(SCRClosingCountState.S10_CHECK_STERILE);
                    break;
                // Section 6 sub-states — CIR CBI capture flow (SCR waits)
                case "cirClosingCountS6BrokenQuestion":
                case "cirClosingCountS6CapturePlaceholder":
                case "cirClosingCountS6PhotoConfirm":
                case "cirClosingCountS6NeedleTap":
                    setState(SCRClosingCountState.SECTION_6);
                    break;
                case "cirClosingCountS6WaitScrValidations":
                    setState(SCRClosingCountState.S6_VALIDATE_CBI);
                    break;
                case "cirClosingCountS6ResolveReadj":
                case "cirClosingCountS6Readjudication":
                    setState(SCRClosingCountState.S6_WAIT_FOR_CIR_READJ);
                    break;
                // Section 6 exit loop states
                case "cirClosingCountS6CheckSterile":
                    scrNotFoundCountRef.current = Math.abs(
                        appContext.caseService.startingCount.value +
                            appContext.caseService.addedNeedleCount.value -
                            appContext.caseService.confirmed.value,
                    );
                    setState(SCRClosingCountState.S6_CHECK_STERILE);
                    break;
                case "cirClosingCountS6NeedleRegistered":
                    setState(SCRClosingCountState.S6_NEEDLE_REGISTERED);
                    break;
                case "cirClosingCountS6NeedleFound":
                    setState(SCRClosingCountState.S6_NEEDLE_FOUND);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.cir_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager]);

    const showHeader = state !== SCRClosingCountState.S1_CONFIRM_PACK;

    function renderContent() {
        switch (state) {
            case SCRClosingCountState.DEPOSIT_USED:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.step1Prefix"
                        highlightKey="scrClosingCount.step1Highlight"
                        suffixKey="scrClosingCount.step1Suffix"
                        onConfirm={() => setState(SCRClosingCountState.DEPOSIT_UNUSED)}
                    />
                );
            case SCRClosingCountState.DEPOSIT_UNUSED:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.step2Prefix"
                        highlightKey="scrClosingCount.step2Highlight"
                        suffixKey="scrClosingCount.step2Suffix"
                        onConfirm={() => setState(SCRClosingCountState.DEPOSIT_PACKED)}
                    />
                );
            case SCRClosingCountState.DEPOSIT_PACKED:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.step3Prefix"
                        highlightKey="scrClosingCount.step3Highlight"
                        suffixKey="scrClosingCount.step3Suffix"
                        onConfirm={() => setState(SCRClosingCountState.WAIT_FOR_CIR)}
                    />
                );
            case SCRClosingCountState.WAIT_FOR_CIR:
                return <WaitForCIRClosingCount />;
            case SCRClosingCountState.VALIDATE_PENDING:
                return (
                    <SCRClosingCountStep
                        prefixKey={
                            isRevalidation.current
                                ? "scrClosingCount.validatePendingRevalidation"
                                : "scrClosingCount.validatePending"
                        }
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isClosingCountValidation.set("main");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRClosingCountState.WAIT_FOR_CIR_POST_VALIDATION:
                if (postValidationTransitioning.current) return null;
                return <WaitForCIRClosingCount />;
            case SCRClosingCountState.WAIT_FOR_CIR_REVIEW:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReview" />;
            case SCRClosingCountState.CLOSING_COUNT_DONE:
                return <ClosingCountDoneScreen hideButtons />;
            case SCRClosingCountState.WAIT_CIR_SCAN:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRScan" />;
            // Section 1 — SCR waits while CIR checks the CBI box count.
            // S1 sync listener handles transitions.
            case SCRClosingCountState.S1_WAIT_CBI_BOX:
                return <WaitForCIRClosingCount textKey="scrClosingCount.s1WaitCbiBox" />;
            // Section 1 — Figma 3.96: SCR waits while CIR checks wrappers/packs.
            // Custom text with purple count badge (styling from Figma 3.47 remainingBadge).
            // Section 1 — Read-only mirror of CIR S1_EXTRA_REGISTERED.
            // Section 1 "extra registered" — show addedNeedleCount when extra packs
            // were opened (matches Section 10 which also reads addedNeedleCount).
            // Fall back to extraCount (overCount) when addedNeedleCount is 0.
            // S1 sync listener handles exit: CIR loop back, Decision Node 9, or re-adjudication.
            case SCRClosingCountState.S1_EXTRA_REGISTERED:
                return (
                    <NeedleRegisteredScreen
                        needleCount={addedNeedleCountVal > 0 ? addedNeedleCountVal : extraCount}
                        variant="extra"
                        hideButtons
                    />
                );
            // Section 1 — Figma 3.99: SCR confirms pack details after CIR found discrepancy.
            // CIR is waiting at 3.40 (waitSCR). On confirm, SCR sends answer back via Parlay
            // and returns to the wrappers wait screen while CIR processes the result.
            case SCRClosingCountState.S1_CONFIRM_PACK:
                if (!scrConfirmSuturePack) return null;
                return (
                    <SCRScanPackConfirmScreen
                        scannedPackInfo={scrConfirmSuturePack}
                        onConfirm={async () => {
                            await appContext.caseService.parlayInterface.caseManager.scr_confirmed_answer(
                                scrConfirmSuturePack,
                                true,
                            );
                            appContext.caseService.scrConfirmSuturePack.set(null);
                            setState(SCRClosingCountState.S1_WAIT_CBI_BOX);
                        }}
                        onDeny={async () => {
                            await appContext.caseService.parlayInterface.caseManager.scr_confirmed_answer(
                                scrConfirmSuturePack,
                                false,
                            );
                            appContext.caseService.scrConfirmSuturePack.set(null);
                            setState(SCRClosingCountState.S1_WAIT_CBI_BOX);
                        }}
                    />
                );
            // Section 1 — Figma 3.100: First-pass CBI mismatch validate screen.
            // CIR updated CBI box counts and is now at S1_WAIT_SCR_VALIDATIONS (3.15).
            // SCR shows validate button so the scrub nurse can confirm CBI changes.
            case SCRClosingCountState.S1_VALIDATE_CBI:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section1ValidateCbi"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isClosingCountValidation.set("s1");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRClosingCountState.S1_WAIT_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReAdjudication" />;
            // Section 2 — SCR waits while CIR checks the CBI box count (3.46).
            // S2 sync listener handles transitions.
            case SCRClosingCountState.S2_WAIT_CBI_BOX:
                return <WaitForCIRClosingCount textKey="scrClosingCount.s2WaitCbiBox" />;
            case SCRClosingCountState.S2_WAIT_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReAdjudication" />;
            // Section 2 — Figma 3.104: Read-only mirror of CIR sterile field check (3.47).
            case SCRClosingCountState.S2_CHECK_STERILE:
                return <NeedleSterileFieldScreen needleCount={extraCount} variant="remaining" hideButtons />;
            // Section 2 — Figma 3.105: Read-only mirror of CIR needle registered (misplaced).
            // Uses scrNotFoundCountRef captured at sync time (same pattern as S5/S6).
            case SCRClosingCountState.S2_REGISTERED:
                return (
                    <NeedleRegisteredScreen needleCount={scrNotFoundCountRef.current} variant="misplaced" hideButtons />
                );
            // Section 2 — CBI mismatch: CIR updated CBI counts, SCR validates.
            case SCRClosingCountState.S2_VALIDATE_CBI:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section2ValidateCbi"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isClosingCountValidation.set("s2");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            // Section 10 — Extra needles: SCR read-only mirrors of CIR screens.
            case SCRClosingCountState.S10_CHECK_STERILE:
                return <NeedleSterileFieldScreen needleCount={addedNeedleCountVal} variant="extra" hideButtons />;
            case SCRClosingCountState.S10_XRAY:
                return <NeedleXrayScreen needleCount={addedNeedleCountVal} variant="extra" hideButtons />;
            case SCRClosingCountState.S10_WAIT_NEEDLE_TYPE:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRNeedleType" />;
            case SCRClosingCountState.S10_REGISTERED:
                return <NeedleRegisteredScreen needleCount={addedNeedleCountVal} variant="extra" hideButtons />;
            // Section 7 — Misplaced needles: SCR read-only mirrors of CIR screens.
            // SCR shows same visual as CIR but without buttons; transitions are
            // driven by CIR actions relayed through Parlay backend.
            case SCRClosingCountState.S7_CHECK_STERILE:
                return <NeedleSterileFieldScreen needleCount={misplacedCount} variant="misplaced" hideButtons />;
            case SCRClosingCountState.S7_XRAY:
                return <NeedleXrayScreen needleCount={misplacedCount} variant="misplaced" hideButtons />;
            case SCRClosingCountState.S7_WAIT_NEEDLE_TYPE:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRNeedleType" />;
            case SCRClosingCountState.S7_REGISTERED:
                return <NeedleRegisteredScreen needleCount={misplacedCount} variant="misplaced" hideButtons />;
            case SCRClosingCountState.S7_DONE:
                return <ClosingCountDoneScreen hideButtons />;
            case SCRClosingCountState.S7_WAIT_CIR_SCAN:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRScan" />;
            case SCRClosingCountState.SECTION_3:
                return (
                    <SCRClosingCountStep
                        prefixKey="section3.scrPlaceNeedles"
                        activeButton="yes"
                        onConfirm={async () => {
                            await appContext.caseService.parlayInterface.caseManager.misplaced_needle_placed();
                            await appContext.caseService.parlayInterface.caseManager.mock_needle_scan_event();
                            setState(SCRClosingCountState.S3_WAIT_FOR_CIR);
                        }}
                        textWrapperClassName={stepStyles.instructionTextWrapperWide}
                    />
                );
            case SCRClosingCountState.S3_WAIT_FOR_CIR:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReview" />;
            case SCRClosingCountState.S3_VALIDATE_PENDING:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section3ValidateMisplaced"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isClosingCountValidation.set("s3");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRClosingCountState.S3_WAIT_FOR_CIR_POST_VALIDATION:
                return <WaitForCIRClosingCount />;
            case SCRClosingCountState.S3_WAIT_FOR_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReadjudicationS3" />;
            case SCRClosingCountState.SECTION_4:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRCBI" />;
            case SCRClosingCountState.S4_VALIDATE_CBI:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section4ValidateCbi"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isClosingCountValidation.set("s4");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRClosingCountState.S4_WAIT_FOR_CIR_POST_VALIDATION:
                return <WaitForCIRClosingCount />;
            case SCRClosingCountState.S4_WAIT_FOR_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReAdjudication" />;
            // Section 5 — SCR places remaining needles into haystack
            case SCRClosingCountState.SECTION_5:
                return (
                    <SCRClosingCountStep
                        prefixKey="section5.scrPlaceNeedles"
                        activeButton="yes"
                        onConfirm={async () => {
                            await appContext.caseService.parlayInterface.caseManager.mock_needle_scan_event();
                            setState(SCRClosingCountState.S5_WAIT_FOR_CIR);
                        }}
                        textWrapperClassName={stepStyles.instructionTextWrapperWide}
                    />
                );
            case SCRClosingCountState.S5_WAIT_FOR_CIR:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReview" />;
            case SCRClosingCountState.S5_VALIDATE_PENDING:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section5ValidateRemaining"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isClosingCountValidation.set("s5");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRClosingCountState.S5_WAIT_FOR_CIR_POST_VALIDATION:
                return <WaitForCIRClosingCount />;
            case SCRClosingCountState.S5_WAIT_FOR_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReadjudicationS5" />;
            // Section 5 — Read-only mirrors of CIR exit screens
            case SCRClosingCountState.S5_CHECK_STERILE:
                return <NeedleSterileFieldScreen needleCount={extraCount} variant="remaining" hideButtons />;
            case SCRClosingCountState.S5_NEEDLE_REGISTERED:
                return (
                    <NeedleRegisteredScreen needleCount={scrNotFoundCountRef.current} variant="misplaced" hideButtons />
                );
            case SCRClosingCountState.S5_NEEDLE_FOUND:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRNeedleType" />;
            // Section 6 — CBI batch flow for remaining needle in non-sterile zone
            case SCRClosingCountState.SECTION_6:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRCBI" />;
            case SCRClosingCountState.S6_VALIDATE_CBI:
                return (
                    <SCRClosingCountStep
                        prefixKey="scrClosingCount.section4ValidateCbi"
                        activeButton="validate"
                        onConfirm={() => {
                            appContext.caseService.isClosingCountValidation.set("s6");
                            appContext.navigate({ path: "scrValidation" });
                        }}
                    />
                );
            case SCRClosingCountState.S6_WAIT_FOR_CIR_POST_VALIDATION:
                return <WaitForCIRClosingCount />;
            case SCRClosingCountState.S6_WAIT_FOR_CIR_READJ:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRReAdjudication" />;
            // Section 6 — Read-only mirrors of CIR exit screens
            case SCRClosingCountState.S6_CHECK_STERILE:
                return <NeedleSterileFieldScreen needleCount={extraCount} variant="remaining" hideButtons />;
            case SCRClosingCountState.S6_NEEDLE_REGISTERED:
                return (
                    <NeedleRegisteredScreen needleCount={scrNotFoundCountRef.current} variant="misplaced" hideButtons />
                );
            case SCRClosingCountState.S6_NEEDLE_FOUND:
                return <WaitForCIRClosingCount textKey="scrClosingCount.waitForCIRNeedleType" />;
        }
    }

    return (
        <div className={styles.screenContainer}>
            {showHeader && (
                <TrackingHeader
                    title={t("closeCount.title")}
                    stage={3}
                    stageColor="rgba(129, 167, 255, 1)"
                    showNames={true}
                    showHelp={false}
                />
            )}
            {renderContent()}
        </div>
    );
};
