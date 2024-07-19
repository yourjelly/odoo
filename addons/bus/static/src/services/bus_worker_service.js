import { Dispatcher, WORKER_VERSION } from "@bus/wip_workers/dispatcher";
import { EventBus } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";
import { Deferred } from "@web/core/utils/concurrency";
import { session } from "@web/session";

let WorkerClass = browser.SharedWorker ?? browser.Worker;

class WorkerManager {
    /** @type {string|undefined} */
    serverURL;
    /** @type {Worker|SharedWorker} */
    worker;
    /** @type {Deferred} */
    workerInitializedDeferred;
    startTs = luxon.DateTime.now().set({ milliseconds: 0 }).valueOf();
    /** @type {Map<Function, Function>} */
    callbackToWrapper = new Map();
    callbackBus = new EventBus();

    constructor(services) {
        this.serverURL = services["bus.parameters"].serverURL;
        this.multiTab = services["multi_tab"];
    }

    /**
     *
     * @param {typeof import("BusWorker").NAMESPACES[keyof typeof import("BusWorker").NAMESPACES]} namespace
     * @param {*} type
     * @param {*} payload
     */
    send(type, payload, namespace = null) {
        if (WorkerClass === browser.SharedWorker) {
            this.worker.port.postMessage({ type, namespace, payload });
        } else {
            this.worker.postMessage({ type, namespace, payload });
        }
    }

    subscribe(namespace, callback) {
        const wrapper = ({ detail }) => callback(detail);
        this.callbackToWrapper.set(callback, wrapper);
        this.callbackBus.on(namespace, wrapper);
    }

    unsubscribe(namespace, callback) {
        this.callbackBus.off(namespace, this.callbackToWrapper.get(callback));
        this.callbackToWrapper.delete(callback);
    }

    async start() {
        if (this.workerInitializedDeferred) {
            return this.workerInitializedDeferred;
        }
        this.workerInitializedDeferred = new Deferred();
        let workerURL = `${this.serverURL}/bus/worker_bundle?v=${WORKER_VERSION}`;
        if (this.serverURL !== window.origin) {
            // Loaded from a different origin than the bundle URL. The Worker
            // expects an URL from this origin, give it a base64 URL that will
            // then load the bundle via "importScripts" which allows cross
            // origin.
            const source = `importScripts("${workerURL}");`;
            workerURL = "data:application/javascript;base64," + window.btoa(source);
        }
        this.worker = new WorkerClass(workerURL, {
            name: WorkerClass === browser.SharedWorker ? "odoo:shared_worker" : "odoo:web_worker",
        });
        this.worker.addEventListener("error", (e) => {
            if (WorkerClass === browser.SharedWorker) {
                console.warn('Error while loading "bus_service" SharedWorker, fallback on Worker.');
                WorkerClass = browser.Worker;
                this.start();
            } else {
                this.workerInitializedDeferred.resolve();
                console.warn("Bus service failed to initialized.");
            }
        });
        if (WorkerClass === browser.SharedWorker) {
            this.worker.port.start();
            this.worker.port.addEventListener("message", (ev) => this._handleMessage(ev.data));
        } else {
            this.worker.addEventListener("message", (ev) => this._handleMessage(ev.data));
        }
        this._initializeWorkerConnection();
        return this.workerInitializedDeferred;
    }

    _handleMessage({ type, namespace, payload }) {
        if (!namespace) {
            this._handleDispatcherMessage(type, payload);
        }
        this.callbackBus.trigger(namespace, { type, payload });
    }

    _handleDispatcherMessage(type, payload) {
        switch (type) {
            case Dispatcher.OUT.INITIALIZED:
                this.workerInitializedDeferred.resolve();
                break;
            default:
                break;
        }
    }

    _initializeWorkerConnection() {
        // User_id has different values according to its origin:
        //     - frontend: number or false,
        //     - backend: array with only one number
        //     - guest page: array containing null or number
        //     - public pages: undefined
        // Let's format it in order to ease its usage:
        //     - number if user is logged, false otherwise, keep
        //       undefined to indicate session_info is not available.
        let uid = Array.isArray(session.user_id) ? session.user_id[0] : session.user_id;
        if (!uid && uid !== undefined) {
            uid = false;
        }
        this.send(Dispatcher.IN.INITIALIZE, {
            db: session.db,
            debug: odoo.debug,
            lastNotificationId: this.multiTab.getSharedValue("last_notification_id", 0),
            serverURL: this.serverURL,
            startTs: this.startTs,
            uid,
        });
    }
}

export const busWorkerService = {
    dependencies: ["bus.parameters", "multi_tab"],

    start(env, services) {
        const manager = new WorkerManager(services);

        const test = {
            get: (namespace) => ({
                start: async () => {
                    await manager.start();
                    manager.send(Dispatcher.IN.SUBSCRIBE, namespace);
                },
                stop: () => manager.send(Dispatcher.IN.UNSUBSCRIBE, namespace),
                send: async (type, payload) => {
                    await manager.start();
                    manager.send(Dispatcher.IN.SUBSCRIBE, namespace);
                    manager.send(type, payload, namespace);
                },
                subscribe: (callback) => manager.subscribe(namespace, callback),
                unsubscribe: (callback) => manager.unsubscribe(namespace, callback),
            }),
        };
        const worker = test.get("VOIP");
        worker.send("hello", "world");
        return test;
    },
};
registry.category("services").add("bus.worker", busWorkerService);
