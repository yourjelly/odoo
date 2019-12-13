odoo.define('website_form_editor', function (require) {
'use strict';

const ajax = require('web.ajax');
const core = require('web.core');
const FormEditorRegistry = require('website_form.form_editor_registry');
const options = require('web_editor.snippets.options');

const qweb = core.qweb;

const fieldEditor = options.Class.extend({

    /**
     * Returns a field object
     *
     * @private
     * @param {string} type the type of the field
     * @param {string} name The name of the field used also as label
     * @param {boolean} required
     * @param {boolean} hidden
     * @returns {Object}
     */
    _getCustomField: function (type, name) {
        return {
            name: name,
            string: name,
            custom: true,
            type: type,
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
    /**
     * Returns a promise which is resolved once the records of the field have been retrieved.
     *
     * @private
     * @param {Object} field
     * @returns {Promise}
     */
    _getFieldRecords: function (field) {
        // Convert the required boolean to a value directly usable
        // in qweb js to avoid duplicating this in the templates
        field.required = field.required ? 1 : null;

        // Fetch possible values for relation fields
        let fieldRelationProm;
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
     * @param {Object} field
     * @returns {HTMLElement}
     */
    _renderField: function (field) {
        return this._getFieldRecords(field).then(() => {
            const template = document.createElement('template');
            template.innerHTML = qweb.render("website_form.field_" + field.type, {field: field}).trim();
            return template.content.firstChild;
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
    init: function () {
        this._super.apply(this, arguments);
        // Disable text edition
        this.$target.attr('contentEditable', false);
        // Get potential message
        this.$message = this.$target.parent().find('.s_website_form_end_message');
        this.showEndMessage = false;
        // Add default attributes
        if (!this.$target[0].dataset.successMode) {
            this.$target[0].dataset.successMode = 'redirect';
        }
    },
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

        const targetModelName = this.$target[0].dataset.model_name;
        if (targetModelName) {
            this.activeForm = _.findWhere(this.models, {model: targetModelName});
        } else {
            this.activeForm = this.models[0];
            this._applyFormModel(this.activeForm.model);
        }
        // Create the Form Action select
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
    cleanForSave: function () {
        const model = this.$target.data('model_name');
        // because apparently this can be called on the wrong widget and
        // we may not have a model, or fields...
        if (model) {
            // we may be re-whitelisting already whitelisted fields. Doesn't
            // really matter.
            const fields = this.$target.find('input.form-field[name=email_to], .form-field:not(.o_website_form_custom) :input').map(function (_, node) {
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
        const customInputs = this.$target.find('.o_website_form_custom .o_website_form_input');
        _.each(customInputs, function (input, index) {
            // Change the custom field name according to their label
            const fieldLabel = $(input).closest('.form-field').find('label:first');
            input.name = fieldLabel.text().trim();
            fieldLabel.attr('for', input.name);

            // Change the custom radio or checkboxes values according to their label
            if (input.type === 'radio' || input.type === 'checkbox') {
                const checkboxLabel = $(input).closest('label').text().trim();
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
        // If we want to rerender the xml we need to avoid the updateUI
        // as they are asynchronous and the ui might try to update while
        // we are building the UserValueWidgets.
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
     * Select the model to create with the form.
     */
    selectAction: function (previewMode, value, params) {
        this.activeForm = _.findWhere(this.models, {id: parseInt(value)});
        this._applyFormModel(this.activeForm.model);
        this.rerender = true;
    },
    /**
     * Select the value of a field (hidden) that will be used on the model as a preset.
     * ie: The Job you apply for if the form is on that job's page.
     */
    addActionField: function (previewMode, value, params) {
        let fieldName = params.fieldName;
        if (params.isSelect === 'true') {
            value = parseInt(value);
        }
        this._addActionRelatedField(value, fieldName);
    },
    /**
     * Changes the onSuccess event.
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
            case 'addActionField':
                var value = this.$target.find(`.form-group input[name="${params.fieldName}"]`).val();
                if (value) {
                    return value;
                } else {
                    return params.isSelect ? '0' : '';
                }
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
        // Add Action select
        const firstOption = uiFragment.querySelector(':first-child');
        uiFragment.insertBefore(this.selectActionEl.cloneNode(true), firstOption);

        // Add Action related options
        const formKey = this.activeForm.website_form_key;
        const formInfo = FormEditorRegistry.get(formKey);
        if (!formInfo.fields) {
            return;
        }
        const proms = formInfo.fields.map(field => this._getFieldRecords(field));
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
     * Returns a we-select element with field's records as it's options
     *
     * @private
     * @param {Object} field
     * @return {HTMLElement}
     */
    _buildSelect: function (field) {
        const selectEl = options.buildElement('we-select', null, {
            dataAttributes: {
                noPreview: 'true',
                fieldName: field.name,
                isSelect: 'true',
            },
            classes: ['related_element'],
        });
        const noneButton = options.buildElement('we-button', 'None', {
            dataAttributes: {
                addActionField: 0,
            },
            classes: ['custom_select'],
        });
        selectEl.append(noneButton);
        field.records.forEach(el => {
            const button = options.buildElement('we-button', el.display_name, {
                dataAttributes: {
                    addActionField: el.id,
                },
                classes: ['custom_select'],
            });
            selectEl.append(button);
        });
        selectEl.setAttribute('string', field.string);
        return selectEl;
    },
    /**
     * Returns a we-input element from the field
     *
     * @private
     * @param {Object} field
     * @returns {HTMLElement}
     */
    _buildInput: function (field) {
        const inputEl = options.buildElement('we-input', null, {
            dataAttributes: {
                noPreview: 'true',
                fieldName: field.name,
                addActionField: '',
            },
            classes: ['custom_input', 'related_element'],
        });
        inputEl.setAttribute('string', field.string);
        return inputEl;
    },
    /**
     * Add a hidden field that will be used on the model as a preset.
     *
     * @private
     * @param {string} value
     * @param {string} fieldName
     */
    _addActionRelatedField: function (value, fieldName) {
        this.$target.find('.form-group:has("[name=' + fieldName + ']")').remove();
        if (value) {
            const $hiddenField = $(qweb.render('website_form.field_hidden', {
                field: {
                    name: fieldName,
                    value: value,
                },
            }));
            this.$target.find('.form-group:has(".o_website_form_send")').before($hiddenField);
        }
    },
    /**
     * Apply the model on the form changing it's fields
     *
     * @private
     */
    _applyFormModel: function (model) {
        this.$target[0].dataset.model_name = this.activeForm.model = model;
        this.$target.find(".o_we_form_rows .form-field").remove();
        const formKey = this.activeForm.website_form_key;
        const formInfo = FormEditorRegistry.get(formKey);
        this.$target[0].dataset.success_page = formInfo.successPage || '';
        ajax.loadXML(formInfo.defaultTemplatePath, qweb).then(() => {
            this.$target.find('.form-group:has(".o_website_form_send")').before(qweb.render(formInfo.defaultTemplateName));
        });
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
        this.rerender = true;
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
        // Clean the editable select
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
            const select = this.$target[0].querySelector('select');
            if (select && !this.$target[0].querySelector('#editable_select')) {
                select.style.display = 'none';
                const editableSelect = document.createElement('div');
                editableSelect.id = 'editable_select';
                editableSelect.classList = 'form-control o_website_form_input';
                select.parentElement.appendChild(editableSelect);
            }

            this.rerender = false;
            await this._rerenderXML().then(() => this._renderList());
            return;
        }
        await this._super.apply(this, arguments);

        const hasPlaceholder = !!this._getPlaceholderInput();
        this.el.querySelector('[data-set-placeholder]').classList.toggle('d-none', !hasPlaceholder);

        const isMustipleCheckbox = !!this.$target[0].querySelector('.o_website_form_flex');
        this.el.querySelector('.o_we_multi_check').classList.toggle('d-none', !isMustipleCheckbox);

        const isModelRequired = !!this.$target[0].classList.contains('o_website_form_required');
        this.el.querySelector('[data-select-class="o_website_form_required_custom"]').classList.toggle('d-none', isModelRequired);
        this.el.querySelector('[data-select-class="o_website_form_field_hidden"]').classList.toggle('d-none', isModelRequired);
        this.$el.find('we-select:has([data-custom-field])').toggleClass('d-none', isModelRequired);
    },

    //----------------------------------------------------------------------
    // Options
    //----------------------------------------------------------------------

    /**
     * Replace the current field with the custom field selected.
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
        if (['one2many', 'many2one'].includes(value)) {
            this.rerender = true;
        }
    },
    /**
     * Replace the current field with the existing field selected.
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
     * Set the name of the field on the label
     */
    setName: function (previewMode, value, params) {
        this.$target[0].querySelector('.o_we_form_label').textContent = value;
    },
    /*
    * Set the placeholder of the input
    */
    setPlaceholder: function (previewMode, value, params) {
        this._setPlaceholder(value);
    },
    /**
     * Replace the field with the same field having the label in a different position.
     */
    selectLabelPosition: function (previewMode, value, params) {
        const field = this._getActiveField();
        field.formatInfo.labelPosition = value;
        this._replaceField(field, true);
    },
    /**
     * Select the display of the multicheckbox field (vertical & horizontal)
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
        const fieldsInForm = Array.from(this.formEl.querySelectorAll('.o_we_form_label')).map(label => label.getAttribute('for')).filter(el => el !== this._getFieldName());
        this.existingFields.forEach(option => {
            if (!fieldsInForm.includes(option.dataset.existingField)) {
                selectEl.append(option.cloneNode(true));
            }
        });
    },
    /**
     * Returns the target as a field Object
     *
     * @private
     * @returns {Object}
     */
    _getActiveField: function () {
        let field;
        const name = this._getFieldName();
        if (this.$target[0].classList.contains('o_website_form_custom')) {
            field = this._getCustomField(this.$target[0].dataset.type, name);
        } else {
            field = this.fields[name];
        }
        field.placeholder = this._getPlaceholder();
        field.required = this._isFieldRequired();
        field.hidden = !!this.$target[0].classList.contains('o_website_form_field_hidden');

        field.formatInfo = {
            labelPosition: this._getlabelPosition(),
            labelWidth: this.$target[0].querySelector('.o_we_form_label').style.width,
        };
        return field;
    },
    /**
     * Replace the target content with the field provided
     * If the field do not have the formatInfo set the info will be r
     *
     * @private
     * @param {Object} field
     */
    _replaceField: function (field, notFromActive) {
        if (!notFromActive) {
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

    //----------------------------------------------------------------------
    // List Items
    //----------------------------------------------------------------------

    /**
     * To do after rerenderXML to add the list to the options
     *
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
     * Load the dropdown of the list with the records missing from the list.
     *
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
