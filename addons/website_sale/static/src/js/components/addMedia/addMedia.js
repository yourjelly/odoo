/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from '@web/core/utils/hooks';
import { AddMediaImageVideo } from '@web/core/add_media_dialog/addMediaImageVideo';
import { MediaDialog } from '@web_editor/components/media_dialog/media_dialog';


export class AddMediaField extends Component {

    setup() {
        this.dialogs = useService('dialog');
        // this.rpc = useService('rpc');
        console.log("setup ready");
    }

    addImages() {
        // this.dialogs.add(MediaDialog, {})
        this.dialogs.add(AddMediaImageVideo, {})
    }
}

AddMediaField.template = "website_sale.addMediaField";
registry.category("fields").add("add_media", {
    component: AddMediaField,
    supportedTypes: ["one2many"],
});
