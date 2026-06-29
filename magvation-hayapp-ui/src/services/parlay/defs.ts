import { ParlayService } from ".";
import {
    CaseType,
    SuturePackInfo,
    SutureSheet,
    AnalyzeNeedleResult,
    PendingCBIValidation,
    HayScanResult,
    NFCScanResult,
    CaseSuture,
    ErrorEventData,
    CBILastImageRecord,
    NeedleImageCapturedData,
} from "../CaseService";
import { ParlayHayAppUserData, ParlaySurgeonData } from "../StaffService";

class ParlayDef {
    service: ParlayService;
    id!: number;

    constructor(service: ParlayService) {
        this.service = service;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand(method: string, args?: object): Promise<any> {
        return this.service.sendCommand(this.id, method, args);
    }
}

export interface AdjudicatedNeedle {
    id: string;
    reason: string;
}

export interface SCRValidationResult {
    id: string;
    reason: string;
    validation: "yes" | "no";
}

export class CaseManagerDefs extends ParlayDef {
    constructor(service: ParlayService) {
        super(service);
        this.id = 100;
    }

    version(): Promise<string> {
        return this.service.sendCommand(this.id, "version");
    }

    get_restore_state_enabled(): Promise<boolean> {
        return this.service.sendCommand(this.id, "get_restore_state_enabled");
    }

    get_development_mode(): Promise<boolean> {
        return this.service.sendCommand(this.id, "get_development_mode");
    }

    set_expected_login_role(role: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_expected_login_role", { role });
    }

    verify_login(email: string, password: string, role: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "verify_login", {
            email: email,
            password: password,
            role: role,
        });
    }
    logout_user(role: string): Promise<{
        success: boolean;
        at_least_one_still_logged_in: boolean;
        has_cir: boolean;
        has_scr: boolean;
        error?: string;
    }> {
        return this.sendCommand("logout_user", { role });
    }
    set_case_types(case_types: { case_type_id: string; name: string }[]): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_case_types", { case_types_list: case_types });
    }

    remove_case_type(case_type_id: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "remove_case_type", { case_type_id: case_type_id });
    }

    set_case_staff(surgeon_id: string, cir_id: string, scr_id: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_case_staff", {
            surgeon_id: surgeon_id,
            cir_id: cir_id,
            scr_id: scr_id,
        });
    }

    set_surgeons_with_case_types(
        surgeons_data: Array<{
            surgeon_id: string;
            case_groups: Array<{
                primary: {
                    case_type_id: string;
                    name: string;
                    cpt_code: string;
                    is_primary: boolean;
                    secondary_cpt_codes: string[];
                };
                addOns: Array<{
                    case_type_id: string;
                    name: string;
                    cpt_code: string;
                    is_primary: boolean;
                    secondary_cpt_codes: string[];
                }>;
            }>;
        }>,
    ): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_surgeons_with_case_types", {
            surgeons_data: surgeons_data,
        });
    }

    get_surgeons_with_case_types(): Promise<{
        surgeons: Array<{ surgeon_id: string; first_name: string; last_name: string }>;
        case_types: Array<{
            case_type_id: string;
            name: string;
            cpt_code: string;
            is_primary: boolean;
            secondary_cpt_codes: string[];
        }>;
    }> {
        return this.service.sendCommand(this.id, "get_surgeons_with_case_types", {});
    }

    add_bad_needle(image: string, amount: number, verified: boolean): Promise<boolean> {
        return this.service.sendCommand(this.id, "add_bad_needle", {
            image: image,
            amount: amount,
            verified: verified,
        });
    }

    add_interim_count(
        when: string,
        remaining_count: number,
        bad_needles_count: number,
        verified: boolean,
    ): Promise<boolean> {
        return this.service.sendCommand(this.id, "add_interim_count", {
            when: when,
            remaining_count: remaining_count,
            bad_needles_count: bad_needles_count,
            verified: verified,
        });
    }

    start_interim_count(): Promise<boolean> {
        return this.service.sendCommand(this.id, "start_interim_count", {});
    }

    add_relief_count(
        when: string,
        remaining_count: number,
        bad_needles_count: number,
        misplaced_count: number,
        remaining_verified: boolean,
        bad_needles_verified: boolean,
        total_needles_verified: boolean,
        relief_count_verified: boolean,
        cir_replaced: boolean,
        scr_replaced: boolean,
        cir_replacement_id: string,
        scr_replacement_id: string,
    ): Promise<boolean> {
        return this.service.sendCommand(this.id, "add_relief_count", {
            when: when,
            remaining_count: remaining_count,
            bad_needles_count: bad_needles_count,
            misplaced_count: misplaced_count,
            remaining_verified: remaining_verified,
            bad_needles_verified: bad_needles_verified,
            total_needles_verified: total_needles_verified,
            relief_count_verified: relief_count_verified,
            cir_replaced: cir_replaced,
            scr_replaced: scr_replaced,
            cir_replacement_id: cir_replacement_id,
            scr_replacement_id: scr_replacement_id,
        });
    }

    get_surgeons(): Promise<ParlaySurgeonData[]> {
        return this.service.sendCommand(this.id, "get_surgeons");
    }

    get_hayapp_users_by_role(role: string): Promise<ParlayHayAppUserData[]> {
        return this.service.sendCommand(this.id, "get_hayapp_users_by_role", { role: role });
    }

    get_hayapp_users(): Promise<ParlayHayAppUserData[]> {
        return this.service.sendCommand(this.id, "get_hayapp_users");
    }

    get_case_types(): Promise<CaseType[]> {
        return this.service.sendCommand(this.id, "get_case_types");
    }

    get_case_types_for_surgeon(surgeon_id: string): Promise<CaseType[]> {
        return this.service.sendCommand(this.id, "get_case_types_for_surgeon", { surgeon_id: surgeon_id });
    }

    get_surgeon_by_id(surgeon_id: string): Promise<ParlaySurgeonData | undefined> {
        return this.service.sendCommand(this.id, "get_surgeon_by_id", { surgeon_id: surgeon_id });
    }

    get_room_id(): Promise<string> {
        return this.service.sendCommand(this.id, "get_room_id");
    }

    get_suture_pack_info(fda_guid: number): Promise<SuturePackInfo | undefined> {
        return this.service.sendCommand(this.id, "get_suture_pack_info", { fda_guid: fda_guid });
    }

    get_suture_sheet(suture_sheet_id: string): Promise<SutureSheet | undefined> {
        return this.service.sendCommand(this.id, "get_suture_sheet", { suture_sheet_id: suture_sheet_id });
    }

    get_suture_sheets_for_surgeon(surgeon_id: string): Promise<SutureSheet[]> {
        return this.service.sendCommand(this.id, "get_suture_sheets_for_surgeon", { surgeon_id: surgeon_id });
    }

    get_surgeons_pack_and_needle_totals(): Promise<{ total_packs: number; total_needles: number }> {
        return this.service.sendCommand(this.id, "get_surgeons_pack_and_needle_totals");
    }

    surgeon_has_suture_sheet_for_cpt(surgeon_id: string, cpt_code: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "surgeon_has_suture_sheet_for_cpt", {
            surgeon_id: surgeon_id,
            cpt_code: cpt_code,
        });
    }

    set_selected_suture_sheets(sheet_ids: string[]): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_selected_suture_sheets", { sheet_ids: sheet_ids });
    }

    get_selected_suture_sheets(): Promise<SutureSheet[]> {
        return this.service.sendCommand(this.id, "get_selected_suture_sheets");
    }

    cir_verified_needles(complete_needles: string[], not_complete_needles: string[]): Promise<boolean> {
        return this.service.sendCommand(this.id, "cir_verified_needles", {
            complete_needles: complete_needles,
            not_complete_needles: not_complete_needles,
        });
    }

    cir_adjudicated_needles(adjudicated_needles: AdjudicatedNeedle[], source: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "cir_adjudicated_needles", {
            adjudicated_needles: adjudicated_needles,
            source: source,
        });
    }

    scr_validated_needles(validated_needles: SCRValidationResult[]): Promise<boolean> {
        return this.service.sendCommand(this.id, "scr_validated_needles", {
            validated_needles: validated_needles,
        });
    }

    cbi_needles_counted(
        type: string,
        count: number,
        image: string,
        image_number = 0,
        image_time = "",
        misplaced = false,
        markers: Array<{ x: number; y: number; number: number; type: string }> = [],
        image_natural_width = 900,
        image_natural_height = 875,
        cir_confirmed = false,
        extra = false,
        from_found_non_sterile = false,
    ): Promise<boolean> {
        return this.sendCommand("cbi_needles_counted", {
            type,
            count,
            image,
            image_number,
            image_time,
            misplaced,
            markers,
            image_natural_width,
            image_natural_height,
            cir_confirmed,
            extra,
            from_found_non_sterile,
        });
    }

    cbi_removed_confirmed(
        type: string,
        new_image: string,
        new_image_number = 0,
        new_image_time = "",
        new_markers: Array<{ x: number; y: number; number: number; type: string }> = [],
        new_image_natural_width = 0,
        new_image_natural_height = 0,
        previous_image = "",
        previous_image_number = 0,
        previous_image_time = "",
        previous_markers: Array<{ x: number; y: number; number: number; type: string }> = [],
        previous_image_natural_width = 0,
        previous_image_natural_height = 0,
        what_is_it = "",
        other_input = "",
    ): Promise<boolean> {
        return this.sendCommand("cbi_removed_confirmed", {
            type,
            new_image,
            new_image_number,
            new_image_time,
            new_markers,
            new_image_natural_width,
            new_image_natural_height,
            previous_image,
            previous_image_number,
            previous_image_time,
            previous_markers,
            previous_image_natural_width,
            previous_image_natural_height,
            what_is_it,
            other_input,
        });
    }

    cbi_removed_dismissed(id: string): Promise<boolean> {
        return this.sendCommand("cbi_removed_dismissed", { id });
    }

    cbi_needles_confirmed(ids: string[], confirmed: boolean): Promise<boolean> {
        return this.service.sendCommand(this.id, "cbi_needles_confirmed", {
            ids: ids,
            confirmed: confirmed,
        });
    }

    cbi_needles_re_adjudicated(
        needle_id: string,
        needle_type: string,
        count: number,
        image_filename: string,
        image_number: number,
        received_time: string,
        misplaced: boolean,
        markers: Array<{ x: number; y: number; number: number; type: string }>,
        imageNaturalWidth: number,
        imageNaturalHeight: number,
        extra = false,
    ): Promise<boolean> {
        return this.sendCommand("cbi_needles_re_adjudicated", {
            needle_id,
            needle_type,
            count,
            image_filename,
            image_number,
            received_time,
            misplaced,
            markers,
            imageNaturalWidth,
            imageNaturalHeight,
            extra,
        });
    }

    scr_confirmed_answer(suture_pack_info: SuturePackInfo, confirmed: boolean): Promise<boolean> {
        return this.service.sendCommand(this.id, "scr_confirmed_answer", {
            suture_pack_info: suture_pack_info,
            confirmed: confirmed,
        });
    }

    scr_confirm_suture_pack(suture_pack_info: SuturePackInfo): Promise<boolean> {
        return this.service.sendCommand(this.id, "scr_confirm_suture_pack", {
            suture_pack_info: suture_pack_info,
        });
    }

    set_current_confirming_pack(case_suture: CaseSuture): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_current_confirming_pack", {
            case_suture: case_suture,
        });
    }

    cir_count_mismatch(case_suture: CaseSuture): Promise<boolean> {
        return this.service.sendCommand(this.id, "cir_count_mismatch", {
            case_suture: case_suture,
        });
    }

    cir_confirmed_field_count(case_suture: CaseSuture, field_count: number, current_index: number): Promise<boolean> {
        return this.service.sendCommand(this.id, "cir_confirmed_field_count", {
            case_suture: case_suture,
            field_count: field_count,
            current_index: current_index,
        });
    }

    cir_confirmed_field_count_event(callback: () => void) {
        return this.service.onEvent(this.id, "CIR_CONFIRMED_FIELD_COUNT", callback);
    }

    scr_confirmed_field_count(confirmed: boolean): Promise<boolean> {
        return this.service.sendCommand(this.id, "scr_confirmed_field_count", { confirmed });
    }

    scr_confirmed_field_count_event(callback: (action: "next" | "complete" | "retry") => void) {
        return this.service.onEvent(this.id, "SCR_CONFIRMED_FIELD_COUNT", (value) => {
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value);
                    callback(parsed.action || "next");
                } catch {
                    callback("next");
                }
            } else if (value && typeof value === "object" && "action" in value) {
                callback((value as { action: "next" | "complete" | "retry" }).action);
            } else {
                callback("next");
            }
        });
    }

    get_field_count(): Promise<number> {
        return this.service.sendCommand(this.id, "get_field_count");
    }

    current_confirming_pack_updated(callback: (value: CaseSuture) => void) {
        return this.service.onEvent(this.id, "CURRENT_CONFIRMING_PACK_UPDATED", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    misplaced_needle_placed(): Promise<boolean> {
        return this.service.sendCommand(this.id, "misplaced_needle_placed");
    }

    decrement_added_needle_count(): Promise<boolean> {
        return this.service.sendCommand(this.id, "decrement_added_needle_count");
    }

    increment_added_needle_count(count: number, from_interim = false): Promise<boolean> {
        return this.service.sendCommand(this.id, "increment_added_needle_count", { count, from_interim });
    }

    reset_closing_count_verification(): Promise<boolean> {
        return this.service.sendCommand(this.id, "reset_closing_count_verification");
    }

    reset_cbi_confirmations(): Promise<boolean> {
        return this.service.sendCommand(this.id, "reset_cbi_confirmations");
    }

    undo_needle_scan(): Promise<boolean> {
        return this.service.sendCommand(this.id, "undo_needle_scan");
    }

    increment_misplaced_needles(count = 1): Promise<boolean> {
        return this.service.sendCommand(this.id, "increment_misplaced_needles", {
            count: count,
        });
    }

    decrement_misplaced_needles(count = 1): Promise<boolean> {
        return this.service.sendCommand(this.id, "decrement_misplaced_needles", {
            count: count,
        });
    }

    increment_found_non_sterile(count = 1): Promise<boolean> {
        return this.service.sendCommand(this.id, "increment_found_non_sterile", {
            count: count,
        });
    }

    decrement_found_non_sterile(count = 1): Promise<boolean> {
        return this.service.sendCommand(this.id, "decrement_found_non_sterile", {
            count: count,
        });
    }

    start_haystack(): Promise<boolean> {
        return this.service.sendCommand(this.id, "start_haystack");
    }

    reset_haystack(): Promise<boolean> {
        return this.service.sendCommand(this.id, "reset_haystack");
    }

    restart_count(): Promise<boolean> {
        return this.service.sendCommand(this.id, "restart_count");
    }

    haystack_post_test(): Promise<boolean> {
        return this.service.sendCommand(this.id, "haystack_post_test");
    }

    haytray_test(): Promise<boolean> {
        return this.service.sendCommand(this.id, "haytray_test");
    }

    cbi_scanned(callback: (value: HayScanResult) => void) {
        return this.service.onEvent(this.id, "SCANNER_CAMERA_RESULT", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    suture_pack_scanned(callback: (value: SuturePackInfo) => void) {
        return this.service.onEvent(this.id, "SUTURE_PACK_SCANNED", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    mock_datamatrix_scan_event(fdagudid = 10705031018662): Promise<boolean> {
        return this.service.sendCommand(this.id, "mock_datamatrix_scan_event", { fdagudid });
    }

    mock_needle_scan_event(): Promise<boolean> {
        return this.service.sendCommand(this.id, "mock_needle_scan_event");
    }

    remove_scanned_suture_pack(fda_guid: number): Promise<boolean> {
        return this.service.sendCommand(this.id, "remove_scanned_suture_pack", { fda_guid: fda_guid });
    }

    get_added_needles(): Promise<SuturePackInfo[]> {
        return this.service.sendCommand(this.id, "get_added_needles");
    }

    set_starting_count(starting_count: number): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_starting_count", { starting_count: starting_count });
    }

    set_haystack_count(haystack_count: number): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_haystack_count", { haystack_count: haystack_count });
    }

    send_mock_no_objects_event(): Promise<boolean> {
        return this.service.sendCommand(this.id, "send_mock_no_objects_event", {});
    }

    clear_latest_needle_result(): Promise<boolean> {
        return this.service.sendCommand(this.id, "clear_latest_needle_result", {});
    }

    clear_cbi_image(): Promise<boolean> {
        return this.service.sendCommand(this.id, "clear_cbi_image", {});
    }

    on_start_up(): Promise<boolean> {
        return this.service.sendCommand(this.id, "on_start_up", {});
    }

    set_current_cir_screen(screen: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_current_cir_screen", { screen });
    }

    set_current_scr_screen(screen: string, setLED = true): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_current_scr_screen", { screen, setLED });
    }

    scr_screen_changed(callback: (value: { screen: string }) => void) {
        return this.service.onEvent(this.id, "SCR_SCREEN_CHANGED", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    surgeon_editing_status_changed(callback: (value: { editing: boolean }) => void) {
        return this.service.onEvent(this.id, "SURGEON_EDITING_STATUS_CHANGED", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    notify_scr_surgeon_editing_started(): Promise<boolean> {
        return this.sendCommand("notify_scr_surgeon_editing_started", {});
    }

    notify_scr_surgeon_editing_ended(): Promise<boolean> {
        return this.sendCommand("notify_scr_surgeon_editing_ended", {});
    }

    cir_screen_changed(callback: (value: { screen: string }) => void) {
        return this.service.onEvent(this.id, "CIR_SCREEN_CHANGED", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    scr_confirmed_suture_pack(callback: (value: SuturePackInfo) => void) {
        return this.service.onEvent(this.id, "SCR_CONFIRM_SUTURE_PACK", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    interim_count_started(callback: () => void) {
        return this.service.onEvent(this.id, "INTERIM_COUNT_STARTED", () => {
            callback();
        });
    }

    set_cbi_notifications(counts: {
        contaminated?: number;
        incompatible?: number;
        broken?: number;
        misplaced?: number;
    }): Promise<boolean> {
        return this.sendCommand("set_cbi_notifications", counts);
    }

    cbi_notification_update(
        callback: (value: { contaminated: number; incompatible: number; broken: number; misplaced: number }) => void,
    ) {
        return this.service.onEvent(this.id, "CBI_NOTIFICATION_UPDATE", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    update_dashboards(
        callback: (result: {
            haystack_needles: number;
            cir_verification: AnalyzeNeedleResult[];
            cir_adjudication: AnalyzeNeedleResult[];
            scr_validation: AnalyzeNeedleResult[];
            cir_readjudication: AnalyzeNeedleResult[];
            haystack_reason_counts: Record<string, number>;
            misplaced_needles: number;
            whole_misplaced_needles: number;
            found_non_sterile_needles: number;
            pending_cbi_validations: PendingCBIValidation[];
            added_needle_count: number;
            interim_added_needle_count: number;
            starting_count: number;
            incompatible_needle_count: number;
            contaminated_needle_count: number;
            broken_needle_count: number;
            confirmed: number;
            case_sutures: CaseSuture[];
            stage: number;
            surgeon_id: string;
            cir_id: string;
            scr_id: string;
            latest_needle_result: AnalyzeNeedleResult | null;
            last_cbi_image: HayScanResult | null;
            last_cbi_images_by_type: Record<string, CBILastImageRecord | null>;
            surgeon_count: number;
            first_surgeon_name: string;
        }) => void,
    ) {
        return this.service.onEvent(this.id, "DASHBOARD_UPDATE", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value as never);
                }
            } else if (value != null && typeof value === "object") {
                callback(value as never);
            }
        });
    }

    get_restored_state(): Promise<{
        is_fresh: boolean;
        current_cir_screen: string;
        current_scr_screen: string;
        cbi_notification_counts: {
            contaminated: number;
            incompatible: number;
            broken: number;
            misplaced: number;
        };
        starting_count: number;
        added_needle_count: number;
        surgeon_id: string;
        cir_id: string;
        scr_id: string;
    }> {
        return this.sendCommand("get_restored_state", {});
    }

    clear_case(): Promise<boolean> {
        return this.service.sendCommand(this.id, "clear_case");
    }

    clear_surgeon(): Promise<boolean> {
        return this.service.sendCommand(this.id, "clear_surgeon");
    }

    clear_case_types(): Promise<boolean> {
        return this.service.sendCommand(this.id, "clear_case_types");
    }

    clear_suture_sheets(): Promise<boolean> {
        return this.service.sendCommand(this.id, "clear_suture_sheets");
    }

    scr_confirmed_event(callback: (value: string) => void) {
        return this.service.onEvent(this.id, "SCR_CONFIRMED_ADDED", (value) => {
            if (typeof value === "string") {
                callback(value);
            }
        });
    }

    nfc_scan(callback: (value: NFCScanResult) => void) {
        return this.service.onEvent(this.id, "NFC_UID_SCANNED", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback({ success: false, uid: value, error: "Invalid response format" });
                }
            }
        });
    }

    set_confirmed_total(total: number): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_confirmed_total", { total });
    }

    get_confirmed_total(): Promise<number> {
        return this.service.sendCommand(this.id, "get_confirmed_total");
    }

    get_total_scanned_needles(): Promise<number> {
        return this.service.sendCommand(this.id, "get_total_scanned_needles");
    }

    scr_confirm_total(confirmed: boolean): Promise<boolean> {
        return this.service.sendCommand(this.id, "scr_confirm_total", { confirmed });
    }

    scr_total_confirmation_event(callback: (data: { confirmed: boolean; validation_status: string }) => void) {
        return this.service.onEvent(this.id, "SCR_TOTAL_CONFIRMATION", (value) => {
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value);
                    callback(parsed);
                } catch (error) {
                    console.error("Failed to parse SCR_TOTAL_CONFIRMATION event:", error);
                }
            }
        });
    }

    complete_setup(skip = false): Promise<boolean> {
        return this.service.sendCommand(this.id, "complete_setup", { skip });
    }
    skip_to_stage_2(): Promise<{
        success: boolean;
        cir_name?: string;
        scr_name?: string;
        surgeon_name?: string;
        error?: string;
    }> {
        return this.service.sendCommand(this.id, "skip_to_stage_2");
    }
    navigate_to_dashboard(callback: (value: { starting_count: number }) => void) {
        return this.service.onEvent(this.id, "NAVIGATE_TO_DASHBOARD", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set_enriched_summary_items(items: any[]): Promise<boolean> {
        return this.service.sendCommand(this.id, "set_enriched_summary_items", { items });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get_enriched_summary_items(): Promise<any[]> {
        return this.sendCommand("get_enriched_summary_items");
    }

    set_redundant_adjustments(
        adjustments: Array<{
            product_code: string;
            suture_needle_use: string[];
            redundant_packs: number;
        }>,
    ): Promise<boolean> {
        return this.sendCommand("set_redundant_adjustments", { adjustments });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    append_sheets_to_enriched_summary(new_sheet_ids: string[]): Promise<any[]> {
        return this.sendCommand("append_sheets_to_enriched_summary", { new_sheet_ids });
    }

    calculate_summary_sheet_with_redundancy(
        suture_sheet_ids: string[],
        redundant_adjustments: Array<{
            product_code: string;
            suture_needle_use: string[];
            redundant_packs: number;
        }>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any[]> {
        return this.sendCommand("calculate_summary_sheet_with_redundancy", {
            suture_sheet_ids,
            redundant_adjustments,
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get_redundant_needle_items(case_groups: string[][]): Promise<any[]> {
        return this.sendCommand("get_redundant_needle_items", { case_groups });
    }

    case_cleared(callback: () => void) {
        return this.service.onEvent(this.id, "CASE_CLEARED", () => {
            callback();
        });
    }

    clear_error_event(): Promise<boolean> {
        return this.service.sendCommand(this.id, "clear_error_event");
    }

    error_cleared(callback: () => void) {
        return this.service.onEvent(this.id, "ERROR_CLEARED", () => {
            callback();
        });
    }

    error_event(callback: (value: ErrorEventData) => void) {
        return this.service.onEvent(this.id, "ERROR_EVENT", (value) => {
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value);
                    callback(parsed);
                } catch {
                    callback(value as unknown as ErrorEventData);
                }
            }
        });
    }

    needle_image_captured(callback: (value: NeedleImageCapturedData) => void) {
        return this.service.onEvent(this.id, "NEEDLE_IMAGE_CAPTURED", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value as unknown as NeedleImageCapturedData);
                }
            } else if (typeof value === "object" && value !== null) {
                callback(value as NeedleImageCapturedData);
            }
        });
    }

    itrace_scan_result(callback: (value: { code_type: string; code_data: string }) => void) {
        return this.service.onEvent(this.id, "ITRACE_SCAN_RESULT", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value as unknown as { code_type: string; code_data: string });
                }
            } else if (typeof value === "object") {
                callback(value as { code_type: string; code_data: string });
            }
        });
    }
}

export class HayScannerDefs extends ParlayDef {
    constructor(service: ParlayService) {
        super(service);
        this.id = 400;
    }

    version(): Promise<string> {
        return this.service.sendCommand(this.id, "version");
    }

    suture_pack_info(callback: (value: SuturePackInfo) => void) {
        return this.service.onEvent(this.id, "suture_pack_info", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    closing_box_scan(callback: (value: string) => void) {
        return this.service.onEvent(this.id, "closing_box_scan", (value) => {
            if (typeof value === "string") {
                callback(value);
            }
        });
    }

    open_data_matrix_scanner(timeout: number, mode: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "open_data_matrix_scanner", { timeout, mode });
    }

    open_itrace_scanner(timeout: number, mode: string): Promise<boolean> {
        return this.service.sendCommand(this.id, "open_itrace_scanner", { timeout, mode });
    }

    open_camera(timeout: number): Promise<boolean> {
        return this.service.sendCommand(this.id, "open_camera", { timeout });
    }

    close_active_screen(): Promise<boolean> {
        return this.service.sendCommand(this.id, "close_active_screen");
    }

    handshake_response(callback: (value: { challenge_response: string }) => void) {
        return this.service.onEvent(this.id, "handshake_response", (value) => {
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value);
                    callback(parsed);
                } catch (e) {
                    console.error("Failed to parse handshake_response:", e);
                }
            } else if (typeof value === "object") {
                callback(value);
            }
        });
    }

    handshake_error(callback: (value: { error: string }) => void) {
        return this.service.onEvent(this.id, "handshake_error", (value) => {
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value);
                    callback(parsed);
                } catch (e) {
                    console.error("Failed to parse handshake_error:", e);
                }
            } else if (typeof value === "object") {
                callback(value);
            }
        });
    }

    scanner_error(callback: (value: { screen_type: string; error_message: string }) => void) {
        return this.service.onEvent(this.id, "scanner_error", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch (e) {
                    console.error("Failed to parse scanner_error:", e);
                }
            } else if (typeof value === "object") {
                callback(value as { screen_type: string; error_message: string });
            }
        });
    }
}

export type HaystackButtonEvent = { button: string };

export class HayStackDefs extends ParlayDef {
    constructor(service: ParlayService) {
        super(service);
        this.id = 300;
    }

    version(): Promise<string> {
        return this.service.sendCommand(this.id, "version");
    }

    button_pressed(callback: (button: HaystackButtonEvent) => void) {
        return this.service.onEvent(this.id, "stack_button", (button) => {
            if (typeof button === "string") {
                try {
                    callback(JSON.parse(button));
                } catch {
                    callback(button);
                }
            }
        });
    }

    needle_event(callback: (event: string) => void) {
        return this.service.onEvent(this.id, "stack_needle", (event) => {
            if (typeof event === "string") {
                try {
                    callback(JSON.parse(event));
                } catch {
                    callback(event);
                }
            }
        });
    }

    tray_event(callback: (event: { event: string }) => void) {
        return this.service.onEvent(this.id, "stack_tray", (event) => {
            console.log("Received tray event:", event);
            if (typeof event === "string") {
                try {
                    callback(JSON.parse(event));
                } catch {
                    callback(event);
                }
            }
        });
    }

    connection_event(callback: (value: { connected: boolean; new_haystack: boolean }) => void) {
        return this.service.onEvent(this.id, "haystack_connection", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    haystack_post_result(
        callback: (value: {
            status_byte: number;
            vin_pass: boolean;
            motor_pass: boolean;
            tower_cap_pass: boolean;
            rotation_pass: boolean;
        }) => void,
    ) {
        return this.service.onEvent(this.id, "haystack_post_status", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    haytray_test_result(callback: (value: { success: boolean }) => void) {
        return this.service.onEvent(this.id, "haytray_test", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value);
                }
            }
        });
    }

    error_event(callback: (value: ErrorEventData) => void) {
        return this.service.onEvent(this.id, "ERROR_EVENT", (value) => {
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value);
                    callback(parsed);
                } catch {
                    callback(value);
                }
            }
        });
    }
}

export class AllInOneDefs extends ParlayDef {
    constructor(service: ParlayService) {
        super(service);
        this.id = 1100;
    }

    error_event(callback: (value: ErrorEventData) => void) {
        return this.service.onEvent(this.id, "ERROR_EVENT", (value) => {
            if (typeof value === "string") {
                try {
                    callback(JSON.parse(value));
                } catch {
                    callback(value as unknown as ErrorEventData);
                }
            }
        });
    }
}

export class iTraceDefs extends ParlayDef {
    constructor(service: ParlayService) {
        super(service);
        this.id = 600;
    }

    analyze_needle(
        callback: (result: {
            id: string;
            needle_count: number;
            error_string: string | null;
            response_type: string;
            not_a_needle_count: number;
            object_count: number;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            results: any;
            received_time?: string;
            image_number?: number;
        }) => void,
    ) {
        return this.service.onEvent(this.id, "IMAGE_EVENT", (result) => {
            if (typeof result === "string") {
                try {
                    callback(JSON.parse(result));
                } catch {
                    callback({
                        id: "",
                        needle_count: 0,
                        error_string: "Invalid JSON from backend",
                        response_type: "",
                        not_a_needle_count: 0,
                        object_count: 0,
                        results: {},
                    });
                }
            }
        });
    }
}
