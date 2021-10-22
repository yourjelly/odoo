/** @odoo-module **/

import { registerNewModel } from '@mail/model/model_core';
import { attr, one2many } from '@mail/model/model_field';

export const guest = {
    modelName: 'mail.guest',
    identifyingFields: ['id'],
    fields: {
        authoredMessages: one2many('mail.message', {
            inverse: 'guestAuthor',
        }),
        avatarUrl: attr({
            compute: '_computeAvatarUrl',
        }),
        id: attr({
            required: true,
            readonly: true,
        }),
        name: attr(),
    },
    modelMethods: {
        /**
         * @static
         * @param {Object} param0
         * @param {number} param0.id The id of the guest to rename.
         * @param {string} param0.name The new name to use to rename the guest.
         */
        async performRpcGuestUpdateName({ id, name }) {
            await this.env.services.rpc({
                route: '/mail/guest/update_name',
                params: {
                    guest_id: id,
                    name,
                },
            });
        }
    },
    recordMethods: {
        /**
         * @private
         * @returns {string}
         */
        _computeAvatarUrl() {
            return `/web/image/mail.guest/${this.id}/avatar_128?unique=${this.name}`;
        }
    },
};

registerNewModel(guest);
