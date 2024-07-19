export const WORKER_VERSION = "1.0.0.0";

export class Dispatcher extends EventTarget {
    /** @type {Set<BaseHandler>} */
    static handlers = new Set();
    static IN = {
        INITIALIZE: "DISPATCHER.IN.INITIALIZE",
        LEAVE: "DISPATCHER.IN.LEAVE",
        SUBSCRIBE: "DISPATCHER.IN.SUBSCRIBE",
        UNSUBSCRIBE: "DISPATCHER.IN.UNSUBSCRIBE",
    };
    static OUT = {
        INITIALIZED: "DISPATCHER.OUT.INITIALIZED",
    };
    /** @type {number|false|undefined} */
    currentUID;
    /** @type {string|undefined} */
    currentDB;
    /** @type {Map<Function, Function>} */
    callbacksToWrapper = new Map();
    /** @type {Map<string, Set<MessagePort>} */
    debugModeByClient = new Map();
    /** @type {{[namespace: string]: NamespacedDispatcher}} */
    dispatcherByNamespace = {};
    /** @type {number} */
    newestStartTs;
    /** @type {string} */
    serverURL;

    static registerHandler(handler) {
        Dispatcher.handlers.add(handler);
    }

    constructor() {
        super(...arguments);
        for (const HandlerClass of Dispatcher.handlers) {
            if (HandlerClass.NAMESPACE in this.dispatcherByNamespace) {
                throw new Error(`Namespace '${HandlerClass.NAMESPACE}' already in use.`);
            }
            const dispatcher = new NamespacedDispatcher(HandlerClass.NAMESPACE, this);
            this.dispatcherByNamespace[HandlerClass.NAMESPACE] = dispatcher;
            new HandlerClass(dispatcher);
        }
    }

    /** @param {MessagePort} client */
    registerClient(client) {
        client.onmessage = (ev) => this.dispatchMessage(client, ev.data);
    }

    /**
     * @param {MessagePort} client
     * @param {Object} param0
     * @param {string} [param0.db] Database name.
     * @param {String} [param0.debug] Current debugging mode for the
     * given client.
     * @param {Number|false|undefined} [param0.uid] Current user id
     *     - Number: user is logged whether on the frontend/backend.
     *     - false: user is not logged.
     *     - undefined: not available (e.g. livechat support page)
     */
    initializeClient(client, { db, debug, serverURL, startTs, uid }) {
        if (this.newestStartTs > startTs) {
            return;
        }
        this.debugModeByClient.set(client, debug);
        this.serverURL = serverURL;
        this.newestStartTs = startTs;
        const currentUserKnown = uid !== undefined;
        if ((this.currentUID !== uid && currentUserKnown) || this.currentDB !== db) {
            const data = {
                currentUID: uid,
                currentDB: db,
                previousUID: this.currentUID,
                previousDB: this.currentDB,
            };
            this.currentUID = uid;
            this.currentDB = db;
            this.broadcastEvent(
                new CustomEvent(NamespacedDispatcher.EVENTS.USER_CHANGED, { detail: data })
            );
        }
        this.send(client, Dispatcher.OUT.INITIALIZED);
    }

    /**
     * Relay incoming messages to the correct handler according to the
     * `namespace` property.
     *
     * @param {MessagePort} client
     * @param {{type: string, payload: any, namespace: string}} message
     */
    dispatchMessage(client, message) {
        const { type, payload, namespace } = message;
        if (!namespace) {
            this.handleDispatcherMessage(client, type, payload);
            return;
        }
        const dispatcher = this.dispatcherByNamespace[namespace];
        if (!dispatcher) {
            throw new Error(`No handler for namespace '${namespace}'.`);
        }
        dispatcher.dispatchEvent(
            new CustomEvent(NamespacedDispatcher.EVENTS.MESSAGE, {
                detail: { client, type, payload },
            })
        );
    }

    handleDispatcherMessage(client, type, payload) {
        switch (type) {
            case Dispatcher.IN.INITIALIZE:
                this.initializeClient(client, payload);
                break;
            case Dispatcher.IN.LEAVE: {
                this.debugModeByClient.delete(client);
                for (const dispatcher of Object.values(this.dispatcherByNamespace)) {
                    dispatcher.clients.delete(client);
                }
                this.broadcastEvent(
                    new CustomEvent(NamespacedDispatcher.EVENTS.CLIENT_LEFT, { detail: client })
                );
                break;
            }
            case Dispatcher.IN.SUBSCRIBE:
                this.dispatcherByNamespace[payload]?.clients.add(client);
                break;
            case Dispatcher.IN.UNSUBSCRIBE:
                this.dispatcherByNamespace[payload?.clients.delete(client)];
                break;
            default:
                break;
        }
    }

    send(client, type, payload, namespace) {
        client.postMessage({ type, namespace, payload });
    }

    broadcast(namespace, type, payload) {
        for (const clients of this.namespaceToClients[namespace] ?? []) {
            for (const client of clients) {
                this.send(client, type, payload, namespace);
            }
        }
    }

    broadcastEvent(event) {
        for (const dispatcher of Object.values(this.dispatcherByNamespace)) {
            dispatcher.dispatchEvent(event);
        }
    }

    get inDebugMode() {
        return this.debugModeByClient.values().some(Boolean);
    }
}

class NamespacedDispatcher extends EventTarget {
    static EVENTS = {
        MESSAGE: "NAMESPACE_DISPATCHER.MESSAGE",
        CLIENT_JOINED: "NAMESPACE_DISPATCHER.EVENTS.CLIENT_JOIN",
        CLIENT_LEFT: "NAMESPACE_DISPATCHER.EVENTS.CLIENT_LEFT",
        USER_CHANGED: "NAMESPACE_DISPATCHER.EVENTS.USER_CHANGED",
    };
    /** @type {MessagePort[]} */
    clients = new Set();

    constructor(id, dispatcher) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
    }

    send(client, type, payload) {
        this.dispatcher.send(client, type, payload, this.id);
    }

    broadcast(type, payload) {
        this.dispatcher.broadcast(this.id, type, payload, this.id);
    }
}

`
class VoipHandler {
    static NAMESPACE = "VOIP"
    static OUT = {
        SEND_HELLO: "VOIP.OUT.SEND_HELLO",
    }
    constructor(dispatcher) {
        // subscribe to dispatcher events
        dispatcher.addEventListener(NamespacedDispatcher.MESSAGE, onMessage);
        dispatcher.addEventListener(NamespacedDispatcher.CLIENT_JOINED, onClientJoined);
        // reply to client(s)
        dispatcher.send(dispatcher.clients[0], VoipHandler.OUT.SEND_HELLO, "hello world");
        dispatcher.broadcast(VoipHandler.OUT.SEND_HELLO, "hello to every connected client");
    }
}
Dispatcher.registerHandler(VoipHandler)

`;

class VoipHandler {
    static NAMESPACE = "VOIP";
    static OUT = {
        SEND_HELLO: "VOIP.OUT.SEND_HELLO",
    };
    constructor(dispatcher) {
        // subscribe to dispatcher events
        dispatcher.addEventListener(NamespacedDispatcher.EVENTS.MESSAGE, ({ detail }) =>
            console.warn(detail.type, detail.payload)
        );
        dispatcher.addEventListener(NamespacedDispatcher.EVENTS.CLIENT_JOINED, console.warn);
    }
}
Dispatcher.registerHandler(VoipHandler);
