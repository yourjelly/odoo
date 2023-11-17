/** @odoo-module */
import { registry } from "@web/core/registry";
import { Base } from "./related_models";

export class RestaurantTable extends Base {
    static pythonModel = "restaurant.table";
}

registry.category("pos_available_models").add(RestaurantTable.pythonModel, RestaurantTable);
