import { Record } from "@mail/core/common/record";

export class CannedResponse extends Record {
    static id = "id";
    /** @returns {import("models").CannedResponse} */
    static get(data) {
        return super.get(data);
    }
    /** @returns {import("models").CannedResponse|import("models").CannedResponse[]} */
    static insert(data) {
        return super.insert(...arguments);
    }

    /** @type {number} */
    id;
    /** @type {string} */
    source;
    storeAsAllCannedResponses = Record.one("Store", {
        default() {
            return this._store;
        },
        inverse: "allCannedResponses",
    });
    /** @type {string} */
    substitution;
}

CannedResponse.register();
