/** @odoo-module */

import { useService } from '@web/core/utils/hooks';
import { FormRenderer } from '@web/views/form/form_renderer';

const { useRef, useEffect } = owl;

export class FormRendererWithHtmlExpander extends FormRenderer {
    setup() {
        super.setup();
    }
}
