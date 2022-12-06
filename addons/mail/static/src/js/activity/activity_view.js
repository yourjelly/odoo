/** @odoo-module */

import { registry } from "@web/core/registry";
// import { GalleryController } from "./gallery_controller";

const activityView = {
    type: "activity",
    display_name: "Activity", //todo: translation
    icon: "fa fa-clock-o",
    multiRecord: true,
};

registry.category("views").add("activity", activityView);
