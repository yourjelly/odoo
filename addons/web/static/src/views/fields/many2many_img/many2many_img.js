/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "../standard_field_props";
import { useService } from "@web/core/utils/hooks";

export class Many2ManyImage extends Component {
    static template = "web.Many2ManyImage";
    static props = {
        ...standardFieldProps,
        className: { type: String, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.rpc = useService("rpc");
        console.log("set up");
        this.state = useState({
            image: [],
        });

        onWillStart(async () => {
            const productTemplateID = this.props.record.data.id;
            const productImage = await this.orm.call("product.image", "search_read", [], {
                fields: ["id", "name", "video_url"],
                domain: [["product_tmpl_id", "=", parseInt(productTemplateID)]],
            });

            const uploadedImageID = [];
            for (const image in productImage) {
                uploadedImageID.push(productImage[image].id);
            }

            const attchedImage = await this.orm.call("ir.attachment", "search_read", [], {
                fields: ["id"],
                domain: [
                    ["res_id", "in", uploadedImageID],
                    ["res_model", "=", "product.image"],
                    ["res_field", "=", "image_1920"],
                ],
            });
            for (const img in attchedImage) {
                this.state.image.push(attchedImage[img].id);
            }
        });

        // onWillStart(() => {
        //     this.getImage();
        // })
    }

    get files() {
        const productImageIDs = [];
        for (const id in this.state.image) {
            productImageIDs.push(this.state.image[id]);
        }
        return productImageIDs;
    }

    getUrl(id) {
        return "/web/image/" + id;
    }

    onClickEdit(ev) {
        const selectedImgID = parseInt(ev.target.closest(".position-relative").id);
        // TODO: open img dialog box and replace existing image
        console.log("selectedImgID: ", selectedImgID);
    }

    async onClickTrace(ev) {
        const selectedImgID = parseInt(ev.target.closest(".position-relative").id);

        await this.orm
            .call("product.template", "remove_image", [this.props.record.data.id, selectedImgID])
            .then(() => {
                const updateImgState = this.state.image.filter((id) => id != selectedImgID);
                console.log("updateImgState: ", updateImgState);
                this.state.image = updateImgState;
            });
    }
}

registry.category("fields").add("m2m_img", {
    component: Many2ManyImage,
    supportedTypes: ["many2many"],
});
