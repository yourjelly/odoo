/** @odoo-module */

import { registry } from "@web/core/registry";

export class PosBus {
    static serviceDependencies = ["pos", "orm", "bus_service"];

    constructor(...args) {
        this.setup(...args);
        if (this.pos.config.is_restaurant) {
            this.initTableOrderCount();
        }
    }

    setup(env, { pos, orm, bus_service }) {
        this.pos = pos;
        this.orm = orm;

        bus_service.addChannel(`pos_session-${pos.pos_session.id}-${pos.pos_session.access_token}`);
        bus_service.addEventListener("notification", ({ detail }) => {
            for (const message of detail) {
                this.dispatch(message);
            }
        });
    }

    async initTableOrderCount() {
        const result = await this.orm.call(
            "pos.config",
            "get_tables_order_count_and_printing_changes",
            [this.pos.config.id]
        );

        this.ws_syncTableCount(result);
    }

    dispatch(message) {
        if (message.type === "TABLE_ORDER_COUNT") {
            this.ws_syncTableCount(message.payload);
        }
    }
    // Sync the number of orders on each table with other PoS
    // using the same floorplan.
    async ws_syncTableCount(data) {
        const missingTable = data.find((table) => !(table.id in this.pos.tables_by_id));

        if (missingTable) {
            const result = await this.orm.call("pos.session", "get_pos_ui_pos_floor", [
                [odoo.pos_session_id],
            ]);

            if (this.pos.config.module_pos_restaurant) {
                this.pos.floors = result;
                this.pos.loadRestaurantFloor();
            }
        }

        for (const table of data) {
            const table_obj = this.pos.tables_by_id[table.id];
            if (table_obj) {
                table_obj.order_count = table.orders;
                table_obj.changes_count = table.changes;
                table_obj.skip_changes = table.skip_changes;
            }
        }
    }
}

export const posBusService = {
    dependencies: PosBus.serviceDependencies,
    async start(env, deps) {
        return new PosBus(env, deps);
    },
};

registry.category("services").add("pos_bus", posBusService);
