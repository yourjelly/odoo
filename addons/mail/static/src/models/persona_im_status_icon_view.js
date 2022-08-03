/** @odoo-module **/

import { one } from '@mail/model/model_field';
import { registerModel } from '@mail/model/model_core';
import { clear, replace } from '@mail/model/model_field_command';

registerModel({
    name: 'PersonaImStatusIconView',
    identifyingFields: [[
        'channelInvitationFormSelectablePartnerViewOwner',
        'channelMemberViewOwner',
        'composerSuggestionViewOwner',
        'messageViewOwner',
        'notificationRequestViewOwner',
        'threadNeedactionPreviewViewOwner',
        'channelPreviewViewOwner',
    ]],
    recordMethods: {
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computePersona() {
            if (this.channelInvitationFormSelectablePartnerViewOwner) {
                return replace(this.channelInvitationFormSelectablePartnerViewOwner.partner.persona);
            }
            if (this.channelMemberViewOwner) {
                return replace(this.channelMemberViewOwner.channelMember.persona);
            }
            if (this.composerSuggestionViewOwner) {
                return replace(this.composerSuggestionViewOwner.suggestable.partner.persona);
            }
            if (this.messageViewOwner) {
                return replace(this.messageViewOwner.message.author.persona);
            }
            if (this.notificationRequestViewOwner) {
                return replace(this.messaging.partnerRoot.persona);
            }
            if (this.threadNeedactionPreviewViewOwner) {
                return replace(this.threadNeedactionPreviewViewOwner.thread.channel.correspondent.persona);
            }
            if (this.channelPreviewViewOwner) {
                return replace(this.channelPreviewViewOwner.channel.correspondent.persona);
            }
            return clear();
        },
    },
    fields: {
        channelInvitationFormSelectablePartnerViewOwner: one('ChannelInvitationFormSelectablePartnerView', {
            inverse: 'personaImStatusIconView',
            readonly: true,
        }),
        channelMemberViewOwner: one('ChannelMemberView', {
            inverse: 'personaImStatusIconView',
            readonly: true,
        }),
        composerSuggestionViewOwner: one('ComposerSuggestionView', {
            inverse: 'personaImStatusIconView',
            readonly: true,
        }),
        messageViewOwner: one('MessageView', {
            inverse: 'personaImStatusIconView',
            readonly: true,
        }),
        notificationRequestViewOwner: one('NotificationRequestView', {
            inverse: 'personaImStatusIconView',
            readonly: true,
        }),
        threadNeedactionPreviewViewOwner: one('ThreadNeedactionPreviewView', {
            inverse: 'personaImStatusIconView',
            readonly: true,
        }),
        channelPreviewViewOwner: one('ChannelPreviewView', {
            inverse: 'personaImStatusIconView',
            readonly: true,
        }),
        persona: one('Persona', {
            compute: '_computePersona',
            readonly: true,
            required: true,
        }),
    },
});
