/** @odoo-module */

import { useService } from '@web/core/utils/hooks';
import { FormRenderer } from '@web/views/form/form_renderer';
import { qweb } from "web.core";
import {Markup} from "web.utils";

const { useRef, useEffect, onMounted, } = owl;

export class FormRendererWithHtmlExpander extends FormRenderer {
    setup() {
        debugger
        super.setup();
        this.ui = useService('ui');
        const ref = useRef('compiled_view_root');
        useEffect(
            (el, size) => {
                if (el && size === 6) {
                    const descriptionField = el.querySelector(this.htmlFieldQuerySelector);
                    if (descriptionField) {
                        const editor = descriptionField.querySelector('.note-editable');
                        const elementToResize = editor || descriptionField;
                        const { bottom, height } = elementToResize.getBoundingClientRect();
                        const minHeight = document.documentElement.clientHeight - bottom - height;
                        elementToResize.style.minHeight = `${minHeight}px`;
                    }
                }
            },
            () => [ref.el, this.ui.size, this.props.record.mode],
        );

        onMounted(()=>{
            const content = document.querySelector('.o_project_update_description');
            // const template = `<div>Project update description with JS</div>` + this.props.record.data.project_id + 'Discription values' + this.props.record.data.description
            const template = "project.ProjectUpdateDescription"
            $(content).html(qweb.render(template, {
                description: Markup(this.props.record.data.description),
            }));
        }
        );

    }

    get htmlFieldQuerySelector() {
        return '.oe_form_field.oe_form_field_html';
    }
}
