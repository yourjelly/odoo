/** @odoo-module **/

import FormController from 'web.FormController';
import { Domain } from '@web/core/domain';

FormController.include({
    /**
     * Knowledge articles can interact with some records with the help of the KnowledgeService.
     * Those records need to have a field whose name is in [knowledgeTriggerFieldNames].
     * This list is ordered and the first match [list.fieldName <-> record.fieldName] found will
     * be stored in the KnowledgeService to be accessed later by an article in Knowledge
     *
     * @override
     */
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);
        this.knowledgeRecordFieldNames = [
            'note', 'memo', 'description', 'comment', 'narration', 'additional_note', 'internal_notes', 'notes'
        ];
        if (this._isPotentialKnowledgeRecord()) {
            this._searchKnowledgeRecord();
        }
        if (this.knowledgeFormController) {
            this._unregisterObsoleteKnowledgeRecords(this.renderer.breadcrumbs);
        }
    },
    /**
     * When the record in the form view changes, it has to be updated in the knowledgeService too
     *
     * @override
     */
    update: async function (params, options) {
        await this._super(...arguments);
        if (this._isPotentialKnowledgeRecord()) {
            this._searchKnowledgeRecord();
        }
        if (this.knowledgeFormController) {
            this._unregisterObsoleteKnowledgeRecords(this.renderer.breadcrumbs);
        }
    },
    _unregisterObsoleteKnowledgeRecords: function (breadcrumbs, revoke = false) {
        // this right here solve the problem to access the correct breadcrumb in case multiple unrelated records have the same
        // name and controllerID -> this will validate the full breadcrumbs stack everytime we arrive to the knowledge view
        // a registered record has to have the same breadcrumbs as computed here
        const records = this.call('knowledgeService', 'getRecords');
        let isObsolete = revoke;
        for (let record of records) {
            if (record.breadcrumbs.length > breadcrumbs.length) {
                isObsolete = !revoke;
            } else {
                const slicedBreadcrumbs = breadcrumbs.slice(0, record.breadcrumbs.length);
                if (_.isEqual(slicedBreadcrumbs, record.breadcrumbs)) {
                    isObsolete = revoke;
                } else {
                    isObsolete = !revoke;
                }
            }
            if (isObsolete) {
                this.call('knowledgeService', 'deleteRecord', record);
            }
        }
    },
    _isPotentialKnowledgeRecord: function () {
        return !this.knowledgeFormController && this.withControlPanel && this.controlPanelProps.withBreadcrumbs &&
            this.controlPanelProps.action && this.controlPanelProps.action.controllers &&
            this.handle && !this.model.localData[this.handle].isNew();
    },
    _readModifier: function (record, modifier) {
        if (!modifier) {
            return false; // falsy modifier
        }
        let value = false;
        try {
            const preDomain = new Domain(modifier); // unaware of context
            const domain = new Domain(preDomain.toList(record.context)); // aware of context
            value = domain.contains(record.data);
        } catch (_error) {
            return true; // truthy modifier
        }
        return value;
    },
    /**
     * This method finds and stores informations about the field of a record that can be interacted with in Knowledge
     * Search only for form views loaded from an action that can be called again
     *
     * @private
     */
    _searchKnowledgeRecord: function () {
        const record = this.model.get(this.handle, {raw: true});
        const controller = this.controlPanelProps.action.controllers.form;
        const breadcrumbs = this.controlPanelProps.breadcrumbs.slice();
        breadcrumbs.push({
            title: record.data.display_name,
            controllerID: controller.jsId,
        });
        /**
         * If the current potential record has exactly the same breadcrumbs path as another record registered in the
         * KnowledgeService, the previous record should be unregistered here because this problem will not be catched
         * later, as the Knowledge Form view only checks whether its breadcrumbs paths contains a record's breadcrumbs
         * path, regardless of the fact that the current potential record may not have been registered in the service.
         *
         * This check could be omited if the breadcrumbs would also store the related res_id if any, but currently
         * two records with the same display_name and model will have exactly the same breadcrumbs information
         * (controllerID and title).
         */
        this._unregisterObsoleteKnowledgeRecords(breadcrumbs, true);
        const hasMessageIds = this.renderer.chatterFields && this.renderer.chatterFields.hasMessageIds;
        const view = this.controlPanelProps.view;
        const fields = view.viewFields;
        const formFields = view.fieldsInfo.form;
        const knowledgeRecord = {
            res_id: record.res_id,
            res_model: view.model,
            breadcrumbs: breadcrumbs,
            fieldNames: [],
        };
        if (hasMessageIds) {
            knowledgeRecord.withChatter = true;
            this.call('knowledgeService', 'addRecord', knowledgeRecord);
        }
        for (let fieldName of this.knowledgeRecordFieldNames) {
            if (fieldName in formFields && fields[fieldName].type === 'html' && !fields[fieldName].readonly) {
                const readonlyModifier = formFields[fieldName].modifiers.readonly;
                const invisibleModifier = formFields[fieldName].modifiers.invisible;
                if (this._readModifier(record, readonlyModifier) || this._readModifier(record, invisibleModifier)) {
                    continue;
                }
                knowledgeRecord.fieldNames.push({
                    name: fieldName,
                    string: fields[fieldName].string,
                });
            }
        }
        /**
         * while a field by itself can be visible and not readonly, its group / notebook pane could be invisible
         * Another check will be done after rendering to determine if any of the catched fields are in fact
         * usable by the user. @see FormRenderer
         */
        this.call('knowledgeService', 'addToValidateWithHtmlField', knowledgeRecord);
    },
});
