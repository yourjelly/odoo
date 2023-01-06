/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _lt } from "@web/core/l10n/translation";
import { useSpellCheck } from "@web/core/utils/hooks";
import { useInputField } from "../input_field_hook";
import { standardFieldProps } from "../standard_field_props";
import { TranslationButton } from "../translation_button";
import { useDynamicPlaceholder } from "../dynamicplaceholder_hook";
import { parseInteger } from "../parsers";

import { Component, useEffect, onMounted, onWillUnmount, useRef } from "@odoo/owl";

export class TextField extends Component {
    setup() {
        this.textareaRef = useRef("textarea");
        if (this.props.dynamicPlaceholder) {
            this.dynamicPlaceholder = useDynamicPlaceholder(this.textareaRef);
            onMounted(() => {
                this.dynamicPlaceholder.refreshBaseModel();
                this.dynamicPlaceholder.addTriggerKeyListener();
            });
            onWillUnmount(this.dynamicPlaceholder.removeTriggerKeyListener);
        }
        useInputField({ getValue: () => this.props.value || "", refName: "textarea" });
        useSpellCheck({ refName: "textarea" });

        useEffect(() => {
            if (!this.props.readonly) {
                this.resize();
            }
            if (this.dynamicPlaceholder) {
                this.dynamicPlaceholder.refreshBaseModel();
            }
        });
    }

    get minimumHeight() {
        return 50;
    }
    get rowCount() {
        return this.props.rowCount;
    }

    resize() {
        const textarea = this.textareaRef.el;
        let heightOffset = 0;
        const style = window.getComputedStyle(textarea);
        if (style.boxSizing === "border-box") {
            const paddingHeight = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
            const borderHeight =
                parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
            heightOffset = borderHeight + paddingHeight;
        }
        const previousStyle = {
            borderTopWidth: style.borderTopWidth,
            borderBottomWidth: style.borderBottomWidth,
            padding: style.padding,
        };
        Object.assign(textarea.style, {
            height: "auto",
            borderTopWidth: 0,
            borderBottomWidth: 0,
            padding: 0,
        });
        textarea.style.height = "auto";
        const height = Math.max(this.minimumHeight, textarea.scrollHeight + heightOffset);
        Object.assign(textarea.style, previousStyle, { height: `${height}px` });
    }

    onInput() {
        this.resize();
    }
}

TextField.template = "web.TextField";
TextField.components = {
    TranslationButton,
};
TextField.defaultProps = {
    dynamicPlaceholder: false,
    rowCount: 2,
};
TextField.props = {
    ...standardFieldProps,
    isTranslatable: { type: Boolean, optional: true },
    placeholder: { type: String, optional: true },
    dynamicPlaceholder: { type: Boolean, optional: true },
    rowCount: { type: Number, optional: true },
};

TextField.displayName = _lt("Multiline Text");
TextField.supportedTypes = ["html", "text"];

TextField.extractProps = ({ attrs, field }) => {
    const props = {
        isTranslatable: field.translate,
        placeholder: attrs.placeholder,
        dynamicPlaceholder: attrs.options.dynamic_placeholder,
    };
    if (attrs.rows) {
        props.rowCount = parseInteger(attrs.rows);
    }
    return props;
};

registry.category("fields").add("text", TextField);

export class ListTextField extends TextField {
    get minimumHeight() {
        return 0;
    }
    get rowCount() {
        return this.props.rowCount;
    }
}
ListTextField.defaultProps = {
    ...TextField.defaultProps,
    rowCount: 1,
};

registry.category("fields").add("list.text", ListTextField);
