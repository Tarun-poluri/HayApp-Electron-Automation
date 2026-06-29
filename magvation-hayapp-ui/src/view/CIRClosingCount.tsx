import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../viewcss/CIRClosingCount.module.css";
import { TrackingHeader } from "./subview/TrackingHeader";
import { useTranslation } from "react-i18next";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import { CloseCountConfirm } from "./subview/CloseCountConfirm";
import { CloseCountSteps } from "./subview/CloseCountSteps";
import { ResolvePendingItems } from "./subview/ResolvePendingItems";
import { ClosingCountVerification } from "./subview/ClosingCountVerification";
import CIRAdjudicationScreen from "./CIRAdjudicationScreen";
import { ConfirmCBINeedles } from "./subview/ConfirmCBINeedles";
import { ResolveCBIItems } from "./subview/ResolveCBIItems";
import { CIRCBIReadjudicationScreen } from "./subview/CIRCBIReadjudicationScreen";
import { WaitForSCRValidations } from "./subview/WaitForSCRValidations";
import { NeedleSterileFieldScreen } from "./subview/NeedleSterileFieldScreen";
import { NeedleXrayScreen } from "./subview/NeedleXrayScreen";
import { NeedleRegisteredScreen } from "./subview/NeedleRegisteredScreen";
import { ClosingCountDoneScreen } from "./subview/ClosingCountDoneScreen";
import { NeedleFoundScreen } from "./subview/NeedleFoundScreen";
import { CheckCBIBoxScreen } from "./subview/CheckCBIBoxScreen";
import { CBIBoxSelectionScreen } from "./subview/CBIBoxSelectionScreen";
import { NeedleTapScreen } from "./subview/NeedleTapScreen";
import { PlaceIntoCBIBoxScreen } from "./subview/PlaceIntoCBIBoxScreen";
import { CaptureNeedleImageScreen } from "./subview/CaptureNeedleImageScreen";
import { S4PhotoConfirmScreen } from "./subview/S4PhotoConfirmScreen";
import { Section3WaitForSCRScreen } from "./subview/Section3WaitForSCRScreen";
import { Section5WaitForSCRScreen } from "./subview/Section5WaitForSCRScreen";
import { BrokenQuestionScreen } from "./subview/BrokenQuestionScreen";

export enum ClosingCountState {
    CONFIRM,
    STEPS,
    RESOLVE_PENDING,
    VERIFICATION,
    ADJUDICATION,
    READJUDICATION,
    CONTAMINATED,
    CBI_RESOLVE,
    CBI_READJUDICATION,
    SCR_PENDING_WAIT, // Figma 3.15 (WaitForSCRValidations)
    // Post-validation states
    POST_VALIDATION_RESOLVE_READJ, // Figma 3.14 (ResolveCBIItems — prompt before re-adjudication)
    POST_VALIDATION_READJUDICATION,
    // Decision Node 9 (invisible routing waypoint — not a rendered screen):
    //   remaining==0? → any misplaced? → any extra registered?
    //   → Yes: compute total = misplaced − extra
    //     → total==0 → Section 8 (SECTION_8_DONE)
    //     → total!=0 + misplaced left → Section 7 (MISPLACED_CHECK_STERILE)
    //     → total!=0 + extra left → Section 10 (EXTRA_NEEDLES_CHECK_STERILE)
    //   → No extra registered + misplaced → Section 7 (MISPLACED_CHECK_STERILE)
    //   → remaining!=0 → Section 1 (S1_CHECK_CBI_BOX) or Section 2 (S2_CHECK_CBI_BOX)
    //   Note: remaining!=0 routes directly to S1/S2 entry states (no intermediate waypoints).
    DECISION_SCREEN_9,
    // Section 8 — Misplaced == Extra, balanced → closing count done
    SECTION_8_DONE,
    EXTRA_NEEDLES_CHECK_STERILE, // Figma 3.16 (NeedleSterileFieldScreen variant="extra")
    EXTRA_NEEDLES_XRAY,
    EXTRA_NEEDLES_REGISTERED,
    CLOSING_COUNT_DONE, // Figma 3.20 (ClosingCountDoneScreen)
    POST_CLOSING_COUNT, // Placeholder — CIR finished closing count done, next path not built yet (exits to dashboard)
    NEEDLE_FOUND_SELECTION, // Figma 3.17 (NeedleFoundScreen — extra variant)
    // Section 7 — Misplaced needles flow (mirrors extra needles)
    MISPLACED_CHECK_STERILE, // Figma 3.21 (NeedleSterileFieldScreen variant="misplaced")
    MISPLACED_XRAY, // Figma 3.33 (NeedleXrayScreen variant="misplaced")
    MISPLACED_REGISTERED, // Figma 3.34 (NeedleRegisteredScreen variant="misplaced")
    MISPLACED_DONE, // Figma 3.20 (reuses ClosingCountDoneScreen, same as CLOSING_COUNT_DONE)
    POST_SECTION_7, // Placeholder — CIR finished S7, next path not built yet (exits to dashboard)
    MISPLACED_NEEDLE_FOUND, // Figma 3.22 (NeedleFoundScreen — misplaced variant)
    // Section 1 — "Remaining below 0" flow (more needles confirmed than expected)
    S1_CHECK_CBI_BOX, // Figma 3.35
    S1_EXTRA_REGISTERED, // Figma 3.19 (reuses NeedleRegisteredScreen)
    S1_CBI_BOX_SELECTION, // Figma 3.42/3.43
    S1_NEEDLE_TAP, // Figma 3.44/3.45/3.101 (sequential per selected type)
    S1_WAIT_SCR_VALIDATIONS, // Figma 3.15 (reuses WaitForSCRValidations — same screen as SCR_PENDING_WAIT)
    S1_RESOLVE_READJ, // Figma 3.14 (reuses ResolveCBIItems — CBI re-adjudication prompt)
    S1_CBI_READJUDICATION, // Figma 3.10.1/3.10.2/3.10.3 (new CIRCBIReadjudicationScreen)
    // Section 2 — "Remaining above 0" flow (fewer needles confirmed than expected)
    S2_CHECK_CBI_BOX, // Figma 3.46 (reuses CheckCBIBoxScreen with variant="section2")
    S2_CHECK_STERILE_FIELD, // Figma 3.47 (reuses NeedleSterileFieldScreen with variant="remaining")
    S2_NEEDLE_REGISTERED, // Figma 3.48 (reuses NeedleRegisteredScreen variant="misplaced", same as 3.34)
    S2_NEEDLE_FOUND, // Figma 3.49 (reuses NeedleFoundScreen — remaining variant, same as 3.17/3.22)
    S2_CBI_BOX_SELECTION, // Figma 3.42/3.43 (reuses CBIBoxSelectionScreen, same as S1_CBI_BOX_SELECTION)
    S2_NEEDLE_TAP, // Figma 3.44/3.45/3.50/3.51 (sequential NeedleTapScreen per selected type)
    S2_WAIT_SCR_VALIDATIONS, // Figma 3.15 (reuses WaitForSCRValidations — same screen as SCR_PENDING_WAIT)
    S2_RESOLVE_READJ, // Figma 3.14 (reuses ResolveCBIItems)
    S2_READJUDICATION, // Figma 3.10 (reuses CIRAdjudicationScreen)
    // Section 3 — misplaced needle found in sterile zone (from S7 3.22)
    S3_WAIT_FOR_SCR, // CIR waits for SCR to place needles into HayStack
    S3_VERIFICATION, // Figma 3.53 — reuses ClosingCountVerification
    S3_ADJUDICATION, // Figma 3.9 — reuses CIRAdjudicationScreen (source="cirAdjudication")
    S3_SCR_PENDING_WAIT, // Figma 3.15 — WaitForSCRValidations (wait for SCR to validate misplaced needles)
    S3_RESOLVE_READJ, // Figma 3.14 — ResolveCBIItems (prompt before readjudication)
    S3_READJUDICATION, // CIRAdjudicationScreen (source="cirReAdjudication") — individual needle re-review
    // Section 4 — misplaced needle found in non-sterile zone (from S7 3.22)
    SECTION_4, // PlaceIntoCBIBoxScreen — C/B/I variant
    S4_BROKEN_QUESTION, // Broken variant only — "Do you have the other piece?" Yes/No modal
    S4_CAPTURE_PLACEHOLDER, // CaptureNeedleImageScreen — capture photo (dev bypass for now)
    S4_PHOTO_CONFIRM, // Two-panel photo confirmation (image + "Keep this image?")
    S4_NEEDLE_TAP, // NeedleTapScreen for variant
    S4_WAIT_SCR_VALIDATIONS, // WaitForSCRValidations
    S4_RESOLVE_READJ, // ResolveCBIItems
    S4_READJUDICATION, // CIRAdjudicationScreen (re-adj loop)
    // Section 5 — remaining needle found in sterile zone (from S2 3.49)
    SECTION_5, // Wait for SCR to place remaining needles into HayStack
    S5_VERIFICATION, // Individual needle verification (reuses ClosingCountVerification)
    S5_ADJUDICATION, // Individual needle adjudication (reuses CIRAdjudicationScreen)
    S5_SCR_PENDING_WAIT, // WaitForSCRValidations (wait for SCR to validate)
    S5_RESOLVE_READJ, // ResolveCBIItems (prompt before re-adjudication)
    S5_READJUDICATION, // CIRAdjudicationScreen (source="cirReAdjudication") — re-adj loop
    S5_CHECK_STERILE, // Figma 3.68 — NeedleSterileFieldScreen variant="misplaced" (remaining > 0 exit)
    S5_NEEDLE_REGISTERED, // Figma 3.48 — NeedleRegisteredScreen variant="misplaced" ("Not Found" on 3.68)
    S5_NEEDLE_FOUND, // Figma 3.49 — NeedleFoundScreen ("Found" on 3.68 → Section 5/6 loop)
    // Section 6 — remaining needle found in non-sterile zone (from S2 3.49, CBI batch flow)
    SECTION_6, // PlaceIntoCBIBoxScreen — C/B/I variant (remaining, not misplaced)
    S6_BROKEN_QUESTION, // Broken variant only — "Do you have the other piece?" Yes/No modal
    S6_CAPTURE_PLACEHOLDER, // CaptureNeedleImageScreen — capture photo
    S6_PHOTO_CONFIRM, // S4PhotoConfirmScreen (reuse) — two-panel image confirmation
    S6_NEEDLE_TAP, // NeedleTapScreen for CBI count
    S6_WAIT_SCR_VALIDATIONS, // WaitForSCRValidations
    S6_RESOLVE_READJ, // ResolveCBIItems
    S6_READJUDICATION, // CIRCBIReadjudicationScreen (re-adj loop)
    S6_CHECK_STERILE, // NeedleSterileFieldScreen variant="remaining" (remaining > 0 loop)
    S6_NEEDLE_REGISTERED, // NeedleRegisteredScreen variant="misplaced" ("Not Found")
    S6_NEEDLE_FOUND, // NeedleFoundScreen ("Found" → Section 5/6 loop)
}

export const CIRClosingCount: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [state, setState] = useState<ClosingCountState>(ClosingCountState.CONFIRM);
    const [cbiTitleKey, setCbiTitleKey] = useState("closeCount.contaminatedTitle");
    const misplacedHalves = useListenable(appContext.caseService.misplaced);
    const wholeMisplaced = useListenable(appContext.caseService.wholeMisplaced);
    const misplacedCount = misplacedHalves + wholeMisplaced;
    const startingCountVal = useListenable(appContext.caseService.startingCount);
    const addedNeedleCountVal = useListenable(appContext.caseService.addedNeedleCount);
    const confirmedVal = useListenable(appContext.caseService.confirmed);
    const contaminatedNeedleCount = useListenable(appContext.caseService.contaminatedNeedleCount);
    const brokenNeedleCount = useListenable(appContext.caseService.brokenNeedleCount);
    const incompatibleNeedleCount = useListenable(appContext.caseService.incompatibleNeedleCount);

    // Section 1: how many more needles were confirmed than expected
    const overCount = Math.abs(startingCountVal + addedNeedleCountVal - confirmedVal);

    // Section 1: CBI compartment types selected as mismatching on 3.43
    const s1SelectedCompartments = useRef<string[]>([]);
    // Section 1: index into s1SelectedCompartments for sequential tap screens
    const [s1TapIndex, setS1TapIndex] = useState(0);
    // Section 1: accumulated tap results — only sent to backend when all types are done.
    // Deferred so that going back to CBI selection doesn't leave stale data in the backend.
    const s1TapResults = useRef<
        Array<{ type: string; count: number; markers: Array<{ x: number; y: number; number: number; type: string }> }>
    >([]);

    // Section 2: same pattern as S1 — isolated refs so the two sections don't interfere.
    const s2SelectedCompartments = useRef<string[]>([]);
    const [s2TapIndex, setS2TapIndex] = useState(0);
    const s2TapResults = useRef<
        Array<{ type: string; count: number; markers: Array<{ x: number; y: number; number: number; type: string }> }>
    >([]);

    // Section 4: which C/B/I type was selected from NeedleFoundScreen
    const s4NeedleTypeRef = useRef<"contaminated" | "broken" | "incompatible">("contaminated");
    const s4BrokenHasFragment = useRef<boolean>(false);

    // Section 6: same pattern as S4 — isolated refs for remaining needle CBI batch flow
    const s6NeedleTypeRef = useRef<"contaminated" | "broken" | "incompatible">("contaminated");
    const s6BrokenHasFragment = useRef<boolean>(false);

    // Track whether S5/S6 was entered from Section 10 (extra needle context)
    // so the backend can decrement added_needle_count on confirmation.
    const fromSection10Ref = useRef(false);

    // Capture overCount at "Correct" press so S1_EXTRA_REGISTERED shows the
    // count just registered, not the running total after DASHBOARD_UPDATE.
    const s1RegisteredCountRef = useRef(0);

    // Capture remaining count at "Not Found" press so the registered screen
    // shows the correct value even after DASHBOARD_UPDATE changes overCount.
    const s2NotFoundCountRef = useRef(0);
    const s5NotFoundCountRef = useRef(0);
    const s6NotFoundCountRef = useRef(0);

    // Track which NeedleFoundScreen entered Section 6 so back navigates correctly
    const s6SourceStateRef = useRef<ClosingCountState>(ClosingCountState.S2_NEEDLE_FOUND);

    // Camera capture image source — set when a fresh camera result arrives.
    const [captureImageSrc, setCaptureImageSrc] = useState<string | null>(null);

    // Camera capture: open camera hardware and listen for SCANNER_CAMERA_RESULT (S4 + S6).
    // This event only fires on actual camera captures (real hardware or mock_camera_capture_event),
    // never on DASHBOARD_UPDATE — so no stale-echo filtering needed.
    useEffect(() => {
        if (state !== ClosingCountState.S4_CAPTURE_PLACEHOLDER && state !== ClosingCountState.S6_CAPTURE_PLACEHOLDER) {
            return;
        }
        appContext.caseService.parlayInterface.hayScanner.open_camera(50000);
        const unsub = appContext.caseService.parlayInterface.caseManager.cbi_scanned((result) => {
            if (!result?.image_filename) return;
            const src = `http://localhost:8080/hayscan_cbi_images/${result.image_filename}`;
            setCaptureImageSrc(src);
            setState((prev) => {
                if (prev === ClosingCountState.S4_CAPTURE_PLACEHOLDER) return ClosingCountState.S4_PHOTO_CONFIRM;
                if (prev === ClosingCountState.S6_CAPTURE_PLACEHOLDER) return ClosingCountState.S6_PHOTO_CONFIRM;
                return prev;
            });
        });
        return () => {
            if (unsub) unsub();
            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager, appContext.caseService.parlayInterface.hayScanner]);

    // Track current screen for backend state restoration
    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        const screenMap: Record<ClosingCountState, string> = {
            [ClosingCountState.CONFIRM]: "cirCloseCount",
            [ClosingCountState.STEPS]: "cirCloseCountSteps",
            [ClosingCountState.RESOLVE_PENDING]: "cirResolvePendingItems",
            [ClosingCountState.VERIFICATION]: "cirClosingCountVerification",
            [ClosingCountState.ADJUDICATION]: "cirClosingCountAdjudication",
            [ClosingCountState.READJUDICATION]: "cirClosingCountReadjudication",
            [ClosingCountState.CONTAMINATED]: "cirClosingCountContaminated",
            [ClosingCountState.CBI_RESOLVE]: "cirClosingCountCbiResolve",
            [ClosingCountState.CBI_READJUDICATION]: "cirClosingCountCbiReadjudication",
            [ClosingCountState.SCR_PENDING_WAIT]: "cirClosingCountScrPendingWait",
            [ClosingCountState.POST_VALIDATION_RESOLVE_READJ]: "cirClosingCountPostValResolveReadj",
            [ClosingCountState.POST_VALIDATION_READJUDICATION]: "cirClosingCountPostValReadjudication",
            [ClosingCountState.DECISION_SCREEN_9]: "cirClosingCountScreen9",
            [ClosingCountState.SECTION_8_DONE]: "cirClosingCountSection8Done",
            [ClosingCountState.EXTRA_NEEDLES_CHECK_STERILE]: "cirClosingCountScreen10ExtraNeedles",
            [ClosingCountState.EXTRA_NEEDLES_XRAY]: "cirClosingCountExtraNeedlesXray",
            [ClosingCountState.EXTRA_NEEDLES_REGISTERED]: "cirClosingCountExtraNeedlesRegistered",
            [ClosingCountState.CLOSING_COUNT_DONE]: "cirClosingCountDone",
            [ClosingCountState.POST_CLOSING_COUNT]: "cirClosingCountPostDone",
            [ClosingCountState.NEEDLE_FOUND_SELECTION]: "cirClosingCountNeedleFoundSelection",
            [ClosingCountState.MISPLACED_CHECK_STERILE]: "cirClosingCountScreen7MisplacedNeedles",
            [ClosingCountState.MISPLACED_XRAY]: "cirClosingCountScreen7MisplacedXray",
            [ClosingCountState.MISPLACED_REGISTERED]: "cirClosingCountScreen7MisplacedRegistered",
            [ClosingCountState.MISPLACED_DONE]: "cirClosingCountScreen7MisplacedDone",
            [ClosingCountState.POST_SECTION_7]: "cirClosingCountPostSection7",
            [ClosingCountState.MISPLACED_NEEDLE_FOUND]: "cirClosingCountScreen7MisplacedNeedleFound",
            [ClosingCountState.S1_CHECK_CBI_BOX]: "cirClosingCountS1CheckCbiBox",
            [ClosingCountState.S1_EXTRA_REGISTERED]: "cirClosingCountS1ExtraRegistered",
            [ClosingCountState.S1_CBI_BOX_SELECTION]: "cirClosingCountS1CbiBoxSelection",
            [ClosingCountState.S1_NEEDLE_TAP]: "cirClosingCountS1NeedleTap",
            [ClosingCountState.S1_WAIT_SCR_VALIDATIONS]: "cirClosingCountS1WaitScrValidations",
            [ClosingCountState.S1_RESOLVE_READJ]: "cirClosingCountS1ResolveReadj",
            [ClosingCountState.S1_CBI_READJUDICATION]: "cirClosingCountS1CbiReadjudication",
            [ClosingCountState.S2_CHECK_CBI_BOX]: "cirClosingCountS2CheckCbiBox",
            [ClosingCountState.S2_CHECK_STERILE_FIELD]: "cirClosingCountS2CheckSterileField",
            [ClosingCountState.S2_NEEDLE_REGISTERED]: "cirClosingCountS2NeedleRegistered",
            [ClosingCountState.S2_NEEDLE_FOUND]: "cirClosingCountS2NeedleFound",
            [ClosingCountState.S2_CBI_BOX_SELECTION]: "cirClosingCountS2CbiBoxSelection",
            [ClosingCountState.S2_NEEDLE_TAP]: "cirClosingCountS2NeedleTap",
            [ClosingCountState.S2_WAIT_SCR_VALIDATIONS]: "cirClosingCountS2WaitScrValidations",
            [ClosingCountState.S2_RESOLVE_READJ]: "cirClosingCountS2ResolveReadj",
            [ClosingCountState.S2_READJUDICATION]: "cirClosingCountS2Readjudication",
            [ClosingCountState.S3_WAIT_FOR_SCR]: "cirClosingCountS3WaitForScr",
            [ClosingCountState.S3_VERIFICATION]: "cirClosingCountS3Verification",
            [ClosingCountState.S3_ADJUDICATION]: "cirClosingCountS3Adjudication",
            [ClosingCountState.S3_SCR_PENDING_WAIT]: "cirClosingCountS3ScrPendingWait",
            [ClosingCountState.S3_RESOLVE_READJ]: "cirClosingCountS3ResolveReadj",
            [ClosingCountState.S3_READJUDICATION]: "cirClosingCountS3Readjudication",
            [ClosingCountState.SECTION_4]: "cirClosingCountSection4",
            [ClosingCountState.S4_BROKEN_QUESTION]: "cirClosingCountS4BrokenQuestion",
            [ClosingCountState.S4_CAPTURE_PLACEHOLDER]: "cirClosingCountS4CapturePlaceholder",
            [ClosingCountState.S4_PHOTO_CONFIRM]: "cirClosingCountS4PhotoConfirm",
            [ClosingCountState.S4_NEEDLE_TAP]: "cirClosingCountS4NeedleTap",
            [ClosingCountState.S4_WAIT_SCR_VALIDATIONS]: "cirClosingCountS4WaitScrValidations",
            [ClosingCountState.S4_RESOLVE_READJ]: "cirClosingCountS4ResolveReadj",
            [ClosingCountState.S4_READJUDICATION]: "cirClosingCountS4Readjudication",
            [ClosingCountState.SECTION_5]: "cirClosingCountS5WaitForScr",
            [ClosingCountState.S5_VERIFICATION]: "cirClosingCountS5Verification",
            [ClosingCountState.S5_ADJUDICATION]: "cirClosingCountS5Adjudication",
            [ClosingCountState.S5_SCR_PENDING_WAIT]: "cirClosingCountS5ScrPendingWait",
            [ClosingCountState.S5_RESOLVE_READJ]: "cirClosingCountS5ResolveReadj",
            [ClosingCountState.S5_READJUDICATION]: "cirClosingCountS5Readjudication",
            [ClosingCountState.S5_CHECK_STERILE]: "cirClosingCountS5CheckSterile",
            [ClosingCountState.S5_NEEDLE_REGISTERED]: "cirClosingCountS5NeedleRegistered",
            [ClosingCountState.S5_NEEDLE_FOUND]: "cirClosingCountS5NeedleFound",
            [ClosingCountState.SECTION_6]: "cirClosingCountSection6",
            [ClosingCountState.S6_BROKEN_QUESTION]: "cirClosingCountS6BrokenQuestion",
            [ClosingCountState.S6_CAPTURE_PLACEHOLDER]: "cirClosingCountS6CapturePlaceholder",
            [ClosingCountState.S6_PHOTO_CONFIRM]: "cirClosingCountS6PhotoConfirm",
            [ClosingCountState.S6_NEEDLE_TAP]: "cirClosingCountS6NeedleTap",
            [ClosingCountState.S6_WAIT_SCR_VALIDATIONS]: "cirClosingCountS6WaitScrValidations",
            [ClosingCountState.S6_RESOLVE_READJ]: "cirClosingCountS6ResolveReadj",
            [ClosingCountState.S6_READJUDICATION]: "cirClosingCountS6Readjudication",
            [ClosingCountState.S6_CHECK_STERILE]: "cirClosingCountS6CheckSterile",
            [ClosingCountState.S6_NEEDLE_REGISTERED]: "cirClosingCountS6NeedleRegistered",
            [ClosingCountState.S6_NEEDLE_FOUND]: "cirClosingCountS6NeedleFound",
        };
        appContext.caseService.parlayInterface.caseManager.set_current_cir_screen(screenMap[state]);
    }, [state, appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    // Section 3 — tracks entry source for CLOSING_COUNT_DONE back button
    const closingCountSource = useRef<string>("");

    // Decision Node 9 — "Are there misplaced needles?" / "Are there extra suture needles?"
    // Pure routing logic. Called when remaining is resolved (== 0) or when
    // exiting Section 1 via the "wrappers match" path.
    const resolveDecisionNode9 = useCallback(() => {
        const misplaced = appContext.caseService.misplaced.value + appContext.caseService.wholeMisplaced.value;
        const extra = appContext.caseService.addedNeedleCount.value;

        if (misplaced > 0) {
            const totalCount = misplaced - extra;

            if (totalCount === 0) {
                // Section 8 — misplaced equals extra, balanced → done
                setState(ClosingCountState.SECTION_8_DONE);
            } else if (totalCount < 0) {
                // Extra suture needles left → Section 10
                setState(ClosingCountState.EXTRA_NEEDLES_CHECK_STERILE);
            } else {
                // Misplaced suture needles left → Section 7
                setState(ClosingCountState.MISPLACED_CHECK_STERILE);
            }
            return;
        }

        if (extra > 0) {
            setState(ClosingCountState.EXTRA_NEEDLES_CHECK_STERILE);
        } else {
            setState(ClosingCountState.CLOSING_COUNT_DONE);
        }
    }, [appContext.caseService]);

    // Section 3 exit — "Are there still misplaced needles?"
    const resolveS3Exit = useCallback(() => {
        const misplaced = appContext.caseService.misplaced.value + appContext.caseService.wholeMisplaced.value;

        if (misplaced > 0) {
            setState(ClosingCountState.MISPLACED_CHECK_STERILE);
        } else {
            closingCountSource.current = "s3";
            setState(ClosingCountState.CLOSING_COUNT_DONE);
        }
    }, [appContext.caseService]);

    // Section 3 — after SCR validates misplaced needles, check re-adj then exit
    const resolveS3PostValidation = useCallback(() => {
        const hasReAdj = appContext.caseService.cirReAdjudication.value.length > 0;

        if (hasReAdj) {
            setState(ClosingCountState.S3_RESOLVE_READJ);
            return;
        }
        resolveS3Exit();
    }, [appContext.caseService, resolveS3Exit]);

    // Section 3 — waterfall after SCR confirms needle placement
    const resolveS3PostPlacement = useCallback(() => {
        if (appContext.caseService.cirVerification.value.length > 0) setState(ClosingCountState.S3_VERIFICATION);
        else if (appContext.caseService.cirAdjudication.value.length > 0) setState(ClosingCountState.S3_ADJUDICATION);
        else resolveS3Exit();
    }, [appContext.caseService, resolveS3Exit]);

    const resolveS3PostVerification = useCallback(() => {
        if (appContext.caseService.cirAdjudication.value.length > 0) setState(ClosingCountState.S3_ADJUDICATION);
        else resolveS3Exit();
    }, [appContext.caseService, resolveS3Exit]);

    // Section 4 exit — "Are there still misplaced needles?"
    const resolveS4Exit = useCallback(() => {
        const misplaced = appContext.caseService.misplaced.value + appContext.caseService.wholeMisplaced.value;

        if (misplaced > 0) {
            setState(ClosingCountState.MISPLACED_CHECK_STERILE);
        } else {
            closingCountSource.current = "s4";
            setState(ClosingCountState.CLOSING_COUNT_DONE);
        }
    }, [appContext.caseService]);

    // Section 4 — after SCR validates CBI count, check re-adj then exit
    const resolveS4PostValidation = useCallback(() => {
        const hasReAdj = appContext.caseService.cirReAdjudication.value.length > 0;

        if (hasReAdj) {
            setState(ClosingCountState.S4_RESOLVE_READJ);
            return;
        }
        resolveS4Exit();
    }, [appContext.caseService, resolveS4Exit]);

    const resolveNext = useCallback(() => {
        const hasVerification = appContext.caseService.cirVerification.value.length > 0;
        const hasAdjudication = appContext.caseService.cirAdjudication.value.length > 0;
        const hasReAdjudication = appContext.caseService.cirReAdjudication.value.length > 0;

        if (hasVerification) setState(ClosingCountState.VERIFICATION);
        else if (hasAdjudication) setState(ClosingCountState.ADJUDICATION);
        else if (hasReAdjudication) setState(ClosingCountState.READJUDICATION);
        else setState(ClosingCountState.CONTAMINATED);
    }, [appContext.caseService]);

    // Section 5 exit — decision node: "Are there still remaining needles?"
    const resolveS5Exit = useCallback(() => {
        const startingCount = appContext.caseService.startingCount.value;
        const addedNeedles = appContext.caseService.addedNeedleCount.value;
        const confirmed = appContext.caseService.confirmed.value;
        const remaining = startingCount + addedNeedles - confirmed;

        if (remaining > 0) {
            setState(ClosingCountState.S5_CHECK_STERILE);
        } else {
            resolveDecisionNode9();
        }
    }, [appContext.caseService, resolveDecisionNode9]);

    // Section 5 — after SCR validates, check re-adj then exit
    const resolveS5PostValidation = useCallback(() => {
        const hasReAdj = appContext.caseService.cirReAdjudication.value.length > 0;

        if (hasReAdj) {
            setState(ClosingCountState.S5_RESOLVE_READJ);
            return;
        }
        resolveS5Exit();
    }, [appContext.caseService, resolveS5Exit]);

    // Section 5 — waterfall after SCR confirms needle placement
    const resolveS5PostPlacement = useCallback(() => {
        if (appContext.caseService.cirVerification.value.length > 0) setState(ClosingCountState.S5_VERIFICATION);
        else if (appContext.caseService.cirAdjudication.value.length > 0) setState(ClosingCountState.S5_ADJUDICATION);
        else resolveS5Exit();
    }, [appContext.caseService, resolveS5Exit]);

    const resolveS5PostVerification = useCallback(() => {
        if (appContext.caseService.cirAdjudication.value.length > 0) setState(ClosingCountState.S5_ADJUDICATION);
        else resolveS5Exit();
    }, [appContext.caseService, resolveS5Exit]);

    // Section 6 exit — same decision as S5: "Are there still remaining needles?"
    const resolveS6Exit = useCallback(() => {
        const startingCount = appContext.caseService.startingCount.value;
        const addedNeedles = appContext.caseService.addedNeedleCount.value;
        const confirmed = appContext.caseService.confirmed.value;
        const remaining = startingCount + addedNeedles - confirmed;

        if (remaining > 0) {
            setState(ClosingCountState.S6_CHECK_STERILE);
        } else {
            resolveDecisionNode9();
        }
    }, [appContext.caseService, resolveDecisionNode9]);

    // Section 6 — after SCR validates CBI count, check re-adj then exit
    const resolveS6PostValidation = useCallback(() => {
        const hasReAdj = appContext.caseService.cirReAdjudication.value.length > 0;

        if (hasReAdj) {
            setState(ClosingCountState.S6_RESOLVE_READJ);
            return;
        }
        resolveS6Exit();
    }, [appContext.caseService, resolveS6Exit]);

    const resolvePostValidation = useCallback(() => {
        // Re-adjudication loop: if SCR rejected items during closing count,
        // CIR re-adjudicates then waits for SCR again.
        // Only check cirReAdjudication — cirAdjudication is Stage 2 and would
        // have been resolved before entering Closing Count (Stage 3).
        const hasReAdj = appContext.caseService.cirReAdjudication.value.length > 0;
        if (hasReAdj) {
            setState(ClosingCountState.POST_VALIDATION_RESOLVE_READJ);
            return;
        }

        // Decision tree: evaluate remaining needle count
        const startingCount = appContext.caseService.startingCount.value;
        const addedNeedles = appContext.caseService.addedNeedleCount.value;
        const confirmed = appContext.caseService.confirmed.value;
        const remaining = startingCount + addedNeedles - confirmed;

        if (remaining !== 0) {
            // remaining < 0 → Section 1 (S1_CHECK_CBI_BOX): More needles confirmed than
            //   expected (extra needles showed up). CIR walks the nurse through checking the
            //   CBI box, wrappers, and scanning/adding any unregistered packs to reconcile.
            // remaining > 0 → Section 2 (S2_CHECK_CBI_BOX): Fewer needles confirmed than
            //   expected (needles are missing / unaccounted for). CIR checks the CBI box,
            //   then the sterile field for the remaining needles.
            setState(remaining < 0 ? ClosingCountState.S1_CHECK_CBI_BOX : ClosingCountState.S2_CHECK_CBI_BOX);
            return;
        }

        // Remaining == 0 → Decision Node 9
        resolveDecisionNode9();
    }, [appContext.caseService, resolveDecisionNode9]);

    // Section 1 exit gate: check CBI re-adj first, then remaining.
    const resolveSection1Exit = useCallback(() => {
        // Check for pending CBI re-adjudication items (SCR rejected CBI counts)
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        if (hasCbiReAdj) {
            setState(ClosingCountState.S1_RESOLVE_READJ);
            return;
        }

        const startingCount = appContext.caseService.startingCount.value;
        const addedNeedles = appContext.caseService.addedNeedleCount.value;
        const confirmed = appContext.caseService.confirmed.value;
        const remaining = startingCount + addedNeedles - confirmed;

        if (remaining === 0) {
            resolveDecisionNode9();
        } else {
            // Loop back to CBI box check (3.35)
            setState(ClosingCountState.S1_CHECK_CBI_BOX);
        }
    }, [appContext.caseService, resolveDecisionNode9]);

    // Section 1 rejection exit gate: after SCR denies a pack (CIR 3.41 Yes button).
    // Section 2 exit gate: decision diamond logic after SCR validates Section 2 changes.
    // 1. "Are there any new items in Pending CBI Re-Adjudication?" → Yes: 3.14 → 3.10 → loop
    // 2. "Is the remaining needles number equal to 0?" → Yes: Decision Node 9, No: 3.47 (loop)
    const resolveSection2Exit = useCallback(() => {
        // Decision 1: Check for pending CBI re-adjudication items (SCR rejected CBI counts).
        const hasPendingReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        if (hasPendingReAdj) {
            setState(ClosingCountState.S2_RESOLVE_READJ);
            return;
        }

        // Decision 2: Check if remaining has resolved to 0
        const startingCount = appContext.caseService.startingCount.value;
        const addedNeedles = appContext.caseService.addedNeedleCount.value;
        const confirmed = appContext.caseService.confirmed.value;
        const remaining = startingCount + addedNeedles - confirmed;

        if (remaining === 0) {
            // Resolved — feed into Decision Node 9 logic
            resolvePostValidation();
        } else {
            // Still unresolved — loop back to 3.47 (sterile field check)
            setState(ClosingCountState.S2_CHECK_STERILE_FIELD);
        }
    }, [appContext.caseService, resolvePostValidation]);

    // Reset all verification/adjudication decisions and go back to VERIFICATION.
    // Called from any back button after verification has been submitted.
    const resetVerificationAndGoBack = useCallback(async () => {
        await appContext.caseService.parlayInterface.caseManager.reset_closing_count_verification();
        setState(ClosingCountState.VERIFICATION);
    }, [appContext.caseService.parlayInterface.caseManager]);

    // Per-state header config. Returns props for TrackingHeader, or null for states
    // that manage their own header (BasicHeader, adjudication screens, wait screens, etc.).
    const headerProps = (() => {
        const backToDashboard = () => appContext.navigate({ path: "cirDashboard" });
        switch (state) {
            // Standard header: back → previous screen in flow
            case ClosingCountState.CONFIRM:
                return { onBack: backToDashboard, showHelp: true };
            case ClosingCountState.RESOLVE_PENDING:
                return { onBack: () => setState(ClosingCountState.STEPS), showHelp: true };
            case ClosingCountState.CONTAMINATED:
                return {
                    onBack: async () => {
                        await appContext.caseService.parlayInterface.caseManager.reset_cbi_confirmations();
                        await appContext.caseService.parlayInterface.caseManager.reset_closing_count_verification();
                        setState(ClosingCountState.VERIFICATION);
                    },
                    showHelp: true,
                    title: cbiTitleKey,
                };
            case ClosingCountState.CBI_RESOLVE:
                return {
                    onBack: async () => {
                        await appContext.caseService.parlayInterface.caseManager.reset_cbi_confirmations();
                        setState(ClosingCountState.CONTAMINATED);
                    },
                    showHelp: true,
                };
            case ClosingCountState.EXTRA_NEEDLES_CHECK_STERILE:
            case ClosingCountState.MISPLACED_CHECK_STERILE:
                return { showHelp: true };
            case ClosingCountState.S2_CHECK_STERILE_FIELD:
                return { onBack: () => setState(ClosingCountState.S2_CHECK_CBI_BOX), showHelp: true };
            // Section 8
            case ClosingCountState.SECTION_8_DONE:
                return { onBack: () => setState(ClosingCountState.SCR_PENDING_WAIT), showHelp: true };
            // Section 10 (extra needles)
            case ClosingCountState.EXTRA_NEEDLES_XRAY:
                return { onBack: () => setState(ClosingCountState.EXTRA_NEEDLES_CHECK_STERILE), showHelp: true };
            case ClosingCountState.EXTRA_NEEDLES_REGISTERED:
                return { onBack: () => setState(ClosingCountState.EXTRA_NEEDLES_XRAY), showHelp: true };
            case ClosingCountState.CLOSING_COUNT_DONE:
                if (closingCountSource.current === "s3") return { showHelp: true };
                return { onBack: () => setState(ClosingCountState.EXTRA_NEEDLES_REGISTERED), showHelp: true };
            case ClosingCountState.NEEDLE_FOUND_SELECTION:
                return { onBack: () => setState(ClosingCountState.EXTRA_NEEDLES_CHECK_STERILE), showHelp: true };
            // Section 7 (misplaced needles)
            case ClosingCountState.MISPLACED_XRAY:
                return { onBack: () => setState(ClosingCountState.MISPLACED_CHECK_STERILE), showHelp: true };
            case ClosingCountState.MISPLACED_REGISTERED:
                return { onBack: () => setState(ClosingCountState.MISPLACED_XRAY), showHelp: true };
            case ClosingCountState.MISPLACED_DONE:
                return { onBack: () => setState(ClosingCountState.MISPLACED_REGISTERED), showHelp: true };
            case ClosingCountState.MISPLACED_NEEDLE_FOUND:
                return { onBack: () => setState(ClosingCountState.MISPLACED_CHECK_STERILE), showHelp: true };
            // Section 1
            case ClosingCountState.S1_CHECK_CBI_BOX:
                return { showHelp: true };
            case ClosingCountState.S1_EXTRA_REGISTERED:
                return { onBack: () => setState(ClosingCountState.S1_CHECK_CBI_BOX), showHelp: true };
            case ClosingCountState.S1_CBI_BOX_SELECTION:
                return { onBack: () => setState(ClosingCountState.S1_CHECK_CBI_BOX), showHelp: true };
            // Section 2
            case ClosingCountState.S2_CHECK_CBI_BOX:
                return { showHelp: true };
            case ClosingCountState.S2_NEEDLE_REGISTERED:
                return {
                    onBack: async () => {
                        await appContext.caseService.parlayInterface.caseManager.decrement_misplaced_needles(
                            s2NotFoundCountRef.current,
                        );
                        setState(ClosingCountState.S2_CHECK_STERILE_FIELD);
                    },
                    showHelp: true,
                };
            case ClosingCountState.S2_NEEDLE_FOUND:
                return { onBack: () => setState(ClosingCountState.S2_CHECK_STERILE_FIELD), showHelp: true };
            case ClosingCountState.S2_CBI_BOX_SELECTION:
                return { onBack: () => setState(ClosingCountState.S2_CHECK_CBI_BOX), showHelp: true };
            // Section 5 exit flow (3.68/3.48/3.49)
            case ClosingCountState.S5_CHECK_STERILE:
                return { showHelp: true };
            case ClosingCountState.S5_NEEDLE_REGISTERED:
                return {
                    onBack: async () => {
                        await appContext.caseService.parlayInterface.caseManager.decrement_misplaced_needles(
                            s5NotFoundCountRef.current,
                        );
                        setState(ClosingCountState.S5_CHECK_STERILE);
                    },
                    showHelp: true,
                };
            case ClosingCountState.S5_NEEDLE_FOUND:
                return { onBack: () => setState(ClosingCountState.S5_CHECK_STERILE), showHelp: true };
            // Section 4 (from S7 NeedleFoundScreen — broken variant)
            case ClosingCountState.S4_BROKEN_QUESTION:
                return {
                    title: t("closeCount.brokenTitle"),
                    onBack: () => setState(ClosingCountState.MISPLACED_NEEDLE_FOUND),
                    showHelp: true,
                };
            // Section 6 (from S2/S5 NeedleFoundScreen — CBI batch flow for remaining needles)
            case ClosingCountState.S6_BROKEN_QUESTION:
                return {
                    title: t("closeCount.brokenTitle"),
                    onBack: () => setState(s6SourceStateRef.current),
                    showHelp: true,
                };
            // Section 6 exit flow (loop back)
            case ClosingCountState.S6_CHECK_STERILE:
                return { showHelp: true };
            case ClosingCountState.S6_NEEDLE_REGISTERED:
                return {
                    onBack: async () => {
                        await appContext.caseService.parlayInterface.caseManager.decrement_misplaced_needles(
                            s6NotFoundCountRef.current,
                        );
                        setState(ClosingCountState.S6_CHECK_STERILE);
                    },
                    showHelp: true,
                };
            case ClosingCountState.S6_NEEDLE_FOUND:
                return { onBack: () => setState(ClosingCountState.S6_CHECK_STERILE), showHelp: true };
            // All other states: no parent header
            // (own header: STEPS, VERIFICATION, ADJUDICATION, READJUDICATION, CBI_READJUDICATION,
            //  POST_VALIDATION_RESOLVE_READJ, POST_VALIDATION_READJUDICATION, S2_READJUDICATION, S2_RESOLVE_READJ,
            //  S1_RESOLVE_READJ, S1_CBI_READJUDICATION, S4_RESOLVE_READJ, S4_READJUDICATION,
            //  S6_RESOLVE_READJ, S6_READJUDICATION)
            // (BasicHeader: S1_NEEDLE_TAP,
            //  S2_NEEDLE_TAP, SECTION_4, S4_CAPTURE_PLACEHOLDER, S4_PHOTO_CONFIRM, S4_NEEDLE_TAP,
            //  SECTION_6, S6_CAPTURE_PLACEHOLDER, S6_PHOTO_CONFIRM, S6_NEEDLE_TAP)
            // (No header: SCR_PENDING_WAIT, S1_WAIT_SCR_VALIDATIONS, S2_WAIT_SCR_VALIDATIONS,
            //  S4_WAIT_SCR_VALIDATIONS, S6_WAIT_SCR_VALIDATIONS, DECISION_SCREEN_9, POST_SECTION_7, POST_CLOSING_COUNT)
            default:
                return null;
        }
    })();

    // Placeholder navigation: POST_SECTION_7 and POST_CLOSING_COUNT are
    // intermediate broadcast states that exit to dashboard after broadcasting.
    useEffect(() => {
        if (state === ClosingCountState.POST_SECTION_7 || state === ClosingCountState.POST_CLOSING_COUNT) {
            appContext.navigate({ path: "cirDashboard" });
        }
    }, [state, appContext]);

    function renderContent() {
        switch (state) {
            case ClosingCountState.CONFIRM:
                return (
                    <CloseCountConfirm
                        onNo={() => appContext.navigate({ path: "cirDashboard" })}
                        onYes={() => setState(ClosingCountState.STEPS)}
                    />
                );
            case ClosingCountState.STEPS:
                return <CloseCountSteps onComplete={() => setState(ClosingCountState.RESOLVE_PENDING)} />;
            case ClosingCountState.RESOLVE_PENDING:
                return <ResolvePendingItems onResolve={resolveNext} />;
            case ClosingCountState.VERIFICATION:
                return (
                    <ClosingCountVerification
                        onBack={() => setState(ClosingCountState.RESOLVE_PENDING)}
                        onConfirm={resolveNext}
                    />
                );
            case ClosingCountState.ADJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirAdjudication"
                        onComplete={resolveNext}
                        onBack={resetVerificationAndGoBack}
                    />
                );
            case ClosingCountState.READJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirReAdjudication"
                        onComplete={resolveNext}
                        onBack={resetVerificationAndGoBack}
                    />
                );
            case ClosingCountState.CONTAMINATED:
                return (
                    <ConfirmCBINeedles
                        onComplete={(hasDeniedItems) => {
                            if (hasDeniedItems) {
                                setState(ClosingCountState.CBI_RESOLVE);
                            } else {
                                setState(ClosingCountState.SCR_PENDING_WAIT);
                            }
                        }}
                        onTypeChange={setCbiTitleKey}
                    />
                );
            case ClosingCountState.CBI_RESOLVE:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.CBI_READJUDICATION)} />;
            case ClosingCountState.CBI_READJUDICATION: {
                const cbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                return (
                    <CIRCBIReadjudicationScreen
                        items={cbiReAdjItems}
                        onComplete={() => setState(ClosingCountState.SCR_PENDING_WAIT)}
                        onBack={() => setState(ClosingCountState.CBI_RESOLVE)}
                    />
                );
            }
            case ClosingCountState.SCR_PENDING_WAIT:
                return <WaitForSCRValidations onComplete={resolvePostValidation} />;
            case ClosingCountState.POST_VALIDATION_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.POST_VALIDATION_READJUDICATION)} />;
            case ClosingCountState.POST_VALIDATION_READJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirReAdjudication"
                        onComplete={() => setState(ClosingCountState.SCR_PENDING_WAIT)}
                        onBack={() => setState(ClosingCountState.POST_VALIDATION_RESOLVE_READJ)}
                    />
                );
            // Decision Node 9 — "Are there misplaced needles?" branching point.
            // NOT a visible screen — purely a routing waypoint in the state machine.
            // Reached when remaining == 0 but misplaced > 0.
            // Will evaluate misplaced needle data and route to Screens 7/8/10.
            case ClosingCountState.DECISION_SCREEN_9:
                return null;
            case ClosingCountState.SECTION_8_DONE:
                return <ClosingCountDoneScreen onOk={() => appContext.navigate({ path: "cirDashboard" })} />;
            case ClosingCountState.EXTRA_NEEDLES_CHECK_STERILE:
                return (
                    <NeedleSterileFieldScreen
                        needleCount={addedNeedleCountVal}
                        onNeedleFound={() => setState(ClosingCountState.NEEDLE_FOUND_SELECTION)}
                        onNeedleNotFound={() => setState(ClosingCountState.EXTRA_NEEDLES_XRAY)}
                    />
                );
            case ClosingCountState.EXTRA_NEEDLES_XRAY:
                return (
                    <NeedleXrayScreen
                        needleCount={addedNeedleCountVal}
                        onNeedleFound={() => setState(ClosingCountState.NEEDLE_FOUND_SELECTION)}
                        onNeedleNotFound={() => setState(ClosingCountState.EXTRA_NEEDLES_REGISTERED)}
                    />
                );
            case ClosingCountState.EXTRA_NEEDLES_REGISTERED:
                return (
                    <NeedleRegisteredScreen
                        needleCount={addedNeedleCountVal}
                        onOk={() => setState(ClosingCountState.CLOSING_COUNT_DONE)}
                    />
                );
            case ClosingCountState.CLOSING_COUNT_DONE:
                return <ClosingCountDoneScreen onOk={() => setState(ClosingCountState.POST_CLOSING_COUNT)} />;
            case ClosingCountState.NEEDLE_FOUND_SELECTION:
                return (
                    <NeedleFoundScreen
                        onSelectType={async (type) => {
                            fromSection10Ref.current = true;
                            if (type === "sterile") {
                                // added_needle_count serves double duty: it tracks how many extra
                                // packs were opened (set during the procedure) AND counts down how
                                // many extra needles remain to account for (during closing count).
                                // Decrementing here mirrors misplaced_needle_placed in S3 — once
                                // the nurse places this needle, it's accounted for. When the count
                                // hits 0, DN9 exits the Section 10 loop.
                                await appContext.caseService.parlayInterface.caseManager.decrement_added_needle_count();
                                setState(ClosingCountState.SECTION_5);
                            } else {
                                // S6 CBI path: added_needle_count decremented by backend in
                                // cbi_needles_confirmed when extra=true (same countdown logic)
                                s6SourceStateRef.current = ClosingCountState.NEEDLE_FOUND_SELECTION;
                                s6NeedleTypeRef.current = type as "contaminated" | "broken" | "incompatible";
                                if (type === "broken") {
                                    setState(ClosingCountState.S6_BROKEN_QUESTION);
                                } else {
                                    setState(ClosingCountState.SECTION_6);
                                }
                            }
                        }}
                    />
                );
            case ClosingCountState.MISPLACED_CHECK_STERILE:
                return (
                    <NeedleSterileFieldScreen
                        needleCount={misplacedCount}
                        variant="misplaced"
                        onNeedleFound={() => setState(ClosingCountState.MISPLACED_NEEDLE_FOUND)}
                        onNeedleNotFound={() => setState(ClosingCountState.MISPLACED_XRAY)}
                    />
                );
            case ClosingCountState.MISPLACED_XRAY:
                return (
                    <NeedleXrayScreen
                        needleCount={misplacedCount}
                        variant="misplaced"
                        onNeedleFound={() => setState(ClosingCountState.MISPLACED_NEEDLE_FOUND)}
                        onNeedleNotFound={() => setState(ClosingCountState.MISPLACED_REGISTERED)}
                    />
                );
            case ClosingCountState.MISPLACED_REGISTERED:
                return (
                    <NeedleRegisteredScreen
                        needleCount={misplacedCount}
                        variant="misplaced"
                        onOk={() => setState(ClosingCountState.MISPLACED_DONE)}
                    />
                );
            case ClosingCountState.MISPLACED_DONE:
                return <ClosingCountDoneScreen onOk={() => setState(ClosingCountState.POST_SECTION_7)} />;
            case ClosingCountState.MISPLACED_NEEDLE_FOUND:
                return (
                    <NeedleFoundScreen
                        onSelectType={(type) => {
                            if (type === "sterile") {
                                setState(ClosingCountState.S3_WAIT_FOR_SCR);
                            } else {
                                // "contaminated", "broken", or "incompatible" → Section 4
                                s4NeedleTypeRef.current = type as "contaminated" | "broken" | "incompatible";
                                if (type === "broken") {
                                    setState(ClosingCountState.S4_BROKEN_QUESTION);
                                } else {
                                    setState(ClosingCountState.SECTION_4);
                                }
                            }
                        }}
                    />
                );
            // Section 1 — "Remaining below 0": more needles confirmed than expected.
            // The nurse checks the CBI box count, verifies wrappers match added packs,
            // and either registers the extras or scans/adds missing packs to reconcile.
            case ClosingCountState.S1_CHECK_CBI_BOX:
                return (
                    <CheckCBIBoxScreen
                        overCount={overCount}
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        onCorrect={async () => {
                            // overCount = |startingCount + addedNeedleCount - confirmed|
                            // Already accounts for pre-existing addedNeedleCount in its formula,
                            // so increment by the full overCount to bring remaining to 0.
                            s1RegisteredCountRef.current = overCount;
                            if (overCount > 0) {
                                await appContext.caseService.parlayInterface.caseManager.increment_added_needle_count(
                                    overCount,
                                );
                            }
                            setState(ClosingCountState.S1_EXTRA_REGISTERED);
                        }}
                        onMismatch={() => setState(ClosingCountState.S1_CBI_BOX_SELECTION)}
                    />
                );
            // Section 1 "extra registered" — shows the count just registered
            // (captured before DASHBOARD_UPDATE), not the running total.
            case ClosingCountState.S1_EXTRA_REGISTERED:
                return (
                    <NeedleRegisteredScreen
                        needleCount={s1RegisteredCountRef.current}
                        variant="extra"
                        onOk={resolveDecisionNode9}
                    />
                );
            case ClosingCountState.S1_CBI_BOX_SELECTION:
                return (
                    <CBIBoxSelectionScreen
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        onConfirm={(selectedTypes) => {
                            if (selectedTypes.length === 0) {
                                // All compartments confirmed correct — no discrepancy to tap
                                setState(ClosingCountState.S1_CHECK_CBI_BOX);
                                return;
                            }
                            s1SelectedCompartments.current = selectedTypes;
                            s1TapResults.current = [];
                            setS1TapIndex(0);
                            setState(ClosingCountState.S1_NEEDLE_TAP);
                        }}
                    />
                );
            case ClosingCountState.S1_NEEDLE_TAP: {
                const types = s1SelectedCompartments.current;
                const currentType = types[s1TapIndex] as "broken" | "contaminated" | "incompatible";
                return (
                    <NeedleTapScreen
                        key={`s1-${currentType}`}
                        variant={currentType}
                        onConfirm={async (count, markers) => {
                            // Accumulate locally — only sent to backend when all types are done
                            s1TapResults.current[s1TapIndex] = {
                                type: currentType,
                                count,
                                markers: markers.map((m) => ({ x: m.x, y: m.y, number: m.number, type: currentType })),
                            };
                            if (s1TapIndex + 1 < types.length) {
                                setS1TapIndex(s1TapIndex + 1);
                            } else {
                                // All types done — batch-send to backend
                                const cbiImageResult = appContext.caseService.cbiImage.value;
                                const filename = cbiImageResult?.image_filename || "placeholder.png";
                                const naturalW = cbiImageResult?.imageNaturalWidth ?? 900;
                                const naturalH = cbiImageResult?.imageNaturalHeight ?? 875;
                                for (const result of s1TapResults.current) {
                                    // Convert percentage markers → natural pixel coords for SCR validation
                                    const pixelMarkers = result.markers.map((m) => ({
                                        ...m,
                                        x: (m.x / 100) * naturalW,
                                        y: (m.y / 100) * naturalH,
                                    }));
                                    await appContext.caseService.parlayInterface.caseManager.cbi_needles_counted(
                                        result.type,
                                        result.count,
                                        filename,
                                        0,
                                        "",
                                        false,
                                        false,
                                        pixelMarkers,
                                        naturalW,
                                        naturalH,
                                        true,
                                    );
                                }
                                setState(ClosingCountState.S1_WAIT_SCR_VALIDATIONS);
                            }
                        }}
                        onBack={() => {
                            if (s1TapIndex > 0) {
                                setS1TapIndex(s1TapIndex - 1);
                            } else {
                                setState(ClosingCountState.S1_CBI_BOX_SELECTION);
                            }
                        }}
                    />
                );
            }
            case ClosingCountState.S1_WAIT_SCR_VALIDATIONS:
                return <WaitForSCRValidations onComplete={resolveSection1Exit} />;
            case ClosingCountState.S1_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.S1_CBI_READJUDICATION)} />;
            case ClosingCountState.S1_CBI_READJUDICATION: {
                const cbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                return (
                    <CIRCBIReadjudicationScreen
                        items={cbiReAdjItems}
                        onComplete={() => setState(ClosingCountState.S1_WAIT_SCR_VALIDATIONS)}
                        onBack={() => setState(ClosingCountState.S1_RESOLVE_READJ)}
                    />
                );
            }
            // Section 2 — "Remaining above 0": fewer needles confirmed than expected.
            // TODO(CIR): Build full Section 2 workflow beyond the CBI box check.
            case ClosingCountState.S2_CHECK_CBI_BOX:
                return (
                    <CheckCBIBoxScreen
                        overCount={overCount}
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        variant="section2"
                        onCorrect={() => setState(ClosingCountState.S2_CHECK_STERILE_FIELD)}
                        onMismatch={() => setState(ClosingCountState.S2_CBI_BOX_SELECTION)}
                    />
                );
            case ClosingCountState.S2_CHECK_STERILE_FIELD:
                return (
                    <NeedleSterileFieldScreen
                        needleCount={overCount}
                        variant="remaining"
                        onNeedleFound={() => setState(ClosingCountState.S2_NEEDLE_FOUND)}
                        onNeedleNotFound={async () => {
                            s2NotFoundCountRef.current = overCount;
                            await appContext.caseService.parlayInterface.caseManager.increment_misplaced_needles(
                                overCount,
                            );
                            setState(ClosingCountState.S2_NEEDLE_REGISTERED);
                        }}
                    />
                );
            case ClosingCountState.S2_NEEDLE_FOUND:
                return (
                    <NeedleFoundScreen
                        onSelectType={(type) => {
                            fromSection10Ref.current = false;
                            if (type === "sterile") {
                                setState(ClosingCountState.SECTION_5);
                            } else {
                                s6SourceStateRef.current = ClosingCountState.S2_NEEDLE_FOUND;
                                s6NeedleTypeRef.current = type as "contaminated" | "broken" | "incompatible";
                                if (type === "broken") {
                                    setState(ClosingCountState.S6_BROKEN_QUESTION);
                                } else {
                                    setState(ClosingCountState.SECTION_6);
                                }
                            }
                        }}
                    />
                );
            case ClosingCountState.S2_NEEDLE_REGISTERED:
                return (
                    <NeedleRegisteredScreen
                        needleCount={s2NotFoundCountRef.current}
                        variant="misplaced"
                        onOk={resolveDecisionNode9}
                    />
                );
            case ClosingCountState.S2_CBI_BOX_SELECTION:
                return (
                    <CBIBoxSelectionScreen
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        onConfirm={(selectedTypes) => {
                            if (selectedTypes.length === 0) {
                                // All compartments confirmed correct — no discrepancy to tap
                                setState(ClosingCountState.S2_CHECK_CBI_BOX);
                                return;
                            }
                            s2SelectedCompartments.current = selectedTypes;
                            s2TapResults.current = [];
                            setS2TapIndex(0);
                            setState(ClosingCountState.S2_NEEDLE_TAP);
                        }}
                    />
                );
            case ClosingCountState.S2_NEEDLE_TAP: {
                const types = s2SelectedCompartments.current;
                const currentType = types[s2TapIndex] as "broken" | "contaminated" | "incompatible";
                return (
                    <NeedleTapScreen
                        key={`s2-${currentType}`}
                        variant={currentType}
                        onConfirm={async (count, markers) => {
                            // Accumulate locally — only sent to backend when all types are done
                            s2TapResults.current[s2TapIndex] = {
                                type: currentType,
                                count,
                                markers: markers.map((m) => ({ x: m.x, y: m.y, number: m.number, type: currentType })),
                            };
                            if (s2TapIndex + 1 < types.length) {
                                setS2TapIndex(s2TapIndex + 1);
                            } else {
                                // All types done — batch-send to backend
                                const cbiImageResult = appContext.caseService.cbiImage.value;
                                const filename = cbiImageResult?.image_filename || "placeholder.png";
                                const naturalW = cbiImageResult?.imageNaturalWidth ?? 900;
                                const naturalH = cbiImageResult?.imageNaturalHeight ?? 875;
                                for (const result of s2TapResults.current) {
                                    // Convert percentage markers → natural pixel coords for SCR validation
                                    const pixelMarkers = result.markers.map((m) => ({
                                        ...m,
                                        x: (m.x / 100) * naturalW,
                                        y: (m.y / 100) * naturalH,
                                    }));
                                    await appContext.caseService.parlayInterface.caseManager.cbi_needles_counted(
                                        result.type,
                                        result.count,
                                        filename,
                                        0,
                                        "",
                                        false,
                                        false,
                                        pixelMarkers,
                                        naturalW,
                                        naturalH,
                                        true,
                                    );
                                }
                                setState(ClosingCountState.S2_WAIT_SCR_VALIDATIONS);
                            }
                        }}
                        onBack={() => {
                            if (s2TapIndex > 0) {
                                setS2TapIndex(s2TapIndex - 1);
                            } else {
                                setState(ClosingCountState.S2_CBI_BOX_SELECTION);
                            }
                        }}
                    />
                );
            }
            case ClosingCountState.S2_WAIT_SCR_VALIDATIONS:
                return <WaitForSCRValidations onComplete={resolveSection2Exit} />;
            case ClosingCountState.S2_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.S2_READJUDICATION)} />;
            case ClosingCountState.S2_READJUDICATION: {
                const s2CbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                return (
                    <CIRCBIReadjudicationScreen
                        items={s2CbiReAdjItems}
                        onComplete={() => setState(ClosingCountState.S2_WAIT_SCR_VALIDATIONS)}
                        onBack={() => setState(ClosingCountState.S2_RESOLVE_READJ)}
                    />
                );
            }
            case ClosingCountState.S3_WAIT_FOR_SCR:
                return <Section3WaitForSCRScreen onComplete={resolveS3PostPlacement} />;
            case ClosingCountState.S3_VERIFICATION:
                return (
                    <ClosingCountVerification
                        onBack={async () => {
                            await appContext.caseService.parlayInterface.caseManager.undo_needle_scan();
                            await appContext.caseService.parlayInterface.caseManager.increment_misplaced_needles(1);
                            setState(ClosingCountState.S3_WAIT_FOR_SCR);
                        }}
                        onConfirm={resolveS3PostVerification}
                    />
                );
            case ClosingCountState.S3_ADJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirAdjudication"
                        onComplete={() => setState(ClosingCountState.S3_SCR_PENDING_WAIT)}
                        onBack={() => setState(ClosingCountState.S3_VERIFICATION)}
                    />
                );
            case ClosingCountState.S3_SCR_PENDING_WAIT:
                return <WaitForSCRValidations onComplete={resolveS3PostValidation} />;
            case ClosingCountState.S3_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.S3_READJUDICATION)} />;
            case ClosingCountState.S3_READJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirReAdjudication"
                        onComplete={() => setState(ClosingCountState.S3_SCR_PENDING_WAIT)}
                        onBack={() => setState(ClosingCountState.S3_SCR_PENDING_WAIT)}
                    />
                );
            case ClosingCountState.S4_BROKEN_QUESTION:
                return (
                    <BrokenQuestionScreen
                        onNo={() => {
                            s4BrokenHasFragment.current = false;
                            setState(ClosingCountState.SECTION_4);
                        }}
                        onYes={() => {
                            s4BrokenHasFragment.current = true;
                            setState(ClosingCountState.SECTION_4);
                        }}
                    />
                );
            case ClosingCountState.SECTION_4:
                return (
                    <PlaceIntoCBIBoxScreen
                        variant={s4NeedleTypeRef.current}
                        brokenHasFragment={
                            s4NeedleTypeRef.current === "broken" ? s4BrokenHasFragment.current : undefined
                        }
                        onTakePhoto={() => {
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(ClosingCountState.S4_CAPTURE_PLACEHOLDER);
                        }}
                        onBack={() => {
                            if (s4NeedleTypeRef.current === "broken") {
                                setState(ClosingCountState.S4_BROKEN_QUESTION);
                            } else {
                                setState(ClosingCountState.MISPLACED_NEEDLE_FOUND);
                            }
                        }}
                    />
                );
            case ClosingCountState.S4_CAPTURE_PLACEHOLDER:
                return (
                    <CaptureNeedleImageScreen
                        variant={s4NeedleTypeRef.current}
                        onBack={() => setState(ClosingCountState.SECTION_4)}
                    />
                );
            case ClosingCountState.S4_PHOTO_CONFIRM:
                return (
                    <S4PhotoConfirmScreen
                        variant={s4NeedleTypeRef.current}
                        imageSrc={captureImageSrc}
                        onRetake={() => {
                            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(ClosingCountState.S4_CAPTURE_PLACEHOLDER);
                        }}
                        onConfirm={() => setState(ClosingCountState.S4_NEEDLE_TAP)}
                        onBack={() => {
                            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(ClosingCountState.S4_CAPTURE_PLACEHOLDER);
                        }}
                    />
                );
            case ClosingCountState.S4_NEEDLE_TAP:
                return (
                    <NeedleTapScreen
                        key={`s4-${s4NeedleTypeRef.current}`}
                        variant={s4NeedleTypeRef.current}
                        onConfirm={async (count, markers) => {
                            const cbiImageResult = appContext.caseService.cbiImage.value;
                            const filename = cbiImageResult?.image_filename || "placeholder.png";
                            const naturalW = cbiImageResult?.imageNaturalWidth ?? 900;
                            const naturalH = cbiImageResult?.imageNaturalHeight ?? 875;
                            const pixelMarkers = markers.map((m) => ({
                                x: (m.x / 100) * naturalW,
                                y: (m.y / 100) * naturalH,
                                number: m.number,
                                type: s4NeedleTypeRef.current,
                            }));
                            const brokenMissing =
                                s4NeedleTypeRef.current === "broken" ? !s4BrokenHasFragment.current : false;
                            await appContext.caseService.parlayInterface.caseManager.cbi_needles_counted(
                                s4NeedleTypeRef.current,
                                count,
                                filename,
                                0,
                                "",
                                true,
                                brokenMissing,
                                pixelMarkers,
                                naturalW,
                                naturalH,
                                true,
                            );
                            setState(ClosingCountState.S4_WAIT_SCR_VALIDATIONS);
                        }}
                        onBack={() => setState(ClosingCountState.S4_PHOTO_CONFIRM)}
                    />
                );
            case ClosingCountState.S4_WAIT_SCR_VALIDATIONS:
                return <WaitForSCRValidations onComplete={resolveS4PostValidation} />;
            case ClosingCountState.S4_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.S4_READJUDICATION)} />;
            case ClosingCountState.S4_READJUDICATION:
                return (
                    <CIRCBIReadjudicationScreen
                        items={appContext.caseService.cirReAdjudication.value.filter(
                            (r) => r?.response_type === "cbi_re_adjudication",
                        )}
                        onComplete={() => setState(ClosingCountState.S4_WAIT_SCR_VALIDATIONS)}
                        onBack={() => setState(ClosingCountState.S4_WAIT_SCR_VALIDATIONS)}
                    />
                );
            case ClosingCountState.SECTION_5:
                return <Section5WaitForSCRScreen onComplete={resolveS5PostPlacement} />;
            case ClosingCountState.S5_VERIFICATION:
                return (
                    <ClosingCountVerification
                        onBack={async () => {
                            await appContext.caseService.parlayInterface.caseManager.undo_needle_scan();
                            setState(ClosingCountState.SECTION_5);
                        }}
                        onConfirm={resolveS5PostVerification}
                    />
                );
            case ClosingCountState.S5_ADJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirAdjudication"
                        onComplete={() => setState(ClosingCountState.S5_SCR_PENDING_WAIT)}
                        onBack={() => setState(ClosingCountState.S5_VERIFICATION)}
                    />
                );
            case ClosingCountState.S5_SCR_PENDING_WAIT:
                return <WaitForSCRValidations onComplete={resolveS5PostValidation} />;
            case ClosingCountState.S5_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.S5_READJUDICATION)} />;
            case ClosingCountState.S5_READJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirReAdjudication"
                        onComplete={() => setState(ClosingCountState.S5_SCR_PENDING_WAIT)}
                        onBack={() => setState(ClosingCountState.S5_SCR_PENDING_WAIT)}
                    />
                );
            case ClosingCountState.S5_CHECK_STERILE:
                return (
                    <NeedleSterileFieldScreen
                        needleCount={Math.abs(startingCountVal + addedNeedleCountVal - confirmedVal)}
                        variant="remaining"
                        onNeedleNotFound={async () => {
                            s5NotFoundCountRef.current = Math.abs(
                                startingCountVal + addedNeedleCountVal - confirmedVal,
                            );
                            await appContext.caseService.parlayInterface.caseManager.increment_misplaced_needles(
                                s5NotFoundCountRef.current,
                            );
                            setState(ClosingCountState.S5_NEEDLE_REGISTERED);
                        }}
                        onNeedleFound={() => setState(ClosingCountState.S5_NEEDLE_FOUND)}
                    />
                );
            case ClosingCountState.S5_NEEDLE_REGISTERED:
                return (
                    <NeedleRegisteredScreen
                        needleCount={s5NotFoundCountRef.current}
                        variant="misplaced"
                        onOk={resolveDecisionNode9}
                    />
                );
            case ClosingCountState.S5_NEEDLE_FOUND:
                return (
                    <NeedleFoundScreen
                        onSelectType={(type) => {
                            fromSection10Ref.current = false;
                            if (type === "sterile") {
                                setState(ClosingCountState.SECTION_5);
                            } else {
                                s6SourceStateRef.current = ClosingCountState.S5_NEEDLE_FOUND;
                                s6NeedleTypeRef.current = type as "contaminated" | "broken" | "incompatible";
                                if (type === "broken") {
                                    setState(ClosingCountState.S6_BROKEN_QUESTION);
                                } else {
                                    setState(ClosingCountState.SECTION_6);
                                }
                            }
                        }}
                    />
                );
            case ClosingCountState.S6_BROKEN_QUESTION:
                return (
                    <BrokenQuestionScreen
                        onNo={() => {
                            s6BrokenHasFragment.current = false;
                            setState(ClosingCountState.SECTION_6);
                        }}
                        onYes={() => {
                            s6BrokenHasFragment.current = true;
                            setState(ClosingCountState.SECTION_6);
                        }}
                    />
                );
            case ClosingCountState.SECTION_6:
                return (
                    <PlaceIntoCBIBoxScreen
                        variant={s6NeedleTypeRef.current}
                        brokenHasFragment={
                            s6NeedleTypeRef.current === "broken" ? s6BrokenHasFragment.current : undefined
                        }
                        onTakePhoto={() => {
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(ClosingCountState.S6_CAPTURE_PLACEHOLDER);
                        }}
                        onBack={() => {
                            if (s6NeedleTypeRef.current === "broken") {
                                setState(ClosingCountState.S6_BROKEN_QUESTION);
                            } else {
                                setState(s6SourceStateRef.current);
                            }
                        }}
                    />
                );
            case ClosingCountState.S6_CAPTURE_PLACEHOLDER:
                return (
                    <CaptureNeedleImageScreen
                        variant={s6NeedleTypeRef.current}
                        onBack={() => setState(ClosingCountState.SECTION_6)}
                    />
                );
            case ClosingCountState.S6_PHOTO_CONFIRM:
                return (
                    <S4PhotoConfirmScreen
                        variant={s6NeedleTypeRef.current}
                        imageSrc={captureImageSrc}
                        onRetake={() => {
                            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(ClosingCountState.S6_CAPTURE_PLACEHOLDER);
                        }}
                        onConfirm={() => setState(ClosingCountState.S6_NEEDLE_TAP)}
                        onBack={() => {
                            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(ClosingCountState.S6_CAPTURE_PLACEHOLDER);
                        }}
                    />
                );
            case ClosingCountState.S6_NEEDLE_TAP:
                return (
                    <NeedleTapScreen
                        key={`s6-${s6NeedleTypeRef.current}`}
                        variant={s6NeedleTypeRef.current}
                        onConfirm={async (count, markers) => {
                            const cbiImageResult = appContext.caseService.cbiImage.value;
                            const filename = cbiImageResult?.image_filename || "placeholder.png";
                            const naturalW = cbiImageResult?.imageNaturalWidth ?? 900;
                            const naturalH = cbiImageResult?.imageNaturalHeight ?? 875;
                            const pixelMarkers = markers.map((m) => ({
                                x: (m.x / 100) * naturalW,
                                y: (m.y / 100) * naturalH,
                                number: m.number,
                                type: s6NeedleTypeRef.current,
                            }));
                            const brokenMissing =
                                s6NeedleTypeRef.current === "broken" ? !s6BrokenHasFragment.current : false;
                            await appContext.caseService.parlayInterface.caseManager.cbi_needles_counted(
                                s6NeedleTypeRef.current,
                                count,
                                filename,
                                0,
                                "",
                                false,
                                brokenMissing,
                                pixelMarkers,
                                naturalW,
                                naturalH,
                                true,
                                fromSection10Ref.current,
                            );
                            setState(ClosingCountState.S6_WAIT_SCR_VALIDATIONS);
                        }}
                        onBack={() => setState(ClosingCountState.S6_PHOTO_CONFIRM)}
                    />
                );
            case ClosingCountState.S6_WAIT_SCR_VALIDATIONS:
                return <WaitForSCRValidations onComplete={resolveS6PostValidation} />;
            case ClosingCountState.S6_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(ClosingCountState.S6_READJUDICATION)} />;
            case ClosingCountState.S6_READJUDICATION:
                return (
                    <CIRCBIReadjudicationScreen
                        items={appContext.caseService.cirReAdjudication.value.filter(
                            (r) => r?.response_type === "cbi_re_adjudication",
                        )}
                        onComplete={() => setState(ClosingCountState.S6_WAIT_SCR_VALIDATIONS)}
                        onBack={() => setState(ClosingCountState.S6_WAIT_SCR_VALIDATIONS)}
                    />
                );
            case ClosingCountState.S6_CHECK_STERILE:
                return (
                    <NeedleSterileFieldScreen
                        needleCount={Math.abs(startingCountVal + addedNeedleCountVal - confirmedVal)}
                        variant="remaining"
                        onNeedleNotFound={async () => {
                            s6NotFoundCountRef.current = Math.abs(
                                startingCountVal + addedNeedleCountVal - confirmedVal,
                            );
                            await appContext.caseService.parlayInterface.caseManager.increment_misplaced_needles(
                                s6NotFoundCountRef.current,
                            );
                            setState(ClosingCountState.S6_NEEDLE_REGISTERED);
                        }}
                        onNeedleFound={() => setState(ClosingCountState.S6_NEEDLE_FOUND)}
                    />
                );
            case ClosingCountState.S6_NEEDLE_REGISTERED:
                return (
                    <NeedleRegisteredScreen
                        needleCount={s6NotFoundCountRef.current}
                        variant="misplaced"
                        onOk={resolveDecisionNode9}
                    />
                );
            case ClosingCountState.S6_NEEDLE_FOUND:
                return (
                    <NeedleFoundScreen
                        onSelectType={(type) => {
                            fromSection10Ref.current = false;
                            if (type === "sterile") {
                                setState(ClosingCountState.SECTION_5);
                            } else {
                                s6SourceStateRef.current = ClosingCountState.S6_NEEDLE_FOUND;
                                s6NeedleTypeRef.current = type as "contaminated" | "broken" | "incompatible";
                                if (type === "broken") {
                                    setState(ClosingCountState.S6_BROKEN_QUESTION);
                                } else {
                                    setState(ClosingCountState.SECTION_6);
                                }
                            }
                        }}
                    />
                );
            case ClosingCountState.POST_SECTION_7:
            case ClosingCountState.POST_CLOSING_COUNT:
                return null;
        }
    }

    return (
        <div className={styles.screenContainer}>
            {headerProps && (
                <TrackingHeader
                    title={t(headerProps.title ?? "closeCount.title")}
                    stage={3}
                    stageColor="rgba(129, 167, 255, 1)"
                    onBack={headerProps.onBack}
                    showHelp={headerProps.showHelp}
                />
            )}
            {renderContent()}
        </div>
    );
};
