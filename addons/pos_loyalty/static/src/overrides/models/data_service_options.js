import { DataServiceOptions } from "@point_of_sale/app/models/data_service_options";
import { patch } from "@web/core/utils/patch";

patch(DataServiceOptions.prototype, {
    get databaseTable() {
<<<<<<< 18.0
        return {
            ...super.databaseTable,
            "loyalty.card": {
                key: "id",
                condition: (record) => {
                    return record.models["pos.order.line"].find(
                        (l) => l.coupon_id?.id === record.id
                    );
                },
||||||| c05de309a8828c4a84c423753ed015d4e8513cec
        const data = super.databaseTable;
        data.push({
            name: "loyalty.card",
            key: "id",
            condition: (record) => {
                return record.models["pos.order.line"].find((l) => l.coupon_id?.id === record.id);
=======
        const data = super.databaseTable;
        data.push({
            name: "loyalty.card",
            key: "id",
            condition: (record) => {
                return record["<-pos.order.line.coupon_id"].find(
                    (l) => l.order_id?.finalized && typeof l.order_id.id === "number"
                );
>>>>>>> c581cf4a33b5b8dbe7732f88196433f98296473a
            },
        };
    },
});
