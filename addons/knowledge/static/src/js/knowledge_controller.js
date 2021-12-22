/** @odoo-module */

import { qweb as QWeb } from 'web.core';
import FormController from 'web.FormController';

const KnowledgeFormController = FormController.extend({
    events: Object.assign({}, FormController.prototype.events, {
        'click .btn-share': '_onShare',
    }),

    /**
     * @override
     */
    renderButtons: function ($node) {
        this._super.apply(this, arguments);
        if (this.$buttons) {
            const $container = this.$buttons.find('.o_form_buttons_view');
            $container.append(this._renderShareButton());
            $container.append(this._renderDropdownMenu());
        }
    },

    /**
     * @returns {HTMLElement} 
     */
    _renderShareButton: function () {
        return QWeb.render('knowledge.share_button', {});
    },

    _renderDropdownMenu: function () {
        return QWeb.render('knowledge.dropdown_button', {});
    },

    _onShare: function () {
        console.log('sharing the article', this);
    },
});

export {
    KnowledgeFormController,
};