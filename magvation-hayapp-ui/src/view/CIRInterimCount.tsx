import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "../viewcss/CIRInterimCount.module.css";
import { TrackingHeader } from "./subview/TrackingHeader";
import { useTranslation } from "react-i18next";
import { AppContext } from "./App";
import { useListenable } from "../util/Listenable";
import { InterimCountConfirmModal } from "./subview/InterimCountConfirmModal";
import { InterimCountReasonSelect, type InterimCountReasonId } from "./subview/InterimCountReasonSelect";
import { InterimCountRequesterSelect, type InterimCountRequesterId } from "./subview/InterimCountRequesterSelect";
import { CountReconciliationScreen } from "./subview/CountReconciliationScreen";
import CIRAdjudicationScreen from "./CIRAdjudicationScreen";
import { ClosingCountVerification } from "./subview/ClosingCountVerification";
import { ConfirmCBINeedles } from "./subview/ConfirmCBINeedles";
import { ResolveCBIItems } from "./subview/ResolveCBIItems";
import { CIRCBIReadjudicationScreen } from "./subview/CIRCBIReadjudicationScreen";
import { WaitForSCRValidations } from "./subview/WaitForSCRValidations";
import { ResolvePendingItems } from "./subview/ResolvePendingItems";
import { InterimCountScrCountEntry } from "./subview/InterimCountScrCountEntry";
import { InterimCountWaitScrConfirm } from "./subview/InterimCountWaitScrConfirm";
import { CheckCBIBoxScreen } from "./subview/CheckCBIBoxScreen";
import { CBIBoxSelectionScreen } from "./subview/CBIBoxSelectionScreen";
import { NeedleTapScreen } from "./subview/NeedleTapScreen";
import { NeedleSterileFieldScreen } from "./subview/NeedleSterileFieldScreen";
import { NeedleFoundScreen } from "./subview/NeedleFoundScreen";
import { PlaceIntoCBIBoxScreen } from "./subview/PlaceIntoCBIBoxScreen";
import { CaptureNeedleImageScreen } from "./subview/CaptureNeedleImageScreen";
import { S4PhotoConfirmScreen } from "./subview/S4PhotoConfirmScreen";
import { BrokenQuestionScreen } from "./subview/BrokenQuestionScreen";

export enum InterimCountState {
    CONFIRM,
    CHOOSE_REASON,
    WHO_IS_REQUESTING,

    RESOLVE_PENDING,
    VERIFICATION,
    ADJUDICATION,
    READJUDICATION,
    CONTAMINATED,
    CBI_RESOLVE,
    CBI_READJUDICATION,
    SCR_PENDING_WAIT,
    POST_VALIDATION_RESOLVE_READJ,
    POST_VALIDATION_READJUDICATION,

    // === Post-verification SCR count entry (Koboh developing) ===
    // After verification pipeline + re-adj loop completes, CIR shows these screens
    // before doing the 3-way section routing (Section 1/2/3).
    SCR_COUNT_ENTRY, // CIR: "Ask SCR to count" + live count display + Confirm button
    WAIT_SCR_COUNT_CONFIRM, // CIR: "Please wait for confirmation from the SCR..."

    INTERIM_COUNT_DONE,

    S2_CHECK_CBI_BOX,
    S2_CBI_BOX_SELECTION,
    S2_NEEDLE_TAP,
    S2_WAIT_SCR_VALIDATIONS,
    S2_RESOLVE_READJ,
    S2_CBI_READJUDICATION,

    S3_CHECK_CBI_BOX,
    S3_CBI_BOX_SELECTION,
    S3_NEEDLE_TAP,
    S3_WAIT_SCR_VALIDATIONS,
    S3_RESOLVE_READJ,
    S3_READJUDICATION,

    SECTION_4,
    S4_WAIT_SCR,

    SECTION_5,
    S5_BROKEN_QUESTION,
    S5_CAPTURE_PLACEHOLDER,
    S5_PHOTO_CONFIRM,
    S5_NEEDLE_TAP,
    S5_WAIT_SCR_VALIDATIONS,
    S5_RESOLVE_READJ,
    S5_READJUDICATION,

    INTERIM_COUNT_DONE_EXTRA,

    S7_CHECK_STERILE_FIELD,
    S7_NEEDLE_FOUND,
    S7_NEEDLE_REGISTERED,

    INTERIM_COUNT_DONE_REGISTERED,

    POST_INTERIM_COUNT,
}

function getInitialInterimState(route: {
    path: string;
    args?: { interimSkipConfirm?: boolean; interimInitialState?: string };
}): InterimCountState {
    if (route.path !== "cirInterimCount") return InterimCountState.CONFIRM;
    if (route.args?.interimInitialState === "whoIsRequesting") return InterimCountState.WHO_IS_REQUESTING;
    if (route.args?.interimSkipConfirm) return InterimCountState.CHOOSE_REASON;
    return InterimCountState.CONFIRM;
}

export const CIRInterimCount: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const landedFromDashboardConfirm = useRef(Boolean(appContext.route.args?.interimSkipConfirm));
    const interimSessionStarted = useRef(false);

    // SCR nurse's reported count — stored when CIR enters it, used in resolveS2Exit
    const scrReportedCountRef = useRef<number>(0);

    // Section 2: CBI tap state (same pattern as CC S1)
    const s2SelectedCompartments = useRef<string[]>([]);
    const [s2TapIndex, setS2TapIndex] = useState(0);
    const s2TapResults = useRef<
        Array<{ type: string; count: number; markers: Array<{ x: number; y: number; number: number; type: string }> }>
    >([]);

    // Section 3: CBI tap state (same pattern as S2)
    const s3SelectedCompartments = useRef<string[]>([]);
    const [s3TapIndex, setS3TapIndex] = useState(0);
    const s3TapResults = useRef<
        Array<{ type: string; count: number; markers: Array<{ x: number; y: number; number: number; type: string }> }>
    >([]);

    // Section 5: CBI batch flow (single needle from S7 NeedleFound)
    const s5NeedleTypeRef = useRef<"contaminated" | "broken" | "incompatible">("contaminated");
    const s5BrokenHasFragment = useRef<boolean>(false);
    const [captureImageSrc, setCaptureImageSrc] = useState<string | null>(null);

    const [state, setState] = useState<InterimCountState>(() => getInitialInterimState(appContext.route));
    const [selectedReason, setSelectedReason] = useState<InterimCountReasonId | null>(null);
    const [selectedRequester, setSelectedRequester] = useState<InterimCountRequesterId | null>(null);

    const startingCountVal = useListenable(appContext.caseService.startingCount);
    const addedNeedleCountVal = useListenable(appContext.caseService.addedNeedleCount);
    const confirmedVal = useListenable(appContext.caseService.confirmed);
    const contaminatedNeedleCount = useListenable(appContext.caseService.contaminatedNeedleCount);
    const brokenNeedleCount = useListenable(appContext.caseService.brokenNeedleCount);
    const incompatibleNeedleCount = useListenable(appContext.caseService.incompatibleNeedleCount);

    const remaining = startingCountVal + addedNeedleCountVal - confirmedVal;

    const goDashboard = useCallback(() => {
        appContext.navigate({ path: "cirDashboard" });
    }, [appContext]);

    const beginInterimCountSession = useCallback(() => {
        if (interimSessionStarted.current) return;
        interimSessionStarted.current = true;
        if (!appContext.parlayWrapper.isConnected.value) return;
        void appContext.caseService.parlayInterface.caseManager.start_interim_count().catch((err) => {
            console.error("start_interim_count failed:", err);
        });
    }, [appContext.caseService.parlayInterface.caseManager, appContext.parlayWrapper.isConnected.value]);

    useEffect(() => {
        if (!appContext.route.args?.interimSkipConfirm) return;
        beginInterimCountSession();
    }, [appContext.route.args?.interimSkipConfirm, beginInterimCountSession]);

    const hasPendingCirItems = useCallback(() => {
        const v = appContext.caseService.cirVerification.value;
        const a = appContext.caseService.cirAdjudication.value;
        const r = appContext.caseService.cirReAdjudication.value;
        return v.length > 0 || a.length > 0 || r.length > 0;
    }, [appContext.caseService]);

    const goBackFromContaminated = useCallback(async () => {
        await appContext.caseService.parlayInterface.caseManager.reset_cbi_confirmations();
        await appContext.caseService.parlayInterface.caseManager.reset_closing_count_verification();
        if (hasPendingCirItems()) {
            setState(InterimCountState.RESOLVE_PENDING);
        } else {
            setState(InterimCountState.CHOOSE_REASON);
            setSelectedRequester(null);
        }
    }, [appContext.caseService.parlayInterface.caseManager, hasPendingCirItems]);

    const routeAfterIntroSelection = useCallback(() => {
        if (hasPendingCirItems()) {
            setState(InterimCountState.RESOLVE_PENDING);
        } else {
            setState(InterimCountState.CONTAMINATED);
        }
    }, [hasPendingCirItems]);

    const resolveNext = useCallback(() => {
        const hasVerification = appContext.caseService.cirVerification.value.length > 0;
        const hasAdjudication = appContext.caseService.cirAdjudication.value.length > 0;
        const hasReAdjudication = appContext.caseService.cirReAdjudication.value.length > 0;

        if (hasVerification) setState(InterimCountState.VERIFICATION);
        else if (hasAdjudication) setState(InterimCountState.ADJUDICATION);
        else if (hasReAdjudication) setState(InterimCountState.READJUDICATION);
        else setState(InterimCountState.CONTAMINATED);
    }, [appContext.caseService]);

    const resolveAfterVerification = useCallback(() => {
        const hasAdjudication = appContext.caseService.cirAdjudication.value.length > 0;
        const hasReAdjudication = appContext.caseService.cirReAdjudication.value.length > 0;

        if (hasAdjudication) setState(InterimCountState.ADJUDICATION);
        else if (hasReAdjudication) setState(InterimCountState.READJUDICATION);
        else setState(InterimCountState.CONTAMINATED);
    }, [appContext.caseService]);

    const resolveAfterAdjudication = useCallback(() => {
        const hasReAdjudication = appContext.caseService.cirReAdjudication.value.length > 0;
        if (hasReAdjudication) setState(InterimCountState.READJUDICATION);
        else setState(InterimCountState.CONTAMINATED);
    }, [appContext.caseService]);

    const resolveAfterReadjudication = useCallback(() => {
        const hasReAdjudication = appContext.caseService.cirReAdjudication.value.length > 0;
        if (hasReAdjudication) setState(InterimCountState.READJUDICATION);
        else setState(InterimCountState.CONTAMINATED);
    }, [appContext.caseService]);

    const resetVerificationAndGoBack = useCallback(async () => {
        await appContext.caseService.parlayInterface.caseManager.reset_closing_count_verification();
        setState(InterimCountState.VERIFICATION);
    }, [appContext.caseService.parlayInterface.caseManager]);

    // Section routing — called after Koboh's SCR count entry/confirmation screens.
    // 3-way routing: compare system remaining to SCR nurse's reported count.
    // remaining == scrCount → done | remaining < scrCount → S2 (over) | remaining > scrCount → S3 (under)
    const resolveSectionRouting = useCallback(() => {
        const r =
            appContext.caseService.startingCount.value +
            appContext.caseService.addedNeedleCount.value -
            appContext.caseService.confirmed.value;
        const scrCount = scrReportedCountRef.current;

        if (r === scrCount) {
            setState(InterimCountState.INTERIM_COUNT_DONE);
        } else if (r < scrCount) {
            setState(InterimCountState.S2_CHECK_CBI_BOX);
        } else {
            setState(InterimCountState.S3_CHECK_CBI_BOX);
        }
    }, [appContext.caseService]);

    // Post-validation resolver — runs after SCR_PENDING_WAIT completes.
    // Re-adjudication loop: if SCR rejected items, CIR re-adjudicates then waits for SCR again.
    // When clean, routes to Koboh's SCR count entry screens (NOT directly to sections).
    const resolvePostValidation = useCallback(() => {
        const hasReAdj = appContext.caseService.cirReAdjudication.value.length > 0;
        if (hasReAdj) {
            setState(InterimCountState.POST_VALIDATION_RESOLVE_READJ);
            return;
        }

        // Route to Koboh's SCR count entry screens.
        // After count entry + confirmation, resolveSectionRouting does the 3-way routing.
        setState(InterimCountState.SCR_COUNT_ENTRY);
    }, [appContext.caseService]);

    // Section 2 exit resolver — runs after SCR validates CBI tap results.
    // Re-adj loop first, then compare system remaining to SCR nurse's manual count.
    const resolveS2Exit = useCallback(() => {
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        if (hasCbiReAdj) {
            setState(InterimCountState.S2_RESOLVE_READJ);
            return;
        }
        const starting = appContext.caseService.startingCount.value;
        const added = appContext.caseService.addedNeedleCount.value;
        const confirmed = appContext.caseService.confirmed.value;
        const r = starting + added - confirmed;
        const scrCount = scrReportedCountRef.current;
        if (r === scrCount) {
            setState(InterimCountState.INTERIM_COUNT_DONE);
        } else if (r < scrCount) {
            setState(InterimCountState.INTERIM_COUNT_DONE_EXTRA);
        } else {
            setState(InterimCountState.S3_CHECK_CBI_BOX);
        }
    }, [appContext.caseService]);

    // Section 3 exit resolver — runs after SCR validates CBI tap results.
    // Re-adj loop first, then compare system remaining to SCR nurse's manual count.
    const resolveS3Exit = useCallback(() => {
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        if (hasCbiReAdj) {
            setState(InterimCountState.S3_RESOLVE_READJ);
            return;
        }
        const r =
            appContext.caseService.startingCount.value +
            appContext.caseService.addedNeedleCount.value -
            appContext.caseService.confirmed.value;
        const scrCount = scrReportedCountRef.current;
        if (r === scrCount) {
            setState(InterimCountState.INTERIM_COUNT_DONE);
        } else if (r < scrCount) {
            setState(InterimCountState.S2_CHECK_CBI_BOX);
        } else {
            setState(InterimCountState.S7_CHECK_STERILE_FIELD);
        }
    }, [appContext.caseService]);

    // Section 4 exit resolver — after SCR confirms recount, 3-way routing.
    const resolveS4Exit = useCallback(() => {
        const r =
            appContext.caseService.startingCount.value +
            appContext.caseService.addedNeedleCount.value -
            appContext.caseService.confirmed.value;
        const scrCount = scrReportedCountRef.current;
        if (r === scrCount) {
            setState(InterimCountState.INTERIM_COUNT_DONE);
        } else if (r < scrCount) {
            setState(InterimCountState.S2_CHECK_CBI_BOX);
        } else {
            setState(InterimCountState.S7_CHECK_STERILE_FIELD);
        }
    }, [appContext.caseService]);

    // Section 5 exit — 3-way routing after CBI batch flow.
    const resolveS5Exit = useCallback(() => {
        const r =
            appContext.caseService.startingCount.value +
            appContext.caseService.addedNeedleCount.value -
            appContext.caseService.confirmed.value;
        const scrCount = scrReportedCountRef.current;
        if (r === scrCount) {
            setState(InterimCountState.INTERIM_COUNT_DONE);
        } else if (r < scrCount) {
            setState(InterimCountState.S2_CHECK_CBI_BOX);
        } else {
            setState(InterimCountState.S7_CHECK_STERILE_FIELD);
        }
    }, [appContext.caseService]);

    // Section 5 post-validation — re-adj check then exit.
    const resolveS5PostValidation = useCallback(() => {
        const hasCbiReAdj = appContext.caseService.cirReAdjudication.value.some(
            (item) => item?.response_type === "cbi_re_adjudication",
        );
        if (hasCbiReAdj) {
            setState(InterimCountState.S5_RESOLVE_READJ);
            return;
        }
        resolveS5Exit();
    }, [appContext.caseService, resolveS5Exit]);

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;

        const screenMap: Record<InterimCountState, string> = {
            [InterimCountState.CONFIRM]: "cirInterimCount",
            [InterimCountState.CHOOSE_REASON]: "cirInterimCountReasonSelect",
            [InterimCountState.WHO_IS_REQUESTING]: "cirInterimCountRequesterSelect",

            [InterimCountState.RESOLVE_PENDING]: "cirInterimCountResolvePending",
            [InterimCountState.VERIFICATION]: "cirInterimCountVerification",
            [InterimCountState.ADJUDICATION]: "cirInterimCountAdjudication",
            [InterimCountState.READJUDICATION]: "cirInterimCountReadjudication",
            [InterimCountState.CONTAMINATED]: "cirInterimCountContaminated",
            [InterimCountState.CBI_RESOLVE]: "cirInterimCountCbiResolve",
            [InterimCountState.CBI_READJUDICATION]: "cirInterimCountCbiReadjudication",
            [InterimCountState.SCR_PENDING_WAIT]: "cirInterimCountScrPendingWait",
            [InterimCountState.POST_VALIDATION_RESOLVE_READJ]: "cirInterimCountPostValResolveReadj",
            [InterimCountState.POST_VALIDATION_READJUDICATION]: "cirInterimCountPostValReadjudication",

            [InterimCountState.SCR_COUNT_ENTRY]: "cirInterimCountScrCountEntry",
            [InterimCountState.WAIT_SCR_COUNT_CONFIRM]: "cirInterimCountWaitScrCountConfirm",

            [InterimCountState.INTERIM_COUNT_DONE]: "cirInterimCountDone",

            [InterimCountState.S2_CHECK_CBI_BOX]: "cirInterimCountS2CheckCbiBox",
            [InterimCountState.S2_CBI_BOX_SELECTION]: "cirInterimCountS2CbiBoxSelection",
            [InterimCountState.S2_NEEDLE_TAP]: "cirInterimCountS2NeedleTap",
            [InterimCountState.S2_WAIT_SCR_VALIDATIONS]: "cirInterimCountS2WaitScrValidations",
            [InterimCountState.S2_RESOLVE_READJ]: "cirInterimCountS2ResolveReadj",
            [InterimCountState.S2_CBI_READJUDICATION]: "cirInterimCountS2CbiReadjudication",

            [InterimCountState.S3_CHECK_CBI_BOX]: "cirInterimCountS3CheckCbiBox",
            [InterimCountState.S3_CBI_BOX_SELECTION]: "cirInterimCountS3CbiBoxSelection",
            [InterimCountState.S3_NEEDLE_TAP]: "cirInterimCountS3NeedleTap",
            [InterimCountState.S3_WAIT_SCR_VALIDATIONS]: "cirInterimCountS3WaitScrValidations",
            [InterimCountState.S3_RESOLVE_READJ]: "cirInterimCountS3ResolveReadj",
            [InterimCountState.S3_READJUDICATION]: "cirInterimCountS3Readjudication",

            [InterimCountState.SECTION_4]: "cirInterimCountS4ScrRecount",
            [InterimCountState.S4_WAIT_SCR]: "cirInterimCountS4WaitScr",

            [InterimCountState.SECTION_5]: "cirInterimCountSection5",
            [InterimCountState.S5_BROKEN_QUESTION]: "cirInterimCountS5BrokenQuestion",
            [InterimCountState.S5_CAPTURE_PLACEHOLDER]: "cirInterimCountS5CapturePlaceholder",
            [InterimCountState.S5_PHOTO_CONFIRM]: "cirInterimCountS5PhotoConfirm",
            [InterimCountState.S5_NEEDLE_TAP]: "cirInterimCountS5NeedleTap",
            [InterimCountState.S5_WAIT_SCR_VALIDATIONS]: "cirInterimCountS5WaitScrValidations",
            [InterimCountState.S5_RESOLVE_READJ]: "cirInterimCountS5ResolveReadj",
            [InterimCountState.S5_READJUDICATION]: "cirInterimCountS5Readjudication",

            [InterimCountState.INTERIM_COUNT_DONE_EXTRA]: "cirInterimCountDoneExtra",

            [InterimCountState.S7_CHECK_STERILE_FIELD]: "cirInterimCountS7CheckSterileField",
            [InterimCountState.S7_NEEDLE_FOUND]: "cirInterimCountS7NeedleFound",
            [InterimCountState.S7_NEEDLE_REGISTERED]: "cirInterimCountS7NeedleRegistered",

            [InterimCountState.INTERIM_COUNT_DONE_REGISTERED]: "cirInterimCountDoneRegistered",

            [InterimCountState.POST_INTERIM_COUNT]: "cirInterimCountPostDone",
        };

        appContext.caseService.parlayInterface.caseManager.set_current_cir_screen(screenMap[state]);
    }, [state, appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    // POST_INTERIM_COUNT: broadcast fires above, then navigate to dashboard.
    useEffect(() => {
        if (state !== InterimCountState.POST_INTERIM_COUNT) return;
        appContext.navigate({ path: "cirDashboard" });
    }, [state, appContext]);

    // When CIR is waiting for SCR to validate the entered count, listen for
    // SCR's response via scr_screen_changed. "Confirmed" → section routing,
    // "Recount" → back to SCR_COUNT_ENTRY.
    useEffect(() => {
        if (state !== InterimCountState.WAIT_SCR_COUNT_CONFIRM) return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "scrInterimCountConfirmedCount":
                    resolveSectionRouting();
                    break;
                case "scrInterimCountRecount":
                    setState(InterimCountState.SCR_COUNT_ENTRY);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, resolveSectionRouting, appContext.caseService.parlayInterface.caseManager]);

    // Section 4: same pattern — SCR confirms/rejects the recount.
    useEffect(() => {
        if (state !== InterimCountState.S4_WAIT_SCR) return;

        const caseManagerDefs = appContext.caseService.parlayInterface.caseManager;
        if (!caseManagerDefs) return;

        const handler = (event: { screen: string }) => {
            switch (event.screen) {
                case "scrInterimCountConfirmedCount":
                    resolveS4Exit();
                    break;
                case "scrInterimCountRecount":
                    setState(InterimCountState.SECTION_4);
                    break;
            }
        };

        const unsubscribe = caseManagerDefs.scr_screen_changed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [state, resolveS4Exit, appContext.caseService.parlayInterface.caseManager]);

    // Section 5: camera capture listener
    useEffect(() => {
        if (state !== InterimCountState.S5_CAPTURE_PLACEHOLDER) return;
        appContext.caseService.parlayInterface.hayScanner.open_camera(50000);
        const unsub = appContext.caseService.parlayInterface.caseManager.cbi_scanned(
            (result: { image_filename?: string }) => {
                if (!result?.image_filename) return;
                const src = `http://localhost:8080/hayscan_cbi_images/${result.image_filename}`;
                setCaptureImageSrc(src);
                setState(InterimCountState.S5_PHOTO_CONFIRM);
            },
        );
        return () => {
            if (unsub) unsub();
            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
        };
    }, [state, appContext.caseService.parlayInterface.caseManager, appContext.caseService.parlayInterface.hayScanner]);

    const headerProps = (() => {
        switch (state) {
            case InterimCountState.CONFIRM:
            case InterimCountState.CHOOSE_REASON:
            case InterimCountState.WHO_IS_REQUESTING:
                return null;

            case InterimCountState.RESOLVE_PENDING:
                return null;

            case InterimCountState.CONTAMINATED:
                return {
                    onBack: goBackFromContaminated,
                    showHelp: true,
                    title: "interimCount.interimTitle",
                };

            case InterimCountState.CBI_RESOLVE:
                return {
                    onBack: async () => {
                        await appContext.caseService.parlayInterface.caseManager.reset_cbi_confirmations();
                        setState(InterimCountState.CONTAMINATED);
                    },
                    showHelp: true,
                };

            case InterimCountState.VERIFICATION:
            case InterimCountState.ADJUDICATION:
            case InterimCountState.READJUDICATION:
            case InterimCountState.CBI_READJUDICATION:
            case InterimCountState.SCR_PENDING_WAIT:
            case InterimCountState.POST_VALIDATION_RESOLVE_READJ:
            case InterimCountState.POST_VALIDATION_READJUDICATION:
                return null;

            // Post-verification SCR count entry (Koboh screens)
            case InterimCountState.SCR_COUNT_ENTRY:
                return { showHelp: true };

            case InterimCountState.WAIT_SCR_COUNT_CONFIRM:
                return null;

            case InterimCountState.INTERIM_COUNT_DONE:
                return { showHelp: true };

            case InterimCountState.S2_CHECK_CBI_BOX:
                return { showHelp: true };
            case InterimCountState.S2_CBI_BOX_SELECTION:
                return { onBack: () => setState(InterimCountState.S2_CHECK_CBI_BOX), showHelp: true };
            case InterimCountState.S2_NEEDLE_TAP:
            case InterimCountState.S2_WAIT_SCR_VALIDATIONS:
            case InterimCountState.S2_RESOLVE_READJ:
            case InterimCountState.S2_CBI_READJUDICATION:
                return null;

            case InterimCountState.S3_CHECK_CBI_BOX:
                return { showHelp: true };
            case InterimCountState.S3_CBI_BOX_SELECTION:
                return { onBack: () => setState(InterimCountState.S3_CHECK_CBI_BOX), showHelp: true };
            case InterimCountState.S3_NEEDLE_TAP:
            case InterimCountState.S3_WAIT_SCR_VALIDATIONS:
            case InterimCountState.S3_RESOLVE_READJ:
            case InterimCountState.S3_READJUDICATION:
                return null;

            case InterimCountState.SECTION_4:
                return { showHelp: true };
            case InterimCountState.S4_WAIT_SCR:
                return null;

            case InterimCountState.S5_BROKEN_QUESTION:
                return { onBack: () => setState(InterimCountState.S7_NEEDLE_FOUND), showHelp: true };
            case InterimCountState.SECTION_5:
            case InterimCountState.S5_CAPTURE_PLACEHOLDER:
            case InterimCountState.S5_PHOTO_CONFIRM:
            case InterimCountState.S5_NEEDLE_TAP:
            case InterimCountState.S5_WAIT_SCR_VALIDATIONS:
            case InterimCountState.S5_RESOLVE_READJ:
            case InterimCountState.S5_READJUDICATION:
                return null;

            case InterimCountState.INTERIM_COUNT_DONE_EXTRA:
                return { showHelp: true };

            case InterimCountState.S7_CHECK_STERILE_FIELD:
                return { showHelp: true };
            case InterimCountState.S7_NEEDLE_FOUND:
                return { onBack: () => setState(InterimCountState.S7_CHECK_STERILE_FIELD), showHelp: true };
            case InterimCountState.S7_NEEDLE_REGISTERED:
                return { showHelp: true };

            case InterimCountState.INTERIM_COUNT_DONE_REGISTERED:
                return { showHelp: true };

            default:
                return null;
        }
    })();

    const handleIntroBack = () => {
        if (state === InterimCountState.WHO_IS_REQUESTING) {
            setState(InterimCountState.CHOOSE_REASON);
            setSelectedRequester(null);
            return;
        }
        if (state === InterimCountState.CHOOSE_REASON) {
            if (landedFromDashboardConfirm.current) {
                goDashboard();
            } else {
                setState(InterimCountState.CONFIRM);
            }
        }
    };

    const handleSelectReason = (id: InterimCountReasonId) => {
        setSelectedReason(id);
        if (id === "cavity_closure") {
            routeAfterIntroSelection();
        } else {
            setState(InterimCountState.WHO_IS_REQUESTING);
        }
    };

    const handleSelectRequester = (id: InterimCountRequesterId) => {
        setSelectedRequester(id);
        routeAfterIntroSelection();
    };

    const handleResolvePendingBack = () => {
        setState(InterimCountState.CHOOSE_REASON);
        setSelectedRequester(null);
    };

    const confirmOnNo = () => {
        goDashboard();
        if (appContext.parlayWrapper.isConnected.value) {
            void appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirDashboard");
        }
    };

    const confirmOnYes = () => {
        beginInterimCountSession();
        setState(InterimCountState.CHOOSE_REASON);
    };

    function renderContent() {
        switch (state) {
            case InterimCountState.CONFIRM:
                return <InterimCountConfirmModal onNo={confirmOnNo} onYes={confirmOnYes} />;

            case InterimCountState.CHOOSE_REASON:
                return <InterimCountReasonSelect selectedReason={selectedReason} onSelectReason={handleSelectReason} />;

            case InterimCountState.WHO_IS_REQUESTING:
                return (
                    <InterimCountRequesterSelect
                        selectedRequester={selectedRequester}
                        onSelectRequester={handleSelectRequester}
                    />
                );

            case InterimCountState.RESOLVE_PENDING:
                return <ResolvePendingItems onResolve={resolveNext} />;

            case InterimCountState.VERIFICATION:
                return (
                    <ClosingCountVerification
                        onBack={() => setState(InterimCountState.RESOLVE_PENDING)}
                        onConfirm={resolveAfterVerification}
                    />
                );

            case InterimCountState.ADJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirAdjudication"
                        onComplete={resolveAfterAdjudication}
                        onBack={resetVerificationAndGoBack}
                    />
                );

            case InterimCountState.READJUDICATION:
                return (
                    <CIRAdjudicationScreen
                        source="cirReAdjudication"
                        onComplete={resolveAfterReadjudication}
                        onBack={resetVerificationAndGoBack}
                    />
                );

            case InterimCountState.CONTAMINATED:
                return (
                    <ConfirmCBINeedles
                        onComplete={(hasDeniedItems) => {
                            if (hasDeniedItems) {
                                setState(InterimCountState.CBI_RESOLVE);
                            } else {
                                setState(InterimCountState.SCR_PENDING_WAIT);
                            }
                        }}
                    />
                );

            case InterimCountState.CBI_RESOLVE:
                return <ResolveCBIItems onResolve={() => setState(InterimCountState.CBI_READJUDICATION)} />;

            case InterimCountState.CBI_READJUDICATION: {
                const cbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                return (
                    <CIRCBIReadjudicationScreen
                        items={cbiReAdjItems}
                        onComplete={() => setState(InterimCountState.SCR_PENDING_WAIT)}
                        onBack={() => setState(InterimCountState.CBI_RESOLVE)}
                    />
                );
            }

            case InterimCountState.SCR_PENDING_WAIT:
                return <WaitForSCRValidations onComplete={resolvePostValidation} />;

            case InterimCountState.POST_VALIDATION_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(InterimCountState.POST_VALIDATION_READJUDICATION)} />;

            case InterimCountState.POST_VALIDATION_READJUDICATION: {
                const hasCbiReAdjItems = appContext.caseService.cirReAdjudication.value.some(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                if (hasCbiReAdjItems) {
                    const cbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                        (item) => item?.response_type === "cbi_re_adjudication",
                    );
                    return (
                        <CIRCBIReadjudicationScreen
                            items={cbiReAdjItems}
                            onComplete={() => setState(InterimCountState.SCR_PENDING_WAIT)}
                            onBack={() => setState(InterimCountState.POST_VALIDATION_RESOLVE_READJ)}
                        />
                    );
                }
                return (
                    <CIRAdjudicationScreen
                        source="cirReAdjudication"
                        onComplete={() => setState(InterimCountState.SCR_PENDING_WAIT)}
                        onBack={() => setState(InterimCountState.POST_VALIDATION_RESOLVE_READJ)}
                    />
                );
            }

            case InterimCountState.SCR_COUNT_ENTRY:
                return (
                    <InterimCountScrCountEntry
                        initialCount={0}
                        onConfirm={async (count) => {
                            scrReportedCountRef.current = count;
                            await appContext.caseService.parlayInterface.caseManager.set_confirmed_total(count);
                            setState(InterimCountState.WAIT_SCR_COUNT_CONFIRM);
                        }}
                    />
                );

            case InterimCountState.WAIT_SCR_COUNT_CONFIRM:
                return <InterimCountWaitScrConfirm />;

            case InterimCountState.INTERIM_COUNT_DONE:
                return (
                    <CountReconciliationScreen
                        systemCount={remaining}
                        scrCount={scrReportedCountRef.current}
                        onOk={() => setState(InterimCountState.POST_INTERIM_COUNT)}
                    />
                );

            case InterimCountState.S2_CHECK_CBI_BOX:
                return (
                    <CheckCBIBoxScreen
                        overCount={scrReportedCountRef.current - remaining}
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        variant="interimSection2"
                        onCorrect={() => {
                            setState(InterimCountState.INTERIM_COUNT_DONE_EXTRA);
                        }}
                        onMismatch={() => setState(InterimCountState.S2_CBI_BOX_SELECTION)}
                    />
                );
            case InterimCountState.S2_CBI_BOX_SELECTION:
                return (
                    <CBIBoxSelectionScreen
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        onConfirm={(selectedTypes) => {
                            if (selectedTypes.length === 0) {
                                setState(InterimCountState.S2_CHECK_CBI_BOX);
                                return;
                            }
                            s2SelectedCompartments.current = selectedTypes;
                            s2TapResults.current = [];
                            setS2TapIndex(0);
                            setState(InterimCountState.S2_NEEDLE_TAP);
                        }}
                    />
                );
            case InterimCountState.S2_NEEDLE_TAP: {
                const types = s2SelectedCompartments.current;
                const currentType = types[s2TapIndex] as "broken" | "contaminated" | "incompatible";
                return (
                    <NeedleTapScreen
                        key={`s2-${currentType}`}
                        variant={currentType}
                        onConfirm={async (count, markers) => {
                            s2TapResults.current[s2TapIndex] = {
                                type: currentType,
                                count,
                                markers: markers.map((m) => ({ x: m.x, y: m.y, number: m.number, type: currentType })),
                            };
                            if (s2TapIndex + 1 < types.length) {
                                setS2TapIndex(s2TapIndex + 1);
                            } else {
                                const cbiImageResult = appContext.caseService.cbiImage.value;
                                const filename = cbiImageResult?.image_filename || "placeholder.png";
                                const naturalW = cbiImageResult?.imageNaturalWidth ?? 900;
                                const naturalH = cbiImageResult?.imageNaturalHeight ?? 875;
                                for (const result of s2TapResults.current) {
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
                                setState(InterimCountState.S2_WAIT_SCR_VALIDATIONS);
                            }
                        }}
                        onBack={() => {
                            if (s2TapIndex > 0) {
                                setS2TapIndex(s2TapIndex - 1);
                            } else {
                                setState(InterimCountState.S2_CBI_BOX_SELECTION);
                            }
                        }}
                    />
                );
            }
            case InterimCountState.S2_WAIT_SCR_VALIDATIONS:
                return <WaitForSCRValidations onComplete={resolveS2Exit} />;
            case InterimCountState.S2_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(InterimCountState.S2_CBI_READJUDICATION)} />;
            case InterimCountState.S2_CBI_READJUDICATION: {
                const cbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                return (
                    <CIRCBIReadjudicationScreen
                        items={cbiReAdjItems}
                        onComplete={() => setState(InterimCountState.S2_WAIT_SCR_VALIDATIONS)}
                        onBack={() => setState(InterimCountState.S2_RESOLVE_READJ)}
                    />
                );
            }

            // === Section 3 — "Under" (remaining > scrCount) ===
            // CBI correct → Section 7 (sterile field check)
            // CBI mismatch → selection → tap → SCR validation → resolveS3Exit:
            //   remaining === scrCount → INTERIM_COUNT_DONE (Section 1)
            //   remaining < scrCount  → S2_CHECK_CBI_BOX (Section 2 — overcorrected)
            //   remaining > scrCount  → S7_CHECK_STERILE_FIELD (Section 7)
            case InterimCountState.S3_CHECK_CBI_BOX:
                return (
                    <CheckCBIBoxScreen
                        overCount={remaining - scrReportedCountRef.current}
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        variant="interimSection3"
                        onCorrect={() => {
                            setState(InterimCountState.S7_CHECK_STERILE_FIELD);
                        }}
                        onMismatch={() => setState(InterimCountState.S3_CBI_BOX_SELECTION)}
                    />
                );
            case InterimCountState.S3_CBI_BOX_SELECTION:
                return (
                    <CBIBoxSelectionScreen
                        contaminatedCount={contaminatedNeedleCount}
                        brokenCount={brokenNeedleCount}
                        incompatibleCount={incompatibleNeedleCount}
                        onConfirm={(selectedTypes) => {
                            if (selectedTypes.length === 0) {
                                setState(InterimCountState.S3_CHECK_CBI_BOX);
                                return;
                            }
                            s3SelectedCompartments.current = selectedTypes;
                            s3TapResults.current = [];
                            setS3TapIndex(0);
                            setState(InterimCountState.S3_NEEDLE_TAP);
                        }}
                    />
                );
            case InterimCountState.S3_NEEDLE_TAP: {
                const s3Types = s3SelectedCompartments.current;
                const s3CurrentType = s3Types[s3TapIndex] as "broken" | "contaminated" | "incompatible";
                return (
                    <NeedleTapScreen
                        key={`s3-${s3CurrentType}`}
                        variant={s3CurrentType}
                        onConfirm={async (count, markers) => {
                            s3TapResults.current[s3TapIndex] = {
                                type: s3CurrentType,
                                count,
                                markers: markers.map((m) => ({
                                    x: m.x,
                                    y: m.y,
                                    number: m.number,
                                    type: s3CurrentType,
                                })),
                            };
                            if (s3TapIndex + 1 < s3Types.length) {
                                setS3TapIndex(s3TapIndex + 1);
                            } else {
                                const cbiImageResult = appContext.caseService.cbiImage.value;
                                const filename = cbiImageResult?.image_filename || "placeholder.png";
                                const naturalW = cbiImageResult?.imageNaturalWidth ?? 900;
                                const naturalH = cbiImageResult?.imageNaturalHeight ?? 875;
                                for (const result of s3TapResults.current) {
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
                                setState(InterimCountState.S3_WAIT_SCR_VALIDATIONS);
                            }
                        }}
                        onBack={() => {
                            if (s3TapIndex > 0) {
                                setS3TapIndex(s3TapIndex - 1);
                            } else {
                                setState(InterimCountState.S3_CBI_BOX_SELECTION);
                            }
                        }}
                    />
                );
            }
            case InterimCountState.S3_WAIT_SCR_VALIDATIONS:
                return <WaitForSCRValidations onComplete={resolveS3Exit} />;
            case InterimCountState.S3_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(InterimCountState.S3_READJUDICATION)} />;
            case InterimCountState.S3_READJUDICATION: {
                const s3CbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                return (
                    <CIRCBIReadjudicationScreen
                        items={s3CbiReAdjItems}
                        onComplete={() => setState(InterimCountState.S3_WAIT_SCR_VALIDATIONS)}
                        onBack={() => setState(InterimCountState.S3_RESOLVE_READJ)}
                    />
                );
            }

            case InterimCountState.SECTION_4:
                return (
                    <InterimCountScrCountEntry
                        initialCount={0}
                        onConfirm={async (count) => {
                            scrReportedCountRef.current = count;
                            await appContext.caseService.parlayInterface.caseManager.set_confirmed_total(count);
                            setState(InterimCountState.S4_WAIT_SCR);
                        }}
                    />
                );
            case InterimCountState.S4_WAIT_SCR:
                return <InterimCountWaitScrConfirm />;

            case InterimCountState.S5_BROKEN_QUESTION:
                return (
                    <BrokenQuestionScreen
                        onNo={() => {
                            s5BrokenHasFragment.current = false;
                            setState(InterimCountState.SECTION_5);
                        }}
                        onYes={() => {
                            s5BrokenHasFragment.current = true;
                            setState(InterimCountState.SECTION_5);
                        }}
                    />
                );
            case InterimCountState.SECTION_5:
                return (
                    <PlaceIntoCBIBoxScreen
                        variant={s5NeedleTypeRef.current}
                        brokenHasFragment={
                            s5NeedleTypeRef.current === "broken" ? s5BrokenHasFragment.current : undefined
                        }
                        onTakePhoto={() => {
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(InterimCountState.S5_CAPTURE_PLACEHOLDER);
                        }}
                        onBack={() => {
                            if (s5NeedleTypeRef.current === "broken") {
                                setState(InterimCountState.S5_BROKEN_QUESTION);
                            } else {
                                setState(InterimCountState.S7_NEEDLE_FOUND);
                            }
                        }}
                    />
                );
            case InterimCountState.S5_CAPTURE_PLACEHOLDER:
                return (
                    <CaptureNeedleImageScreen
                        variant={s5NeedleTypeRef.current}
                        onBack={() => setState(InterimCountState.SECTION_5)}
                    />
                );
            case InterimCountState.S5_PHOTO_CONFIRM:
                return (
                    <S4PhotoConfirmScreen
                        variant={s5NeedleTypeRef.current}
                        imageSrc={captureImageSrc}
                        onRetake={() => {
                            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(InterimCountState.S5_CAPTURE_PLACEHOLDER);
                        }}
                        onConfirm={() => setState(InterimCountState.S5_NEEDLE_TAP)}
                        onBack={() => {
                            appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                            appContext.caseService.cbiImage.set(null);
                            setCaptureImageSrc(null);
                            setState(InterimCountState.S5_CAPTURE_PLACEHOLDER);
                        }}
                    />
                );
            case InterimCountState.S5_NEEDLE_TAP:
                return (
                    <NeedleTapScreen
                        key={`s5-${s5NeedleTypeRef.current}`}
                        variant={s5NeedleTypeRef.current}
                        onConfirm={async (count, markers) => {
                            const cbiImageResult = appContext.caseService.cbiImage.value;
                            const filename = cbiImageResult?.image_filename || "placeholder.png";
                            const naturalW = cbiImageResult?.imageNaturalWidth ?? 900;
                            const naturalH = cbiImageResult?.imageNaturalHeight ?? 875;
                            const pixelMarkers = markers.map((m) => ({
                                x: (m.x / 100) * naturalW,
                                y: (m.y / 100) * naturalH,
                                number: m.number,
                                type: s5NeedleTypeRef.current,
                            }));
                            const brokenMissing =
                                s5NeedleTypeRef.current === "broken" ? !s5BrokenHasFragment.current : false;
                            await appContext.caseService.parlayInterface.caseManager.cbi_needles_counted(
                                s5NeedleTypeRef.current,
                                count,
                                filename,
                                0,
                                "",
                                true, // misplaced=true
                                brokenMissing,
                                pixelMarkers,
                                naturalW,
                                naturalH,
                                true,
                            );
                            setState(InterimCountState.S5_WAIT_SCR_VALIDATIONS);
                        }}
                        onBack={() => setState(InterimCountState.S5_PHOTO_CONFIRM)}
                    />
                );
            case InterimCountState.S5_WAIT_SCR_VALIDATIONS:
                return <WaitForSCRValidations onComplete={resolveS5PostValidation} />;
            case InterimCountState.S5_RESOLVE_READJ:
                return <ResolveCBIItems onResolve={() => setState(InterimCountState.S5_READJUDICATION)} />;
            case InterimCountState.S5_READJUDICATION: {
                const s5CbiReAdjItems = appContext.caseService.cirReAdjudication.value.filter(
                    (item) => item?.response_type === "cbi_re_adjudication",
                );
                return (
                    <CIRCBIReadjudicationScreen
                        items={s5CbiReAdjItems}
                        onComplete={() => setState(InterimCountState.S5_WAIT_SCR_VALIDATIONS)}
                        onBack={() => setState(InterimCountState.S5_RESOLVE_READJ)}
                    />
                );
            }

            case InterimCountState.INTERIM_COUNT_DONE_EXTRA:
                return (
                    <CountReconciliationScreen
                        systemCount={remaining}
                        scrCount={scrReportedCountRef.current}
                        onOk={() => {
                            const extra = scrReportedCountRef.current - remaining;
                            if (extra > 0) {
                                void appContext.caseService.parlayInterface.caseManager.increment_added_needle_count(
                                    extra,
                                    true,
                                );
                            }
                            setState(InterimCountState.POST_INTERIM_COUNT);
                        }}
                    />
                );

            // === Section 7 — Sterile field check (remaining > scrCount after S3) ===
            // "Suture Needle Not Found" → 7a (INTERIM_COUNT_DONE_REGISTERED — misplaced)
            // "Suture Needle Found" → Needle Found screen:
            //   Sterile zone → Section 4
            //   C/B/I → Section 5
            case InterimCountState.S7_CHECK_STERILE_FIELD:
                return (
                    <NeedleSterileFieldScreen
                        needleCount={remaining - scrReportedCountRef.current}
                        variant="interimRemaining"
                        onNeedleNotFound={() => setState(InterimCountState.INTERIM_COUNT_DONE_REGISTERED)}
                        onNeedleFound={() => setState(InterimCountState.S7_NEEDLE_FOUND)}
                    />
                );
            case InterimCountState.S7_NEEDLE_FOUND:
                return (
                    <NeedleFoundScreen
                        onSelectType={(type) => {
                            if (type === "sterile") {
                                setState(InterimCountState.SECTION_4);
                            } else {
                                s5NeedleTypeRef.current = type as "contaminated" | "broken" | "incompatible";
                                if (type === "broken") {
                                    setState(InterimCountState.S5_BROKEN_QUESTION);
                                } else {
                                    setState(InterimCountState.SECTION_5);
                                }
                            }
                        }}
                    />
                );
            case InterimCountState.S7_NEEDLE_REGISTERED:
                return null;

            case InterimCountState.INTERIM_COUNT_DONE_REGISTERED:
                return (
                    <CountReconciliationScreen
                        systemCount={remaining}
                        scrCount={scrReportedCountRef.current}
                        onOk={() => {
                            const misplaced = remaining - scrReportedCountRef.current;
                            if (misplaced > 0) {
                                void appContext.caseService.parlayInterface.caseManager.increment_misplaced_needles(
                                    misplaced,
                                );
                            }
                            setState(InterimCountState.POST_INTERIM_COUNT);
                        }}
                    />
                );

            case InterimCountState.POST_INTERIM_COUNT:
                // Rendered for one frame so the screenMap broadcast fires,
                // then the useEffect below navigates to dashboard.
                return null;
        }
    }

    const introPickers = state === InterimCountState.CHOOSE_REASON || state === InterimCountState.WHO_IS_REQUESTING;
    const showPipelineHeader =
        !introPickers &&
        state !== InterimCountState.CONFIRM &&
        state !== InterimCountState.RESOLVE_PENDING &&
        headerProps;

    return (
        <div className={styles.screenContainer}>
            {introPickers && (
                <TrackingHeader
                    title={t("interimCount.title")}
                    stage={3}
                    stageColor="rgba(129, 167, 255, 1)"
                    hideStageTracker
                    flipHelpAndAbort
                    onBack={handleIntroBack}
                    showHelp={true}
                    showAbortButton={true}
                    abortButtonLabel={t("infoBar.abortCase")}
                    onAbortCase={goDashboard}
                />
            )}
            {state === InterimCountState.RESOLVE_PENDING && (
                <TrackingHeader
                    title={t("interimCount.initiatedTitle")}
                    stage={3}
                    stageColor="rgba(129, 167, 255, 1)"
                    hideStageTracker
                    flipHelpAndAbort
                    onBack={handleResolvePendingBack}
                    showHelp={true}
                    showAbortButton={true}
                    abortButtonLabel={t("infoBar.abortCase")}
                    onAbortCase={goDashboard}
                />
            )}
            {showPipelineHeader && (
                <TrackingHeader
                    title={headerProps.title ? t(headerProps.title) : t("interimCount.interimTitle")}
                    stage={2}
                    stageColor="rgba(79, 226, 206, 1)"
                    flipHelpAndAbort
                    onBack={headerProps.onBack}
                    showHelp={headerProps.showHelp}
                    showAbortButton={true}
                    abortButtonLabel={t("infoBar.abortCase")}
                    onAbortCase={goDashboard}
                />
            )}
            <div className={state === InterimCountState.CONFIRM ? undefined : styles.content}>{renderContent()}</div>
        </div>
    );
};
