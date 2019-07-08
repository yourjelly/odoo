odoo.define('mail.component.Composer', function (require) {
'use strict';

const AttachmentList = require('mail.component.AttachmentList');
const Input = require('mail.component.ComposerTextInput');
const EmojisButton = require('mail.component.EmojisButton');

const core = require('web.core');

const { Component, connect } = owl;

class Composer extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { AttachmentList, EmojisButton, Input };
        this.fileuploadId = _.uniqueId('o_Composer_fileupload');
        this.id = _.uniqueId('o_Composer');
        this.state = {
            attachmentLocalIds: [],
            isSending: false,
            showAllSuggestedRecipients: false,
        };
        this.template = 'mail.component.Composer';
    }

    mounted() {
        this._attachmentUploadedEventListener = (...args) => this._onAttachmentUploaded(...args);
        this._globalClickCaptureEventListener = (...args) => this._onClickCaptureGlobal(...args);
        document.addEventListener('click', this._globalClickCaptureEventListener, true);
        $(window).on(this.fileuploadId, this._attachmentUploadedEventListener);
    }

    willUnmount() {
        document.removeEventListener('click', this._globalClickCaptureEventListener, true);
        $(window).off(this.fileuploadId, this._attachmentUploadedEventListener);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {boolean}
     */
    get showFooter() {
        return this.state.attachmentLocalIds.length > 0;
    }

    /**
     * @return {string}
     */
    get userAvatar() {
        const avatar = this.env.session.uid > 0
            ? this.env.session.url('/web/image', {
                    model: 'res.users',
                    field: 'image_small',
                    id: this.env.session.uid
                })
            : '/web/static/src/img/user_menu_avatar.png';
        return avatar;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this.refs.textInput.focus();
    }

    focusout() {
        this.refs.textInput.focusout();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _postMessage() {
        const self = this;

        this.state.isSending = true;

        // TODO: take suggested recipients into account
        this.env.store.dispatch('postMessageOnThread', this.props.threadLocalId, {
            attachmentLocalIds: this.state.attachmentLocalIds,
            content: this.refs.textInput.getValue(),
            subtype: this.props.isLog ? 'mail.mt_note': 'mail.mt_comment',
        }).then(function () {
            self.state.isSending = false;
            self.refs.textInput.resetValue();
            self.state.attachmentLocalIds = [];
            self.trigger('message-posted');
        }).guardedCatch(function () {
            self.state.isSending = false;
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQuery.Event} ev
     * @param {...Object} fileData
     */
    _onAttachmentUploaded(ev, ...filesData) {
        for (const fileData of filesData) {
            const {
                error,
                filename,
                id,
                mimetype,
                name,
                size,
            } = fileData;
            const temporaryAttachmentLocalId = this.env.store.state.temporaryAttachmentLocalIds[filename];
            const index = this.state.attachmentLocalIds.findIndex(localId =>
                localId === temporaryAttachmentLocalId);
            this.state.attachmentLocalIds.splice(index, 1);
            this.env.store.commit('deleteAttachment', temporaryAttachmentLocalId);
            if (error || !id) {
                this.env.do_warn(error);
                return;
            }
            const attachmentLocalId = `ir.attachment_${id}`;
            if (index >= this.state.attachmentLocalIds.length) {
                this.state.attachmentLocalIds.push(attachmentLocalId);
            } else {
                this.state.attachmentLocalIds.splice(index, 0, attachmentLocalId);
            }
            this.env.store.commit('createAttachment', {
                filename,
                id,
                mimetype,
                name,
                size,
                uploaded: true,
            });
        }
    }

    /**
     * @private
     * @param {Event} ev
     */
    async _onChangeAttachment(ev) {
        const files = ev.target.files;
        for (const file of files) {
            const attachment = this.state.attachmentLocalIds
                .map(localId => this.env.store.state.attachments[localId])
                .find(attachment =>
                    attachment.name === file.name && attachment.size === file.size);
            // if the files already exits, delete the file before upload
            if (attachment) {
                const attachmentLocalId = attachment.localId;
                this.state.attachmentLocalIds = this.state.attachmentLocalIds.filter(localId =>
                    localId !== attachmentLocalId);
                this.env.store.dispatch('unlinkAttachment', attachment.localId);
            }
        }
        for (const file of files) {
            const attachmentLocalId = this.env.store.commit('createAttachment', {
                isTemporary: true,
                name: file.name,
                uploading: true,
            });
            this.state.attachmentLocalIds.push(attachmentLocalId);
        }
        let formData = new window.FormData();
        formData.append('callback', this.fileuploadId);
        formData.append('csrf_token', core.csrf_token);
        formData.append('id', '0');
        formData.append('model', 'mail.compose.message');
        for (const file of files) {
            // removing existing key with blank data and appending again with file info
            // In safari, existing key will not be updated when append with new file.
            formData.delete('ufile');
            formData.append('ufile', file, file.name);
            const response = await window.fetch('/web/binary/upload_attachment', {
                method: 'POST',
                body: formData,
            });
            let html = await response.text();
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            window.eval.call(window, template.content.firstChild.textContent);
        }
        this.refs.fileInput.value = '';
    }

    /**
     * @private
     */
    _onClickAddAttachment() {
        this.refs.fileInput.click();
        this.focus();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickCaptureGlobal(ev) {
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            this.refs.textInput.saveRange();
        }
    }

    /**
     * @private
     */
    async _onClickFullComposer() {
        const attachmentIds = this.state.attachmentLocalIds
            .map(localId => this.env.store.state.attachments[localId].res_id);

        var context = {
            // default_parent_id: this.id,
            default_body: this.refs.textInput.getValue(),
            default_attachment_ids: attachmentIds,
            // default_partner_ids: partnerIds,
            default_is_log: this.props.isLog,
            mail_post_autofollow: true,
        };

        // if (this.context.default_model && this.context.default_res_id) {
        //     context.default_model = this.context.default_model;
        //     context.default_res_id = this.context.default_res_id;
        // }

        var action = {
            type: 'ir.actions.act_window',
            res_model: 'mail.compose.message',
            view_mode: 'form',
            views: [[false, 'form']],
            target: 'new',
            context: context,
        };
        await this.env.do_action(action);
        this.trigger('full-composer-opened');
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickDiscard(ev) {
        this.trigger('discarded');
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSend(ev) {
        if (!this.refs.textInput.getValue()) {
            return;
        }
        ev.stopPropagation();
        this._postMessage();
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.unicode
     */
    _onEmojiSelection(ev) {
        this.refs.textInput.insert(ev.detail.unicode);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onPostMessageTextInput(ev) {
        this._postMessage();
    }

    /**
     * @private
     */
    _onShowLessSuggestedRecipients() {
        this.state.showAllSuggestedRecipients = false;
    }

    /**
     * @private
     */
    _onShowMoreSuggestedRecipients() {
        this.state.showAllSuggestedRecipients = true;
    }
}

/**
 * Props validation
 */
Composer.props = {
    attachmentEditable: { type: Boolean, optional: true },
    attachmentLayout: { type: String, optional: true },
    attachmentLayoutCardLabel: { type: Boolean, optional: true },
    avatar: Boolean,
    expandable: Boolean,
    discardButton: Boolean,
    inlineActions: Boolean,
    isLog: Boolean,
    recordName: { type: String, optional: true },
    sendButton: Boolean,
    showFollowers: Boolean,
    showThreadName: Boolean,
    suggestedRecipients: {
        type: Array,
        element: {
            type: Object,
            shape: {
                checked: Boolean,
                partnerLocalId: String,
                reason: String,
            },
        },
        optional: true,
    },
    thread: { type: Object, /* {mail.store.model.Thread} */ optional: true },
    threadLocalId: { type: String, optional: true },
};

Composer.defaultProps = {
    avatar: true,
    discardButton: false,
    expandable: false,
    inlineActions: true,
    isLog: false,
    sendButton: true,
    showFollowers: false,
    showThreadName: false,
    suggestedRecipients: [],
};

return connect(
    Composer,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Object[]} [ownProps.suggestedRecipients=[]]
     * @param {string} [ownProps.threadLocalId]
     */
    (state, { suggestedRecipients=[], threadLocalId }) => {
        return {
            fullSuggestedRecipients: suggestedRecipients.map(recipient => {
                return {
                    ...recipient,
                    partner: state.partners[recipient.partnerLocalId],
                };
            }),
            thread: state.threads[threadLocalId],
        };
    },
);

});
