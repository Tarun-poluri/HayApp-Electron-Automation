/**
 * The Base API for adapters
 */
export default class BaseAdapter {
    constructor() {
        this._listeners = []; // list of listeners to call with each message
    }
    /**
     * Send a message down the adapter
     * @param msg
     */
    send_msg(msg) {}

    /**
     * wait for a message to come through the adapter where callback evaluates to true
     * @param msgFilter
     */
    wait_for_msg(msgFilter) {
        return new Promise((resolve, reject) => {
            //push a listener that resolves the promise when the callback is true
            this._listeners.push((msg) => {
                if (msgFilter(msg)) {
                    resolve(msg);
                    return true;
                } else return false;
            });
        });
    }

    /**
     * Call a callback for every message that matches msgFilter
     * @param callback the callback to call with the msg
     * @returns a function to call to stop the callback
     */

    call_on_every_message(callback) {
        let cancelled = false;
        function canceller() {
            cancelled = true;
        }

        this._listeners.push((msg) => {
            // if we've been cancelled then return true to remove us from the listener list
            if (cancelled) return true;

            callback(msg);
            return false;
        });
        return canceller;
    }

    /**
     * Subscribe to a set of topics
     * @param topics - the topics to subscribe to
     */
    subscribe(topics) {}
}
