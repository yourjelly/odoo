/* @odoo-module */

import { Record } from "@mail/core/common/record";

/**
 * @typedef StepAnswer
 * @property {number} id
 * @property {string} label
 * @property {string} [redirectLink]
 */

/**
 * @typedef { "free_input_multi"|"free_input_single"|"question_email"|"question_phone"|"question_selection"|"text"|"forward_operator"} StepType
 */

export class ChatbotStep extends Record {
    static id = [["id"]];
    /** @type {number} */
    id;
    /** @type {StepAnswer[]} */
    answers = [];
    /** @type {string} */
    message;
    /** @type {StepType} */
    type;
    hasAnswer = false;
    isEmailValid = false;
    operatorFound = false;
    isLast = false;
    /** @type {number} */
    selectedAnswerId;

    update(data) {
        super.update(data);
        this.hasAnswer = data.hasAnswer ?? Boolean(data.selectedAnswerId);
    }

    get expectAnswer() {
        if (
            (this.type === "question_email" && !this.isEmailValid) ||
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
}

ChatbotStep.register();
