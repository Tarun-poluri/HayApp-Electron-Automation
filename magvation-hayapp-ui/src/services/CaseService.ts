import { MultiListenable } from "../util/Listenable";
import { ParlayWrapper } from "./ParlayWrapper";
import StaffService, { HayAppUser, HayAppUserType, Surgeon } from "./StaffService";

export interface OperatingRoom {
    id: string;
}

export interface ScannedSuturePack {
    suturePack: SuturePackInfo;
    scannedInTime: number;
}

export interface CaseSuture {
    fda_guid: number;
    num_packs: number;
    product_code: string;
    nomenclature: string; // Pre-formatted: "3-0 PROLENE SH"
    needles_per_pack: number;
    suture_needle_use: string[];
    suture_needle_category: string;
}

export interface SutureSheetItem {
    fda_gudid: number;
    suture_needle_use: string[];
    suture_needle_category: string;
    num_packs: number;
}

export interface SutureSheet {
    suture_sheet_id: string;
    case_type_id: string;
    facility_name: string;
    surgeon_id: string;
    date_created: string;
    cpt_codes?: string[];
    suture_sheet_items: SutureSheetItem[];
}

export interface SuturePackInfo {
    fda_guid: number;
    needle_name: string;
    product_code: string;
    suture_gauge: string;
    manufacturer: string;
    num_sutures: number;
    num_needles: number;
    image: string;
    suture_type: string;
    suture_length: string;
    suture_color: string;
    suture_style: string;
    needle_type: string;
    needle_size: string;
    needle_arc: string;
    needle_tip: string;
    suture_needle_use?: string[];
    suture_needle_category?: string;
}

export interface CaseType {
    case_type_id: string;
    name: string;
    cpt_code: string;
    is_primary: boolean;
    secondary_cpt_codes: string[];
}

export interface AdjudicationData {
    answer: "yes" | "no" | null;
    whatIsIt: "multiple" | "broken" | "not-needle" | null;
    dropdownValue: "Blade" | "K-Wire" | "Hypo" | "Other" | null;
    customItemInput: string;
    needleCount: number | null;
    hasOtherPiece: boolean | null;
    isConfirmed: boolean;
    timestamp?: Date;
    id?: string;
    imageNumber?: number;
}

export interface AnalyzeNeedleResult {
    id: string;
    needle_count: number;
    not_a_needle_count: number;
    object_count: number;
    error_string: string | null;
    response_type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: any;
    received_time?: string;
    image_number?: number;
    adjudication_reason?: string;
    hasOtherPiece?: boolean;
    other_custom_input?: string;
    adjudicated_needle_count?: number;
}

export interface HayScanResult {
    image_filename: string | null;
    received_time?: string;
    image_number?: number;
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
}

export interface CBINotificationSnapshot {
    contaminated: number;
    incompatible: number;
    broken: number;
    misplaced: number;
}

export type SCRNotificationType =
    | keyof CBINotificationSnapshot
    | "misplaced_count_updated"
    | "misplaced_found_nonsterile";

export interface NeedleImageCapturedData {
    image_number: number;
    received_time: string;
    image_filename_used: string;
}

export interface NeedleMarkerData {
    x: number;
    y: number;
    number: number;
    type: string;
}

export interface PendingCBIValidation {
    id: string;
    image_filename: string;
    type: string;
    count: number;
    source: string;
    received_time?: string;
    image_number?: number;
    misplaced?: boolean;
    markers?: NeedleMarkerData[];
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
    cir_confirmed?: boolean;
    // Fields present when source === "cbi_removed"
    previous_image_filename?: string;
    previous_image_number?: number;
    previous_received_time?: string;
    previous_markers?: NeedleMarkerData[];
    previousImageNaturalWidth?: number;
    previousImageNaturalHeight?: number;
    what_is_it?: string;
    other_input?: string;
}

export interface CBILastImageRecord {
    image_filename: string;
    markers: NeedleMarkerData[];
    imageNaturalWidth: number;
    imageNaturalHeight: number;
    image_number?: number;
    received_time?: string;
}

export interface NFCScanResult {
    success: boolean;
    user?: {
        user_id: string;
        first_name: string;
        last_name: string;
        email?: string;
        roles: string[];
    };
    logged_in_role?: string;
    uid: string;
    error?: string;
}

export interface ErrorEventData {
    title: string;
    msg: string;
    is_fatal?: boolean;
}

export default class CaseService {
    private static _instance: CaseService | undefined;

    static get instance(): CaseService {
        if (!this._instance) {
            this._instance = new CaseService();
        }

        return this._instance;
    }

    parlayInterface = ParlayWrapper.instance;

    loginStep = new MultiListenable<"CIR" | "SCR" | "DONE">("CIR");
    scannerAuthenticated = new MultiListenable<boolean>(false);
    restoreStateEnabled = new MultiListenable<boolean>(false);

    // Surgeon tracking
    surgeonCount = new MultiListenable<number>(0);
    firstSurgeonName = new MultiListenable<string>("");

    private _unsubscribers: (() => void)[] = [];

    constructor() {
        this._unsubscribers.push(this.listenForDashboardUpdates());
        this._unsubscribers.push(this.listenForCBIScanned());
        this._unsubscribers.push(this.listenForScannerAuthentication());
        this._unsubscribers.push(this.listenForSCRConfirmSuturePack());
        this._unsubscribers.push(this.listenForSCRConfirmedAdded());
        this._unsubscribers.push(this.listenForSuturePackScans());
        this._unsubscribers.push(this.listenForCBINotificationUpdates());
        this._unsubscribers.push(this.listenForNFCScans());
        this._unsubscribers.push(this.listenForNavigateToDashboard());
        this._unsubscribers.push(this.listenForErrorEvents());
        this._unsubscribers.push(this.listenForAllInOneErrors());
        this._unsubscribers.push(this.listenForErrorCleared());
        this._unsubscribers.push(this.listenForCurrentConfirmingPack());
        this._unsubscribers.push(this.listenForInterimCountStarted());
        this._unsubscribers.push(this.listenForNeedleImageCaptured());
    }

    async fetchRestoreStateConfig() {
        try {
            const response = await this.parlayInterface.caseManager.get_restore_state_enabled();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const enabled = typeof response === "boolean" ? response : ((response as any)?.CONTENTS?.RETURN ?? false);
            this.restoreStateEnabled.set(enabled);
            console.log(`State restoration is ${enabled ? "enabled" : "disabled"} in backend config`);
        } catch (error) {
            console.error("Failed to fetch restore_state config:", error);
            this.restoreStateEnabled.set(false);
        }
    }

    setRole(role: "CIR" | "SCR") {
        this.currentRole.set(role);

        // Only restore if enabled in backend config
        if (!this.restoreStateEnabled.value) {
            console.log("State restoration is disabled in backend config, skipping");
            return;
        }

        // Wait for parlay connection before restoring
        if (this.parlayInterface.isConnected.value) {
            this.restoreState();
        } else {
            const listener = (connected: boolean) => {
                if (connected) {
                    this.parlayInterface.isConnected.removeListener(listener);
                    this.restoreState();
                }
            };
            this.parlayInterface.isConnected.addListener(listener);
        }
    }

    async restoreState() {
        // Check if restoration is enabled in backend config
        if (!this.restoreStateEnabled.value) {
            console.log("State restoration is disabled in backend config");
            return;
        }

        const role = this.currentRole.value;
        if (!role) {
            console.log("Cannot restore state: role not set");
            return;
        }

        try {
            const restoredState = await this.parlayInterface.caseManager.get_restored_state();
            console.log("Fetched restored state:", restoredState);

            if (restoredState) {
                // Skip restoration if state is fresh (no meaningful data)
                if (restoredState.is_fresh) {
                    console.log("State is fresh, skipping restoration");
                    return;
                }

                const cirScreen = restoredState.current_cir_screen || "";
                const scrScreen = restoredState.current_scr_screen || "";

                console.log(`Restored screens: CIR=${cirScreen}, SCR=${scrScreen}`);

                this.restoredCirScreen.set(cirScreen);
                this.restoredScrScreen.set(scrScreen);
                this.startingCount.set(restoredState.starting_count || 0);
                this.addedNeedleCount.set(restoredState.added_needle_count || 0);

                this.restoredSurgeonId.set(restoredState.surgeon_id || "");
                this.restoredCirId.set(restoredState.cir_id || "");
                this.restoredScrId.set(restoredState.scr_id || "");

                console.log(
                    `Restored staff: surgeon=${restoredState.surgeon_id}, cir=${restoredState.cir_id}, scr=${restoredState.scr_id}`,
                );

                if (restoredState.cbi_notification_counts) {
                    this.cbiNotifications.set({
                        contaminated: restoredState.cbi_notification_counts.contaminated || 0,
                        incompatible: restoredState.cbi_notification_counts.incompatible || 0,
                        broken: restoredState.cbi_notification_counts.broken || 0,
                        misplaced: restoredState.cbi_notification_counts.misplaced || 0,
                    });
                }

                this.isRestored.set(true);
                console.log(`State restored for ${role}: CIR=${cirScreen}, SCR=${scrScreen}`);
            }
        } catch (error) {
            console.error("Failed to restore state:", error);
        }
    }

    dispose() {
        this._unsubscribers.forEach((unsub) => unsub());
        this._unsubscribers = [];
    }

    listenForNFCScans() {
        return this.parlayInterface.caseManager.nfc_scan((result) => {
            if (result.success && result.user) {
                // Convert string roles to HayAppUserType
                const convertedRoles: HayAppUserType[] = result.user.roles
                    .map((role) => {
                        if (role === "CIR") return HayAppUserType.Circulator;
                        if (role === "SCR") return HayAppUserType.ScrubNurse;
                        if (role === "ADMIN") return HayAppUserType.Admin;
                        return null;
                    })
                    .filter((role): role is HayAppUserType => role !== null);

                const hayAppUser: HayAppUser = {
                    user_id: result.user.user_id,
                    first_name: result.user.first_name,
                    last_name: result.user.last_name,
                    email: result.user.email || "",
                    roles: convertedRoles,
                    badge: result.uid,
                };

                if (result.logged_in_role === "CIR") {
                    this.circulator.set(hayAppUser);
                } else if (result.logged_in_role === "SCR") {
                    this.scrub.set(hayAppUser);
                }
            } else {
                console.error("Badge login failed:", result.error);
            }

            this.nfcScanResult.set(result);
        });
    }

    listenForSCRConfirmedAdded() {
        return this.parlayInterface.caseManager.scr_confirmed_event((value) => {
            this.scrConfirmAnswer.set(value);
            this.scrConfirmSuturePack.set(null);
            this.scrConfirming.set(false);
        });
    }

    listenForCBIScanned() {
        return this.parlayInterface.caseManager.cbi_scanned((result: HayScanResult) => {
            this.cbiImage.set(result);
        });
    }

    listenForScannerAuthentication() {
        // Listen for successful authentication
        const unsubscribeSuccess = this.parlayInterface.hayScanner.handshake_response(() => {
            this.scannerAuthenticated.set(true);
        });

        // Listen for authentication failures
        const unsubscribeError = this.parlayInterface.hayScanner.handshake_error(() => {
            this.scannerAuthenticated.set(false);
        });

        return () => {
            unsubscribeSuccess();
            unsubscribeError();
        };
    }
    listenForSCRConfirmSuturePack() {
        return this.parlayInterface.caseManager.scr_confirmed_suture_pack((suture_pack_info) => {
            this.scrConfirmSuturePack.set(suture_pack_info);
        });
    }

    listenForDashboardUpdates() {
        return this.parlayInterface.caseManager.update_dashboards((result) => {
            this.haystack.set(result.haystack_needles ?? 0);
            this.cirVerification.set(result.cir_verification ?? []);
            this.cirAdjudication.set(result.cir_adjudication ?? []);
            this.scrValidation.set(result.scr_validation ?? []);
            this.cirReAdjudication.set(result.cir_readjudication ?? []);
            this.haystackReasonCounts.set(result.haystack_reason_counts ?? {});
            this.misplaced.set(result.misplaced_needles ?? 0);
            this.wholeMisplaced.set(result.whole_misplaced_needles ?? 0);
            this.foundNonSterileCount.set(result.found_non_sterile_needles ?? 0);
            this.pendingCbiValidations.set(result.pending_cbi_validations ?? []);
            this.addedNeedleCount.set(result.added_needle_count ?? 0);
            this.interimAddedNeedleCount.set(result.interim_added_needle_count ?? 0);
            this.startingCount.set(result.starting_count ?? 0);
            this.incompatibleNeedleCount.set(result.incompatible_needle_count ?? 0);
            this.contaminatedNeedleCount.set(result.contaminated_needle_count ?? 0);
            this.brokenNeedleCount.set(result.broken_needle_count ?? 0);
            this.confirmed.set(result.confirmed ?? 0);

            // Update surgeon tracking
            if (result.surgeon_count !== undefined) {
                this.surgeonCount.set(result.surgeon_count);
            }
            if (result.first_surgeon_name !== undefined) {
                this.firstSurgeonName.set(result.first_surgeon_name);
            }

            // Set latest needle result from backend
            if (result.latest_needle_result !== undefined) {
                this.latestNeedleResult.set(result.latest_needle_result);
            }

            // Sync CBI image from backend (persisted in app_state, not transient event)
            if (result.last_cbi_image) {
                this.cbiImage.set(result.last_cbi_image);
            }

            // Sync last confirmed CBI image per type from backend (shared across CIR and SCR instances)
            if (result.last_cbi_images_by_type) {
                this.lastCbiImageByType.set(result.last_cbi_images_by_type);
            }

            // Sync stage from backend
            if (result.stage !== undefined) {
                this.stage.set(result.stage);
            }

            // Sync staff info from backend
            (async () => {
                if (result.surgeon_id) {
                    let surgeon = StaffService.instance.surgeonIndex.get(result.surgeon_id);
                    if (!surgeon) {
                        // Fallback: fetch from backend if not in local index (because of two renderer instances)
                        const allSurgeonsData = await this.parlayInterface.caseManager.get_surgeons();
                        const surgeonData = allSurgeonsData.find((s) => s.surgeon_id === result.surgeon_id);
                        if (surgeonData) {
                            surgeon = new Surgeon(surgeonData);
                            StaffService.instance.surgeonIndex.set(surgeon.surgeon_id, surgeon);
                        }
                    }
                    if (surgeon) {
                        this.surgeon.set(surgeon);
                    }
                }
                if (result.cir_id) {
                    let cir = StaffService.instance.hayAppIndex.get(result.cir_id);
                    if (!cir) {
                        // Fallback: fetch from backend if not in local index (because of two renderer instances)
                        const allUsersData = await this.parlayInterface.caseManager.get_hayapp_users();
                        const cirData = allUsersData.find((u) => u.user_id === result.cir_id);
                        if (cirData) {
                            cir = new HayAppUser(cirData);
                            StaffService.instance.hayAppIndex.set(cir.user_id, cir);
                        }
                    }
                    if (cir) {
                        this.circulator.set(cir);
                    }
                }
                if (result.scr_id) {
                    let scr = StaffService.instance.hayAppIndex.get(result.scr_id);
                    if (!scr) {
                        // Fallback: fetch from backend if not in local index (because of two renderer instances)
                        const allUsersData = await this.parlayInterface.caseManager.get_hayapp_users();
                        const scrData = allUsersData.find((u) => u.user_id === result.scr_id);
                        if (scrData) {
                            scr = new HayAppUser(scrData);
                            StaffService.instance.hayAppIndex.set(scr.user_id, scr);
                        }
                    }
                    if (scr) {
                        this.scrub.set(scr);
                    }
                }
            })();

            // Sync caseSutures from backend
            if (result.case_sutures) {
                this.caseSutures.set(result.case_sutures);
                this.caseSutureIndex.clear();
                result.case_sutures.forEach((item) => {
                    this.caseSutureIndex.set(item.fda_guid, item);
                });
            }
        });
    }

    listenForSuturePackScans() {
        return this.parlayInterface.caseManager.suture_pack_scanned((suturePackInfo) => {
            this.suturePackInfoMap.set({
                ...this.suturePackInfoMap.value,
                [suturePackInfo.fda_guid]: suturePackInfo,
            });
        });
    }

    listenForCBINotificationUpdates() {
        return this.parlayInterface.caseManager.cbi_notification_update((counts) => {
            this.cbiNotifications.set({
                contaminated: counts.contaminated ?? 0,
                incompatible: counts.incompatible ?? 0,
                broken: counts.broken ?? 0,
                misplaced: counts.misplaced ?? 0,
            });
        });
    }

    listenForNavigateToDashboard() {
        return this.parlayInterface.caseManager.navigate_to_dashboard((event) => {
            if (event.starting_count !== undefined) {
                this.startingCount.set(event.starting_count);
            }
        });
    }

    listenForNeedleImageCaptured() {
        return this.parlayInterface.caseManager.needle_image_captured((data) => {
            this.needleImageCaptured.set(data);
        });
    }

    listenForErrorEvents() {
        return this.parlayInterface.caseManager.error_event((data) => {
            this.errorEvent.set(data);
        });
    }

    listenForAllInOneErrors() {
        return this.parlayInterface.allInOne.error_event((data) => {
            this.errorEvent.set(data);
        });
    }

    listenForErrorCleared() {
        return this.parlayInterface.caseManager.error_cleared(() => {
            this.errorEvent.set(null);
        });
    }

    listenForCurrentConfirmingPack() {
        return this.parlayInterface.caseManager.current_confirming_pack_updated((caseSuture) => {
            this.currentConfirmingPack.set(caseSuture);
        });
    }
    listenForInterimCountStarted() {
        return this.parlayInterface.caseManager.interim_count_started(() => {
            this.interimCountStarted.set(true);
        });
    }

    listenForCaseCleared(callback: () => void) {
        return this.parlayInterface.caseManager.case_cleared(callback);
    }

    triggerCBINotification(type: keyof CBINotificationSnapshot, count = 1) {
        const current = this.cbiNotifications.value;
        const newCounts = {
            ...current,
            [type]: count === 0 ? 0 : (current[type] ?? 0) + count,
        };
        this.parlayInterface.caseManager.set_cbi_notifications(newCounts);
    }

    clearNFCScanResult() {
        this.nfcScanResult.set(null);
    }

    clearErrorEvent() {
        this.parlayInterface.caseManager.clear_error_event();
    }

    resetAllState() {
        // Reset all state to initial values
        this.loginStep.set("CIR");
        this.scannerAuthenticated.set(false);
        this.nfcScanResult.set(null);
        this.restoredSurgeonId.set("");
        this.restoredCirId.set("");
        this.restoredScrId.set("");
        this.currentRole.set(null);
        this.restoredCirScreen.set("");
        this.restoredScrScreen.set("");
        this.isRestored.set(false);
        this.incompatibleNeedleCount.set(0);
        this.contaminatedNeedleCount.set(0);
        this.brokenNeedleCount.set(0);
        this.pendingCbiValidations.set([]);
        this.cbiImage.set(null);
        this.operatingRoom.set(undefined);
        this.circulator.set(undefined);
        this.scrub.set(undefined);
        this.surgeon.set(undefined);
        this.suturePackInfo.set(null);
        this.suturePackInfoMap.set({});
        this.scannedSuturePacks.set([]);
        this.caseSutures.set([]);
        this.caseSutureIndex.clear();
        this.stage.set(1);
        this.shouldRestartCount.set(false);
        this.reloginRole.set(null);
        this.shouldReturnToCirSetup.set(false);
        this.skipRoleSelection.set(false);
        this.returnToCirStep.set(null);
        this.cirVerification.set([]);
        this.cirAdjudication.set([]);
        this.cirReAdjudication.set([]);
        this.scrValidation.set([]);
        this.scrConfirmSuturePack.set(null);
        this.scrNotification.set(null);
        this.latestNeedleResult.set(null);
        this.needleImageCaptured.set(null);
        this.haystack.set(0);
        this.haystackReasonCounts.set({});
        this.misplaced.set(0);
        this.wholeMisplaced.set(0);
        this.foundNonSterileCount.set(0);
        this.cbiNotifications.set({ contaminated: 0, incompatible: 0, broken: 0, misplaced: 0 });
        this.addedNeedleCount.set(0);
        this.interimAddedNeedleCount.set(0);
        this.startingCount.set(0);
        this.confirmed.set(0);
        this.currentConfirmingPack.set(null);
        this.interimCountStarted.set(false);
        this.isInterimCountValidation.set("");
        this.surgeonCount.set(0);
        this.firstSurgeonName.set("");
        this.lastCbiImageByType.set({});
    }

    nfcScanResult = new MultiListenable<NFCScanResult | null>(null);
    restoredSurgeonId = new MultiListenable<string>("");
    restoredCirId = new MultiListenable<string>("");
    restoredScrId = new MultiListenable<string>("");
    currentRole = new MultiListenable<"CIR" | "SCR" | null>(null);
    restoredCirScreen = new MultiListenable<string>("");
    restoredScrScreen = new MultiListenable<string>("");
    isRestored = new MultiListenable<boolean>(false);
    incompatibleNeedleCount = new MultiListenable<number>(0);
    contaminatedNeedleCount = new MultiListenable<number>(0);
    brokenNeedleCount = new MultiListenable<number>(0);
    pendingCbiValidations = new MultiListenable<PendingCBIValidation[]>([]);
    cbiImage = new MultiListenable<HayScanResult | null>(null);
    operatingRoom = new MultiListenable<OperatingRoom | undefined>(undefined);
    circulator = new MultiListenable<HayAppUser | undefined>(undefined);
    scrub = new MultiListenable<HayAppUser | undefined>(undefined);
    surgeon = new MultiListenable<Surgeon | undefined>(undefined);
    suturePackInfo = new MultiListenable<SuturePackInfo | null>(null);
    suturePackInfoMap = new MultiListenable<Record<number, SuturePackInfo>>({});
    scannedSuturePacks = new MultiListenable<ScannedSuturePack[]>([]);
    caseSutures = new MultiListenable<CaseSuture[]>([]);
    caseSutureIndex = new Map<number, CaseSuture>();
    stage = new MultiListenable<number>(1); //TODO: change to 1 after demos
    shouldRestartCount = new MultiListenable<boolean>(false);
    reloginRole = new MultiListenable<"CIR" | "SCR" | null>(null);
    shouldReturnToCirSetup = new MultiListenable<boolean>(false);
    skipRoleSelection = new MultiListenable<boolean>(false);
    returnToCirStep = new MultiListenable<string | null>(null);
    cirVerification = new MultiListenable<AnalyzeNeedleResult[]>([]);
    cirAdjudication = new MultiListenable<AnalyzeNeedleResult[]>([]);
    scrValidation = new MultiListenable<AnalyzeNeedleResult[]>([]);
    cirReAdjudication = new MultiListenable<AnalyzeNeedleResult[]>([]);
    haystack = new MultiListenable<number>(0);
    misplaced = new MultiListenable<number>(0);
    wholeMisplaced = new MultiListenable<number>(0);
    foundNonSterileCount = new MultiListenable<number>(0);
    confirmed = new MultiListenable<number>(0);
    addedNeedleCount = new MultiListenable<number>(0);
    interimAddedNeedleCount = new MultiListenable<number>(0);
    latestNeedleResult = new MultiListenable<AnalyzeNeedleResult | null>(null);
    needleImageCaptured = new MultiListenable<NeedleImageCapturedData | null>(null);
    haystackReasonCounts = new MultiListenable<Record<string, number>>({});
    cbiNotifications = new MultiListenable<CBINotificationSnapshot>({
        contaminated: 0,
        incompatible: 0,
        broken: 0,
        misplaced: 0,
    });
    scrConfirmSuturePack = new MultiListenable<SuturePackInfo | null>(null);
    scrConfirming = new MultiListenable<boolean>(false);
    scrConfirmAnswer = new MultiListenable<string>("");
    addedNeedleList = new MultiListenable<SuturePackInfo[]>([]);
    startingCount = new MultiListenable<number>(0); //TODO: change to 0 after demos
    scrNotification = new MultiListenable<SCRNotificationType | null>(null);
    scrLastImageState = new MultiListenable<"none" | "good" | "blank">("none");
    adjudicationStore = new MultiListenable<Record<string, AdjudicationData>>({});
    errorEvent = new MultiListenable<ErrorEventData | null>(null);
    currentConfirmingPack = new MultiListenable<CaseSuture | null>(null);
    interimCountStarted = new MultiListenable<boolean>(false);
    // Which closing count flow triggered SCR validation: "" (none), "main", "s1", "s2"
    isClosingCountValidation = new MultiListenable<string>("");
    // Which interim count flow triggered SCR validation: "" (none), "main", "s2", "s3", "s4", "s5"
    isInterimCountValidation = new MultiListenable<string>("");
    // Track current CIR setup step for surgeon flow coordination
    currentCirStep = new MultiListenable<string | null>(null);
    // Track packs scanned before a new procedure was added during/after pickup
    packsBeforeNewProcedure = new MultiListenable<number>(0);
    // Flag indicating we're showing only newly scanned packs after procedure addition
    showingNewProcedureOnly = new MultiListenable<boolean>(false);

    lastCbiImageByType = new MultiListenable<Record<string, CBILastImageRecord | null>>({});

    setLastCbiImage(type: string, record: CBILastImageRecord | null) {
        this.lastCbiImageByType.set({ ...this.lastCbiImageByType.value, [type]: record });
    }

    saveAdjudicationData(id: string, data: AdjudicationData) {
        const store = { ...this.adjudicationStore.value, [id]: data };
        this.adjudicationStore.set(store);
    }

    getAllAdjudications(): AdjudicationData[] {
        return Object.values(this.adjudicationStore.value);
    }

    getAdjudication(id: string): AdjudicationData | undefined {
        return this.adjudicationStore.value[id];
    }

    clearAdjudications() {
        this.adjudicationStore.set({});
    }

    getAddedNeedles = async (): Promise<SuturePackInfo[]> => {
        const needles = await this.parlayInterface.caseManager.get_added_needles();
        this.addedNeedleList.set(needles);
        return needles;
    };

    setStage(newStage: number) {
        this.stage.set(newStage);
    }

    setCBINotification(type: keyof CBINotificationSnapshot, count: number) {
        const current = this.cbiNotifications.value;
        this.cbiNotifications.set({
            ...current,
            [type]: count,
        });
    }

    async setCaseStaff(surgeonId: string, circulatorId: string, scrubId: string) {
        return await this.parlayInterface.caseManager.set_case_staff(surgeonId, circulatorId, scrubId);
    }

    async fetchAllCaseTypes() {
        return await this.parlayInterface.caseManager.get_case_types();
    }

    async initializeHaystack() {
        return await this.parlayInterface.caseManager.start_haystack();
    }

    async fetchSurgeonCaseTypes(surgeonId: string) {
        return await this.parlayInterface.caseManager.get_case_types_for_surgeon(surgeonId);
    }

    async onScanSuturePack(fda_guid: number): Promise<SuturePackInfo | void> {
        let info: SuturePackInfo | undefined = this.suturePackInfoMap.value[fda_guid];
        if (!info) {
            info = await this.parlayInterface.caseManager.get_suture_pack_info(fda_guid);
            if (info) {
                this.suturePackInfoMap.set({
                    ...this.suturePackInfoMap.value,
                    [fda_guid]: info,
                });
            }
        }
        return info || undefined;
    }

    async getSurgeons(): Promise<Surgeon[]> {
        const data = await this.parlayInterface.caseManager.get_surgeons();
        return data as Surgeon[]; // Backend returns compatible surgeon data
    }

    async getCaseTypes(): Promise<CaseType[]> {
        return await this.parlayInterface.caseManager.get_case_types();
    }

    async getCaseTypesForSurgeon(surgeonId: string): Promise<CaseType[]> {
        return await this.parlayInterface.caseManager.get_case_types_for_surgeon(surgeonId);
    }

    async getSutureSheet(sheetId: string): Promise<SutureSheet | undefined> {
        return await this.parlayInterface.caseManager.get_suture_sheet(sheetId);
    }

    async getSutureSheetsForSurgeon(surgeonId: string): Promise<SutureSheet[]> {
        return await this.parlayInterface.caseManager.get_suture_sheets_for_surgeon(surgeonId);
    }

    async getSuturePackInfo(fdaGuid: number): Promise<SuturePackInfo | undefined> {
        // Check cache first
        let info: SuturePackInfo | undefined = this.suturePackInfoMap.value[fdaGuid];
        if (!info) {
            // Fetch from backend if not in cache
            info = await this.parlayInterface.caseManager.get_suture_pack_info(fdaGuid);
            if (info) {
                // Update cache
                this.suturePackInfoMap.set({
                    ...this.suturePackInfoMap.value,
                    [fdaGuid]: info,
                });
            }
        }
        return info;
    }

    async surgeonHasSutureSheetForCpt(surgeonId: string, cptCode: string): Promise<boolean> {
        return await this.parlayInterface.caseManager.surgeon_has_suture_sheet_for_cpt(surgeonId, cptCode);
    }

    async setSelectedSutureSheets(sheetIds: string[]): Promise<boolean> {
        return await this.parlayInterface.caseManager.set_selected_suture_sheets(sheetIds);
    }

    async getSelectedSutureSheets(): Promise<SutureSheet[]> {
        return await this.parlayInterface.caseManager.get_selected_suture_sheets();
    }

    async calculateSummarySheetWithRedundancy(
        sutureSheetIds: string[],
        redundantAdjustments: Array<{
            product_code: string;
            suture_needle_use: string[];
            redundant_packs: number;
        }>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any[]> {
        return await this.parlayInterface.caseManager.calculate_summary_sheet_with_redundancy(
            sutureSheetIds,
            redundantAdjustments,
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getRedundantNeedleItems(caseGroups: string[][]): Promise<any[]> {
        return await this.parlayInterface.caseManager.get_redundant_needle_items(caseGroups);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getEnrichedSummaryItems(): Promise<any[]> {
        return await this.parlayInterface.caseManager.get_enriched_summary_items();
    }

    async setRedundantAdjustments(
        adjustments: Array<{ product_code: string; suture_needle_use: string[]; redundant_packs: number }>,
    ): Promise<boolean> {
        return await this.parlayInterface.caseManager.set_redundant_adjustments(adjustments);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async appendSheetsToEnrichedSummary(newSheetIds: string[]): Promise<any[]> {
        return await this.parlayInterface.caseManager.append_sheets_to_enriched_summary(newSheetIds);
    }

    /**
     * Calculate total scanned needles from all case sutures
     */
    getTotalScannedNeedles(): number {
        const sutures = this.caseSutures.value;
        return sutures.reduce((total, suture) => {
            return total + suture.needles_per_pack * suture.num_packs;
        }, 0);
    }
}
