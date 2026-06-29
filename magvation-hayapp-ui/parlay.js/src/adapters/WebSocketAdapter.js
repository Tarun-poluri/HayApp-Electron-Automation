import BaseAdapter from "./BaseAdapter.js";
import { get_discovery } from "../items/Item.js";

let debugLogs = true;

export function enableDebugLogs(enabled) {
    debugLogs = enabled;
}

export var states = {
    NOT_CONNECTED: "NOT_CONNECTED",
    CONNECTING: "CONNECTING",
    CONNECTED: "CONNECTED",
    DISCONNECTING: "DISCONNECTING",
};

/**
 * Websocket client implementation of an Adapter. Connects to a parlay system through Websocket text-based connection
 */
export default class WebSocketAdapter extends BaseAdapter {
    constructor(url, protocols, auto_connect) {
        super();
        this._dev_id = undefined;
        this._state = states.NOT_CONNECTED;
        this._send_on_connect = []; //send this when we connect
        this._listeners = []; // list of listeners to call with each message
        this._onConnectedListeners = [];
        this._onDisconnectedListeners = [];
        this.auto_connect = auto_connect !== false; //default to true
        this.connect_retry_delay = 1000; //attempt to reconnect every second

        if (this.auto_connect) {
            this.connect(url, protocols);
            //attempt to re-connect
            this.onDisconnected(() => {
                setTimeout(() => {
                    debugLogs && console.log("Parlay connection lost -- attempting to reconnect");
                    this.connect(url, protocols);
                }, this.connect_retry_delay);
            });
        }

        //add the Discovery listener to the listener list.
        this._listeners.push((msg) => {
            if (msg.TOPICS && msg.TOPICS.type === "get_protocol_discovery") {
                this.send_msg({
                    TOPICS: { type: "get_protocol_discovery_response" },
                    CONTENTS: { discovery: get_discovery() },
                });
            }
            return false; //never remove always be listenering
        });
    }

    connect = (url, protocols) => {
        if (this._state !== states.NOT_CONNECTED) throw "Already connected to Websocket. Cannot connect again.";
        this._websocket = new WebSocket(url, protocols);

        //on new data call our listeners
        this._websocket.onmessage = (event) => {
            let msg = JSON.parse(event.data);
            {
                try {
                    //let msg = JSON.parse(mydata);
                    //go through and remove all of the ones that return true
                    for (let i = this._listeners.length - 1; i >= 0; i--) {
                        try {
                            if (this._listeners[i](msg)) this._listeners.splice(i, 1);
                        } catch (e) {
                            console.log(e + "\n" + JSON.stringify(msg));
                        }
                    }
                } catch (e) {
                    console.log("Couldn't parse message" + e);
                }
            }
        };

        this._websocket.onopen = (data) => {
            this._state = states.CONNECTED;

            //subscribe to all broadcast messages
            this.subscribe({ TX_TYPE: "BROADCAST" });

            //send all of the queued messages now that we're connected
            for (let i = 0; i < this._send_on_connect.length; i++) {
                this.send_msg(this._send_on_connect[i]);
            }
            //call any registered event listeners
            let listeners = this._onConnectedListeners;
            //iterate backwords because they might remove themselves
            for (let j = listeners.length - 1; j >= 0; j--) {
                listeners[j](data);
            }
        };

        this._websocket.onclose = (data) => {
            this._state = states.NOT_CONNECTED;
            //call any registered event listeners
            let listeners = this._onDisconnectedListeners;
            for (let j = listeners.length - 1; j >= 0; j--) {
                listeners[j](data);
            }
        };

        // return a promise that will resolve when connected
        return new Promise((resolve, reject) => {
            let canceller = () => {};
            canceller = this.onConnected(() => {
                resolve();
                canceller();
            });
        });
    };

    /**
     * Set Handler for on Disconnected
     * @param func
     */
    onDisconnected = (func) => {
        this._onDisconnectedListeners.push(func);

        return () => {
            var index = this._onDisconnectedListeners.indexOf(func);
            this._onDisconnectedListeners.splice(index, 1);
        };
    };

    onConnected = (func) => {
        this._onConnectedListeners.push(func);

        return () => {
            var index = this._onConnectedListeners.indexOf(func);
            this._onConnectedListeners.splice(index, 1);
        };
    };
    /**
     * Get the current state of the adapter (e.g. CONNECTED)
     * @returns {string|*}
     */
    get state() {
        return this._state;
    }

    /**
     * Disconnect to a device
     * @param dev_id
     * @returns {Promise}
     */
    disconnect = () => {
        this._state = states.NOT_CONNECTED;
        this._websocket.close();
    };

    /**
     * Send a message down the adapter
     * @param msg
     * @returns {Promise}
     */
    send_msg = (msg) => {
        if (this.state === states.CONNECTED) {
            return this._websocket.send(JSON.stringify(msg));
        } else {
            this._send_on_connect.push(msg);
        }
    };

    subscribe = (topics) => {
        let msg = { TOPICS: { type: "subscribe" }, CONTENTS: { TOPICS: topics } };

        this.send_msg(msg);
    };
}
