import { Record } from "@mail/model/record";

export class ResGroups extends Record {
    static _name = "res.groups";
    /** @type {number} */
    id = undefined;
    /** @type {string} */
    full_name = undefined;
}

ResGroups.register();
