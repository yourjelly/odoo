/* @odoo-module */

import { assignDefined } from "@mail/utils/misc";

/**
 * @typedef StepAnswer
 * @property {number} id
 * @property {string} label
 * @property {string} [redirect_link]
 */

/**
 * @typedef { "free_input_multi"|"free_input_single"|"question_email"|"question_phone"|"question_selection"|"text"|"forward_operator"} StepType
 */

/**
 * @typedef IChatbotStep
 * @property {number} chatbot_script_step_id
 * @property {boolean} chatbot_step_is_last
 * @property {string} chatbot_step_message
 * @property {StepType} chatbot_step_type
 * @property {StepAnswer[]} [chatbot_step_answers]
 * @property {boolean} [chatbot_operator_found]
 * @property {boolean} [is_email_valid]
 * @property {number} [chatbot_selected_answer_id]
 * @property {boolean} [has_answer]
 */

export class ChatbotStep {
    /** @type {number} */
    id;
    /** @type {StepAnswer[]} */
    answers = [];
    /** @type {string} */
    message;
    /** @type {StepType} */
    type;
    hasAnswer = false;
    validEmail = false;
    operatorFound = false;
    isLast = false;

    /**
     * @param {IChatbotStep} data
     */
    constructor(data) {
        const {
            chatbot_script_step_id: id,
            chatbot_step_answers: answers,
            chatbot_step_is_last: isLast,
            chatbot_step_message: message,
            chatbot_step_type: type,
            chatbot_operator_found: operatorFound,
            is_email_valid: validEmail,
            chatbot_selected_answer_id,
            has_answer: hasAnswer,
        } = data;
        assignDefined(this, {
            answers,
            id,
            isLast,
            message,
            operatorFound,
            hasAnswer: hasAnswer || Boolean(chatbot_selected_answer_id),
            type,
            validEmail,
        });
    }

    get expectAnswer() {
        if (
            (this.type === "question_email" && !this.validEmail) ||
            (this.answers.length > 0 && !this.hasAnswer)
        ) {
            return true;
        }
        return (
            [
                "free_input_multi",
                "free_input_single",
                "question_selection",
                "question_email",
                "question_phone",
            ].includes(this.type) && !this.hasAnswer
        );
    }

    /**
     * Convert this record to its corresponding server representation.
     *
     * @returns {IChatbotStep}
     */
    toServerData() {
        return {
            chatbot_script_step_id: this.id,
            chatbot_step_answers: this.answers,
            chatbot_step_is_last: this.isLast,
            chatbot_step_message: this.message,
            chatbot_step_type: this.type,
            chatbot_operator_found: this.operatorFound,
            is_email_valid: this.validEmail,
            has_answer: this.hasAnswer,
        };
    }
}
