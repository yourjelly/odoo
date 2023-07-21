/** @odoo-module */

import { Dialog } from "../dialog/dialog";
import { _lt } from "../l10n/translation";
import { useChildRef, useService } from "@web/core/utils/hooks";

import { Component, useRef, useState } from "@odoo/owl";

export class AddMediaImageVideo extends Component {

    setup() {

        this.state = useState({
            attachments: [],
        });

        this.selectedMedia = useState({});
        this.fileInput = useRef('file-input');
        this.uploadService = useService('upload');
    }
   
    async uploadFiles(files) {
        await this.uploadService.uploadFiles(files, { resModel: this.props.resModel, resId: this.props.resId }, attachment => this.onUploaded(attachment));
        alert(" uploaded")
    }

    onClickUpload() {
        // $('.imgUpload').trigger('click');
        this.fileInput.el.click();
    }

    async onChangeFileInput() {
        console.log('changes detected')
        const inputFiles = this.fileInput.el.files;
        if (!inputFiles.length) {
            return;
        }
        await this.uploadFiles(inputFiles);
        this.fileInput.el.value = '';
    }

    selectMedia(media, tabId, multiSelect) {
        if (multiSelect) {
            const isMediaSelected = this.selectedMedia[tabId].map(({ id }) => id).includes(media.id);
            if (!isMediaSelected) {
                this.selectedMedia[tabId].push(media);
            } else {
                this.selectedMedia[tabId] = this.selectedMedia[tabId].filter(m => m.id !== media.id);
            }
        } else {
            this.selectedMedia[tabId] = [media];
        }
    }

    selectAttachment(attachment) {
        console.log(this.props)
        this.selectMedia({ ...attachment, mediaType: 'attachment' });
    }

    async save() {
        alert("saving")
        // extraImageSave: async (attachments) => {
        //     this._rpc({
        //         route: `/shop/product/extra-images`,
        //         params: {
        //             images: attachments,
        //             product_product_id: this.productProductID,
        //             product_template_id: this.productTemplateID,
        //             combination_ids: this._getSelectedVariantValues(this.$target.find('.js_add_cart_variants')),
        //         }
        //     }).then(() => {
        //         this.trigger_up('request_save', {reload: true, optionSelector: this.data.selector});
        //     });
        // }
    }

    async onUploaded(attachment) {
        console.log("attachment", attachment)
        this.state.attachments = [attachment, ...this.state.attachments];
        this.selectAttachment(attachment);
        if (!this.props.multiSelect) {
            await this.save();
        }
        if (this.props.onAttachmentChange) {
            this.props.onAttachmentChange(attachment);
        }
    }


    async _add() {
        alert("Add selected images");
    }

    async _discard() {
        alert("discard changes");
    }

}
AddMediaImageVideo.template = "web.AddMediaImageVideo";
AddMediaImageVideo.components = { Dialog };

AddMediaImageVideo.defaultProps = {
    addLabel: _lt("ADD"),
    discardLabel: _lt("Discard"),
    title: _lt("Select a media"),
};
