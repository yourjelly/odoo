/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _lt } from "@web/core/l10n/translation";
import { useInputField } from "../input_field_hook";
import { standardFieldProps } from "../standard_field_props";

const { Component, useState } = owl;

export class UrlField extends Component {
    setup() {
        useInputField({ getValue: () => this.props.value || "" });
        this.state = useState({
            isEditing: !this.canDisplayAsLink,
        });
    }

    get canDisplayAsLink() {
        return Boolean(this.props.value);
    }

    get formattedHref() {
        let value = "";
        if (typeof this.props.value === "string") {
            const shouldaddPrefix = !(
                this.props.websitePath ||
                this.props.value.includes("://") ||
                /^\//.test(this.props.value)
            );
            value = shouldaddPrefix ? `http://${this.props.value}` : this.props.value;
        }
        return value;
    }

    toggleEdition(ev, shouldSave) {
        if (shouldSave) {
            this.props.update(ev.target.previousElementSibling.value);
        }
        this.state.isEditing = !this.state.isEditing;
    }
}

UrlField.template = "web.UrlField";
UrlField.props = {
    ...standardFieldProps,
    placeholder: { type: String, optional: true },
    text: { type: String, optional: true },
    websitePath: { type: Boolean, optional: true },
};

UrlField.displayName = _lt("URL");
UrlField.supportedTypes = ["char"];

UrlField.extractProps = ({ attrs }) => {
    return {
        text: attrs.text,
        websitePath: attrs.options.website_path,
        placeholder: attrs.placeholder,
    };
};

registry.category("fields").add("url", UrlField);

export class ListUrlField extends UrlField {
    get canDisplayAsLink() {
        return this.props.readonly;
    }
}
registry.category("fields").add("list.url", ListUrlField);
