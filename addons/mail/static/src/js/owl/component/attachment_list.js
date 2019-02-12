odoo.define('mail.component.AttachmentList', function (require) {
'use strict';

const Attachment = require('mail.component.Attachment');

const { Component } = owl;

class AttachmentList extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { Attachment };
        this.template = 'mail.component.AttachmentList';
    }
}

/**
 * Props validation
 */
AttachmentList.props = {
    attachmentLocalIds: { type: Array, element: String },
    downloadable: Boolean,
    editable: Boolean,
    layout: String, // ['basic', 'card']
    layoutBasicImageSize: String, // ['small', 'medium', 'large']
    layoutCardLabel: Boolean,
};

AttachmentList.defaultProps = {
    attachmentLocalIds: [],
    downloadable: false,
    editable: false,
    layout: 'basic',
    layoutBasicImageSize: 'medium',
    layoutCardLabel: true,
};

return AttachmentList;

});
