/** @odoo-module **/

import { Component, useExternalListener, useEffect, useRef } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { sprintf } from "@web/core/utils/strings";
import { useThrottleForAnimation } from "@web/core/utils/timing";

function isEllipsisNeeded(el) {
    return el.scrollWidth > el.offsetWidth;
}

class ActionsOne2ManyField extends Component {
    static props = ["*"];
    static template = "base_automation.ActionsOne2ManyField";
    static actionTemplates = {
        object_create: "base_automation.ActionsOne2ManyField.Action.ObjectCreateOrWrite",
        object_write: "base_automation.ActionsOne2ManyField.Action.ObjectCreateOrWrite",
    };
    setup() {
        this.root = useRef("root");

        let adaptCounter = 0;
        useEffect(() => {
            this.adapt();
        }, () => [adaptCounter]);
        const throttledRenderAndAdapt = useThrottleForAnimation(() => {
            adaptCounter++;
            this.render();
        });
        useExternalListener(window, "resize", throttledRenderAndAdapt);

        this.currentActions = this.props.record.data[this.props.name].records;
        this.hiddenActionsCount = 0;
    }
    async adapt() {
        // --- Initialize ---
        // use getBoundingClientRect to get unrounded width
        // of the elements in order to avoid rounding issues
        const rootWidth = this.root.el.getBoundingClientRect().width;

        // remove all d-none classes (needed to get the real width of the elements)
        const actionsEls = Array.from(this.root.el.children).filter((el) => el.dataset.actionId);
        actionsEls.forEach((el) => el.classList.remove("d-none"));
        const actionsTotalWidth = actionsEls.reduce(
            (sum, el) => sum + el.getBoundingClientRect().width,
            0
        );

        // --- Check first overflowing action ---
        let overflowingActionId;
        if (actionsTotalWidth > rootWidth) {
            let width = 56; // for the ellipsis
            for (const el of actionsEls) {
                const elWidth = el.getBoundingClientRect().width;
                if (width + elWidth > rootWidth) {
                    // All the remaining elements are overflowing
                    overflowingActionId = el.dataset.actionId;
                    const firstOverflowingEl = actionsEls.find(
                        (el) => el.dataset.actionId === overflowingActionId
                    );
                    const firstOverflowingIndex = actionsEls.indexOf(firstOverflowingEl);
                    const overflowingEls = actionsEls.slice(firstOverflowingIndex);
                    // hide overflowing elements
                    overflowingEls.forEach((el) => el.classList.add("d-none"));
                    break;
                }
                width += elWidth;
            }
        }

        // --- Final rendering ---
        const initialHiddenActionsCount = this.hiddenActionsCount;
        this.hiddenActionsCount = overflowingActionId
            ? this.currentActions.length - this.currentActions.findIndex((action) => action.id === overflowingActionId)
            : 0;
        if (initialHiddenActionsCount !== this.hiddenActionsCount) {
            // Render only if hidden actions count has changed.
            return this.render();
        }
    }
    getActionTemplate(action) {
        return this.constructor.actionTemplates[action.data.state];
    }
    getActionType(action) {
        return (
            action.fields.state.selection.find(([type]) => type === action.data.state)?.[1] ||
            action.data.state
        );
    }
    get moreText() {
        const singularOrPlural = this.hiddenActionsCount === 1
            ? _t("1 more action")
            : _t("%s more actions");
        return sprintf(singularOrPlural, this.hiddenActionsCount);
    }
}

const actionsOne2ManyField = {
    component: ActionsOne2ManyField,
    relatedFields: (info) => {
        const relatedFields = [
            { name: "name", type: "char" },
            {
                name: "state",
                type: "selection",
                selection: [
                    ["code", _t("Execute Python Code")],
                    ["object_create", _t("Create a new Record")],
                    ["object_write", _t("Update the Record")],
                    ["multi", _t("Execute several actions")],
                    ["mail_post", _t("Send email")],
                ],
            },
            // Execute Python Code
            { name: "code", type: "text" },
            // Create
            { name: "crud_model_id", type: "many2one" },
            { name: "crud_model_name", type: "char" },
            { name: "fields_lines", type: "one2many" },
            // Add Followers
            { name: "partner_ids", type: "many2many" },
            // Message Post / Email
            { name: "template_id", type: "many2one" },
            { name: "mail_post_autofollow", type: "boolean" },
            { name: "mail_post_method", type: "selection" },
            // Schedule Next Activity
            { name: "activity_type_id", type: "many2one" },
            { name: "activity_summary", type: "char" },
            { name: "activity_note", type: "html" },
            { name: "activity_date_deadline_range", type: "integer" },
            { name: "activity_date_deadline_range_type", type: "selection" },
            { name: "activity_user_type", type: "selection" },
            { name: "activity_user_id", type: "many2one" },
            { name: "activity_user_field_name", type: "char" },
        ];
        return relatedFields;
    },
};

registry.category("fields").add("base_automation_actions_one2many", actionsOne2ManyField);
