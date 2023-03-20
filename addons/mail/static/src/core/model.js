/* @odoo-module */

export class Model {
    /** @type {import("@mail/core/store_service").Store} */
    _store;

    assign(data, fields) {
        for (const property of fields) {
            if (data[property]) {
                this[property] = data[property];
            }
        }
    }

    get fields() {
        return Object.getOwnPropertyNames(this);
    }
}
