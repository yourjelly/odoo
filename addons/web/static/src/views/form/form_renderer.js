/** @odoo-module **/

import { Notebook } from "@web/core/notebook/notebook";
import { Field } from "@web/views/fields/field";
import { ButtonBox } from "@web/views/form/button_box/button_box";
import { InnerGroup, OuterGroup } from "@web/views/form/form_group/form_group";
import { ViewButton } from "@web/views/view_button/view_button";
import { useViewCompiler } from "@web/views/view_compiler";
import { useBounceButton } from "@web/views/view_hook";
import { Widget } from "@web/views/widgets/widget";
import { evalDomain } from "../utils";
import { FormCompiler } from "./form_compiler";
import { FormLabel } from "./form_label";
import { StatusBarButtons } from "./status_bar_buttons/status_bar_buttons";

const { Component, useEffect, useSubEnv, useRef, useState, xml } = owl;

export class FormRenderer extends Component {
    setup() {
        const { arch, autofocusFieldId, disableAutofocus, xmlDoc } = this.props.archInfo;
        this.state = useState({}); // Used by Form Compiler
        this.templateId = useViewCompiler(this.props.Compiler || FormCompiler, arch, xmlDoc);
        useSubEnv({ model: this.props.record.model });
        const compiledViewRef = useRef("compiled_view_root");
        useBounceButton(compiledViewRef, () => {
            return !this.props.record.isInEdition;
        });
        if (!disableAutofocus) {
            useEffect(
                (isInEdition) => {
                    debugger;
                    if (isInEdition) {
                        const elementToFocus =
                            (autofocusFieldId &&
                                compiledViewRef.el.querySelector(`#${autofocusFieldId}`)) ||
                            compiledViewRef.el.querySelector(".o_content .o_field_widget input");
                        if (elementToFocus) {
                            elementToFocus.focus();
                        }
                    }
                },
                () => [this.props.record.isInEdition]
            );
        }
    }

    evalDomainFromRecord(record, expr) {
        return evalDomain(expr, record.evalContext);
    }
}

FormRenderer.template = xml`<t t-call="{{ templateId }}" />`;
FormRenderer.components = {
    Field,
    FormLabel,
    ButtonBox,
    ViewButton,
    Widget,
    Notebook,
    OuterGroup,
    InnerGroup,
    StatusBarButtons,
};
