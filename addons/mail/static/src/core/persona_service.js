/** @odoo-module */

import { Persona } from "@mail/core/persona_model";
import { assignDefined, createLocalId, nullifyClearCommands } from "../utils/misc";
import { registry } from "@web/core/registry";

export const DEFAULT_AVATAR = "/mail/static/src/img/smiley/avatar.jpg";

export class PersonaService {
    constructor(...args) {
        this.setup(...args);
    }

    setup(env, services) {
        this.env = env;
        this.rpc = services.rpc;
        this.services = {
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
        };
    }

    async updateGuestName(guest, name) {
        await this.rpc("/mail/guest/update_name", {
            guest_id: guest.id,
            name,
        });
    }

    /**
     * @param {import("@mail/core/persona_model").Data} data
     * @returns {import("@mail/core/persona_model").Persona}
     */
    insert(data) {
        const localId = createLocalId(data.type, data.id);
        let persona = this.services["mail.store"].personas[localId];
        if (!persona) {
            persona = new Persona();
            persona._store = this.services["mail.store"];
            persona.localId = localId;
            this.services["mail.store"].personas[localId] = persona;
        }
        this.update(persona, data);
        // return reactive version
        return this.services["mail.store"].personas[localId];
    }

    update(persona, data) {
        nullifyClearCommands(data);
        assignDefined(persona, { ...data });
        if (
            persona.type === "partner" &&
            persona.im_status !== "im_partner" &&
            !persona.is_public &&
            !this.services["mail.store"].registeredImStatusPartners?.includes(persona.id)
        ) {
            this.services["mail.store"].registeredImStatusPartners?.push(persona.id);
        }
    }
}

export const personaService = {
    dependencies: ["rpc", "mail.store"],
    start(env, services) {
        return new PersonaService(env, services);
    },
};

registry.category("services").add("mail.persona", personaService);
