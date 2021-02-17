/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one } from '@mail/model/model_field';
import { replace } from '@mail/model/model_field_command';

registerModel({
    name: 'LinkPreviewDeleteConfirmView',
    identifyingFields: ['dialogOwner'],
    recordMethods: {
        /**
         * Returns whether the given html element is inside this attachment delete confirm view.
         *
         * @param {Element} element
         * @returns {boolean}
         */
        containsElement(element) {
            return Boolean(this.component && this.component.root.el && this.component.root.el.contains(element));
        },
        onClickCancel() {
            this.dialogOwner.delete();
        },
        async onClickOk() {
            this.linkPreview.remove();
        },
        /**
         * @private
         * @returns {string}
         */
        _computeBody() {
            return this.env._t(`Do you really want to delete this preview?`);
        },
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeLinkPreview() {
            return replace(this.dialogOwner.linkPreviewOwnerAsLinkPreviewDeleteConfirm.linkPreview);
        },
    },
    fields: {
        body: attr({
            compute: '_computeBody',
        }),
        component: attr(),
        dialogOwner: one('Dialog', {
            inverse: 'linkPreviewDeleteConfirmView',
            readonly: true,
            required: true,
        }),
        linkPreview: one('LinkPreview', {
            compute: '_computeLinkPreview',
            readonly: true,
            required: true,
        }),
    },
});
