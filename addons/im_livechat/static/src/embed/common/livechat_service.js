import { expirableStorage } from "@im_livechat/embed/common/expirable_storage";

import { reactive } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { session } from "@web/session";

/**
 * @typedef LivechatRule
 * @property {"auto_popup"|"display_button_and_text"|undefined} [action]
 * @property {number?} [auto_popup_timer]
 * @property {import("@im_livechat/embed/common/chatbot/chatbot_model").IChatbot} [chatbot]
 */

export const RATING = Object.freeze({
    GOOD: 5,
    OK: 3,
    BAD: 1,
});

export const SESSION_STATE = Object.freeze({
    NONE: "NONE",
    CREATED: "CREATED",
    PERSISTED: "PERSISTED",
});

export const ODOO_VERSION_KEY = `${location.origin.replace(
    /:\/{0,2}/g,
    "_"
)}_im_livechat.odoo_version`;

const OPERATOR_STORAGE_KEY = "im_livechat_previous_operator";
const GUEST_TOKEN_STORAGE_KEY = "im_livechat_guest_token";
const SAVED_STATE_STORAGE_KEY = "im_livechat.saved_state";

export function getGuestToken() {
    return expirableStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
}

export class LivechatService {
    /** @type {keyof typeof SESSION_STATE} */
    state = SESSION_STATE.NONE;
    /** @type {LivechatRule} */
    rule;
    initialized = false;
    available = session.livechatData?.isAvailable;
    _onStateChangeCallbacks = {
        [SESSION_STATE.CREATED]: [],
        [SESSION_STATE.PERSISTED]: [],
        [SESSION_STATE.NONE]: [],
    };

    constructor(env, services) {
        this.setup(env, services);
    }

    /**
     * @param {import("@web/env").OdooEnv} env
     * @param {{
     * bus_service: ReturnType<typeof import("@bus/services/bus_service").busService.start>,
     * "mail.store": import("@mail/core/common/store_service").Store
     * }} services
     */
    setup(env, services) {
        this.env = env;
        this.busService = services.bus_service;
        this.notificationService = services.notification;
        this.store = services["mail.store"];
    }

    async initialize() {
        const data =
            this.options?.init ??
            (await rpc("/im_livechat/init", {
                channel_id: this.options.channel_id,
            }));
        this.available = data.available_for_me;
        this.rule = this.store.LivechatRule.insert(data.rule);
        this.store.insert(data.storeData);
        await this._restoreSavedState();
        this.initialized = true;
        this.env.services["im_livechat.initialized"].ready.resolve();
    }

    /**
     * Open a new live chat thread.
     *
     * @returns {Promise<import("models").Thread|undefined>}
     */
    async open() {
        await this._createThread({ persist: false });
        this.thread?.openChatWindow();
    }

    /**
     * Persist the livechat thread if it is not done yet and swap it with the
     * temporary thread.
     *
     * @returns {Promise<import("models").Thread|undefined>}
     */
    async persist() {
        if (this.state === SESSION_STATE.PERSISTED) {
            return this.thread;
        }
        const temporaryThread = this.thread;
        await this._createThread({ persist: true });
        if (temporaryThread) {
            const chatWindow = this.store.discuss.chatWindows.find(
                (c) => c.thread?.id === temporaryThread.id
            );
            temporaryThread.delete();
            chatWindow.close();
        }
        if (!this.thread) {
            return;
        }
        this.store.ChatWindow.insert({ thread: this.thread }).autofocus++;
        await this.busService.addChannel(`mail.guest_${this.guestToken}`);
        await this.env.services["mail.store"].initialize();
        return this.thread;
    }

    /**
     * @param {object} param0
     * @param {boolean} param0.notifyServer Whether to call the
     * `visitor_leave_session` route. Note that this route will never be called
     * if the session was not persisted.
     */
    async leave({ notifyServer = true } = {}) {
        try {
            if (this.thread && this.state === SESSION_STATE.PERSISTED && notifyServer) {
                await rpc("/im_livechat/visitor_leave_session", { channel_id: this.thread.id });
            }
        } finally {
            expirableStorage.removeItem(SAVED_STATE_STORAGE_KEY);
            this.state = SESSION_STATE.NONE;
            await Promise.all(this._onStateChangeCallbacks[SESSION_STATE.NONE].map((fn) => fn()));
        }
    }

    /**
     * Add a callback to be executed when the livechat service state changes.
     *
     * @param {keyof typeof SESSION_STATE} state
     * @param {Function} callback
     */
    onStateChange(state, callback) {
        this._onStateChangeCallbacks[state].push(callback);
    }

    /**
     * Save the current live chat state.
     *
     * @param {object} threadData
     * @param {object} param1
     * @param {boolean} [param1.persisted=false]
     */
    _saveLivechatState(threadData, { persisted = false } = {}) {
        const { guest_token, id, operator } = threadData;
        if (guest_token) {
            expirableStorage.setItem(GUEST_TOKEN_STORAGE_KEY, threadData.guest_token);
            delete threadData.guest_token;
        }
        const ONE_DAY = 60 * 60 * 24;
        const ONE_WEEK = ONE_DAY * 7;
        expirableStorage.setItem(
            SAVED_STATE_STORAGE_KEY,
            JSON.stringify({ id, persisted, user_id: this.savedState?.user_id ?? session.user_id }),
            ONE_DAY
        );
        if (operator) {
            expirableStorage.setItem(OPERATOR_STORAGE_KEY, operator.id, ONE_WEEK);
        }
    }

    /**
     * Restore the live chat from the saved state. Clean it if it is outdated.
     */
    async _restoreSavedState() {
        // state is outdated if it is linked to another user(log in/out after chat start).
        const isOutdated = (this.savedState?.user_id || false) !== (session.user_id || false);
        if (isOutdated || !this.savedState?.persisted) {
            this.leave({ notifyServer: false });
        }
        if (this.options?.force_thread) {
            this._saveLivechatState(this.options.force_thread, { persisted: true });
        }
        if (this.savedState?.persisted) {
            this.state = SESSION_STATE.PERSISTED;
            await this.busService.addChannel(`mail.guest_${this.guestToken}`);
        }
    }

    /**
     * @param {object} param0
     * @param {boolean} [param0.persist=false]
     * @returns {Promise<import("models").Thread>}
     */
    async _createThread({ persist = false }) {
        const data = await rpc(
            "/im_livechat/get_session",
            {
                channel_id: this.options.channel_id,
                anonymous_name: this.options.default_username ?? _t("Visitor"),
                chatbot_script_id: this.rule.chatbotScript?.id,
                previous_operator_id: expirableStorage.getItem(OPERATOR_STORAGE_KEY),
                temporary_id: this.thread?.id,
                persisted: persist,
            },
            { shadow: true }
        );
        if (!data.Thread?.operator) {
            this.notificationService.add(_t("No available collaborator, please try again later."));
            this.leave({ notifyServer: false });
            return;
        }
        data.Thread["scrollUnread"] = false;
        this.state = persist ? SESSION_STATE.PERSISTED : SESSION_STATE.CREATED;
        this._saveLivechatState(data.Thread, { persisted: persist });
        this.store.insert(data);
        await Promise.all(this._onStateChangeCallbacks[this.state].map((fn) => fn()));
    }

    get options() {
        return session.livechatData?.options ?? {};
    }

    get savedState() {
        return JSON.parse(expirableStorage.getItem(SAVED_STATE_STORAGE_KEY) ?? false);
    }

    /**
     * @returns {string|undefined}
     */
    get guestToken() {
        return getGuestToken();
    }

    /**
     * @returns {import("models").Thread|undefined}
     */
    get thread() {
        const { id } = JSON.parse(expirableStorage.getItem(SAVED_STATE_STORAGE_KEY) ?? false);
        if (!id) {
            return null;
        }
        return this.store.Thread.get({ id, model: "discuss.channel" });
    }
}

export const livechatService = {
    dependencies: ["bus_service", "im_livechat.initialized", "mail.store", "notification"],
    start(env, services) {
        const livechat = reactive(new LivechatService(env, services));
        if (livechat.available) {
            livechat.initialize();
        }
        return livechat;
    },
};
registry.category("services").add("im_livechat.livechat", livechatService);
