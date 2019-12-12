odoo.define('website_form_editor', function (require) {
'use strict';

/**
 * @todo this should be entirely refactored
 */

var ajax = require('web.ajax');
var core = require('web.core');
var FormEditorRegistry = require('website_form.form_editor_registry');
var options = require('web_editor.snippets.options');

var qweb = core.qweb;

const fieldEditor = options.Class.extend({

    /**
     * @private
     * @param {*} value
     * @param {*} name
     * @param {*} required
     * @param {*} hidden
     */
    _getCustomField: function (value, name, required, hidden) {
        return {
            name: name,
            string: name,
            custom: true,
            type: value,
            required: required,
            hidden: hidden,
            // Default values for x2many fields
            records: [
                {
                    id: 'Option 1',
                    display_name: 'Option 1'
                }, {
                    id: 'Option 2',
                    display_name: 'Option 2'
                }, {
                    id: 'Option 3',
                    display_name: 'Option 3'
                },
            ],
            // Default values for selection fields
            selection: [
                [
                    'Option 1',
                    'Option 1'
                ], [
                    'Option 2',
                    'Option 2'
                ], [
                    'Option 3',
                    'Option 3'
                ],
            ],
        };
    },
    _getFieldRecords: function (field) {
        // Convert the required boolean to a value directly usable
        // in qweb js to avoid duplicating this in the templates
        field.required = field.required ? 1 : null;

        // Fetch possible values for relation fields
        var fieldRelationProm;
        if (!field.records && field.relation && field.relation !== 'ir.attachment') {
            fieldRelationProm = this._rpc({
                model: field.relation,
                method: 'search_read',
                args: [
                    field.domain || [],
                    ['display_name']
                ],
            }).then(function (records) {
                field.records = records;
            });
        }
        return Promise.resolve(fieldRelationProm);
    },
    /**
     * @private
     * @param {*} field
     */
    _renderField: function (field) {
        return this._getFieldRecords(field).then(() => {
            return $(qweb.render("website_form.field_" + field.type, {field: field}))[0];
        });
    },
});

options.registry.websiteFormEditor = fieldEditor.extend({
    xmlDependencies: ['/website_form/static/src/xml/website_form_editor.xml'],

    events: _.extend({}, options.Class.prototype.events || {}, {
        'click .toggle-edit-message': '_onToggleEndMessageClick',
    }),

    /**
     * @override
     */
    willStart: async function () {
        const _super = this._super.bind(this);
        const args = arguments;

        // Get list of website_form compatible models.
        this.models = await this._rpc({
            model: "ir.model",
            method: "search_read",
            args: [
                [['website_form_access', '=', true], ['website_form_key', '!=', false]],
                ['id', 'model', 'name', 'website_form_label', 'website_form_key']
            ],
        });
        this.selectActionEl = options.buildElement('we-select', 'Action', {
            dataAttributes: {
                noPreview: 'true',
            },
        });
        this.models.forEach(el => {
            const option = options.buildElement('we-button', el.website_form_label, {
                dataAttributes: {
                    selectAction: el.id,
                },
            });
            this.selectActionEl.append(option);
        });

        return _super(...args);
    },
    /**
     * @override
     */
    start: function () {
        const proms = [this._super(...arguments)];
        // Disable text edition
        this.$target.addClass('o_fake_not_editable').attr('contentEditable', false);
        this.$target.find('label:not(:has(span)), label span').addClass('o_fake_not_editable').attr('contentEditable', false);
        // Get potential message
        this.$message = this.$target.parent().find('.s_website_form_end_message');
        this.showEndMessage = false;
        // Add default attributes
        const targetModelName = this.$target[0].dataset.model_name;
        if (targetModelName) {
            this.activeForm = _.findWhere(this.models, {model: targetModelName});
        } else {
            this.activeForm = this.models[0];
            this.$target[0].dataset.model_name = this.activeForm.model;
            this._changeFormParameters();
        }
        if (!this.$target[0].dataset.successMode) {
            this.$target[0].dataset.successMode = 'redirect';
        }
        proms.push(this._rerenderXML());

        return Promise.all(proms);
    },

    /**
     * @override
     */
    cleanForSave: function () {
        var model = this.$target.data('model_name');
        // because apparently this can be called on the wrong widget and
        // we may not have a model, or fields...
        if (model) {
            // we may be re-whitelisting already whitelisted fields. Doesn't
            // really matter.
            var fields = this.$target.find('input.form-field[name=email_to], .form-field:not(.o_website_form_custom) :input').map(function (_, node) {
                return node.getAttribute('name');
            }).get();
            if (fields.length) {
                // ideally we'd only do this if saving the form
                // succeeds... but no idea how to do that
                this._rpc({
                    model: 'ir.model.fields',
                    method: 'formbuilder_whitelist',
                    args: [model, _.uniq(fields)],
                });
            }
        }

        // Update values of custom inputs to mirror their labels
        var customInputs = this.$target.find('.o_website_form_custom .o_website_form_input');
        _.each(customInputs, function (input, index) {
            // Change the custom field name according to their label
            var fieldLabel = $(input).closest('.form-field').find('label:first');
            input.name = fieldLabel.text().trim();
            fieldLabel.attr('for', input.name);

            // Change the custom radio or checkboxes values according to their label
            if (input.type === 'radio' || input.type === 'checkbox') {
                var checkboxLabel = $(input).closest('label').text().trim();
                if (checkboxLabel) {
                    input.value = checkboxLabel;
                }
            }
        });
        // Display Success Message
        if (this.$message.length) {
            this.$target.removeClass('d-none');
            this.$message.addClass("d-none");
        }
    },
    /**
     * @override
     */
    updateUI: async function () {
        if (this.rerender) {
            this.rerender = false;
            await this._rerenderXML();
            return;
        }
        await this._super.apply(this, arguments);
        const dataset = this.$target[0].dataset;

        // End Message UI
        this.updateUIEndMessage();
        this.$el.find('[data-attribute-name="success_page"]')
            .toggleClass('d-none', dataset.successMode !== 'redirect');
        this.$el.find('.toggle-edit-message')
            .toggleClass('d-none', dataset.successMode !== 'message');

        const successMode = dataset.successMode;
        const messageInput = this.el.querySelector('[data-attribute-name="successMessage"]');
        const redirectInput = this.el.querySelector('[ data-attribute-name="success_page"]');
        redirectInput && redirectInput.classList.toggle('d-none', successMode !== 'redirect');
        messageInput && messageInput.classList.toggle('d-none', successMode !== 'message');
    },
    /**
     * @see this.updateUI
     */
    updateUIEndMessage: function () {
        this.$target.toggleClass("d-none", this.showEndMessage);
        this.$message.toggleClass("d-none", !this.showEndMessage);
        this.trigger_up('cover_update');
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     *
     */
    selectAction: function (previewMode, value, params) {
        this.activeForm = _.findWhere(this.models, {id: parseInt(value)});
        this.$target[0].dataset.model_name = this.activeForm.model;
        this.$target[0].querySelectorAll('.related_field').forEach(el => el.remove());
        this._changeFormParameters();
        this.rerender = true;
    },
    /**
     *
     */
    customSelect: function (previewMode, value, params) {
        let fieldName = params.fieldName;
        value = parseInt(value);
        this._addActionRelatedField(value, fieldName);
    },
    /**
     *
     */
    customInput: function (previewMode, value, params) {
        let fieldName = params.fieldName;
        this._addActionRelatedField(value, fieldName);
    },
    /**
     *
     */
    onSuccess: function (previewMode, value, params) {
        this.$target[0].dataset.successMode = value;
        if (value === 'message') {
            if (!this.$message.length) {
                this.$message = $(qweb.render('website_form.s_website_form.end_message'));
            }
            this.$target.after(this.$message);
        } else {
            this.$message.remove();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'selectAction':
                return this.activeForm.id;
            case 'customSelect':
                return this.$target.find(`.form-group input[name="${params.fieldName}"]`).val() || '0';
            case 'customInput':
                return this.$target.find(`.form-group input[name="${params.fieldName}"]`).val() || '';
            case 'onSuccess':
                return this.$target[0].dataset.successMode;
        }
        return this._super(...arguments);
    },
    /**
     *@override
    */
    _renderCustomXML: function (uiFragment) {
        // Hide change form parameters option for forms
        // e.g. User should not be enable to change existing job application form to opportunity form in 'Apply job' page.
        if (this.$target.attr('hide-change-model') !== undefined) {
            return;
        }
        const firstOption = uiFragment.querySelector(':first-child');
        uiFragment.insertBefore(this.selectActionEl.cloneNode(true), firstOption);

        if (!this.activeForm) {
            return;
        }
        const formKey = this.activeForm.website_form_key;
        var formInfo = FormEditorRegistry.get(formKey);
        if (!formInfo.fields) {
            return;
        }

        var proms = [];
        formInfo.fields.forEach(field => {
            proms.push(this._getFieldRecords(field));
        });
        return Promise.all(proms).then(() => {
            formInfo.fields.forEach(field => {
                let option;
                switch (field.type) {
                    case 'many2one':
                        option = this._buildSelect(field);
                        break;
                    case 'char':
                        option = this._buildInput(field);
                        break;
                    default:
                        break;
                }
                uiFragment.insertBefore(option, firstOption);
            });
        });
    },
    /**
     * @private
     * @param {string} value
     * @param {string} fieldName
     */
    _addActionRelatedField: function (value, fieldName) {
        this.$target.find('.form-group:has("[name=' + fieldName + ']")').remove();
        if (value) {
            var $hiddenField = $(qweb.render('website_form.field_char', {
                field: {
                    name: fieldName,
                    value: value,
                },
            })).addClass('d-none related_field');
            this.$target.find('.form-group:has(".o_website_form_send")').before($hiddenField);
        }
    },
    /**
     * @private
     */
    _changeFormParameters: function () {
        var formKey = this.activeForm.website_form_key;
        this.$target[0].dataset.model_name = this.activeForm.model;
        this.$target.find(".o_we_form_rows .form-field").remove();
        var formInfo = FormEditorRegistry.get(formKey);
        this.$target[0].dataset.success_page = formInfo.successPage || '';
        ajax.loadXML(formInfo.defaultTemplatePath, qweb).then(() => {
            this.$target.find('.form-group:has(".o_website_form_send")').before(qweb.render(formInfo.defaultTemplateName));
        });
    },
    /**
     * @private
     * @param {Object} field
     * @return {HTMLElement}
     */
    _buildSelect: function (field) {
        const selectEl = options.buildElement('we-select', null, {
            dataAttributes: {
                noPreview: 'true',
                fieldName: field.name,
            },
            classes: ['related_element'],
        });
        const noneButton = options.buildElement('we-button', 'None', {
            dataAttributes: {
                customSelect: 0,
            },
            classes: ['custom_select'],
        });
        selectEl.append(noneButton);
        field.records.forEach(el => {
            const button = options.buildElement('we-button', el.display_name, {
                dataAttributes: {
                    customSelect: el.id,
                },
                classes: ['custom_select'],
            });
            selectEl.append(button);
        });
        selectEl.setAttribute('string', field.string);
        return selectEl;
    },
    /**
     * @private
     * @param {Object} field
     * @returns {HTMLElement}
     */
    _buildInput: function (field) {
        const inputEl = options.buildElement('we-input', null, {
            dataAttributes: {
                noPreview: 'true',
                fieldName: field.name,
                customInput: '',
            },
            classes: ['custom_input', 'related_element'],
        });
        inputEl.setAttribute('string', field.string);
        return inputEl;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onToggleEndMessageClick: function () {
        this.showEndMessage = !this.showEndMessage;
        this.$el.find(".toggle-edit-message").toggleClass('text-primary', this.showEndMessage);
        this.updateUIEndMessage();
    },
});

options.registry.websiteFieldEditor = fieldEditor.extend({
    events: _.extend({}, fieldEditor.prototype.events, {
        'click we-button.o_we_select_remove_option': '_onRemoveItemClick',
        'click we-button.o_we_list_add_optional': '_onAddCustomItemClick',
        'click we-button.o_we_list_add_existing': '_onAddExistingItemClick',
        'click we-list we-select': '_onAddItemSelectClick',
        'input we-list input': '_onListItemInput',
    }),

    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.formEl = this.$target[0].closest('form');
    },
    /**
     * @override
     */
    willStart: async function () {
        const _super = this._super.bind(this);
        const args = arguments;
        this.existingFields = await this._rpc({
            model: "ir.model",
            method: "get_authorized_fields",
            args: [this.formEl.dataset.model_name],
        }).then(fields => {
            this.fields = _.each(fields, function (field, fieldName) {
                field.name = fieldName;
            });
            const computedFields = Object.keys(fields).map(key => {
                return options.buildElement('we-button', fields[key].string, {
                    dataAttributes: {
                        existingField: key,
                    },
                });
            }).sort((a, b) => (a.textContent > b.textContent) ? 1 : (a.textContent < b.textContent) ? -1 : 0);
            if (computedFields.length) {
                const title = options.buildTitleElement('Existing fields');
                computedFields.unshift(title);
            }
            return computedFields;
        });
        return _super(...args);
    },
    /**
     * @override
     */
    cleanForSave: function () {
        this.$target[0].querySelectorAll('#editable_select').forEach(el => el.remove());
        const select = this.$target[0].querySelector('select');
        if (select && this.listTable) {
            select.style.display = '';
            select.innerHTML = '';
            this.listTable.querySelectorAll('input').forEach(el => {
                const option = document.createElement('option');
                option.textContent = el.value;
                option.value = el.name || el.value;
                select.appendChild(option);
            });
        }
    },
    /**
     * @override
     */
    updateUI: async function () {
        if (this.rerender) {
            this.rerender = false;
            await this._rerenderXML().then(() => this._renderList());
            return;
        }
        await this._super.apply(this, arguments);
        if (!this.el.childElementCount) {
            return;
        }
        const hasPlaceholder = !!this._getPlaceholderInput();
        this.el.querySelector('[data-set-placeholder]').classList.toggle('d-none', !hasPlaceholder);

        const isModelRequired = !!this.$target[0].classList.contains('o_website_form_required');
        this.el.querySelector('[data-select-class="o_website_form_required_custom"]').classList.toggle('d-none', isModelRequired);
        this.el.querySelector('[data-select-class="o_website_form_field_hidden"]').classList.toggle('d-none', isModelRequired);
        this.$el.find('we-select:has([data-custom-field])').toggleClass('d-none', isModelRequired);
        this.el.querySelector('.multi_check').classList.toggle('d-none', !this.$target[0].querySelector('.o_website_form_flex'));
    },

    //----------------------------------------------------------------------
    // Options
    //----------------------------------------------------------------------

    /**
     *
     */
    customField: function (previewMode, value, params) {
        // Both custom Field and existingField are called when selecting an option
        // value is '' for the method that should not be called. Do not use the same
        // value for a custom field and an existing field.
        if (!value) {
            return;
        }
        const name = this.el.querySelector(`[data-custom-field="${value}"]`).textContent;
        const field = this._getCustomField(value, `Custom ${name}`);
        this._replaceField(field);
    },
    /**
     *
     */
    existingField: function (previewMode, value, params) {
        // see customField
        if (!value) {
            return;
        }
        const field = this.fields[value];
        this._replaceField(field);
        // Rerender for the existing fields as we can't have twice the same existing field on the form
        this.rerender = true;
    },
    /**
     *
     */
    setName: function (previewMode, value, params) {
        this.$target[0].querySelector('.o_we_form_label').textContent = value;
    },
    /*
        *
        */
    setPlaceholder: function (previewMode, value, params) {
        this._setPlaceholder(value);
    },
    /**
     *
     */
    selectLabelPosition: function (previewMode, value, params) {
        const field = this._getActiveField();
        field.formatInfo.labelPosition = value;
        this._replaceField(field);
    },
    /**
     *
     */
    multiCheckboxDisplay: function (previewMode, value, params) {
        const target = this.$target[0].querySelector('.o_website_form_flex');
        target.classList.toggle('o_website_form_flex_fw', value === 'vertical');
        target.dataset.display = value;
    },

    //----------------------------------------------------------------------
    // Private
    //----------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'customField':
                return this.$target[0].dataset.type;
            case 'existingField':
                return this._getFieldName();
            case 'setName':
                return this.$target[0].querySelector('.o_we_form_label').textContent;
            case 'setPlaceholder':
                return this._getPlaceholder();
            case 'selectLabelPosition':
                return this._getlabelPosition();
            case 'multiCheckboxDisplay':
                var target = this.$target[0].querySelector('.o_website_form_flex');
                return target ? target.dataset.display : '';
        }
        return this._super(...arguments);
    },

    /**
     *@override
     */
    _renderCustomXML: function (uiFragment) {
        const selectEl = uiFragment.querySelector('we-select.o_we_type_select');
        var fieldsInForm = Array.from(this.formEl.querySelectorAll('.o_we_form_label')).map(label => label.getAttribute('for')).filter(el => el !== this._getFieldName());
        this.existingFields.forEach(option => {
            if (!fieldsInForm.includes(option.dataset.existingField)) {
                selectEl.append(option.cloneNode(true));
            }
        });
    },
    /**
     * @private
     */
    _getActiveField: function () {
        let field;
        const required = this._isFieldRequired();
        const hidden = !!this.$target[0].classList.contains('o_website_form_field_hidden');
        const name = this._getFieldName();
        if (this.$target[0].classList.contains('o_website_form_custom')) {
            field = this._getCustomField(this.$target[0].dataset.type, name, required, hidden);
        } else {
            field = this.fields[name];
        }
        field.placeholder = this._getPlaceholder();
        field.required = required;
        field.hidden = hidden;

        field.formatInfo = {
            labelPosition: this._getlabelPosition(),
        };
        field.formatInfo.labelWidth = this.$target[0].querySelector('.o_we_form_label').style.width;
        return field;
    },
    /**
     * @private
     * @param {Object} field
     */
    _replaceField: function (field) {
        if (!field.formatInfo) {
            const activeField = this._getActiveField();
            field.formatInfo = activeField.formatInfo;
            field.required = activeField.required;
            field.hidden = activeField.hidden;
            field.placeholder = activeField.placeholder;
        }
        this._renderField(field).then((htmlField) => {
            this.$target.html(htmlField.innerHTML);
            this.$target[0].classList = htmlField.classList;
            htmlField.dataset.type ? this.$target[0].dataset.type = htmlField.dataset.type : delete this.$target[0].dataset.type;
            if (field.placeholder) {
                this._setPlaceholder(field.placeholder);
            }
            this.$target.find('label:not(:has(span)), label span').addClass('o_fake_not_editable').attr('contentEditable', false);
        });
    },
    /**
     * @private
     * @returns {string}
     */
    _getlabelPosition: function () {
        const label = this.$target[0].querySelector('.o_we_form_label');
        if (this.$target[0].querySelector('.row')) {
            if (label.classList.contains('text-right')) {
                return 'right';
            } else {
                return 'left';
            }
        } else {
            if (label.classList.contains('d-none')) {
                return 'none';
            } else {
                return 'top';
            }
        }
    },
    /**
     * @private
     */
    _setPlaceholder: function (value) {
        const input = this._getPlaceholderInput();
        if (input) {
            input.placeholder = value;
        }
    },
    /**
     * @private
     * @returns {string}
     */
    _getPlaceholder: function () {
        const input = this._getPlaceholderInput();
        return input ? input.placeholder : '';
    },
    /**
     * @private
     * @returns {HTMLElement}
     */
    _getPlaceholderInput: function () {
        return this.$target[0].querySelector('input[type="text"], input[type="email"], textarea');
    },
    /**
     * @private
     * @returns {string}
     */
    _getFieldName: function () {
        return this.$target[0].querySelector('.o_we_form_label').getAttribute('for');
    },
    /**
     * @private
     * @returns {boolean}
     */
    _isFieldRequired: function () {
        const classList = this.$target[0].classList;
        return classList.contains('o_website_form_required_custom') || classList.contains('o_website_form_required');
    },
    /**
     * @private
     * @returns {Promise}
     */
    _rerender: function () {
        const select = this.$target[0].querySelector('select');
        if (select && !this.$target[0].querySelector('#editable_select')) {
            select.style.display = 'none';
            const editableSelect = document.createElement('div');
            editableSelect.id = 'editable_select';
            editableSelect.classList = 'form-control o_website_form_input';
            select.parentElement.appendChild(editableSelect);
        }
        this.rerender = true;
    },
    /**
     * @private
     */
    _renderList: function () {
        let addItemButton, addItemTitle, listTitle;
        const select = this.$target[0].querySelector('select');
        const checkbox = this.$target[0].querySelector('.o_website_form_flex');
        this.listTable = document.createElement('table');
        const isCustomOption = !!this.$target[0].classList.contains('o_website_form_custom');

        if (select) {
            listTitle = 'Options List';
            addItemTitle = 'Add new Option';
            select.querySelectorAll('option').forEach(opt => {
                this._addItemToTable(opt.value, opt.textContent.trim(), !isCustomOption);
            });
        } else if (checkbox) {
            listTitle = 'Checkbox List';
            addItemTitle = 'Add new Checkbox';
            checkbox.querySelectorAll('.checkbox').forEach(opt => {
                this._addItemToTable(opt.querySelector('input').value, opt.querySelector('span').textContent.trim(), !isCustomOption);
            });
        } else {
            return;
        }

        if (isCustomOption) {
            addItemButton = options.buildElement('we-button', addItemTitle, {
                dataAttributes: {
                    noPreview: 'true',
                },
                classes: ['o_we_list_add_optional'],
            });
        } else {
            addItemButton = options.buildElement('we-select');
            const togglerEl = document.createElement('we-toggler');
            togglerEl.textContent = addItemTitle;
            addItemButton.appendChild(togglerEl);
            const selectMenuEl = document.createElement('we-select-menu');
            addItemButton.appendChild(selectMenuEl);
            this._loadListDropdown(selectMenuEl);
        }
        const selectInputEl = document.createElement('we-list');
        selectInputEl.appendChild(options.buildTitleElement(listTitle));
        selectInputEl.appendChild(this.listTable);
        selectInputEl.appendChild(addItemButton);
        this.el.insertBefore(selectInputEl, this.el.querySelector('[data-set-placeholder]'));
        this._makeListItemsSortable();
    },
    /**
     * @private
     * @param {HTMLElement} selectMenu
     */
    _loadListDropdown: function (selectMenu) {
        selectMenu = selectMenu || this.el.querySelector('we-list we-select-menu');
        if (selectMenu) {
            selectMenu.innerHTML = '';
            const targetName = this._getFieldName();
            const field = this.fields[targetName];
            const optionIds = Array.from(this.listTable.querySelectorAll('input')).map(opt => parseInt(opt.name));
            this._getFieldRecords(field).then(() => {
                const buttonItems = field.records.filter(el => !optionIds.includes(el.id)).map(el => {
                    const option = options.buildElement('we-button', el.display_name, {
                        dataAttributes: {
                            addOption: el.id,
                            noPreview: 'true',
                        },
                        classes: ['o_we_list_add_existing'],
                    });
                    return option;
                });
                const childNodes = buttonItems.length ? buttonItems : [options.buildTitleElement('No more records')];
                childNodes.forEach(button => selectMenu.appendChild(button));
            });
        }
    },
    /**
     *@private
     */
    _makeListItemsSortable: function () {
        $(this.listTable).sortable({
            axis: 'y',
            handle: '.drag_handle',
            items: 'tr',
            cursor: 'move',
            opacity: 0.6,
            stop: (event, ui) => {
                this._renderListItems();
            },
        });
    },
    /**
     * @private
     * @param {string} id
     * @param {string} text
     */
    _addItemToTable: function (id, text, notEditable) {
        const draggableEl = options.buildElement('we-button', null, {
            classes: ['drag_handle', 'fas', 'fa-arrows-alt'],
            dataAttributes: {
                noPreview: 'true',
            },
        });
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.value = text || '';
        inputEl.name = id || '';
        inputEl.disabled = !!notEditable;
        const trEl = document.createElement('tr');
        const buttonEl = options.buildElement('we-button', null, {
            classes: ['o_we_select_remove_option', 'fa', 'fa-fw', 'fa-minus'],
            dataAttributes: {
                removeOption: id,
                noPreview: 'true',
            },
        });
        const draggableTdEl = document.createElement('td');
        const inputTdEl = document.createElement('td');
        const buttonTdEl = document.createElement('td');
        draggableTdEl.appendChild(draggableEl);
        trEl.appendChild(draggableTdEl);
        inputTdEl.appendChild(inputEl);
        trEl.appendChild(inputTdEl);
        buttonTdEl.appendChild(buttonEl);
        trEl.appendChild(buttonTdEl);
        this.listTable.appendChild(trEl);
        if (!notEditable) {
            inputEl.focus();
        }
        this._renderListItems();
    },
    /**
     * @private
     */
    _renderListItems: function () {
        const checkboxWrap = this.$target[0].querySelector('.o_website_form_flex');
        const selectWrap = this.$target[0].querySelector('#editable_select');
        if (checkboxWrap) {
            checkboxWrap.innerHTML = '';
            const fieldName = this._getFieldName();
            const fieldRequired = this.$target[0].classList.contains('o_website_form_required');
            this.listTable.querySelectorAll('input').forEach(el => {
                const params = {
                    record: {
                        id: el.name || el.value,
                        display_name: el.value,
                    },
                    field: {
                        name: fieldName,
                    }
                };
                if (fieldRequired) {
                    params.field.required = fieldRequired;
                }
                const $checkbox = $(qweb.render("website_form.checkbox", params));
                checkboxWrap.appendChild($checkbox[0]);
            });
        } else if (selectWrap) {
            selectWrap.innerHTML = '';
            this.listTable.querySelectorAll('input').forEach(el => {
                const $option = $('<div id="' + (el.name || el.value) + '" class="o_website_form_select_item">' + el.value + '</div>');
                selectWrap.appendChild($option[0]);
            });
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onRemoveItemClick: function (ev) {
        ev.target.closest('tr').remove();
        this._loadListDropdown();
        this._renderListItems();
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onAddCustomItemClick: function (ev) {
        this._addItemToTable();
        this._makeListItemsSortable();
        this._renderListItems();
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onAddExistingItemClick: function (ev) {
        const value = ev.currentTarget.dataset.addOption;
        this._addItemToTable(value, ev.currentTarget.querySelector('we-title').textContent, true);
        this._makeListItemsSortable();
        this._loadListDropdown();
        this._renderListItems();
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onAddItemSelectClick: function (ev) {
        ev.currentTarget.querySelector('we-toggler').classList.toggle('active');
    },
    /**
     * @private
     */
    _onListItemInput: function () {
        this._renderListItems();
    },
});

options.registry.addField = fieldEditor.extend({
    /**
     * @override
     */
    isTopOption: function () {
        return true;
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     *
     */
    addField: function (previewMode, value, params) {
        const field = this._getCustomField('char', 'Custom Text');
        field.formatInfo = {
            labelWidth: this.$target[0].querySelector('.o_we_form_label').style.width,
            labelPosition: 'left',
        };
        this._renderField(field).then(htmlField => {
            this.$target.after(htmlField);
            this.trigger_up('activate_snippet', {
                $snippet: $(htmlField),
            });
        });
    },
});

// Superclass for options that need to disable a button from the snippet overlay
var disable_overlay_button_option = options.Class.extend({
    xmlDependencies: ['/website_form/static/src/xml/website_form_editor.xml'],

    // Disable a button of the snippet overlay
    disable_button: function (button_name, message) {
        // TODO refactor in master
        var className = 'oe_snippet_' + button_name;
        this.$overlay.add(this.$overlay.data('$optionsSection')).on('click', '.' + className, this.prevent_button);
        var $button = this.$overlay.add(this.$overlay.data('$optionsSection')).find('.' + className);
        $button.attr('title', message).tooltip({delay: 0});
        $button.removeClass(className); // Disable the functionnality
    },

    prevent_button: function (event) {
        // Snippet options bind their functions before the editor, so we
        // can't cleanly unbind the editor onRemove function from here
        event.preventDefault();
        event.stopImmediatePropagation();
    }
});

// Disable duplicate button for model fields
options.registry['website_form_editor_field_model'] = disable_overlay_button_option.extend({
    start: function () {
        this.disable_button('clone', 'You can\'t duplicate a model field.');
        return this._super.apply(this, arguments);
    }
});

// Disable delete button for model required fields
options.registry['website_form_editor_field_required'] = disable_overlay_button_option.extend({
    start: function () {
        this.disable_button('remove', 'You can\'t remove a field that is required by the model itself.');
        return this._super.apply(this, arguments);
    }
});
});
