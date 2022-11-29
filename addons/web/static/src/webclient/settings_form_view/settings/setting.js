/** @odoo-module **/

import { escapeRegExp } from "@web/core/utils/strings";
import { HighlightText } from "../highlight_text/highlight_text";
import { session } from "@web/session";
import { FormLabelHighlightText } from "../highlight_text/form_label_highlight_text";
import { Component, useState } from "@odoo/owl";

export class Setting extends Component {
    setup() {
        this.state = useState({
            search: this.env.searchState,
            showAllContainer: this.env.showAllContainer,
        });
        this.labels = this.props.labels || [];
        this.labels.push(this.labelString, this.props.help);
        if (this.props.fieldName) {
            this.fieldType = this.props.record.fields[this.props.fieldName].type;
            if (typeof this.props.fieldInfo.modifiers.readonly === "boolean") {
                this.labelClassName = "o_form_label";
            }
        }
        this.displayCompanySpecificIcon = session.display_switch_company_menu;
    }

    get classNames() {
        const { class: _class } = this.props;
        const classNames = {
            o_setting_box: true,
            "col-12": true,
            "col-lg-6": true,
            o_searchable_setting: Boolean(this.labels.length),
            [_class]: Boolean(_class),
        };

        return classNames;
    }

    get labelString() {
        const label =
            this.props.record &&
            this.props.record.fields[this.props.fieldName] &&
            this.props.record.fields[this.props.fieldName].string;
        return this.props.string || label || "";
    }

    get url() {
        if (
            this.props.documentation.startsWith("https://") ||
            this.props.documentation.startsWith("http://")
        ) {
            return this.props.documentation;
        } else {
            const serverVersion = session.server_version;
            return "https://www.odoo.com/documentation/" + serverVersion + this.props.documentation;
        }
    }
    visible() {
        if (!this.state.search.value) {
            return true;
        }
        if (this.state.showAllContainer.showAllContainer) {
            return true;
        }
        const regexp = new RegExp(escapeRegExp(this.state.search.value), "i");
        if (regexp.test(this.labels.join())) {
            return true;
        }
        return false;
    }
}
Setting.components = {
    FormLabelHighlightText,
    HighlightText,
};
Setting.template = "web.Setting";
