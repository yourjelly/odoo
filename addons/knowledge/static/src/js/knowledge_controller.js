/** @odoo-module */

import { qweb as QWeb } from 'web.core';
import FormController from 'web.FormController';

const KnowledgeFormController = FormController.extend({
    events: Object.assign({}, FormController.prototype.events, {
        'click .btn-share': '_onShare',
        'click .btn-create': '_onCreate',
    }),

    /**
     * @override
     */
    _setMode: function () {
        console.log('_setMode', arguments)
        return this._super.apply(this, arguments);
    },

    _onShare: function () {
        console.log('sharing the article', this);
    },

    _onCreate: function () {
        console.log('creating a new article', this);
    },
});

export {
    KnowledgeFormController,
};