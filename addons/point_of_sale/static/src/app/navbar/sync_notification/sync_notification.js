import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useService } from "@web/core/utils/hooks";

export class SyncNotification extends Component {
    static template = "point_of_sale.SyncNotification";
    static props = {};

    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
    }
    get sync() {
        return {
            offline: this.pos.data.network.offline,
        };
    }
    onClick() {}
}
