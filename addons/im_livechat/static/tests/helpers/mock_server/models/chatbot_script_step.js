/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /*
     * Simulates the `_format_for_frontend` method of the `chatbot.script.step` model.
     * model.
     */
    _mockChatbotScriptStep__formatForFrontend(id) {
        const [self] = this.pyEnv["chatbot.script.step"].searchRead([["id", "=", id]]);
        const answers = this.pyEnv["chatbot.script.answer"].searchRead([["step_id", "=", id]]);
        return {
            id: self.id,
            answers: answers.map((answer) => ({
                id: answer.id,
                label: answer.name,
                redirectLink: answer.redirect_link,
            })),
            message: self.message,
            isLast: this._mockChatbotScriptStep__isLastStep(self.id),
            type: self.step_type,
        };
    },

    /**
     * Simulates the `_is_last_step` method of the `chatbot.script.step` model.
     */
    _mockChatbotScriptStep__isLastStep(id) {
        const [self] = this.pyEnv["chatbot.script.step"].searchRead([["id", "=", id]]);
        return (
            self.step_type !== "question_selection" &&
            !this._mockChatbotScriptStep__fetchNextStep(id)
        );
    },

    _mockChatbotScriptStep__fetchNextStep(id, selectedAnswerId) {
        const [self] = this.pyEnv["chatbot.script.step"].searchRead([["id", "=", id]]);
        const [script] = this.pyEnv["chatbot.script"].searchRead([
            ["script_step_ids", "in", self.id],
        ]);
        return script.script_step_ids.filter((stepId) => stepId > id)[0];
    },
});
