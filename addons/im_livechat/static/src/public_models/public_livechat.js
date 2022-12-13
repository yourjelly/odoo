/** @odoo-module **/

import PublicLivechat from '@im_livechat/legacy/models/public_livechat';

import { attr, clear, one, Model } from '@mail/model';

import { unaccent } from 'web.utils';
import { deleteCookie, setCookie } from 'web.utils.cookies';

Model({
    name: 'PublicLivechat',
    lifecycleHooks: {
        _created() {
            this.update({
                widget: new PublicLivechat(this.messaging, {
                    parent: this.publicLivechatGlobalOwner.livechatButtonView.widget,
                    data: this.data,
                }),
            });
        },
        _willDelete() {
            this.widget.destroy();
        },
    },
    recordMethods: {
        async createLivechatChannel() {
            const params = {
                anonymous_name: this.publicLivechatGlobalOwner.livechatButtonView.defaultUsername,
                channel_id: this.publicLivechatGlobalOwner.channelId,
                operator_id: this.operator.id,
                uuid: this.uuid,
            };
            if (this.data.chatbot_script_id) {
                params["chatbot_script_id"] = this.data.chatbot_script_id;
            }
            const livechatData = await this.messaging.rpc({
                route: "/im_livechat/create_livechat_channel",
                params,
            });
            if (!livechatData || !livechatData.operator_pid) {
                this.publicLivechatGlobalOwner.update({
                    noOperator: true,
                });
                this.messaging.publicLivechatGlobal.chatWindow.widget.renderChatWindow();
            } else {
                this.update({ data: livechatData });
                this.widget.data = livechatData;
                this._updateSessionCookie();
            }
        },
        _updateSessionCookie() {
            deleteCookie('im_livechat_session');
            setCookie('im_livechat_session', unaccent(JSON.stringify(this.widget.toData()), true), 60 * 60, 'required');
            setCookie('im_livechat_auto_popup', JSON.stringify(false), 60 * 60, 'optional');
            if (this.operator) {
                const operatorPidId = this.operator.id;
                const oneWeek = 7 * 24 * 60 * 60;
                setCookie('im_livechat_previous_operator_pid', operatorPidId, oneWeek, 'optional');
            }
        },
    },
    fields: {
        data: attr(),
        id: attr({
            compute() {
                if (!this.data) {
                    return clear();
                }
                return this.data.id;
            },
        }),
        isTemporary: attr({
            compute() {
                if (!this.data || !this.data.id) {
                    return true;
                }
                return false;
            }
        }),
        isFolded: attr({
            default: false,
        }),
        publicLivechatGlobalOwner: one('PublicLivechatGlobal', {
            identifying: true,
            inverse: 'publicLivechat',
        }),
        name: attr({
            compute() {
                if (!this.data || this.publicLivechatGlobalOwner.noOperator) {
                    return clear();
                }
                return this.data.name;
            },
        }),
        operator: one('LivechatOperator', {
            compute() {
                if (!this.data) {
                    return clear();
                }
                if (!this.data.operator_pid) {
                    return clear();
                }
                if (!this.data.operator_pid[0]) {
                    return clear();
                }
                return {
                    id: this.data.operator_pid[0],
                    name: this.data.operator_pid[1],
                };
            },
        }),
        status: attr({
            compute() {
                if (!this.data) {
                    return clear();
                }
                return this.data.status || '';
            },
        }),
        // amount of messages that have not yet been read on this chat
        unreadCounter: attr({
            default: 0,
        }),
        uuid: attr({
            compute() {
                if (!this.data) {
                    return clear();
                }
                return this.data.uuid;
            },
        }),
        widget: attr(),
    },
});
