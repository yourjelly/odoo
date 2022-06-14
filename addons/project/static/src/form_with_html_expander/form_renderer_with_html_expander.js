/** @odoo-module */

import { useService } from '@web/core/utils/hooks';
import { FormRenderer } from '@web/views/form/form_renderer';

const { onMounted } = owl;

export class FormRendererWithHtmlExpander extends FormRenderer {
    setup() {
        super.setup();
        this.ui = useService('ui');
        onMounted(() => {
            if (this.ui.size === 6) {
                const descriptionField = document.querySelector(this.htmlFieldQuerySelector);
                if (descriptionField) {
                    const editor = descriptionField.querySelector('.note-editable');
                    const elementToResize = editor || descriptionField;
                    const minHeight = document.documentElement.clientHeight - elementToResize.getBoundingClientRect().top - this.bottomDistanceForDescriptionField;
                    elementToResize.style.minHeight = `${minHeight}px`;
                }
            }
        });
    }

    get htmlFieldQuerySelector() {
        return '.oe_form_field.oe_form_field_html';
    }

    get bottomDistanceForDescriptionField() {
        return 58;
    }
}
