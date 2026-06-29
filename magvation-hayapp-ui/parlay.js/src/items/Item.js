/**
 * Function argument reflection as used by angular
 * @type {RegExp}
 */
const FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
const FN_ARG_SPLIT = /,/;
const FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;

/**
 * Generate a list of parameters for this function (using fn.$inject if set)
 * @param fn - the function to parse
 * @returns {*} list of argument names
 */
function formalParameterList(fn) {
    //modification here. Do the $inject
    if (fn.$inject !== undefined) return fn.$inject;
    let fnText, argDecl;
    let args = [];
    fnText = fn.toString().replace(STRIP_COMMENTS, "");
    argDecl = fnText.match(FN_ARGS);
    if (argDecl == null) return []; //if we have no arguments return an empty list
    let r = argDecl[1].split(FN_ARG_SPLIT);
    for (let a in r) {
        let arg = r[a];
        arg.replace(FN_ARG, function (all, underscore, name) {
            args.push(name);
        });
    }
    //cache this so we don't need to do it again
    fn.$inject = args;
    return args;
}

let last_msg_id = 200;
/**
 * Generate  a 16 bit msg ID
 * @returns {number}
 */
export function generate_msg_id() {
    return last_msg_id++ % 65535;
}

//! Map of items from id->meta-info
export var items = new Map();

/**
 * Register a Parlay item with an adapter to be discovered
 * @param item
 */
export function registerParlayItem(obj, adapter, id, name) {
    //default name to ID
    name = name || id;
    items.set(id, { object: obj, id: id, name: name, adapter: adapter });
    //construct and return the handle.
    return new ParlayItemHandle(adapter, id, name, obj);
}

export function promiseTimeout(promise, timeout_ms) {
    let timerId = undefined;
    let settleRace = null;
    let cleanupPromise = () => {
        clearTimeout(timerId);
        settleRace();
    };
    return Promise.race([
        promise,
        new Promise(function (resolve, reject) {
            settleRace = resolve;
            // set the timeout
            timerId = setTimeout(function () {
                reject("Timed Out");
            }, timeout_ms);
        }),
    ])
        .then((result) => {
            // promise was resolved; cancel timeout and resolve race promise
            cleanupPromise();
            return result;
        })
        .catch((reason) => {
            // promise was rejected; cancel timeout and rethrow the reason
            cleanupPromise();
            throw reason;
        });
}

/***
 * Get the discovery information for all of the registered items
 */
export function get_discovery() {
    let discovery = [];
    //foreach item that has been registered
    items.forEach((value, key, map) => {
        //basic item discovery info
        let item_disc = {
            ID: key,
            NAME: value.name,
            //we are a sub-template of ParlayStandardItem
            TYPE: "ReactItemParlayStandardItem/ParlayStandardItem",
            DATASTREAMS: [],
            PROPERTIES: [],
            CONTENT_FIELDS: [],
        };

        let commands = new Map();
        //add the properties of the object to discovery

        let item = value.object;

        // do while loop will get all members except for builtins like __proto__
        do {
            if (item.constructor !== Object) {
                for (let member of Object.getOwnPropertyNames(item)) {
                    if (member === "constructor" || member.slice(0, 2) === "__") continue;

                    // we dont need to do a check for hasOwnProperty on the member because
                    // that handling is already done in getOwnPropertyNames
                    switch (typeof item[member]) {
                        case "number":
                        case "string":
                        default:
                            let descriptor = Object.getOwnPropertyDescriptor(item, member);

                            let read_only = (!!descriptor.get && !descriptor.set) || descriptor.writable === false;
                            let write_only = !!descriptor.set && !descriptor.get; //if we have a set but no get, the we're write_only

                            let entry = {
                                PROPERTY: member,
                                STREAM: member,
                                PROPERTY_NAME: member,
                                READ_ONLY: read_only,
                                WRITE_ONLY: write_only,
                                INPUT: typeof item[member] === "number" ? "NUMBER" : "STRING",
                            };

                            item_disc.PROPERTIES.push(entry);
                            item_disc.DATASTREAMS.push(entry);
                            break;
                        case "function":
                            if (member !== "constructor") commands.set(member, item[member]);
                            break;
                    }
                }
            }
        } while ((item = Object.getPrototypeOf(item)));

        //now take the commands and build the discovery object
        let command_name_list = Array.from(commands.keys());
        item_disc.CONTENT_FIELDS.push({
            INPUT: "DROPDOWN",
            MSG_KEY: "COMMAND",
            LABEL: "command",
            DROPDOWN_OPTIONS: command_name_list.map((command_name) => [command_name, command_name]),
            DROPDOWN_SUB_FIELDS: command_name_list.map(function (fn_name) {
                return formalParameterList(commands.get(fn_name)).map((arg_name) => {
                    return {
                        MSG_KEY: arg_name,
                        INPUT: "STRING",
                    };
                });
            }),
        });

        discovery.push(item_disc);
    });

    return discovery;
}

/**
 *  Send a command to a Parlay Item
 * @param adapter
 * @param from
 * @param to
 * @param command
 * @param args
 * @param recv_callback A callback method that will be called with every message response (e.g. progress & complete)
 * @param sent_callback A callback method that will be called right before sending the command
 */
function send_parlay_command(adapter, from, to, command, args, recv_callback, sent_callback) {
    if (typeof args !== "object") {
        throw "args, must be an object. Instead got " + args;
    }
    args.COMMAND = command; //append command to dict
    let msg_id = generate_msg_id();
    let payload = {
        TOPICS: {
            TO: to,
            FROM: from,
            TX_TYPE: "DIRECT",
            MSG_TYPE: "COMMAND",
            RESPONSE_REQ: true,
            MSG_ID: msg_id,
        },
        CONTENTS: args,
    };
    if (sent_callback) sent_callback(payload);
    adapter.send_msg(payload);

    //wait for the message that has the same MSG_ID and the FROM is our TO and is not a PROGRESS
    let complete_promise = new Promise((resolve, reject) => {
        //use wait_for message to call recv_callback with every matching message, and then complete on the not progress message
        //we're done when we get the first non-'PROGRESS' message
        adapter.wait_for_msg((msg) => {
            if (msg.TOPICS.FROM == to && msg.TOPICS.MSG_ID == msg_id) {
                if (recv_callback) recv_callback(msg);
                if (msg.TOPICS.MSG_STATUS != "PROGRESS") {
                    if (msg.TOPICS.MSG_STATUS == "OK") resolve(msg);
                    else reject(msg);
                    return true;
                }
            }
            return false;
        });
    });

    return complete_promise;
}

/**
 * A Handle to the parlay system for a specific item.
 * This Handle 'wraps' the object and provides the hooks needed to communicate with the rest of the Parlay system
 */
class ParlayItemHandle {
    constructor(adapter, id, name, wrapped_object) {
        this._adapter = adapter;
        this.id = id;
        this.name = name;
        this._wrapped_object = wrapped_object || {};
        //cache property values so we can get them quickly if requested
        this._cached_properties = new Map();
        //a map of monkeypatched props to inject STREAM logic into
        this._active_streams = new Map(); // key => {orig: orig_prop, listeners:[listeners]}
        //subscribe to anything TO us
        this._adapter.subscribe({ TO: this.id });

        //add the handler that will call our commands and get/set/our properties
        this._adapter.wait_for_msg((msg) => {
            //two basic requirements are TOPICS and CONTENTS objects
            if (msg.TOPICS === undefined || msg.CONTENTS === undefined) {
                console.warn("Unknown websocket message: " + JSON.stringify(msg));
                return;
            }

            //if the message is to us
            if (msg.TOPICS.TO == this.id) {
                switch (msg.TOPICS.MSG_TYPE) {
                    //run one of our commands
                    case "COMMAND":
                        //find the function to run
                        let fn = wrapped_object[msg.CONTENTS.COMMAND];
                        if (!fn) throw "No such command: " + msg.CONTENTS.COMMAND;

                        //line up the arguments in the right order
                        let arg_names = formalParameterList(fn);
                        let args = [];
                        for (let i = 0; i < arg_names.length; i++) args.push(msg.CONTENTS[arg_names[i]]);
                        //first send a progress back
                        this._adapter.send_msg({
                            TOPICS: {
                                TO: msg.TOPICS.FROM,
                                FROM: this.id,
                                TX_TYPE: "DIRECT",
                                MSG_TYPE: "RESPONSE",
                                RESPONSE_REQ: false,
                                MSG_ID: msg.TOPICS.MSG_ID,
                                MSG_STATUS: "PROGRESS",
                            },
                            CONTENTS: {},
                        });
                        try {
                            let result = fn.apply(this._wrapped_object, args);
                            // this result might or might not be a promise. Send the result back after execution either way
                            Promise.resolve(result).then((val) => {
                                //send a response with the actual result value
                                this._adapter.send_msg({
                                    TOPICS: {
                                        TO: msg.TOPICS.FROM,
                                        FROM: this.id,
                                        TX_TYPE: "DIRECT",
                                        MSG_TYPE: "RESPONSE",
                                        RESPONSE_REQ: false,
                                        MSG_ID: msg.TOPICS.MSG_ID,
                                        MSG_STATUS: "OK",
                                    },
                                    CONTENTS: { RESULT: val },
                                });
                            });
                        } catch (e) {
                            //if an exception is thrown, translate that to an ERROR message
                            this._adapter.send_msg({
                                TOPICS: {
                                    TO: msg.TOPICS.FROM,
                                    FROM: this.id,
                                    TX_TYPE: "DIRECT",
                                    MSG_TYPE: "RESPONSE",
                                    RESPONSE_REQ: false,
                                    MSG_ID: msg.TOPICS.MSG_ID,
                                    MSG_STATUS: "ERROR",
                                },
                                CONTENTS: { DESCRIPTION: e },
                            });
                        }

                        break;
                    case "PROPERTY":
                        let property_name = msg.CONTENTS.PROPERTY;
                        if (msg.CONTENTS.ACTION == "SET") {
                            this._wrapped_object[property_name] = msg.CONTENTS.VALUE;
                            this._adapter.send_msg({
                                TOPICS: {
                                    TO: msg.TOPICS.FROM,
                                    FROM: this.id,
                                    TX_TYPE: "DIRECT",
                                    MSG_TYPE: "RESPONSE",
                                    RESPONSE_REQ: false,
                                    MSG_ID: msg.TOPICS.MSG_ID,
                                    MSG_STATUS: "OK",
                                },
                                CONTENTS: { PROPERTY: property_name, ACTION: "RESPONSE" },
                            });
                        } else {
                            //get the value, and if it's a promise then send the response when it finishes
                            let val = this._wrapped_object[property_name];
                            Promise.resolve(val).then((VALUE) =>
                                this._adapter.send_msg({
                                    TOPICS: {
                                        TO: msg.TOPICS.FROM,
                                        FROM: this.id,
                                        TX_TYPE: "DIRECT",
                                        MSG_TYPE: "RESPONSE",
                                        RESPONSE_REQ: false,
                                        MSG_ID: msg.TOPICS.MSG_ID,
                                        MSG_STATUS: "OK",
                                    },

                                    CONTENTS: { PROPERTY: property_name, ACTION: "RESPONSE", VALUE },
                                }),
                            );
                        }
                        break;

                    case "DATASTREAM":
                    case "STREAM":
                        // if we are receiving a stream ignore all this
                        if (!!msg.CONTENTS.VALUE) break;

                        // if we are streaming to some one else then do all this

                        let stream_id = msg.CONTENTS.STREAM;
                        let remove = !!msg.CONTENTS.STOP;
                        let requester = msg.TOPICS.FROM;

                        // if it's already active then just add it to the list
                        if (this._active_streams.has(stream_id)) {
                            if (!remove) this._active_streams.get(stream_id).listeners.push(requester);
                            else {
                                let streamer = this._active_streams.get(stream_id);
                                streamer.listeners = streamer.listeners.filter((e) => e !== requester);
                                this._active_streams.set(stream_id, streamer);
                            }
                        }
                        //else it's not active yet and we need to activate it
                        else {
                            //get the original property and try to monkey patch the property
                            let orig = Object.getOwnPropertyDescriptor(this._wrapped_object, stream_id);
                            //create the list
                            this._active_streams.set(stream_id, { orig, listeners: [requester] });
                            // if it's not configurable then we can't monkey pacth it
                            if (!orig || !orig.configurable)
                                console.warn(
                                    "Warning -- cannot monkey-patch " +
                                        stream_id +
                                        " stream because it's not configurable. Set configurable = true on Object.defineProperty to enable this. \n\n Without monkey patching ParlayHande.update_stream() must be manually called to stream changes",
                                );
                            else {
                                //now overrride it

                                Object.defineProperty(this._wrapped_object, stream_id, {
                                    enumerable: orig.enumerable,
                                    configurable: true,
                                    set: (v) => {
                                        //proxy it down to our original setter or value
                                        if (!!orig.set) orig.set(v);
                                        else orig.value = v;

                                        this.update_stream(stream_id, v);
                                    },
                                    get: () => {
                                        if (!!orig.get) return orig.get();
                                        else return orig.value;
                                    },
                                });
                            }
                        }

                        break;

                    default:
                        break;
                }
            }
            return false; //never remove
        });
    }

    /**
     * Send a command from this ItemHandle
     * @param to To ID of the item to send to
     * @param command The command ID to send
     * @param args Key-value map of arguments
     * @param timeout_ms Timeout to fail if no response by
     * @param recv_callback A callback method that will be called with every message response (e.g. progress & complete)
     * @param always_full_message If set to true, it will NOT automatically parse out RESULT on success, but always return the full message
     * @param sent_callback A callback method that will be called right before sending the command
     */
    send_command = (to, command, args, timeout_ms, recv_callback, always_full_message, sent_callback) => {
        let result = send_parlay_command(this._adapter, this.id, to, command, args, recv_callback, sent_callback);
        // attach a timeout
        if (timeout_ms !== undefined) result = promiseTimeout(result, timeout_ms);

        if (always_full_message) return result;

        //return the RESULT itself if it exists
        return result.then((msg) => (msg.CONTENTS.RESULT === undefined ? msg : msg.CONTENTS.RESULT));
    };

    /**
     * Set a property value through parlay
     * @param to - the ID of the item that owns the property
     * @param property_name - the name of the property
     * @param value - the value to se it to
     * @param timeout_ms Timeout to fail if no response by
     * @returns {*}
     */
    set_property = (to, property_name, value, timeout_ms) => {
        let result = this._set_property(to, property_name, value);
        if (timeout_ms !== undefined) result = promiseTimeout(result, timeout_ms);
        return result;
    };
    _set_property = async (to, property_name, value) => {
        let msg_id = generate_msg_id();
        this._adapter.send_msg({
            TOPICS: {
                TO: to,
                FROM: this.id,
                TX_TYPE: "DIRECT",
                MSG_TYPE: "PROPERTY",
                RESPONSE_REQ: true,
                MSG_ID: msg_id,
                MSG_STATUS: "OK",
            },
            CONTENTS: { PROPERTY: property_name, ACTION: "SET", VALUE: value },
        });

        //wait for the message that has the same MSG_ID and the FROM is our TO and is not a PROGRESS
        let result = await this._adapter.wait_for_msg(
            (msg) => msg.TOPICS.FROM == to && msg.TOPICS.MSG_ID == msg_id && msg.TOPICS.MSG_STATUS != "PROGRESS",
        );
        //if it's ok, then just return the RESULT
        if (result.TOPICS.MSG_STATUS == "OK") return result.CONTENTS.VALUE;
        //otherwise throw the whole message as an error
        else throw result;
    };

    /**
     * Get a property through the parlay system
     * @param to - the ID of the item that owns the property
     * @param property_name - the name of the poperty to get
     * @param timeout_ms Timeout to fail if no response by
     * @param cached Set to True if it's ok to get the cached values instead of requesting it
     * @returns {*} a promise that will resolve with the value
     */
    get_property = (to, property_name, timeout_ms, cached) => {
        //if it's ok to get the cached value and we have a cached value then just use that
        if (cached && this._cached_properties.has(to + "." + property_name)) {
            let r = this._cached_properties.get(to + "." + property_name);
            return Promise.resolve(r);
        }

        let result = this._get_property(to, property_name);
        if (timeout_ms !== undefined) result = promiseTimeout(result, timeout_ms);
        return result;
    };
    _get_property = async (to, property_name) => {
        let msg_id = generate_msg_id();
        this._adapter.send_msg({
            TOPICS: {
                TO: to,
                FROM: this.id,
                TX_TYPE: "DIRECT",
                MSG_TYPE: "PROPERTY",
                RESPONSE_REQ: true,
                MSG_ID: msg_id,
                MSG_STATUS: "OK",
            },
            CONTENTS: { PROPERTY: property_name, ACTION: "GET" },
        });

        //wait for the message that has the same MSG_ID and the FROM is our TO and is not a PROGRESS
        let result = await this._adapter.wait_for_msg(
            (msg) => msg.TOPICS.FROM == to && msg.TOPICS.MSG_ID == msg_id && msg.TOPICS.MSG_STATUS != "PROGRESS",
        );
        //if it's ok, then just return the RESULT
        if (result.TOPICS.MSG_STATUS == "OK") {
            //cache it
            this._cached_properties.set(to + "." + property_name, result.CONTENTS.VALUE);
            return result.CONTENTS.VALUE;
        }
        //otherwise throw the whole message as an error
        else throw result;
    };

    /**
     *  Subscribe to a stream
     * @param to - The ID of the item to subscribe to
     * @param stream_name - The name of the stream to subscribe to
     * @param callback - The callback to call when the value streams
     * @param rate_hz - The rate that the stream will update at. (Optional)
     * @returns {function()} - a function that when called will cancel the stream
     */
    stream = (to, stream_name, callback, rate_hz = 0) => {
        let msg_id = generate_msg_id();
        let contents = {
            STREAM: stream_name,
            STOP: false,
        };

        if (rate_hz > 0) {
            contents.RATE = rate_hz;
        }

        this._adapter.send_msg({
            TOPICS: {
                TO: to,
                FROM: this.id,
                TX_TYPE: "DIRECT",
                MSG_TYPE: "STREAM",
                RESPONSE_REQ: true,
                MSG_ID: msg_id,
                MSG_STATUS: "OK",
            },
            CONTENTS: contents,
        });

        let canceller = this._adapter.call_on_every_message((msg) => {
            if (
                msg.TOPICS.FROM == to &&
                msg.TOPICS.MSG_TYPE == "STREAM" &&
                (msg.CONTENTS.STREAM == stream_name || msg.TOPICS.STREAM == stream_name)
            ) {
                //cache the stream
                this._cached_properties.set(to + "." + stream_name, msg.CONTENTS.VALUE);
                //call the callback with the value
                callback(msg.CONTENTS.VALUE);
            }
        });

        //make a function that when called will cancel the stream and kill the listener
        return (sendStopMessage) => {
            canceller();
            if (sendStopMessage) {
                this._adapter.send_msg({
                    TOPICS: {
                        TO: to,
                        FROM: this.id,
                        TX_TYPE: "DIRECT",
                        MSG_TYPE: "STREAM",
                        RESPONSE_REQ: true,
                        MSG_ID: msg_id,
                        MSG_STATUS: "OK",
                    },
                    CONTENTS: { STREAM: stream_name, STOP: true },
                });
            }
        };
    };

    /**
     * Call handler every time 'event' happened
     * @param event - the Event ID to key off of
     * @param handler - fn(info, description,  full_msg) - a function to call every time that happens
     * @returns function - A function that when called will cancel the listening
     */
    on_event = (event, handler) => {
        return this._adapter.call_on_every_message((msg) => {
            if (msg.TOPICS.MSG_TYPE === "EVENT" && msg.CONTENTS.EVENT === event) {
                handler(msg.CONTENTS.INFO, msg.CONTENTS.DESCRIPTION, msg);
            }
        });
    };

    /**
     * Do a discovery and return a promise that will resolve with the list of discovered items
     * @param force - whether to force the discovery (clear the cash and restart)
     * @param discovery_msg  - a previously saved discovery message to use
     * @param msg_callback - A callback that will be called with the full discovery message once aquired
     */
    discover = async (force, discovery_msg, msg_callback) => {
        if (!discovery_msg) {
            //send request
            this._adapter.send_msg({
                TOPICS: {
                    type: "broker",
                    request: "get_discovery",
                },
                CONTENTS: { force: !!force },
            });
            discovery_msg = await this._adapter.wait_for_msg(
                (msg) => msg.TOPICS.type === "broker" && msg.TOPICS.response === "get_discovery_response",
            );
        }

        let discovery = discovery_msg.CONTENTS.discovery;

        if (!!msg_callback) msg_callback(discovery_msg);

        return discovery.map((discovery) => new ParlayItemProxy(this, discovery));
    };

    /**
     * Get the broker's config object
     */
    get_broker_config = async () => {
        this._adapter.send_msg({
            TOPICS: {
                type: "broker",
                request: "get_config",
            },
            CONTENTS: {},
        });

        let resp = await this._adapter.wait_for_msg(
            (msg) => msg.TOPICS.type === "broker" && msg.TOPICS.response === "get_config_response",
        );
        return resp.CONTENTS;
    };

    /**
     * Update the stream in this item handle with value. This is handeld automatically when you write to a property
     * But this is a manual way, in case you want to update the stream WITHOUT writing the property value itself for some reason
     * @param stream_id
     * @param value
     */
    update_stream = (stream_id, value) => {
        //Send the stream message to all listeners
        let info = this._active_streams.get(stream_id);
        if (!!info && !!info.listeners) {
            for (let listener of info.listeners) {
                this._adapter.send_msg({
                    TOPICS: {
                        TO: listener,
                        FROM: this.id,
                        TX_TYPE: "DIRECT",
                        MSG_TYPE: "STREAM",
                        RESPONSE_REQ: false,
                        MSG_ID: generate_msg_id(),
                        MSG_STATUS: "OK",
                        STREAM: stream_id, //TODO: remove this duplication in the next version, once Qt is up to spec.
                    },

                    CONTENTS: { STREAM: stream_id, VALUE: value },
                });
            }
        }
    };
}

/*
    Discovery  Item Proxy here
 */

export class ParlayItemProxy {
    /**
     *
     * @param item_handle - The handle that will actually be doing the sending of messages
     * @param discovery - the discovery for the item that this object is a proxy for
     */
    constructor(item_handle, discovery) {
        this._item_handle = item_handle;
        this._discovery = discovery;

        this.id = this._discovery["ID"];
        this.name = this._discovery["NAME"] || this._discovery["ID"];
        this.hidden = !!this._discovery["HIDDEN"];

        //create the forwarding utility functions
        this.send_command = this._item_handle.send_command.bind(this._item_handle, this.id);
        this.set_property = this._item_handle.set_property.bind(this._item_handle, this.id);
        this.get_property = this._item_handle.get_property.bind(this._item_handle, this.id);
        this.stream = this._item_handle.stream.bind(this._item_handle, this.id);

        //attach any children
        if (this._discovery["CHILDREN"] !== undefined)
            this.children = this._discovery["CHILDREN"].map(
                (child_discovery) => new ParlayItemProxy(this._item_handle, child_discovery),
            );
        else this.children = [];
    }

    get content_fields() {
        return this._discovery["CONTENT_FIELDS"];
    }

    get properties() {
        return this._discovery["PROPERTIES"] || [];
    }

    get datastreams() {
        return this._discovery["DATASTREAMS"] || [];
    }
}
