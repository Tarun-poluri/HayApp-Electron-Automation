import BluetoothSerial from "promenade-react-native-bluetooth-serial";
import BaseAdapter from "./BaseAdapter.js";
import { get_discovery } from "../items/Item.js";

export var states = {
    NOT_CONNECTED: "NOT_CONNECTED",
    CONNECTING: "CONNECTING",
    CONNECTED: "CONNECTED",
    DISCONNECTING: "DISCONNECTING",
};
/**
 * Bluetooth client implementation of an Adapter. Connects to a parlay system through Bluetooth serial connection
 */
export default class BluetoothAdapter extends BaseAdapter {
    constructor() {
        super();
        this._dev_id = undefined;
        this._state = states.NOT_CONNECTED;
        this._send_on_connect = []; //send this when we connect
        this._onDisconnected = () => {};
        this._onConnected = () => {};

        BluetoothSerial.subscribe("\n"); //subscribe to new-line delimited messages
        //on new data call our listeners
        BluetoothSerial.on("data", (data) => {
            // have to use setTimeout here because we are NOT in the javascript eventloop and order gets weird.
            //setTimeout for 0 seconds in the future puts us in the event loop
            try {
                let msg = JSON.parse(data.data);
                //go through and remove all of the ones that return true
                for (let i = this._listeners.length - 1; i >= 0; i--) {
                    try {
                        if (this._listeners[i](msg)) this._listeners.splice(i, 1);
                    } catch (e) {
                        alert(e);
                    }
                }
            } catch (e) {
                console.log("Couldn't parse message" + e);
            }
        });

        BluetoothSerial.on("connectionSuccess", (data) => {
            this._state = states.CONNECTED;
            this._onConnected();
        });

        BluetoothSerial.on("connectionLost", (data) => {
            this._state = states.NOT_CONNECTED;
            this._onDisconnected();
        });

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

        //see if we're already connected to a device
        this.isConnected().then(function (connected) {
            if (connected) {
                this._state = states.CONNECTED;
                this._onConnected();
            }
        });

        //subscribe to all broadcast messages
        this.subscribe({ TX_TYPE: "BROADCAST" });
    }

    /**
     * Set Handler for on Disconnected
     * @param func
     */
    onDisconnected = (func) => (this._onDisconnected = func);
    onConnected = (func) => (this._onConnected = func);
    /**
     * Get the current state of the adapter (e.g. CONNECTED)
     * @returns {string|*}
     */
    get state() {
        return this._state;
    }

    /**
     *  Get the list of all bluetooth devices in the area
     * @returns {Promise}
     */
    list() {
        return BluetoothSerial.list();
    }

    /**
     * By default the iOS layer of BLE will heartbeat for you, if you pass true, it will enable it. False will disable
     * it. By default this is enabled.
     * @param enabled True if the heartbeat should be done by the iOS layer
     * @returns None.
     */
    setHeartbeatFeatureiOS(enabled) {
        BluetoothSerial.setHeartbeatFeature(enabled);
    }

    /**
     * Get the list of all unpaired bluetooth devices in the area (Android only)
     * list() does not return unpaired devices for Android
     * @returns {Promise}
     */
    unpairedDevicesAndroid() {
        try {
            return BluetoothSerial.discoverUnpairedDevices();
        } catch (e) {
            console.log(
                [
                    e.message,
                    "Could not get list of unparied devices for Android.",
                    "Make sure you are not calling this function from another platform.",
                ].join("\n"),
            );
        }
    }

    /**
     * Connect to a device
     * @param dev_id
     * @returns {Promise}
     */
    connect = (dev_id) => {
        this._state = states.CONNECTING;
        return new Promise((resolve, reject) => {
            BluetoothSerial.connect(dev_id)
                .then((res) => {
                    this._dev_id = dev_id;
                    this._state = states.CONNECTED;
                    //send all of the queued messages now that we're connected
                    for (let i = 0; i < this._send_on_connect.length; i++) {
                        this.send_msg(this._send_on_connect[i]);
                    }
                    resolve(res);
                })
                .catch((e) => {
                    this._state = states.NOT_CONNECTED;
                    reject(e);
                });
        });
    };

    /**
     * Disconnect to a device
     * @param dev_id
     * @returns {Promise}
     */
    disconnect = () => {
        this._state = states.DISCONNECTING;
        return new Promise((resolve, reject) => {
            BluetoothSerial.disconnect()
                .then((res) => {
                    this._dev_id = undefined;
                    this._state = states.NOT_CONNECTED;
                    resolve(res);
                })
                .catch((e) => {
                    this._state = states.NOT_CONNECTED;
                    reject(e);
                });
        });
    };

    /**
     * returns if a device is already connected
     * @param dev_id
     * @returns {Promise}
     */
    isConnected = () => {
        return new Promise((resolve, reject) => {
            BluetoothSerial.isConnected()
                .then((res) => {
                    resolve(res);
                })
                .catch((e) => {
                    reject(e);
                });
        });
    };

    /**
     * Send a message down the adapter
     * @param msg
     * @returns {Promise}
     */
    send_msg = (msg) => {
        if (this._state !== states.CONNECTED) {
            throw "Cannot send. Not currently connected to any device\n" + this._state;
        }
        return BluetoothSerial.write(JSON.stringify(msg) + "\n");
    };

    subscribe = (topics) => {
        let msg = { TOPICS: { type: "subscribe" }, CONTENTS: { TOPICS: topics } };
        this._send_on_connect.push(msg); //add it to the list so when we re-connect (or initially connect) we'll send it
        //if we're connected to a device, then just send the subscription message
        if (this._dev_id) {
            this.send_msg(msg);
        }
    };
}
