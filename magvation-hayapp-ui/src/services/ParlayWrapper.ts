import { MultiListenable } from "../util/Listenable";
import { AllInOneDefs, CaseManagerDefs, HayScannerDefs, HayStackDefs, iTraceDefs } from "./parlay/defs";
import ParlayService from "./parlay/index";

const TIMEOUT_ERROR_MS = 60000;

export class ParlayWrapper {
    private static _instance: ParlayWrapper | undefined;

    static get instance(): ParlayWrapper {
        if (!this._instance) {
            this._instance = new ParlayWrapper();
        }

        return this._instance;
    }

    caseManager = new CaseManagerDefs(ParlayService);
    hayScanner = new HayScannerDefs(ParlayService);
    hayStack = new HayStackDefs(ParlayService);
    iTrace = new iTraceDefs(ParlayService);
    allInOne = new AllInOneDefs(ParlayService);

    private errorTimeout: NodeJS.Timeout | undefined;
    private _callStartup = true;

    isConnected = new MultiListenable<boolean>(false);

    private async handleBrokerConnect(): Promise<void> {
        console.log("parlay connected");
        if (this.isConnected.value) {
            console.log("parlay already connected");
            return;
        }

        this.isConnected.set(true);
        clearTimeout(this.errorTimeout);
        this.errorTimeout = undefined;
        if (this._callStartup) {
            this.caseManager.on_start_up().catch((err) => console.error("on_start_up failed:", err));
        }
    }

    private async handleBrokerDisconnect(): Promise<void> {
        console.log("parlay disconnected");
        if (this.isConnected.value) {
            this.isConnected.set(false);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onBroadcastEvent(eventName: string, callback: (info: any, fromId: string | number) => void): () => void {
        return ParlayService.onBroadcastEvent(eventName, callback);
    }

    start(callStartup = true) {
        this._callStartup = callStartup;
        this.errorTimeout = setTimeout(() => {
            this.isConnected.set(false);
        }, TIMEOUT_ERROR_MS);

        if (!this.isConnected.value) {
            ParlayService.connectToBroker(
                () => {
                    this.handleBrokerConnect();
                },
                () => {
                    this.handleBrokerDisconnect();
                },
            );
        }
    }
}
