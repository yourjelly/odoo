import { Editor } from "@html_editor/editor";
import { HtmlField } from "@html_editor/fields/html_field";
import { HtmlViewer } from "@html_editor/fields/html_viewer";
import { copyCssRules } from "@html_editor/wysiwyg";
import {
    Component,
    EventBus,
    onMounted,
    onWillStart,
    reactive,
    useRef,
    useSubEnv,
} from "@odoo/owl";
import { loadBundle, loadJS } from "@web/core/assets";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { LazyComponent } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
import { Mutex } from "@web/core/utils/concurrency";

const legacyEventToNewEvent = {
    historyStep: "ADD_STEP",
    historyUndo: "HISTORY_UNDO",
    historyRedo: "HISTORY_REDO",
};

/**
 * Swap the previous theme's default images with the new ones.
 * (Redefine the `src` attribute of all images in a $container, depending on the theme parameters.)
 *
 * @private
 * @param {Object} themeParams
 * @param {JQuery} $container
 */
function switchImages(themeParams, $container) {
    if (!themeParams) {
        return;
    }
    for (const img of $container.find("img")) {
        const $img = $(img);
        const src = $img.attr("src");
        $img.removeAttr("loading");

        let m = src.match(/^\/web\/image\/\w+\.s_default_image_(?:theme_[a-z]+_)?(.+)$/);
        if (!m) {
            m = src.match(
                /^\/\w+\/static\/src\/img\/(?:theme_[a-z]+\/)?s_default_image_(.+)\.[a-z]+$/
            );
        }
        if (!m) {
            return;
        }

        if (themeParams.get_image_info) {
            const file = m[1];
            const imgInfo = themeParams.get_image_info(file);

            const src = imgInfo.format
                ? `/${imgInfo.module}/static/src/img/theme_${themeParams.name}/s_default_image_${file}.${imgInfo.format}`
                : `/web/image/${imgInfo.module}.s_default_image_theme_${themeParams.name}_${file}`;

            $img.attr("src", src);
        }
    }
}
export class MassMailingHtmlField extends HtmlField {
    static template = "mass_mailing.MassMailingHtmlField";
    static components = { ...HtmlField.components, LazyComponent };

    setup() {
        super.setup();
        this.fieldConfig = reactive({
            selectedTheme: null,
            $scrollable: null,
        });

        useSubEnv({
            // onWysiwygReset: this._resetIframe.bind(this),
            switchImages,
            fieldConfig: this.fieldConfig,
        });

        onWillStart(async () => {
            
            await loadBundle("web_editor.backend_assets_wysiwyg");

            await loadBundle("web_editor.assets_wysiwyg");
            await loadBundle("mass_mailing.assets_snippets_menu");
            this.getColorPickerTemplateService = this.env.services.get_color_picker_template;

            const { MassMailingSnippetsMenu } = await odoo.loader.modules.get(
                "@mass_mailing/js/snippets.editor"
            );
            this.MassMailingSnippetsMenu = MassMailingSnippetsMenu;
        });
    }

    // return {
    //     ...super.wysiwygOptions,
    //     onIframeUpdated: () => this.onIframeUpdated(),
    //     getCodeViewValue: (editableEl) => this._getCodeViewValue(editableEl),
    //     snippets: 'mass_mailing.email_designer_snippets',
    //     resizable: false,
    //     linkOptions: {
    //         ...super.wysiwygOptions.linkOptions,
    //         initialIsNewWindow: true,
    //     },
    //     toolbarOptions: {
    //         ...super.wysiwygOptions.toolbarOptions,
    //         dropDirection: 'dropup',
    //     },
    //     onWysiwygBlur: () => {
    //         this.commitChanges();
    //         this.wysiwyg.odooEditor.toolbarHide();
    //     },
    //     dropImageAsAttachment: false,
    //     useResponsiveFontSizes: false,
    //     ...this.props.wysiwygOptions,
    // };
    get menuProps() {
        const editor = this.editor;
        const self = this;
        const options = {
            mutex: new Mutex(),
            snippets: "mass_mailing.email_designer_snippets",

            wysiwyg: {
                get $editable() {
                    return $(editor.editable);
                },
                getEditable: () => $(editor.editable),
                isSaving: () => false,
                getColorpickerTemplate: () => {
                    return this.getColorPickerTemplateService();
                },
                state: {
                    toolbarProps: {},
                },
                odooEditor: {
                    get document() {
                        return editor.document;
                    },
                    addEventListener: (legacyEvent) => {
                        const event = legacyEventToNewEvent[legacyEvent];
                        // if (!event) {
                        //     throw new Error(`Missing event to map ${legacyEvent}`);
                        // }
                    },
                    automaticStepSkipStack() {
                        //@todo @phoenix to check
                    },
                    /**
                     * Find all descendants of `element` with a `data-call` attribute and bind
                     * them on click to the execution of the command matching that
                     * attribute.
                     */
                    bindExecCommand(element) {
                        // for (const buttonEl of element.querySelectorAll("[data-call]")) {
                        //     buttonEl.addEventListener("click", (ev) => {
                        //         if (!this.isSelectionInEditable()) {
                        //             this.historyResetLatestComputedSelection(true);
                        //         }
                        //         const arg1 = buttonEl.dataset.arg1;
                        //         const args = (arg1 && arg1.split(",")) || [];
                        //         this.execCommand(buttonEl.dataset.call, ...args);

                        //         ev.preventDefault();
                        //         this._updateToolbar();
                        //     });
                        // }
                    },
                },
            },
        };
        return {
            bus: new EventBus(),
            options,
        };
    }

    get wysiwygProps() {
        const props = super.wysiwygProps;
        return {
            ...props,
            iframe: true,
            copyCss: true,
        };
    }
}

export const massMailingHtmlField = {
    // ...htmlField,
    component: MassMailingHtmlField,
    additionalClasses: ["w-100", "h-100"],

    // displayName: _t("Email"),
    // supportedOptions: [...htmlField.supportedOptions, {
    //     label: _t("Filter templates"),
    //     name: "filterTemplates",
    //     type: "boolean"
    // }, {
    //     label: _t("Inline field"),
    //     name: "inline-field",
    //     type: "field"
    // }],
    // extractProps({ attrs, options }) {
    //     const props = htmlField.extractProps(...arguments);
    //     props.filterTemplates = options.filterTemplates;
    //     props.inlineField = options['inline-field'];
    //     props.iframeHtmlClass = attrs.iframeHtmlClass;
    //     return props;
    // },
    // fieldDependencies: [{ name: 'body_html', type: 'html', readonly: 'false' }],
};

registry.category("fields").add("mass_mailing_html", massMailingHtmlField);
