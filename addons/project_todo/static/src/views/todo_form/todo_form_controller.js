/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { user } from "@web/core/user";
import { FormController } from "@web/views/form/form_controller";
import { TodoEditableBreadcrumbName } from "@project_todo/components/todo_editable_breadcrumb_name/todo_editable_breadcrumb_name";
import { TodoDoneCheckmark } from "@project_todo/components/todo_done_checkmark/todo_done_checkmark";
import { PriorityField } from "@web/views/fields/priority/priority_field";

import { onWillStart, useState } from "@odoo/owl";
import { TodoTagIds } from "../../components/todo_tag_ids/todo_tag_ids";
import { TodoUserIds } from "../../components/todo_user_ids/todo_user_ids";
import { TodoChatterPanel } from "../../components/todo_chatter_panel/todo_chatter_panel";
import { StatusBarField } from "@web/views/fields/statusbar/statusbar_field";
/**
 *  The FormController is overridden to be able to manage the edition of the name of a to-do directly
 *  in the breadcrumb as well as the mark as done button next to it.
 */

export class TodoFormController extends FormController {
    static template = "project_todo.TodoFormView";
    static components = {
        ...FormController.components,
        TodoEditableBreadcrumbName,
        TodoDoneCheckmark,
        PriorityField,
        TodoTagIds,
        TodoUserIds,
        TodoChatterPanel,
        StatusBarField,
    };
    setup() {
        super.setup();
        this.state = useState({
            displayChatter: false
        });
        onWillStart(async () => {
            this.projectAccess = await user.hasGroup("project.group_project_user");
        });
    }

    get actionMenuItems() {
        const actionToKeep = ["archive", "unarchive", "duplicate", "delete"];
        const menuItems = super.actionMenuItems;
        const filteredActions =
            menuItems.action?.filter((action) => actionToKeep.includes(action.key)) || [];

        if (this.projectAccess) {
            filteredActions.push({
                description: _t("Convert to Task"),
                callback: () => {
                    this.model.action.doAction(
                        "project_todo.project_task_action_convert_todo_to_task",
                        {
                            props: {
                                resId: this.model.root.resId,
                            },
                        }
                    );
                },
            });
        }
        menuItems.action = filteredActions;
        menuItems.print = [];
        return menuItems;
    }

    toggleChatter() {
        if (this.props.record.resId) {
            this.state.displayChatter = !this.state.displayChatter;
            this.env.bus.trigger('TODO:TOGGLE_CHATTER', {displayChatter: this.state.displayChatter});
        }
    }
}
