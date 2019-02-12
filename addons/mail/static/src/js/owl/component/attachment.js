odoo.define('mail.component.Attachment', function () {
'use strict';

const { Component, connect } = owl;

class Attachment extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.Attachment';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get attachmentUrl() {
        if (this.props.attachment.isTemporary) {
            return '';
        }
        return this.env.session.url('/web/content', {
            id: this.props.attachment.id,
            download: true,
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickImage(ev) {
        if (!this.props.attachment.isViewable) {
            return;
        }
        this.env.store.commit('viewAttachments', {
            attachmentLocalId: this.props.attachmentLocalId,
            attachmentLocalIds: this.props.attachmentLocalIds.filter(localId =>
                this.env.store.state.attachments[localId].isViewable),
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickUnlink(ev) {
        this.env.store.dispatch('unlinkAttachment', this.props.attachmentLocalId);
    }
}

/**
 * Props validation
 */
Attachment.props = {
    attachment: Object, // {mail.store.model.Attachment}
    attachmentLocalId: String,
    downloadable: Boolean,
    editable: Boolean,
    layout: String, // ['basic', 'card']
    layoutBasicImageSize: String, // ['small', 'medium', 'large']
    layoutCardLabel: Boolean,
};

Attachment.defaultProps = {
    downloadable: false,
    editable: false,
    layout: 'basic',
    layoutBasicImageSize: 'medium',
    layoutCardLabel: true,
};

return connect(
    Attachment,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.attachmentLocalId
     */
    (state, ownProps) => {
        return {
            attachment: state.attachments[ownProps.attachmentLocalId],
        };
    },
    { deep: false }
);

});
