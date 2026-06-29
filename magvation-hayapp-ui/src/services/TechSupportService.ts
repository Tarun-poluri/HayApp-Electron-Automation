import ParlayService from "./parlay/index";

interface LoginResult {
    success: boolean;
    access_token?: string;
    error?: string;
}

interface ProvisionResult {
    success: boolean;
    api_key?: string;
    error?: string;
}

interface SyncGroupDataResult {
    success: boolean;
    surgeons?: number;
    hayapp_users?: number;
    case_types?: number;
    suture_sheets?: number;
    suture_packs?: number;
    error?: string;
}

interface SyncProgressResult {
    active: boolean;
    stage: string;
    message: string;
    percent: number | null;
}

export class TechSupportService {
    private static _instance: TechSupportService | undefined;
    private techSupportItemId: number | null = null;
    private readonly TECH_SUPPORT_ITEM_ID = 1000; // From defs.py
    // Cloud sync can include multiple network requests and file downloads.
    // Give cloud sync up to five minutes (default Parlay command timeout is 5s).
    private readonly SYNC_GROUP_DATA_TIMEOUT_MS = 300_000;

    static get instance(): TechSupportService {
        if (!this._instance) {
            this._instance = new TechSupportService();
        }
        return this._instance;
    }

    async login(username: string, password: string): Promise<LoginResult> {
        try {
            const result = await ParlayService.sendCommand(this.TECH_SUPPORT_ITEM_ID, "tech_support_login", {
                username,
                password,
            });
            return {
                success: result.success || false,
                access_token: result.access_token,
                error: result.error,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    async provision(serialNumber: string): Promise<ProvisionResult> {
        try {
            const result = await ParlayService.sendCommand(this.TECH_SUPPORT_ITEM_ID, "provision_device", {
                serial_number: serialNumber,
            });
            return {
                success: result.success || false,
                api_key: result.api_key,
                error: result.error,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    async isProvisioned(): Promise<{
        is_provisioned: boolean;
        has_api_key: boolean;
        has_group_id: boolean;
        group_data_access_denied: boolean;
    }> {
        try {
            console.log(`Sending is_provisioned command to item ${this.TECH_SUPPORT_ITEM_ID}`);
            const result = await ParlayService.sendCommand(this.TECH_SUPPORT_ITEM_ID, "is_provisioned", {});
            console.log("is_provisioned result received:", result);
            return {
                is_provisioned: result.is_provisioned || false,
                has_api_key: result.has_api_key || false,
                has_group_id: result.has_group_id || false,
                group_data_access_denied: result.group_data_access_denied || false,
            };
        } catch (error) {
            console.error("is_provisioned command failed:", error);
            return {
                is_provisioned: false,
                has_api_key: false,
                has_group_id: false,
                group_data_access_denied: false,
            };
        }
    }

    async getDeviceSerialNumber(): Promise<{ serial_number: string }> {
        try {
            console.log(`Sending get_device_serial_number command to item ${this.TECH_SUPPORT_ITEM_ID}`);
            const result = await ParlayService.sendCommand(this.TECH_SUPPORT_ITEM_ID, "get_device_serial_number", {});
            console.log("get_device_serial_number result received:", result);
            return {
                serial_number: result.serial_number || "",
            };
        } catch (error) {
            console.error("get_device_serial_number command failed:", error);
            return {
                serial_number: "",
            };
        }
    }

    async syncGroupData(): Promise<SyncGroupDataResult> {
        try {
            const result = await ParlayService.sendCommand(
                this.TECH_SUPPORT_ITEM_ID,
                "sync_group_data",
                {},
                this.SYNC_GROUP_DATA_TIMEOUT_MS,
            );
            return {
                success: result.success || false,
                surgeons: result.surgeons,
                hayapp_users: result.hayapp_users,
                case_types: result.case_types,
                suture_sheets: result.suture_sheets,
                suture_packs: result.suture_packs,
                error: result.error,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    async getSyncProgress(): Promise<SyncProgressResult> {
        try {
            const raw = await ParlayService.getProperty(this.TECH_SUPPORT_ITEM_ID, "sync_progress");
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            return {
                active: Boolean(parsed?.active),
                stage: String(parsed?.stage ?? ""),
                message: String(parsed?.message ?? ""),
                percent: typeof parsed?.percent === "number" ? parsed.percent : null,
            };
        } catch {
            return {
                active: false,
                stage: "",
                message: "",
                percent: null,
            };
        }
    }
}
