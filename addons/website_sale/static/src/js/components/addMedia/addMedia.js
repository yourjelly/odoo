/** @odoo-module **/

import { Component, xml } from "@odoo/owl";
import { useService } from '@web/core/utils/hooks';
import { registry } from "@web/core/registry";
import { AddMediaImageVideo } from '@web/core/add_media_dialog/addMediaImageVideo';
import { MediaDialog } from '@web_editor/components/media_dialog/media_dialog';


export class AddMediaImage extends Component {

    setup() {
        this.dialogs = useService('dialog');
        // this.rpc = useService('rpc');
        console.log("setup ready");
    }

    addImages() {
        // this.dialogs.add(MediaDialog, {})
        this.dialogs.add(AddMediaImageVideo, { })     
    }
}

AddMediaImage.template = "website_sale.addMediaImage";
AddMediaImage.supportedTypes = ["one2many"];

AddMediaImage.template = xml`
<div t-attf-class="d-flex">
    <button t-on-click="addImages" t-attf-class="btn btn-primary p2">Upload Image</button>
</div>
`;
    // <button t-on-click="addImages" t-attf-class="btn btn-primary p2">Upload Video</button>
    
registry.category("fields").add("add_mdeia", AddMediaImage);