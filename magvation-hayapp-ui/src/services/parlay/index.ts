// Disable no-explicit-any in this file because we do not know which file types parlay will send back to us.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebSocketAdapter } from "parlay-js";
import { registerParlayItem } from "parlay-js";

import { DEV_MODE, DEVICE_ADDRESS } from "../../defs/devMode";

const BrokerAddress = DEV_MODE ? DEVICE_ADDRESS : window.location.hostname;

const url =
    window.location.protocol === "https:" ? "wss://" + BrokerAddress + ":16186" : "ws://" + BrokerAddress + ":16185";

const COMMAND_TIMEOUT_MS = 5000;

type TPyId = string | number;
type TParlayItemHandler = any;
type TWebSocketAdapter = any;
type TCommandName = string | number;
type TPropertyName = string | number;
type TStreamName = string | number;
type TArgs = object;
type TTimeout = number;

export type TCancelStreamCallback = null | ((sendStopMessage?: boolean) => void);
export type TOnCartridgeErrorChange = (error: string) => void;
export type TOnHandheldFirmwareVersionChanged = (handheldFirmwareVersion: string) => void;
export const functionNotSet = (): void => console.warn("Function not set");

// --- START: dynamic screen change dev workaround (HMR WebSocket persistence) ---
// Persists the WebSocketAdapter on window so Vite HMR reloads reuse the
// existing connection instead of creating a new one (which crashes React).
// To revert: comment out this block and uncomment the original ParlayAdapter below.
const HMR_KEY = "__parlay_ws_adapter__";
function getOrCreateAdapter(): TWebSocketAdapter {
    const existing = (window as any)[HMR_KEY];
    if (existing) return existing;
    const adapter = new WebSocketAdapter(url, undefined, true);
    (window as any)[HMR_KEY] = adapter;
    return adapter;
}
class ParlayAdapter {
    public static WEBSOCKET_ADAPTER: TWebSocketAdapter = getOrCreateAdapter();
}
// --- END: dynamic screen change dev workaround ---

// --- Original ParlayAdapter (uncomment to revert) ---
// class ParlayAdapter {
//     public static WEBSOCKET_ADAPTER: TWebSocketAdapter = new WebSocketAdapter(url, undefined, true);
// }

export class ParlayService {
    private static ID = window.location.pathname.includes("secondary") ? "magvation_react_scr" : "magvation_react";

    // tslint:disable:variable-name
    private __itemHandle: TParlayItemHandler;

    private __ensureHandle() {
        if (!this.__itemHandle) {
            throw new Error("ParlayService is not connected. Call connectToBroker() first.");
        }
    }

    sendCommand(
        pyId: TPyId,
        commandName: TCommandName,
        args: TArgs = {},
        timeout: TTimeout = COMMAND_TIMEOUT_MS,
    ): Promise<any> {
        this.__ensureHandle();
        return this.__itemHandle.send_command(pyId, commandName, args, timeout);
    }

    setProperty(pyId: TPyId, propertyName: TPropertyName, value: any): Promise<any> {
        return this.__itemHandle.set_property(pyId, propertyName, value, COMMAND_TIMEOUT_MS);
    }

    getProperty(pyId: TPyId, propertyName: TPropertyName): Promise<any> {
        return this.__itemHandle.get_property(pyId, propertyName, COMMAND_TIMEOUT_MS);
    }

    stream(pyId: TPyId, streamName: TStreamName, callback: (result: any) => void): TCancelStreamCallback {
        return this.__itemHandle.stream(pyId, streamName, callback);
    }

    public connectToBroker(handleConnected: any, handleDisconnected: any): void {
        this.__itemHandle = registerParlayItem(
            this,
            ParlayAdapter.WEBSOCKET_ADAPTER,
            "react." + ParlayService.ID,
            ParlayService.ID,
        );
        ParlayAdapter.WEBSOCKET_ADAPTER.onConnected(handleConnected);
        ParlayAdapter.WEBSOCKET_ADAPTER.onDisconnected(handleDisconnected);

        // --- START: macOS dev workaround (HMR-safe connect) ---
        // Checks adapter state before connecting. If already connected (from HMR
        // reload or auto_connect), fires callback immediately instead of throwing.
        // To revert: comment out this block and uncomment the original connect() below.
        if (ParlayAdapter.WEBSOCKET_ADAPTER._state === "CONNECTED") {
            handleConnected();
        } else if (ParlayAdapter.WEBSOCKET_ADAPTER._state === "NOT_CONNECTED") {
            ParlayAdapter.WEBSOCKET_ADAPTER.connect(url);
        }
        // --- END: macOS dev workaround ---

        // --- Original connect (uncomment to revert) ---
        // ParlayAdapter.WEBSOCKET_ADAPTER.connect(url);
    }

    onEvent(pyId: TPyId, eventName: string, callback: (count: number) => void): () => void {
        return ParlayAdapter.WEBSOCKET_ADAPTER.call_on_every_message((msg: any) => {
            if (msg.TOPICS.FROM == pyId && msg.CONTENTS.EVENT == eventName) {
                callback(msg.CONTENTS.INFO);
            }
        });
    }

    onBroadcastEvent(eventName: string, callback: (info: any, fromId: TPyId) => void): () => void {
        return ParlayAdapter.WEBSOCKET_ADAPTER.call_on_every_message((msg: any) => {
            if (msg.TOPICS.MSG_TYPE === "EVENT" && msg.CONTENTS.EVENT == eventName) {
                callback(msg.CONTENTS.INFO, msg.TOPICS.FROM);
            }
        });
    }
}

export default new ParlayService();
