/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";
import { View } from "@web/views/view";

const { Component, markup, useState } = owl;

export class SelectCreateDialog extends Component {
    setup() {
        this.viewService = useService("view");
        this.state = useState({ resIds: [] });
        const type = this.props.type;
        const contextKey = type === "list" ? "tree_view_ref" : "kanban_view_ref";
        this.viewProps = {
            viewId: (this.props.context && this.props.context[contextKey]) || false,
            resModel: this.props.resModel,
            domain: this.props.domain,
            context: this.props.context,
            type, // "list" or "kanban"
            editable: false, // readonly
            showButtons: false,
            hasSelectors: this.props.multiSelect,
            selectRecord: async (resId) => {
                if (this.props.onSelected) {
                    await this.props.onSelected([resId]);
                    this.props.close();
                }
            },
            onSelectionChanged: (resIds) => {
                this.state.resIds = resIds;
            },
            noBreadcrumbs: true,
            searchViewId: this.props.searchViewId || false,
            display: { searchPanel: false },
            noContentHelp: markup(`<p>${this.env._t("No records found!")}</p>`),
            dynamicFilters: this.props.dynamicFilters || [],
        };
        if (this.props.type === "kanban") {
            this.viewProps.forceGlobalClick = true;
        }
    }

    async select() {
        if (this.props.onSelected) {
            await this.props.onSelected(this.state.resIds);
            this.props.close();
        }
    }
    async createEditRecord() {
        if (this.props.onCreateEdit) {
            await this.props.onCreateEdit();
            this.props.close();
        }
    }
}
SelectCreateDialog.components = { Dialog, View };
SelectCreateDialog.template = "web.SelectCreateDialog";

SelectCreateDialog.defaultProps = {
    multiSelect: true,
    type: "list",
};

/**
 * Props: (to complete)
 *
 * resModel
 * domain
 * context
 * title
 * onSelected
 * type
 */
