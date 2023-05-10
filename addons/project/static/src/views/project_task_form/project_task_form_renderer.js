/** @odoo-module */
import { useService } from '@web/core/utils/hooks';

import { FormRendererWithHtmlExpander } from "../form_with_html_expander/form_renderer_with_html_expander";
const { useRef, useEffect } = owl;

export class ProjectTaskFormRenderer extends FormRendererWithHtmlExpander {
    setup() {
        super.setup();
        this.ui = useService('ui');
        const ref = useRef('compiled_view_root');
        useEffect(
            (el, size) => {
                const descriptionField = el.querySelector(this.htmlFieldQuerySelector);

                if (descriptionField) {
                        const { bottom, height, top } = descriptionField.getBoundingClientRect();
                        console.log("descriptionField.getBoundingClientRect()", descriptionField.getBoundingClientRect())
                        console.log("document.documentElement.clientHeight", document.documentElement.clientHeight)
                        const minHeight = document.documentElement.clientHeight - (bottom + height) + top;
                        descriptionField.style.minHeight = `${minHeight}px`;
                    }
                },
            () => [ref.el, this.ui.size, this.props.record.mode],
        );
    }
    get htmlFieldQuerySelector() {
        return '.o_field_html[name="description"]';
    }
}
