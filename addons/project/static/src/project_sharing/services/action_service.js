import { ActionManager } from "@web/webclient/actions/action_service";
import { session } from "@web/session";
import { patch } from "@web/core/utils/patch";

patch(ActionManager.prototype, {
    async doAction(actionRequest, options = {}) {
        const additionalContext = {
            ...(options.additionalContext || {}),
            ...(session.action_context || {}),
        };
        options.additionalContext = additionalContext;
        return super.doAction(actionRequest, options);
    }
});
