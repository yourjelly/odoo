/* @odoo-module */

import { assignDefined } from "@mail/utils/misc";

/**
 * @typedef IChatbot
 * @property {string} chatbot_name
 * @property {number} chatbot_operator_partner_id
 * @property {number} chatbot_script_id
 * @property {import("./chatbot_step_model").IChatbotStep[]} chatbot_welcome_steps
 * @property {number} [welcome_step_index]
 */

export class Chatbot {
    /** @type {string} */
    name;
    /** @type {number} */
    operatorPartnerId;
    /** @type {number} */
    welcomeStepIndex = 0;
    /** @type {number} */
    scriptId;
    /** @type {import("./chatbot_step_model").IChatbotStep[]} */
    welcomeSteps = [];

    /**
     * @param {IChatbot} data
     */
    constructor(data) {
        const {
            chatbot_name: name,
            chatbot_operator_partner_id: operatorPartnerId,
            chatbot_welcome_steps: welcomeSteps,
            welcome_step_index: welcomeStepIndex,
            chatbot_script_id: scriptId,
        } = data;
        assignDefined(this, {
            name,
            operatorPartnerId,
            scriptId,
            welcomeStepIndex,
            welcomeSteps,
        });
    }

    get welcomeCompleted() {
        return this.welcomeStepIndex >= this.welcomeSteps.length;
    }

    get nextWelcomeStep() {
        return this.welcomeSteps[this.welcomeStepIndex++];
    }

    /**
     * Convert this record to its corresponding server representation.
     *
     * @returns {IChatbot}
     */
    toServerData() {
        return {
            chatbot_name: this.name,
            chatbot_operator_partner_id: this.operatorPartnerId,
            chatbot_welcome_steps: this.welcomeSteps,
            chatbot_script_id: this.scriptId,
            welcome_step_index: this.welcomeStepIndex,
        };
    }
}
