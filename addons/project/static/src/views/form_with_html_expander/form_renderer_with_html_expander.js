/** @odoo-module */

import { useService } from '@web/core/utils/hooks';
import { FormRenderer } from '@web/views/form/form_renderer';

const { useRef, useEffect } = owl;

export class FormRendererWithHtmlExpander extends FormRenderer {
    setup() {
        super.setup();
        this.ui = useService('ui');
        const ref = useRef('compiled_view_root');
        useEffect(
            (el, size) => {
                if (el && size === 6 && this.options) {
                    this.options.element.style.minHeight = this.options.minHeight;
                }
            },
            () => [ref.el, this.ui.size, this.props.record.mode],
        );
    }

    get htmlFieldQuerySelector() {
        return '.oe_form_field.oe_form_field_html';
    }
}
