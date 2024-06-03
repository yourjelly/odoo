import { reactive } from "@odoo/owl";

import { registry } from "@web/core/registry";

export class Store {
    constructor(env, { orm }) {
        this.env = env;
        this.orm = orm;
        this.projects = [];
        this.resources = [];
        this.languages = [];
        this.resource = {};
        this.active_message = {};
        this.project_id = null;
        this.target_lang_id = null;
        this.resource_id = null;
        return reactive(this);
    }

    async fetchLanguages() {
        this.languages.splice(
            0,
            this.languages.length,
            ...(await this.orm.call("t9n.project", "get_target_langs", [this.project_id]))
        );
    }
    async fetchResources() {
        // const resources = await this.orm.call("t9n.resource", "get_resources", [this.project_id]);
        // this.resources.splice(
        //     0,
        //     this.resources.length,
        //     ...resources.map((r) => new Resource(r.id, r.file_name, r.project_id, r.messages))
        // );
    }

    async fetchResource() {
        const resource = await this.orm.call("t9n.resource", "get_resource", [], {
            id: this.resource_id,
            target_lang_id: this.target_lang_id,
        });
        Object.assign(this.resource, resource);
        if (this.resource.messages.length > 0) {
            Object.assign(this.active_message, this.resource.messages[0]);
        }
    }

    async fetchActiveMessage() {
        const newMessage = await this.orm.call("t9n.message", "get_message", [], {
            message_id: this.active_message.id,
            target_lang_id: this.target_lang_id,
        });
        const messageIndex = this.resource.messages.findIndex(
            (message) => message.id === this.active_message.id
        );
        if (messageIndex !== -1) {
            Object.assign(this.resource.messages[messageIndex], newMessage);
            this.resource.messages.splice(messageIndex, 1, this.resource.messages[messageIndex]);
        }
        Object.assign(this.active_message, newMessage);
    }

    setProjectId(id) {
        this.project_id = id;
    }

    setTargetLangId(id) {
        this.target_lang_id = id;
    }

    setResourceId(id) {
        this.resource_id = id;
    }

    setActiveMessage(message) {
        Object.assign(this.active_message, message);
    }
}

export const storeService = {
    dependencies: ["orm"],
    start(env, deps) {
        return new Store(env, deps);
    },
};

registry.category("services").add("t9n.store", storeService);
