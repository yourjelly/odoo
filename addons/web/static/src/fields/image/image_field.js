/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class ImageField extends Component {}
ImageField.template = "web.ImageField";

registry.category("fields").add("image", ImageField);
