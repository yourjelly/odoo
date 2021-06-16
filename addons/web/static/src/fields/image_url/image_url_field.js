/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class ImageUrlField extends Component {}
ImageUrlField.template = "web.ImageUrlField";

registry.category("fields").add("image_url", ImageUrlField);
