/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from '@web/core/utils/hooks';
import { AddMediaImageVideo } from '@web/core/add_media_dialog/addMediaImageVideo';
import { MediaDialog } from '@web_editor/components/media_dialog/media_dialog';

import { patch } from "@web/core/utils/patch";


patch(AddMediaImageVideo.prototype, {
    async _add() {
        const res = await this.rpc('/shop/product/extra-images', {
            images: this.state.attachments,
            // product_template_id: this.location.hash.match(/id=(\d+)/)[1]
            product_product_id: null,
            product_template_id: this.props.productTemplateId,
        }).then(() => {
            debugger;
        });
    }
});

export class AddMediaField extends Component {
    setup() {
        this.dialogs = useService('dialog');
    }



    addImages() {
        this.dialogs.add(AddMediaImageVideo, {
            'productTemplateId': this.props.record.data.id,
        })
    }
}

AddMediaField.template = "website_sale.addMediaField";
registry.category("fields").add("add_media", {
    component: AddMediaField,
    supportedTypes: ["one2many"],
});


