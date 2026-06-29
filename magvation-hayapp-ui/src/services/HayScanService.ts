import { MultiListenable } from "../util/Listenable";
import { ParlayWrapper } from "./ParlayWrapper";

//TODO: Can probably remove this file once iTrace scanning is hooked up

export enum State {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
}

export default class HayScanService {
    private static _instance: HayScanService | undefined;

    static get instance(): HayScanService {
        if (!this._instance) {
            this._instance = new HayScanService();
        }
        return this._instance;
    }

    constructor() {
        ParlayWrapper.instance.isConnected.addListener((isConnected) => {
            if (isConnected) {
                this.setupListeners();
            }
        });
    }

    closingBoxScan = new MultiListenable<string | null>(null);

    setupListeners() {
        ParlayWrapper.instance.hayScanner.closing_box_scan((value) => {
            this.closingBoxScan.set(value);
        });
    }

    scannedRoom = new MultiListenable<string | undefined>(undefined);

    async scanRoom() {
        const roomId = await ParlayWrapper.instance.caseManager.get_room_id();
        this.scannedRoom.set(roomId);
    }
}
