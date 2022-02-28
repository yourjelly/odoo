/** @odoo-module */
import AbstractService from 'web.AbstractService';
import core from 'web.core';

/**
 * This service is used to store data from non-knowledge form views which have a record containing a field which could be used
 * by a knowledge form view
 *
 * Typical usage is the following:
 * - A form view is loaded and one field of the current record matches what can be used in Knowldege.
 *      - Informations about this record and how to access its form view (action) is stored in this service instance
 * - An article is opened in knowledge and it contains a KnowledgeToolbar.
 *      - When the toolbar is created, it asks this service instance if a record can be interacted with
 *      - if there is one such record, the available buttons are displayed in the toolbar
 * - When one of such buttons is used, we reload the form view of the record and execute the desired operation, which is stored
 *   in this service instance with an actionId and a status
 * - During the operation, its status can be updated.
 * - When the operation is completed successfully, the service should be notified and it will be cleared
 *
 * The linkedRecord is cleared or replaced each time a form view (other than a Knowledge article) is accessed
 */
const KnowledgeService = AbstractService.extend({
    /**
     * @override
     */
    start() {
        this._super.apply(...arguments);
        this._records = new Set();
        this._lastVisitedRecordWithChatter = null;
        this._lastVisitedRecordWithHtmlField = null;
        this._toValidateStackWithHtmlField = [];
    },
    addToValidateWithHtmlField(record) {
        if (record && record.fieldNames.length) {
            this._toValidateStackWithHtmlField.push(record);
        }
    },
    popToValidateWithHtmlField() {
        return this._toValidateStackWithHtmlField.pop();
    },
    addRecord(record) {
        if (record) {
            this._records.add(record);
        }
        if (record.withChatter) {
            this._lastVisitedRecordWithChatter = record;
        }
        if (record.withHtmlField) {
            this._toValidateStackWithHtmlField = [];
            this._lastVisitedRecordWithHtmlField = record;
        }
    },
    deleteRecord(record) {
        this._records.delete(record);
    },
    getAvailableRecordWithChatter() {
        if (this._lastVisitedRecordWithChatter && !this._lastVisitedRecordWithChatter.withChatter) {
            this._records.delete(this._lastVisitedRecordWithChatter);
        }
        if (!this._records.has(this._lastVisitedRecordWithChatter)) {
            this._lastVisitedRecordWithChatter = null;
        }
        return this._lastVisitedRecordWithChatter;
    },
    getAvailableRecordWithHtmlField() {
        if (this._lastVisitedRecordWithHtmlField && !this._lastVisitedRecordWithHtmlField.withHtmlField) {
            this._records.delete(this._lastVisitedRecordWithHtmlField);
        }
        if (!this._records.has(this._lastVisitedRecordWithHtmlField)) {
            this._lastVisitedRecordWithHtmlField = null;
        }
        return this._lastVisitedRecordWithHtmlField;
    },
    getRecords() {
        return new Set(this._records);
    },
});

core.serviceRegistry.add('knowledgeService', KnowledgeService);

export default KnowledgeService;
