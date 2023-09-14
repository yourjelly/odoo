/** @odoo-module **/

import FormEditorRegistry from "@website/js/form_editor_registry";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import weUtils from "@web_editor/js/common/utils";
import "@website/js/editor/snippets.options";
import { unique } from "@web/core/utils/arrays";
import { _t } from "@web/core/l10n/translation";
import { renderToElement } from "@web/core/utils/render";
import { SnippetOption } from "@web_editor/components/snippets_menu/snippets_options";
import { useService } from "@web/core/utils/hooks";
import { onWillStart, useEffect, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { KeepLast } from "@web/core/utils/concurrency";

let currentActionName;

const allFormsInfo = new Map();
const clearAllFormsInfo = () => {
    allFormsInfo.clear();
};
/**
 * Returns the domain of a field.
 *
 * @private
 * @param {HTMLElement} formEl
 * @param {String} name
 * @param {String} type
 * @param {String} relation
 * @returns {Object|false}
 */
function _getDomain(formEl, name, type, relation) {
    // We need this because the field domain is in formInfo in the
    // WebsiteFormEditor but we need it in the WebsiteFieldEditor.
    if (!allFormsInfo.get(formEl) || !name || !type || !relation) {
        return false;
    }
    const field = allFormsInfo.get(formEl).fields
        .find(el => el.name === name && el.type === type && el.relation === relation);
    return field && field.domain;
}

export class FormEditor extends SnippetOption {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.orm = useService("orm");
    }
    //----------------------------------------------------------------------
    // Private
    //----------------------------------------------------------------------

    /**
     * Returns a promise which is resolved once the records of the field
     * have been retrieved.
     *
     * @private
     * @param {Object} field
     * @returns {Promise<Object>}
     */
    async _fetchFieldRecords(field) {
        // Convert the required boolean to a value directly usable
        // in qweb js to avoid duplicating this in the templates
        field.required = field.required ? 1 : null;

        if (field.records) {
            return field.records;
        }
        // Set selection as records to avoid added conplexity
        if (field.type === 'selection') {
            field.records = field.selection.map(el => ({
                id: el[0],
                display_name: el[1],
            }));
        } else if (field.relation && field.relation !== 'ir.attachment') {
            field.records = await this.orm.searchRead(
                field.relation,
                field.domain || [],
                ['display_name']
            );
        }
        return field.records;
    }
    /**
     * Returns a field object
     *
     * @private
     * @param {string} type the type of the field
     * @param {string} name The name of the field used also as label
     * @returns {Object}
     */
    _getCustomField(type, name) {
        return {
            name: name,
            string: name,
            custom: true,
            type: type,
            // Default values for x2many fields and selection
            records: [{
                id: _t('Option 1'),
                display_name: _t('Option 1'),
            }, {
                id: _t('Option 2'),
                display_name: _t('Option 2'),
            }, {
                id: _t('Option 3'),
                display_name: _t('Option 3'),
            }],
        };
    }
    /**
     * Returns the default formatInfos of a field.
     *
     * @private
     * @returns {Object}
     */
    _getDefaultFormat() {
        return {
            labelWidth: this.$target[0].querySelector('.s_website_form_label').style.width,
            labelPosition: 'left',
            multiPosition: 'horizontal',
            requiredMark: this._isRequiredMark(),
            optionalMark: this._isOptionalMark(),
            mark: this._getMark(),
        };
    }
    /**
     * @private
     * @returns {string}
     */
    _getMark() {
        return this.$target[0].dataset.mark;
    }
    /**
     * Replace all `"` character by `&quot;`, all `'` character by `&apos;` and
     * all "`" character by `&lsquo;`. This is needed in order to be able to
     * perform querySelector of this type: `querySelector(`[name="${name}"]`)`.
     *
     * @param {string} name
     */
    _getQuotesEncodedName(name) {
        return name.replaceAll(/"/g, character => `&quot;`)
                   .replaceAll(/'/g, character => `&apos;`)
                   .replaceAll(/`/g, character => `&lsquo;`);
    }
    /**
     * @private
     * @returns {boolean}
     */
    _isOptionalMark() {
        return this.$target[0].classList.contains('o_mark_optional');
    }
    /**
     * @private
     * @returns {boolean}
     */
    _isRequiredMark() {
        return this.$target[0].classList.contains('o_mark_required');
    }
    /**
     * @private
     * @param {Object} field
     * @returns {HTMLElement}
     */
    _renderField(field, resetId = false) {
        if (!field.id) {
            field.id = weUtils.generateHTMLId();
        }
        const params = { field: { ...field } };
        if (["url", "email", "tel"].includes(field.type)) {
            params.field.inputType = field.type;
        }
        if (["boolean", "selection", "binary"].includes(field.type)) {
            params.field.isCheck = true;
        }
        if (field.type === "one2many" && field.relation !== "ir.attachment") {
            params.field.isCheck = true;
        }
        if (field.custom && !field.string) {
            params.field.string = field.name;
        }
        if (field.type === "description") {
            if (field.description) {
                params.default_description = _t("Describe your field here.");
            } else if (["email_cc", "email_to"].includes(field.name)) {
                params.default_description = _t("Separate email addresses with a comma.");
            }
        }
        const template = document.createElement('template');
        template.content.append(renderToElement("website.form_field_" + field.type, params));
        if (field.description && field.description !== true) {
            $(template.content.querySelector('.s_website_form_field_description')).replaceWith(field.description);
        }
        template.content.querySelectorAll('input.datetimepicker-input').forEach(el => el.value = field.propertyValue);
        template.content.querySelectorAll("[name]").forEach(el => {
            el.name = this._getQuotesEncodedName(el.name);
        });
        template.content.querySelectorAll("[data-name]").forEach(el => {
            el.dataset.name = this._getQuotesEncodedName(el.dataset.name);
        });
        return template.content.firstElementChild;
    }
}

export class FieldEditor extends FormEditor {
    VISIBILITY_DATASET = ['visibilityDependency', 'visibilityCondition', 'visibilityComparator', 'visibilityBetween'];

    /**
     * @override
     */
    setup() {
        super.setup();
        this.formEl = this.$target[0].closest('form');
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Returns the target as a field Object
     *
     * @private
     * @param {boolean} noRecords
     * @returns {Object}
     */
    _getActiveField(noRecords) {
        let field;
        const labelText = this.$target.find('.s_website_form_label_content').text();
        if (this._isFieldCustom()) {
            field = this._getCustomField(this.$target[0].dataset.type, labelText);
        } else {
            field = Object.assign({}, this.fields[this._getFieldName()]);
            field.string = labelText;
            field.type = this._getFieldType();
        }
        if (!noRecords) {
            field.records = this._getListItems();
        }
        this._setActiveProperties(field);
        return field;
    }
    /**
     * Returns the format object of a field containing
     * the position, labelWidth and bootstrap col class
     *
     * @private
     * @returns {Object}
     */
    _getFieldFormat() {
        let requiredMark, optionalMark;
        const mark = this.$target[0].querySelector('.s_website_form_mark');
        if (mark) {
            requiredMark = this._isFieldRequired();
            optionalMark = !requiredMark;
        }
        const multipleInput = this._getMultipleInputs();
        const format = {
            labelPosition: this._getLabelPosition(),
            labelWidth: this.$target[0].querySelector('.s_website_form_label').style.width,
            multiPosition: multipleInput && multipleInput.dataset.display || 'horizontal',
            col: [...this.$target[0].classList].filter(el => el.match(/^col-/g)).join(' '),
            requiredMark: requiredMark,
            optionalMark: optionalMark,
            mark: mark && mark.textContent,
        };
        return format;
    }
    /**
     * Returns the name of the field
     *
     * @private
     * @returns {string}
     */
    _getFieldName() {
        const multipleName = this.$target[0].querySelector('.s_website_form_multiple');
        return multipleName ? multipleName.dataset.name : this.$target[0].querySelector('.s_website_form_input').name;
    }
    /**
     * Returns the type of the  field, can be used for both custom and existing fields
     *
     * @private
     * @returns {string}
     */
    _getFieldType() {
        return this.$target[0].dataset.type;
    }
    /**
     * @private
     * @returns {string}
     */
    _getLabelPosition() {
        const label = this.$target[0].querySelector('.s_website_form_label');
        if (this.$target[0].querySelector('.row:not(.s_website_form_multiple)')) {
            return label.classList.contains('text-end') ? 'right' : 'left';
        } else {
            return label.classList.contains('d-none') ? 'none' : 'top';
        }
    }
    /**
     * Returns the multiple checkbox/radio element if it exist else null
     *
     * @private
     * @returns {HTMLElement}
     */
    _getMultipleInputs() {
        return this.$target[0].querySelector('.s_website_form_multiple');
    }
    /**
     * Returns true if the field is a custom field, false if it is an existing field
     *
     * @private
     * @returns {boolean}
     */
    _isFieldCustom() {
        return !!this.$target[0].classList.contains('s_website_form_custom');
    }
    /**
     * Returns true if the field is required by the model or by the user.
     *
     * @private
     * @returns {boolean}
     */
    _isFieldRequired() {
        const classList = this.$target[0].classList;
        return classList.contains('s_website_form_required') || classList.contains('s_website_form_model_required');
    }
    /**
     * Set the active field properties on the field Object
     *
     * @param {Object} field Field to complete with the active field info
     */
    _setActiveProperties(field) {
        const classList = this.$target[0].classList;
        const textarea = this.$target[0].querySelector('textarea');
        const input = this.$target[0].querySelector('input[type="text"], input[type="email"], input[type="number"], input[type="tel"], input[type="url"], textarea');
        const fileInputEl = this.$target[0].querySelector("input[type=file]");
        const description = this.$target[0].querySelector('.s_website_form_field_description');
        field.placeholder = input && input.placeholder;
        if (input) {
            // textarea value has no attribute,  date/datetime timestamp property is formated
            field.value = input.getAttribute('value') || input.value;
        } else if (field.type === 'boolean') {
            field.value = !!this.$target[0].querySelector('input[type="checkbox"][checked]');
        } else if (fileInputEl) {
            field.maxFilesNumber = fileInputEl.dataset.maxFilesNumber;
            field.maxFileSize = fileInputEl.dataset.maxFileSize;
        }
        // property value is needed for date/datetime (formated date).
        field.propertyValue = input && input.value;
        field.description = description && description.outerHTML;
        field.rows = textarea && textarea.rows;
        field.required = classList.contains('s_website_form_required');
        field.modelRequired = classList.contains('s_website_form_model_required');
        field.hidden = classList.contains('s_website_form_field_hidden');
        field.formatInfo = this._getFieldFormat();
    }
}

class WebsiteFormEditor extends FormEditor {
    static template = "website.WebsiteFormEditor";

    setup() {
        super.setup();
        this.state = useState({
            activeForm: {},
        });

        this.dialogs = useService("dialog");
        this.notifications = useService("notification");

        this.formFieldsKeepLast = new KeepLast();

        this.env.validMethodNames.push(
            "addActionField",
            "promptSaveRedirect",
            "onSuccess",
            "selectAction",
            "setMark",
            "toggleRecaptchaLegal"
        );

        onWillStart(async () => {
            this.modelCantChange = this.$target.attr('hide-change-model') !== undefined;
            if (this.modelCantChange) {
                return;
            }

            // Get list of website_form compatible models.
            this.models = await this.orm.call(
                "ir.model",
                "get_compatible_form_models"
            );

            const targetModelName = this.$target[0].dataset.model_name || 'mail.mail';
            this.state.activeForm = this.models.find(m => m.model === targetModelName);
            currentActionName = this.state.activeForm.website_form_label;
            await this.prepareRender();
        });

        useEffect(
            () => {
            },
            () => [this.state.activeForm.website_form_key]
        );
    }
    /**
     * @override
     */
    start() {
        const proms = [super.start(...arguments)];
        // Disable text edition
        this.$target.attr('contentEditable', false);
        // Make button, description, and recaptcha editable
        this.$target.find('.s_website_form_send, .s_website_form_field_description, .s_website_form_recaptcha').attr('contentEditable', true);
        // Get potential message
        this.$message = this.$target.parent().find('.s_website_form_end_message');
        this.showEndMessage = false;
        // If the form has no model it means a new snippet has been dropped.
        // Apply the default model selected in willStart on it.
        if (!this.$target[0].dataset.model_name) {
            proms.push(this._applyFormModel());
        }
        return Promise.all(proms);
    }
    /**
     * @override
     */
    cleanForSave() {
        const model = this.$target[0].dataset.model_name;
        // because apparently this can be called on the wrong widget and
        // we may not have a model, or fields...
        if (model) {
            // we may be re-whitelisting already whitelisted fields. Doesn't
            // really matter.
            const fields = [...this.$target[0].querySelectorAll('.s_website_form_field:not(.s_website_form_custom) .s_website_form_input')].map(el => el.name);
            if (fields.length) {
                // ideally we'd only do this if saving the form
                // succeeds... but no idea how to do that
                this.orm.call(
                    'ir.model.fields',
                    'formbuilder_whitelist',
                    [model, unique(fields)],
                );
            }
        }
        if (this.$message.length) {
            this.$target.removeClass('d-none');
            this.$message.addClass("d-none");
        }
    }
    /**
     * @override
     */
    async updateUI() {
        await super.updateUI();
        // End Message UI
        this.updateUIEndMessage();
    }
    /**
     * @see this.updateUI
     */
    updateUIEndMessage() {
        this.$target.toggleClass("d-none", this.showEndMessage);
        this.$message.toggleClass("d-none", !this.showEndMessage);
    }
    /**
     * @override
     */
    async notify(name, data) {
        await super.notify(...arguments);
        if (name === 'field_mark') {
            this._setLabelsMark();
        } else if (name === 'add_field') {
            const field = this._getCustomField('char', 'Custom Text');
            field.formatInfo = data.formatInfo;
            field.formatInfo.requiredMark = this._isRequiredMark();
            field.formatInfo.optionalMark = this._isOptionalMark();
            field.formatInfo.mark = this._getMark();
            const fieldEl = this._renderField(field);
            data.$target.after(fieldEl);
            this.env.activateSnippet(fieldEl);
        }
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Select the value of a field (hidden) that will be used on the model as a preset.
     * ie: The Job you apply for if the form is on that job's page.
     */
    addActionField(previewMode, value, params) {
        const fieldName = params.fieldName;
        if (params.isSelect === 'true') {
            value = parseInt(value);
        }
        this._addHiddenField(value, fieldName);
    }
    /**
     * Prompts the user to save changes before being redirected
     * towards an action specified in value.
     *
     * @see this.selectClass for parameters
     */
    promptSaveRedirect(name, value, widgetValue) {
        return new Promise((resolve, reject) => {
            const message = _t("Would you like to save before being redirected? Unsaved changes will be discarded.");
            this.dialogs.add(ConfirmationDialog, {
                body: message,
                confirm: () => {
                    this.env.requestSave({
                        reload: false,
                        onSuccess: () => {
                            this._redirectToAction(value);
                        },
                        onFailure: () => {
                            this.notifications.add(
                                _t("Something went wrong."),
                                {
                                    type: 'danger',
                                    sticky: true,
                                }
                            );
                            reject();
                        },
                    });
                    resolve();
                },
                cancel: () => resolve(),
                confirmLabel: _t("Save"),
                confirmClass: "btn-primary",
                cancelLabel: _t("Discard"),
            });
        });
    }
    /**
     * Changes the onSuccess event.
     */
    onSuccess(previewMode, value, params) {
        this.$target[0].dataset.successMode = value;
        if (value === 'message') {
            if (!this.$message.length) {
                this.$message = $(renderToElement('website.s_website_form_end_message'));
            }
            this.$target.after(this.$message);
        } else {
            this.showEndMessage = false;
            this.$message.remove();
        }
    }
    /**
     * Select the model to create with the form.
     */
    async selectAction(previewMode, value, params) {
        if (this.modelCantChange) {
            return;
        }
        await this._applyFormModel(parseInt(value));
    }
    /**
     * @override
     */
    async selectClass(previewMode, value, params) {
        await super.selectClass(...arguments);
        if (params.name === 'field_mark_select') {
            this._setLabelsMark();
        }
    }
    /**
     * Set the mark string on the form
     */
    setMark(previewMode, value, params) {
        this.$target[0].dataset.mark = value.trim();
        this._setLabelsMark();
    }
    /**
     * Toggle the recaptcha legal terms
     */
    toggleRecaptchaLegal(previewMode, value, params) {
        const recaptchaLegalEl = this.$target[0].querySelector('.s_website_form_recaptcha');
        if (recaptchaLegalEl) {
            recaptchaLegalEl.remove();
        } else {
            const labelWidth = this.$target[0].querySelector('.s_website_form_label').style.width;
            const legal = renderToElement("website.s_website_form_recaptcha_legal", {
                labelWidth: labelWidth,
            });
            legal.setAttribute('contentEditable', true);
            this.$target.find('.s_website_form_submit').before(legal);
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        switch (methodName) {
            case 'selectAction':
                return this.state.activeForm.id;
            case 'addActionField': {
                const value = this.$target.find(`.s_website_form_dnone input[name="${params.fieldName}"]`).val();
                if (value) {
                    return value;
                } else {
                    return params.isSelect ? '0' : '';
                }
            }
            case 'onSuccess':
                return this.$target[0].dataset.successMode;
            case 'setMark':
                return this._getMark();
            case 'toggleRecaptchaLegal':
                return !this.$target[0].querySelector('.s_website_form_recaptcha') || '';
        }
        return super.computeWidgetState(...arguments);
    }
    /**
     * Prepares the state with the correct values to trigger a re-render.
     *
     * @returns {Promise<Awaited<unknown>[]>}
     */
    prepareRender() {
        if (this.modelCantChange) {
            return;
        }
        // Add Action related options
        const formKey = this.state.activeForm.website_form_key;
        const formInfo = FormEditorRegistry.get(formKey);
        if (!formInfo || !formInfo.fields) {
            return;
        }
        allFormsInfo.set(this.$target[0], formInfo);
        const proms = formInfo.fields.map(field => this._fetchFieldRecords(field));
        return Promise.all(proms).then(() => {
            this.state.formInfo = formInfo;
        });
    }
    /**
     * Add a hidden field to the form
     *
     * @private
     * @param {string} value
     * @param {string} fieldName
     */
    _addHiddenField(value, fieldName) {
        this.$target.find(`.s_website_form_dnone:has(input[name="${fieldName}"])`).remove();
        if (value) {
            const hiddenField = renderToElement('website.form_field_hidden', {
                field: {
                    name: fieldName,
                    value: value,
                    dnone: true,
                    formatInfo: {},
                },
            });
            this.$target.find('.s_website_form_submit').before(hiddenField);
        }
    }
    /**
     * Returns a we-input element from the field
     *
     * @private
     * @param {Object} field
     * @returns {HTMLElement}
     */
    _buildInput(field) {
        const inputEl = document.createElement('we-input');
        inputEl.dataset.noPreview = 'true';
        inputEl.dataset.fieldName = field.name;
        inputEl.dataset.addActionField = '';
        inputEl.setAttribute('string', field.string);
        inputEl.classList.add('o_we_large');
        return inputEl;
    }
    /**
     * Returns a we-select element with field's records as it's options
     *
     * @private
     * @param {Object} field
     * @return {HTMLElement}
     */
    _buildSelect(field) {
        const selectEl = document.createElement('we-select');
        selectEl.dataset.noPreview = 'true';
        selectEl.dataset.fieldName = field.name;
        selectEl.dataset.isSelect = 'true';
        selectEl.setAttribute('string', field.string);
        if (!field.required) {
            const noneButton = document.createElement('we-button');
            noneButton.textContent = 'None';
            noneButton.dataset.addActionField = 0;
            selectEl.append(noneButton);
        }
        field.records.forEach(el => {
            const button = document.createElement('we-button');
            button.textContent = el.display_name;
            button.dataset.addActionField = el.id;
            selectEl.append(button);
        });
        if (field.createAction) {
            return this._addCreateButton(selectEl, field.createAction);
        }
        return selectEl;
    }
    /**
     * Wraps an HTML element in a we-row element, and adds a
     * we-button linking to the given action.
     *
     * @private
     * @param {HTMLElement} element
     * @param {String} action
     * @returns {HTMLElement}
     */
    _addCreateButton(element, action) {
        const linkButtonEl = document.createElement('we-button');
        linkButtonEl.title = _t("Create new");
        linkButtonEl.dataset.noPreview = 'true';
        linkButtonEl.dataset.promptSaveRedirect = action;
        linkButtonEl.classList.add('fa', 'fa-fw', 'fa-plus');
        const projectRowEl = document.createElement('we-row');
        projectRowEl.append(element);
        projectRowEl.append(linkButtonEl);
        return projectRowEl;
    }
    /**
     * Apply the model on the form changing it's fields
     *
     * @private
     * @param {Integer} modelId
     */
    async _applyFormModel(modelId) {
        let oldFormInfo;
        if (modelId) {
            const oldFormKey = this.state.activeForm.website_form_key;
            if (oldFormKey) {
                oldFormInfo = FormEditorRegistry.get(oldFormKey);
            }
            this.$target.find('.s_website_form_field').remove();
            this.state.activeForm = this.models.find(model => model.id === modelId);
            currentActionName = this.state.activeForm.website_form_label;
        }
        await this.prepareRender();
        const formKey = this.state.activeForm.website_form_key;
        const formInfo = FormEditorRegistry.get(formKey);
        // Success page
        if (!this.$target[0].dataset.successMode) {
            this.$target[0].dataset.successMode = 'redirect';
        }
        if (this.$target[0].dataset.successMode === 'redirect') {
            const currentSuccessPage = this.$target[0].dataset.successPage;
            if (formInfo && formInfo.successPage) {
                this.$target[0].dataset.successPage = formInfo.successPage;
            } else if (!oldFormInfo || (oldFormInfo !== formInfo && oldFormInfo.successPage && currentSuccessPage === oldFormInfo.successPage)) {
                this.$target[0].dataset.successPage = '/contactus-thank-you';
            }
        }
        // Model name
        this.$target[0].dataset.model_name = this.state.activeForm.model;
        // Load template
        if (formInfo) {
            const formatInfo = this._getDefaultFormat();
            await Promise.all(formInfo.formFields.map(async field => {
                field.formatInfo = formatInfo;
                await this._fetchFieldRecords(field);
                this.$target.find('.s_website_form_submit, .s_website_form_recaptcha').first().before(this._renderField(field));
                return field;
            }));
        }
    }
    /**
     * Set the correct mark on all fields.
     *
     * @private
     */
    _setLabelsMark() {
        this.$target[0].querySelectorAll('.s_website_form_mark').forEach(el => el.remove());
        const mark = this._getMark();
        if (!mark) {
            return;
        }
        let fieldsToMark = [];
        const requiredSelector = '.s_website_form_model_required, .s_website_form_required';
        const fields = Array.from(this.$target[0].querySelectorAll('.s_website_form_field'));
        if (this._isRequiredMark()) {
            fieldsToMark = fields.filter(el => el.matches(requiredSelector));
        } else if (this._isOptionalMark()) {
            fieldsToMark = fields.filter(el => !el.matches(requiredSelector));
        }
        fieldsToMark.forEach(field => {
            let span = document.createElement('span');
            span.classList.add('s_website_form_mark');
            span.textContent = ` ${mark}`;
            field.querySelector('.s_website_form_label').appendChild(span);
        });
    }
    /**
     * Redirects the user to the page of a specified action.
     *
     * @private
     * @param {string} action
     */
    _redirectToAction(action) {
        window.location.replace(`/web#action=${encodeURIComponent(action)}`);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onToggleEndMessageClick() {
        this.showEndMessage = !this.showEndMessage;
        this.updateUIEndMessage();
        this.env.activateSnippet(
            this.showEndMessage ? this.$message[0] : this.target
        );
    }
}
registry.category("snippets_options").add("website.WebsiteFormEditor", {
    component: WebsiteFormEditor,
    template: "website.WebsiteFormEditor",
    selector: ".s_website_form",
    target: "form",
}, {
    sequence: 10,
});

const authorizedFieldsCache = {};

export class WebsiteFieldEditor extends FieldEditor {
    setup() {
        super.setup();

        this.dialogs = useService("dialog");
        this.state = useState({
            hiddenConditionOptions: [],
            hiddenConditionNoTextOptions: [],
            typeOptions: [],
        });
        for (const methodName of Object.getOwnPropertyNames(WebsiteFieldEditor.prototype)) {
            if (typeof this[methodName] === "function") {
                this.env.validMethodNames.push(methodName);
            }
        }

        onWillStart(async () => {
            // Get the authorized existing fields for the form model
            const model = this.formEl.dataset.model_name;
            let getFields;
            if (model in authorizedFieldsCache) {
                getFields = authorizedFieldsCache[model];
            } else {
                // Because we cache the call, we cannot use useService because
                // the Promise would be aborted if the component gets destroyed
                // during its onWillStart. We should look into why the component
                // often gets destroyed, but still this seems the right thing
                // to do regardless.
                getFields = this.env.services.orm.call(
                    "ir.model",
                    "get_authorized_fields",
                    [model],
                );
                authorizedFieldsCache[model] = getFields;
            }

            this.existingFields = await getFields.then((fields) => {
                this.fields = {};
                for (const [fieldName, field] of Object.entries(fields)) {
                    field.name = fieldName;
                    const fieldDomain = _getDomain(this.formEl, field.name, field.type, field.relation);
                    field.domain = fieldDomain || field.domain || [];
                    this.fields[fieldName] = field;
                }
                // Create the buttons for the type we-select
                return Object.keys(fields).map(key => {
                    const field = fields[key];
                    return {
                        textContent: field.string,
                        existingField: field.name,
                    };
                }).sort((a, b) => (a.textContent > b.textContent) ? 1 : (a.textContent < b.textContent) ? -1 : 0);
            });
            await this.prepareRender();
        });
    }
    /**
     * @override
     */
    async start() {
        // Build the custom select
        const select = this._getSelect();
        if (select) {
            const field = this._getActiveField();
            await this._replaceField(field);
        }
        return super.start(...arguments);
    }
    /**
     * @override
     */
    cleanForSave() {
        this.$target[0].querySelectorAll('#editable_select').forEach(el => el.remove());
        const select = this._getSelect();
        if (select) {
            select.style.display = '';
        }
    }
    /**
     * @override
     */
    async onFocus() {
        // Other fields type might have change to an existing type.
        // We need to reload the existing type list.
        await this.prepareRender();
    }
    /**
     * Rerenders the clone to avoid id duplicates.
     *
     * @override
     */
    onClone() {
        const field = this._getActiveField();
        delete field.id;
        const fieldEl = this._renderField(field);
        this._replaceFieldElement(fieldEl);
    }
    /**
     * Removes the visibility conditions concerned by the deleted field
     *
     * @override
     */
    onRemove() {
        const fieldName = this.$target[0].querySelector('.s_website_form_input').name;
        const isMultipleField = this.formEl.querySelectorAll(`.s_website_form_input[name="${fieldName}"]`).length > 1;
        if (isMultipleField) {
            return;
        }
        const dependentFieldContainerEl = this.formEl.querySelectorAll(`[data-visibility-dependency="${fieldName}"]`);
        for (const fieldContainerEl of dependentFieldContainerEl) {
            this._deleteConditionalVisibility(fieldContainerEl);
        }
    }

    //----------------------------------------------------------------------
    // Options
    //----------------------------------------------------------------------

    /**
     * Add/remove a description to the field input
     */
    async toggleDescription(previewMode, value, params) {
        const field = this._getActiveField();
        field.description = !!value; // Will be changed to default description in qweb
        await this._replaceField(field);
    }
    /**
     * Replace the current field with the custom field selected.
     */
    async customField(previewMode, value, params) {
        // Both custom Field and existingField are called when selecting an option
        // value is '' for the method that should not be called.
        if (!value) {
            return;
        }
        const oldLabelText = this.$target[0].querySelector('.s_website_form_label_content').textContent;
        const field = this._getCustomField(value, oldLabelText);
        this._setActiveProperties(field);
        await this._replaceField(field);
        await this.prepareRender();
    }
    /**
     * Replace the current field with the existing field selected.
     */
    async existingField(previewMode, value, params) {
        // see customField
        if (!value) {
            return;
        }
        const field = Object.assign({}, this.fields[value]);
        this._setActiveProperties(field);
        await this._replaceField(field);
        await this.prepareRender();
    }
    /**
     * Set the name of the field on the label
     */
    setLabelText(previewMode, value, params) {
        this.$target.find('.s_website_form_label_content').text(value);
        if (this._isFieldCustom()) {
            value = this._getQuotesEncodedName(value);
            const multiple = this.$target[0].querySelector('.s_website_form_multiple');
            if (multiple) {
                multiple.dataset.name = value;
            }
            const inputEls = this.$target[0].querySelectorAll('.s_website_form_input');
            const previousInputName = inputEls[0].name;
            inputEls.forEach(el => el.name = value);

            // Synchronize the fields whose visibility depends on this field
            const dependentEls = this.formEl.querySelectorAll(`.s_website_form_field[data-visibility-dependency="${previousInputName}"]`);
            for (const dependentEl of dependentEls) {
                dependentEl.dataset.visibilityDependency = value;
            }
        }
    }
    /**
     * Replace the field with the same field having the label in a different position.
     */
    async selectLabelPosition(previewMode, value, params) {
        const field = this._getActiveField();
        field.formatInfo.labelPosition = value;
        await this._replaceField(field);
    }
    async selectType(previewMode, value, params) {
        const field = this._getActiveField();
        field.type = value;
        await this._replaceField(field);
    }
    /**
     * Select the textarea default value
     */
    selectTextareaValue(previewMode, value, params) {
        this.$target[0].textContent = value;
        this.$target[0].value = value;
    }
    /**
     * Select the date as value property and convert it to the right format
     */
    selectValueProperty(previewMode, value, params) {
        this.$target[0].value = value ? moment.unix(value).format(params.format) : '';
    }
    /**
     * Select the display of the multicheckbox field (vertical & horizontal)
     */
    multiCheckboxDisplay(previewMode, value, params) {
        const target = this._getMultipleInputs();
        target.querySelectorAll('.checkbox, .radio').forEach(el => {
            if (value === 'horizontal') {
                el.classList.add('col-lg-4', 'col-md-6');
            } else {
                el.classList.remove('col-lg-4', 'col-md-6');
            }
        });
        target.dataset.display = value;
    }
    /**
     * Set the field as required or not
     */
    toggleRequired(previewMode, value, params) {
        const isRequired = this.$target[0].classList.contains(params.activeValue);
        this.$target[0].classList.toggle(params.activeValue, !isRequired);
        this.$target[0].querySelectorAll('input, select, textarea').forEach(el => el.toggleAttribute('required', !isRequired));
        this.props.notifyOptions("WebsiteFormEditor", {
            name: 'field_mark',
        });
    }
    /**
     * Apply the we-list on the target and rebuild the input(s)
     */
    async renderListItems(previewMode, value, params) {
        const valueList = JSON.parse(value);

        // Synchronize the possible values with the fields whose visibility
        // depends on the current field
        const newValuesText = valueList.map(value => value.name);
        const inputEls = this.$target[0].querySelectorAll('.s_website_form_input, option');
        const inputName = this.$target[0].querySelector('.s_website_form_input').name;
        for (let i = 0; i < inputEls.length; i++) {
            const input = inputEls[i];
            if (newValuesText[i] && input.value && !newValuesText.includes(input.value)) {
                for (const dependentEl of this.formEl.querySelectorAll(
                        `[data-visibility-condition="${input.value}"][data-visibility-dependency="${inputName}"]`)) {
                    dependentEl.dataset.visibilityCondition = newValuesText[i];
                }
                break;
            }
        }

        const field = this._getActiveField(true);
        field.records = valueList;
        await this._replaceField(field);
    }
    /**
     * Sets the visibility of the field.
     *
     * @see this.selectClass for parameters
     */
    async setVisibility(previewMode, widgetValue, params) {
        if (widgetValue === 'conditional') {
            const widget = this.requestUserValueWidgets('hidden_condition_opt')[0];
            const firstValue = widget.possibleValues['setVisibilityDependency'].find(el => el !== '');
            if (firstValue) {
                // Set a default visibility dependency
                await this._setVisibilityDependency(firstValue);
                return;
            }
            this.dialogs.add(ConfirmationDialog, {
                body: _t("There is no field available for this option."),
            });
        }
        this._deleteConditionalVisibility(this.$target[0]);
    }
    /**
     * @see this.selectClass for parameters
     */
    async setVisibilityDependency(previewMode, widgetValue, params) {
        await this._setVisibilityDependency(widgetValue);
    }
    /**
     * @override
     */
    async selectDataAttribute(previewMode, widgetValue, params) {
        await super.selectDataAttribute(...arguments);
        if (params.attributeName === "maxFilesNumber") {
            const allowMultipleFiles = params.activeValue > 1;
            this.$target[0].toggleAttribute("multiple", allowMultipleFiles);
        }
    }

    //----------------------------------------------------------------------
    // Private
    //----------------------------------------------------------------------

    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        switch (methodName) {
            case 'toggleDescription': {
                const description = this.$target[0].querySelector('.s_website_form_field_description');
                return !!description;
            }
            case 'customField':
                return this._isFieldCustom() ? this._getFieldType() : '';
            case 'existingField':
                return this._isFieldCustom() ? '' : this._getFieldName();
            case 'setLabelText':
                return this.$target.find('.s_website_form_label_content').text();
            case 'selectLabelPosition':
                return this._getLabelPosition();
            case 'selectType':
                return this._getFieldType();
            case 'selectTextareaValue':
                return this.$target[0].textContent;
            case 'selectValueProperty':
                return this.$target[0].getAttribute('value') || '';
            case 'multiCheckboxDisplay': {
                const target = this._getMultipleInputs();
                return target ? target.dataset.display : '';
            }
            case 'toggleRequired':
                return this.$target[0].classList.contains(params.activeValue) ? params.activeValue : 'false';
            case 'renderListItems':
                return JSON.stringify(this._getListItems());
            case 'setVisibilityDependency':
                return this.$target[0].dataset.visibilityDependency || '';
        }
        return super.computeWidgetState(...arguments);
    }
    /**
     * @override
     */
    computeWidgetVisibility(widgetName, params) {
        const dependencyEl = this._getDependencyEl();
        switch (widgetName) {
            case 'hidden_condition_time_comparators_opt':
                return dependencyEl && dependencyEl.dataset.target;
            case 'hidden_condition_date_between':
                return dependencyEl && dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#datepicker')
                && ['between', '!between'].includes(this.$target[0].getAttribute('data-visibility-comparator'));
            case 'hidden_condition_datetime_between':
                return dependencyEl && dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#datetimepicker')
                && ['between', '!between'].includes(this.$target[0].dataset.visibilityComparator);
            case 'hidden_condition_additional_datetime':
                return dependencyEl && dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#datetimepicker')
                && !['set', '!set'].includes(this.$target[0].dataset.visibilityComparator);
            case 'hidden_condition_additional_date':
                return dependencyEl && dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#datepicker')
                && !['set', '!set'].includes(this.$target[0].dataset.visibilityComparator);
            case 'hidden_condition_additional_text':
                if (!this.$target[0].classList.contains('s_website_form_field_hidden_if') ||
                (dependencyEl && (['checkbox', 'radio'].includes(dependencyEl.type) || dependencyEl.nodeName === 'SELECT'))) {
                    return false;
                }
                if (!dependencyEl) {
                    return true;
                }
                if (dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#date')) {
                    return false;
                }
                return (['text', 'email', 'tel', 'url', 'search', 'password', 'number'].includes(dependencyEl.type)
                    || dependencyEl.nodeName === 'TEXTAREA') && !['set', '!set'].includes(this.$target[0].dataset.visibilityComparator);
            case 'hidden_condition_no_text_opt':
                return dependencyEl && (dependencyEl.type === 'checkbox' || dependencyEl.type === 'radio' || dependencyEl.nodeName === 'SELECT');
            case 'hidden_condition_num_opt':
                return dependencyEl && dependencyEl.type === 'number';
            case 'hidden_condition_text_opt':
                if (!this.$target[0].classList.contains('s_website_form_field_hidden_if') || (dependencyEl &&
                dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#date'))) {
                    return false;
                }
                return !dependencyEl || (['text', 'email', 'tel', 'url', 'search', 'password'].includes(dependencyEl.type) ||
                dependencyEl.nodeName === 'TEXTAREA');
            case 'hidden_condition_date_opt':
                return dependencyEl && dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#datepicker');
            case 'hidden_condition_datetime_opt':
                return dependencyEl && dependencyEl.dataset.target && dependencyEl.dataset.target.includes('#datetimepicker');
            case 'hidden_condition_file_opt':
                return dependencyEl && dependencyEl.type === 'file';
            case 'hidden_condition_opt':
                return this.$target[0].classList.contains('s_website_form_field_hidden_if');
            case 'char_input_type_opt':
                return !this.$target[0].classList.contains('s_website_form_custom') &&
                    ['char', 'email', 'tel', 'url'].includes(this.$target[0].dataset.type) &&
                    !this.$target[0].classList.contains('s_website_form_model_required');
            case 'multi_check_display_opt':
                return !!this._getMultipleInputs();
            case 'required_opt':
            case 'hidden_opt':
            case 'type_opt':
                return !this.$target[0].classList.contains('s_website_form_model_required');
            case "max_files_number_opt": {
                // Do not display the option if only one file is supposed to be
                // uploaded in the field.
                const fieldEl = this.$target[0].closest(".s_website_form_field");
                return fieldEl.classList.contains("s_website_form_custom") ||
                    ["one2many", "many2many"].includes(fieldEl.dataset.type);
            }
        }
        return super.computeWidgetVisibility(...arguments);
    }
    /**
     * Deletes all attributes related to conditional visibility.
     *
     * @param {HTMLElement} fieldEl
     */
     _deleteConditionalVisibility(fieldEl) {
        for (const name of this.VISIBILITY_DATASET) {
            delete fieldEl.dataset[name];
        }
        fieldEl.classList.remove('s_website_form_field_hidden_if', 'd-none');
    }
    /**
     * @param {HTMLElement} [fieldEl]
     * @returns {HTMLElement} The visibility dependency of the field
     */
    _getDependencyEl(fieldEl = this.$target[0]) {
        const dependencyName = fieldEl.dataset.visibilityDependency;
        return this.formEl.querySelector(`.s_website_form_input[name="${dependencyName}"]`);
    }
    /**
     * @override
     */
    async prepareRender() {
            const recursiveFindCircular = (el) => {
                if (el.dataset.visibilityDependency === this._getFieldName()) {
                    return true;
                }
                const dependencyInputEl = this._getDependencyEl(el);
                if (!dependencyInputEl) {
                    return false;
                }
                return recursiveFindCircular(dependencyInputEl.closest('.s_website_form_field'));
            };

            // Update available visibility dependencies
            const existingDependencyNames = [];
            this.state.hiddenConditionOptions = [];
            for (const el of this.formEl.querySelectorAll('.s_website_form_field:not(.s_website_form_dnone)')) {
                const inputEl = el.querySelector('.s_website_form_input');
                if (el.querySelector('.s_website_form_label_content') && inputEl && inputEl.name
                    && inputEl.name !== this.$target[0].querySelector('.s_website_form_input').name
                    && !existingDependencyNames.includes(inputEl.name) && !recursiveFindCircular(el)) {
                    this.state.hiddenConditionOptions.push({
                        textContent: el.querySelector('.s_website_form_label_content').textContent,
                        setVisibilityDependency: inputEl.name,
                    });
                    existingDependencyNames.push(inputEl.name);
                }
            }

            const comparator = this.$target[0].dataset.visibilityComparator;
            const dependencyEl = this._getDependencyEl();
            this.state.hiddenConditionNoTextOptions = [];
            if (dependencyEl) {
                if ((['radio', 'checkbox'].includes(dependencyEl.type) || dependencyEl.nodeName === 'SELECT')) {
                    // Update available visibility options
                    // const selectOptEl = uiFragment.querySelectorAll('we-select[data-name="hidden_condition_no_text_opt"]')[1];
                    const inputContainerEl = this.$target[0];
                    const dependencyEl = this._getDependencyEl();
                    if (dependencyEl.nodeName === 'SELECT') {
                        for (const option of dependencyEl.querySelectorAll('option')) {
                            this.state.hiddenConditionNoTextOptions.push({
                                textContent: option.value || `<${_t("no value")}>`,
                                selectDataAttribute: option.value,
                            });
                        }
                        if (!inputContainerEl.dataset.visibilityCondition) {
                            inputContainerEl.dataset.visibilityCondition = dependencyEl.querySelector('option').value;
                        }
                    } else { // DependecyEl is a radio or a checkbox
                        const dependencyContainerEl = dependencyEl.closest('.s_website_form_field');
                        const inputsInDependencyContainer = dependencyContainerEl.querySelectorAll('.s_website_form_input');
                        for (const el of inputsInDependencyContainer) {
                            this.state.hiddenConditionNoTextOptions.push({
                                textContent: el.value,
                                selectDataAttribute: el.value,
                            });
                        }
                        if (!inputContainerEl.dataset.visibilityCondition) {
                            inputContainerEl.dataset.visibilityCondition = inputsInDependencyContainer[0].value;
                        }
                    }
                    if (!inputContainerEl.dataset.visibilityComparator) {
                        inputContainerEl.dataset.visibilityComparator = 'selected';
                    }
                }
                if (!comparator) {
                    // Set a default comparator according to the type of dependency
                    if (dependencyEl.dataset.target) {
                        this.$target[0].dataset.visibilityComparator = 'after';
                    } else if (['text', 'email', 'tel', 'url', 'search', 'password', 'number'].includes(dependencyEl.type)
                        || dependencyEl.nodeName === 'TEXTAREA') {
                        this.$target[0].dataset.visibilityComparator = 'equal';
                    } else if (dependencyEl.type === 'file') {
                        this.$target[0].dataset.visibilityComparator = 'fileSet';
                    }
                }
            }


            const currentFieldName = this._getFieldName();
            const fieldsInForm = Array.from(this.formEl.querySelectorAll('.s_website_form_field:not(.s_website_form_custom) .s_website_form_input')).map(el => el.name).filter(el => el !== currentFieldName);
            const availableFields = this.existingFields.filter(el => !fieldsInForm.includes(el.existingField));
            this.state.availableFields = availableFields;

            const select = this._getSelect();
            const multipleInputs = this._getMultipleInputs();
            this.state.list = false;
            if (!select && !multipleInputs) {
                return;
            }

            const field = Object.assign({}, this.fields[this._getFieldName()]);
            const type = this._getFieldType();

            const list = {};
            const optionText = select ? 'Option' : type === 'selection' ? 'Radio' : 'Checkbox';
            list.textContent = `${optionText} List`;
            list.addItemTitle = _t("Add new %s", optionText);
            list.renderListItems = '';

            if (!this._isFieldCustom()) {
                await this._fetchFieldRecords(field);
                list.availableRecords = JSON.stringify(field.records);
            }
            this.state.list = list;
    }
    /**
     * Replaces the target content with the field provided.
     *
     * @private
     * @param {Object} field
     * @returns {Promise}
     */
    async _replaceField(field) {
        await this._fetchFieldRecords(field);
        const activeField = this._getActiveField();
        if (activeField.type !== field.type) {
            field.value = '';
        }
        const fieldEl = this._renderField(field);
        this._replaceFieldElement(fieldEl);
    }
    /**
     * Replaces the target with provided field.
     *
     * @private
     * @param {HTMLElement} fieldEl
     */
    _replaceFieldElement(fieldEl) {
        const inputEl = this.$target[0].querySelector('input');
        const dataFillWith = inputEl ? inputEl.dataset.fillWith : undefined;
        const hasConditionalVisibility = this.$target[0].classList.contains('s_website_form_field_hidden_if');
        const previousName = this.$target[0].querySelector('.s_website_form_input').name;
        [...this.$target[0].childNodes].forEach(node => node.remove());
        [...fieldEl.childNodes].forEach(node => this.$target[0].appendChild(node));
        [...fieldEl.attributes].forEach(el => this.$target[0].removeAttribute(el.nodeName));
        [...fieldEl.attributes].forEach(el => this.$target[0].setAttribute(el.nodeName, el.nodeValue));
        if (hasConditionalVisibility) {
            this.$target[0].classList.add('s_website_form_field_hidden_if', 'd-none');
        }
        const dependentFieldEls = this.formEl.querySelectorAll(`.s_website_form_field[data-visibility-dependency="${previousName}"]`);
        const newName = this.$target[0].querySelector('.s_website_form_input').name;
        if (previousName !== newName && dependentFieldEls) {
            // In order to keep the visibility conditions consistent,
            // when the name has changed, it means that the type has changed so
            // all fields whose visibility depends on this field must be updated so that
            // they no longer have conditional visibility
            for (const fieldEl of dependentFieldEls) {
                this._deleteConditionalVisibility(fieldEl);
            }
        }
        const newInputEl = this.$target[0].querySelector('input');
        if (newInputEl) {
            newInputEl.dataset.fillWith = dataFillWith;
        }
    }
    /**
     * Sets the visibility dependency of the field.
     *
     * @param {string} value name of the dependency input
     */
     async _setVisibilityDependency(value) {
        delete this.$target[0].dataset.visibilityCondition;
        delete this.$target[0].dataset.visibilityComparator;
        const previousDependency = this._getDependencyEl();
        let rerender = false;
        if (this.formEl.querySelector(`.s_website_form_input[name="${value}"]`).type !== (previousDependency && previousDependency.type)) {
            rerender = true;
        }
        this.$target[0].dataset.visibilityDependency = value;
        if (rerender) {
            await this.prepareRender();
        }
    }
    /**
     * @private
     */
    _getListItems() {
        const select = this._getSelect();
        const multipleInputs = this._getMultipleInputs();
        let options = [];
        if (select) {
            options = [...select.querySelectorAll('option')];
        } else if (multipleInputs) {
            options = [...multipleInputs.querySelectorAll('.checkbox input, .radio input')];
        }
        return options.map(opt => {
            const name = select ? opt : opt.nextElementSibling;
            return {
                id: /^-?[0-9]{1,15}$/.test(opt.value) ? parseInt(opt.value) : opt.value,
                display_name: name.textContent.trim(),
                selected: select ? opt.selected : opt.checked,
            };
        });
    }
    /**
     * Returns the select element if it exist else null
     *
     * @private
     * @returns {HTMLElement}
     */
    _getSelect() {
        return this.$target[0].querySelector('select');
    }
}

registry.category("snippets_options").add("website.WebsiteFieldEditor", {
    template: "website.WebsiteFieldEditor",
    component: WebsiteFieldEditor,
    selector: ".s_website_form_field",
    exclude: ".s_website_form_dnone",
    dropNear: ".s_website_form_field",
    "drop-lock-within": "form",
}, {
    sequence: 10,
});

export class AddFieldForm extends FormEditor {
    static isTopOption = true;
    static isTopFirstOption = true;

    setup() {
        super.setup();
        this.env.validMethodNames.push("addField");
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Add a char field at the end of the form.
     * New field is set as active
     */
    async addField(previewMode, value, params) {
        const field = this._getCustomField('char', 'Custom Text');
        field.formatInfo = this._getDefaultFormat();
        const fieldEl = this._renderField(field);
        this.$target.find('.s_website_form_submit, .s_website_form_recaptcha').first().before(fieldEl);
        this.env.activateSnippet(fieldEl);
    }
}
registry.category("snippets_options").add("website.AddFieldForm", {
    component: AddFieldForm,
    template: "website.AddFieldForm",
    selector: ".s_website_form",
    target: "form",
});

export class AddField extends FieldEditor {
    static isTopOption = true;
    static isTopFirstOption = true;

    setup() {
        super.setup();
        this.env.validMethodNames.push("addField");
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Add a char field with active field properties after the active field.
     * New field is set as active
     */
    async addField(previewMode, value, params) {
        await this.props.notifyOptions("WebsiteFormEditor", {
            name: 'add_field',
            data: {
                formatInfo: this._getFieldFormat(),
                $target: this.$target,
            },
        });
    }
}
registry.category("snippets_options").add("website.AddField", {
    component: AddField,
    template: "website.AddField",
    selector: ".s_website_form_field",
    exclude: ".s_website_form_field_dnone",
});

registry.category("snippets_options").add("website.WebsitFormSubmit", {
    template: "website.WebsiteFormSubmit",
    selector: ".s_website_form_submit",
    exclude: ".s_website_form_no_submit_options",
});

//
// // Superclass for options that need to disable a button from the snippet overlay
// const DisableOverlayButtonOption = options.Class.extend({
//     // Disable a button of the snippet overlay
//     disableButton: function (buttonName, message) {
//         // TODO refactor in master
//         const className = 'oe_snippet_' + buttonName;
//         this.$overlay.add(this.$overlay.data('$optionsSection')).on('click', '.' + className, this.preventButton);
//         const $buttons = this.$overlay.add(this.$overlay.data('$optionsSection')).find('.' + className);
//         for (const buttonEl of $buttons) {
//             // For a disabled element to display a tooltip, it must be wrapped
//             // into a non-disabled element which holds the tooltip.
//             buttonEl.classList.add('o_disabled');
//             const spanEl = buttonEl.ownerDocument.createElement('span');
//             spanEl.setAttribute('tabindex', 0);
//             spanEl.setAttribute('title', message);
//             buttonEl.replaceWith(spanEl);
//             spanEl.appendChild(buttonEl);
//             Tooltip.getOrCreateInstance(spanEl, {delay: 0});
//         }
//     },
//
//     preventButton: function (event) {
//         // Snippet options bind their functions before the editor, so we
//         // can't cleanly unbind the editor onRemove function from here
//         event.preventDefault();
//         event.stopImmediatePropagation();
//     }
// });
//
// // Disable duplicate button for model fields
// options.registry.WebsiteFormFieldModel = DisableOverlayButtonOption.extend({
//     start: function () {
//         this.disableButton('clone', _t('You cannot duplicate this field.'));
//         return this._super.apply(this, arguments);
//     }
// });
//
// // Disable delete button for model required fields
// options.registry.WebsiteFormFieldRequired = DisableOverlayButtonOption.extend({
//     start: function () {
//         this.disableButton("remove", _t(
//             "This field is mandatory for this action. You cannot remove it. Try hiding it with the"
//             + " 'Visibility' option instead and add it a default value."
//         ));
//         return this._super.apply(this, arguments);
//     },
//
//     //--------------------------------------------------------------------------
//     // Private
//     //--------------------------------------------------------------------------
//
//     /**
//      * @override
//      */
//     async _renderCustomXML(uiFragment) {
//         const fieldName = this.$target[0]
//             .querySelector("input.s_website_form_input").getAttribute("name");
//         const spanEl = document.createElement("span");
//         spanEl.innerText = _t("The field '%s' is mandatory for the action '%s'.", fieldName, currentActionName);
//         uiFragment.querySelector("we-alert").appendChild(spanEl);
//     },
// });
//
// // Disable delete and duplicate button for submit
// options.registry.WebsiteFormSubmitRequired = DisableOverlayButtonOption.extend({
//     start: function () {
//         this.disableButton('remove', _t('You can\'t remove the submit button of the form'));
//         this.disableButton('clone', _t('You can\'t duplicate the submit button of the form.'));
//         return this._super.apply(this, arguments);
//     }
// });
//
// // Disable "Shown on Mobile/Desktop" option if for an hidden field
// options.registry.DeviceVisibility.include({
//
//     //--------------------------------------------------------------------------
//     // Private
//     //--------------------------------------------------------------------------
//
//     /**
//      * @override
//      */
//     async _computeVisibility() {
//         // Same as default but overridden by other apps
//         return await this._super(...arguments)
//             && !this.$target.hasClass('s_website_form_field_hidden');
//     },
// });

export default {
    clearAllFormsInfo,
};
