/** @odoo-module **/

import { Component, xml } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from '@web/core/utils/hooks';
import { MediaDialog } from '@web_editor/components/media_dialog/media_dialog';

class AttachmentMediaDialog extends MediaDialog {
    /**
     * @override
     */
    async save() {
        if (this.state.activeTab === "VIDEOS") {
            // TODO
            return this.props.close();
        }
        await super.save();
        const selectedMedia = this.selectedMedia[this.state.activeTab];
        if (selectedMedia.length) {
            await this.props.extraImageSave(selectedMedia);
        }
        this.props.close();
    }
}


export class AddMediaField extends Component {
    setup() {
        this.dialogs = useService('dialog');
        this.rpc = useService("rpc");
        this.orm = useService("orm");
    }
    addImages() {
        let extraImageEls;
        this.dialogs.add(AttachmentMediaDialog, {
            multiImages: true,
            onlyImages: true,
            // Kinda hack-ish but the regular save does not get the information we need
            save: async (imgEls) => {
                extraImageEls = imgEls;
            },
            extraImageSave: async (attachments) => {
                for (const index in attachments) {
                    const attachment = attachments[index];
                    if (attachment.mimetype.startsWith("image/")) {
                        if (["image/gif", "image/svg+xml"].includes(attachment.mimetype)) {
                            continue;
                        }
                        await this._convertAttachmentToWebp(attachment, extraImageEls[index]);
                    }
                }
                this.rpc('/shop/product/extra-images',
                    {
                        images: attachments,
                        product_product_id: null,
                        product_template_id: this.props.record.data.id,
                    }
                );
            }
        });
    }

    async _convertAttachmentToWebp(attachment, imageEl) {
        // This method is widely adapted from onFileUploaded in ImageField.
        // Upon change, make sure to verify whether the same change needs
        // to be applied on both sides.
        // Generate alternate sizes and format for reports.
        const imgEl = document.createElement("img");
        imgEl.src = imageEl.src;
        await new Promise(resolve => imgEl.addEventListener("load", resolve));
        const originalSize = Math.max(imgEl.width, imgEl.height);
        const smallerSizes = [1024, 512, 256, 128].filter(size => size < originalSize);
        const webpName = attachment.name.replace(/\.(jpe?g|png)$/i, ".webp");
        let referenceId = undefined;
        for (const size of [originalSize, ...smallerSizes]) {
            const ratio = size / originalSize;
            const canvas = document.createElement("canvas");
            canvas.width = imgEl.width * ratio;
            canvas.height = imgEl.height * ratio;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgb(255, 255, 255)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height, 0, 0, canvas.width, canvas.height);
            const [resizedId] = await this.orm.call("ir.attachment", "create_unique", [
                [
                    {
                        name: webpName,
                        description: size === originalSize ? "" : `resize: ${size}`,
                        datas: canvas.toDataURL("image/webp", 0.75).split(",")[1],
                        res_id: referenceId,
                        res_model: "ir.attachment",
                        mimetype: "image/webp",
                    },
                ],
            ]);
            if (size === originalSize) {
                attachment.original_id = attachment.id;
                attachment.id = resizedId;
                attachment.image_src = `/web/image/${resizedId}-autowebp/${attachment.name}`;
                attachment.mimetype = "image/webp";
            }
            referenceId = referenceId || resizedId; // Keep track of original.
            await this.orm.call("ir.attachment", "create_unique", [
                [
                    {
                        name: webpName.replace(/\.webp$/, ".jpg"),
                        description: "format: jpeg",
                        datas: canvas.toDataURL("image/jpeg", 0.75).split(",")[1],
                        res_id: resizedId,
                        res_model: "ir.attachment",
                        mimetype: "image/jpeg",
                    }
                ],
            ]);
        }
    }

    addVideo() {
        this.dialogs.add(AttachmentMediaDialog, {
            noImages: true,
            noDocuments: true,
            noIcons: true,
            noVideos: false,
        })
    }
}

registry.category("fields").add("add_media", {
    component: AddMediaField,
    supportedTypes: ["one2many"],
});

AddMediaField.template = xml`
<div t-attf-class="d-flex">
    <button t-on-click="addImages" t-attf-class="btn btn-primary p-2 me-3 text-nowrap">Upload Image</button>
    <button t-on-click="addVideo" t-attf-class="btn btn-secondary p-2 text-nowrap">Upload Video</button>
</div>`;
