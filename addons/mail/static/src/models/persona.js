/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, many, one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';

registerModel({
    name: 'Persona',
    identifyingMode: 'xor',
    modelMethods: {
        /**
         * Get the persona corresponding to the given id.
         *
         * @param {Object} param0
         * @returns {Object} Persona related to given id.
         */
        async getFromIdentifyingId({ partnerId, userId }) {
            let partner;
            if (userId) {
                const user = this.messaging.models['User'].insert({ id: userId });
                if (!user.partner) {
                    await user.fetchPartner();
                    partner = user.partner;
                }
            } else if (partnerId) {
                partner = this.messaging.models['Partner'].insert({ id: partnerId });
            }
            if (!partner) {
                return;
            }
            return this.messaging.models['Persona'].insert({ partner });
        }
    },
    recordMethods: {
        async canOpenChat() {
            if (this.guest) {
                return false;
            }
            if (!this.partner.user && !this.partner.hasCheckedUser) {
                await this.partner.checkIsUser();
            }
            return Boolean(this.partner.user);
        },
        /**
         * Gets the chat between this persona and the current partner.
         *
         * @returns {Channel|undefined}
         */
        async getChat() {
            // Find the chat or try to create it.
            let chat = this.partner.dmChatWithCurrentPartner;
            if (!chat || !chat.thread.isPinned) {
                // If chat is not pinned then it has to be pinned client-side
                // and server-side, which is a side effect of following rpc.
                chat = await this.messaging.models['Channel'].performRpcCreateChat({
                    partnerIds: [this.partner.id],
                });
            }
            return chat;
        },
        /**
         * Try to open a chat between this persona and the current user.
         * If the chat can't be opened, display a notification instead.
         *
         * @param {Object} param0
         */
        async requestOpenChat({ inChatWindow, ...openThreadOptions }) {
            const canOpenChat = await this.canOpenChat();
            if (!canOpenChat) {
                this.messaging.notify({
                    message: this.env._t('You can only chat with partners that have a dedicated user.'),
                    type: 'info',
                });
                return;
            }
            const chat = await this.getChat();
            if (!chat) {
                this.messaging.notify({
                    message: this.env._t("An unexpected error occurred during the creation of the chat."),
                    type: 'warning',
                });
                return;
            }
            if (inChatWindow) {
                return this.messaging.chatWindowManager.openThread(chat.thread, openThreadOptions);
            }
            return chat.thread.open(openThreadOptions);
        },
    },
    fields: {
        channelMembers: many('ChannelMember', {
            inverse: 'persona',
            isCausal: true,
        }),
        guest: one('Guest', {
            identifying: true,
            inverse: 'persona',
        }),
        im_status: attr({
            compute() {
                if (this.guest) {
                    return this.guest.im_status || clear();
                }
                if (this.partner) {
                    return this.partner.im_status || clear();
                }
                return clear();
            },
        }),
        messagingAsAnyPersona: one('Messaging', {
            default: {},
            inverse: 'allPersonas',
        }),
        name: attr({
            compute() {
                if (this.guest) {
                    return this.guest.name || clear();
                }
                if (this.partner) {
                    return this.partner.nameOrDisplayName || clear();
                }
                return clear();
            },
        }),
        partner: one('Partner', {
            identifying: true,
            inverse: 'persona',
        }),
        volumeSetting: one('res.users.settings.volumes', {
            compute() {
                if (this.guest) {
                    return this.guest.volumeSetting || clear();
                }
                if (this.partner) {
                    return this.partner.volumeSetting || clear();
                }
                return clear();
            },
        }),
    },
});
