import { DataServiceOptions } from "@point_of_sale/app/models/data_service_options";
import { patch } from "@web/core/utils/patch";

patch(DataServiceOptions.prototype, {
    get databaseTable() {
        return {
            "sale.order": {
                key: "uuid",
                condition: (record) => false,
            },
            "sale.order.line": {
                key: "uuid",
                condition: (record) => false,
            },
        };
    },
});
