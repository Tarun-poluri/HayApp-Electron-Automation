import { MultiListenable } from "../util/Listenable";
import { ParlayWrapper } from "./ParlayWrapper";

export enum HayAppUserType {
    ScrubNurse,
    Circulator,
    Admin,
}

export const HayAppUserTypeMap = new Map<HayAppUserType, string>([
    [HayAppUserType.ScrubNurse, "SCR"],
    [HayAppUserType.Circulator, "CIR"],
    [HayAppUserType.Admin, "Admin"],
]);

export function hayAppUserTypeToEnum(type: string): HayAppUserType | undefined {
    for (const [key, value] of HayAppUserTypeMap.entries()) {
        if (value === type) {
            return key;
        }
    }

    return undefined;
}

export interface ParlaySurgeonData {
    surgeon_id: string;
    first_name: string;
    last_name: string;
    cyphermed_user_id?: string;
}

export class Surgeon {
    surgeon_id: string;
    first_name: string;
    last_name: string;
    cyphermed_user_id: string;

    constructor(parlayData: ParlaySurgeonData) {
        console.log("Creating Surgeon from parlay data:", parlayData);
        this.surgeon_id = parlayData.surgeon_id;
        this.first_name = parlayData.first_name || "";
        this.last_name = parlayData.last_name || "";
        this.cyphermed_user_id = parlayData.cyphermed_user_id || "";
    }
}

export interface ParlayHayAppUserData {
    user_id: string;
    first_name: string;
    last_name: string;
    email?: string;
    roles: string[];
    badge?: string;
}

export class HayAppUser {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    roles: HayAppUserType[];
    badge?: string;

    constructor(parlayData: ParlayHayAppUserData) {
        console.log("Creating HayAppUser from parlay data:", parlayData);
        this.user_id = parlayData.user_id;
        this.first_name = parlayData.first_name;
        this.last_name = parlayData.last_name;
        this.email = parlayData.email || "";
        this.roles = parlayData.roles
            .map((role: string) => hayAppUserTypeToEnum(role))
            .filter((role: HayAppUserType | undefined) => role !== undefined) as HayAppUserType[];
        this.badge = parlayData.badge;
    }
}

export default class StaffService {
    private static _instance: StaffService | undefined;

    static get instance(): StaffService {
        if (!this._instance) {
            this._instance = new StaffService();
        }

        return this._instance;
    }

    parlayInterface = ParlayWrapper.instance;

    hayAppUsers = new MultiListenable<HayAppUser[]>([]);
    hayAppIndex = new Map<string, HayAppUser>();
    surgeons = new MultiListenable<Surgeon[]>([]);
    surgeonIndex = new Map<string, Surgeon>();

    private _isInitialized = false;
    private _initPromise: Promise<void> | null = null;

    async init() {
        // If already initialized, return immediately
        if (this._isInitialized) {
            return;
        }

        // If initialization is in progress, wait for it
        if (this._initPromise) {
            return this._initPromise;
        }

        // Start initialization
        this._initPromise = this.syncWithLocal().then(() => {
            this._isInitialized = true;
            this._initPromise = null;
        });

        return this._initPromise;
    }

    constructor() {}

    async syncWithLocal() {
        const rawHayAppUsers = await this.parlayInterface.caseManager.get_hayapp_users();

        console.log("Fetched HayAppUsers from Parlay:", rawHayAppUsers);
        const newHayAppUsers = rawHayAppUsers.map((item: ParlayHayAppUserData) => new HayAppUser(item));

        this.hayAppIndex.clear();
        for (let i = 0; i < newHayAppUsers.length; i++) {
            this.hayAppIndex.set(newHayAppUsers[i].user_id, newHayAppUsers[i]);
        }
        this.hayAppUsers.set(newHayAppUsers);

        const rawSurgeons = await this.parlayInterface.caseManager.get_surgeons();

        console.log("Fetched surgeons from Parlay:", rawSurgeons);
        const newSurgeons = rawSurgeons.map((item: ParlaySurgeonData) => new Surgeon(item));

        this.surgeonIndex.clear();
        for (let i = 0; i < newSurgeons.length; i++) {
            this.surgeonIndex.set(newSurgeons[i].surgeon_id, newSurgeons[i]);
        }
        this.surgeons.set(newSurgeons);
    }

    async getHash(password: string): Promise<string> {
        const hash = await window.crypto.subtle.digest("SHA-512", new TextEncoder().encode(password));
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    async loginHayAppUser(user: HayAppUser, password: string, role: HayAppUserType): Promise<boolean> {
        const roleStr = HayAppUserTypeMap.get(role);
        if (!roleStr) return false;
        return await this.parlayInterface.caseManager.verify_login(user.email, password, roleStr);
    }

    async getHayAppUsersByRole(role: HayAppUserType): Promise<HayAppUser[]> {
        const roleStr = HayAppUserTypeMap.get(role);
        if (!roleStr) {
            return [];
        }

        const hayAppUserData = await this.parlayInterface.caseManager.get_hayapp_users_by_role(roleStr);
        const hayAppUserList = hayAppUserData.map((item: ParlayHayAppUserData) => new HayAppUser(item));

        this.hayAppIndex.clear();
        for (let i = 0; i < hayAppUserList.length; i++) {
            this.hayAppIndex.set(hayAppUserList[i].user_id, hayAppUserList[i]);
        }
        this.hayAppUsers.set(hayAppUserList);

        return hayAppUserList;
    }
}
