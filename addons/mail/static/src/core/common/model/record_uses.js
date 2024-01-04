/* @odoo-module */

export class RecordUses {
    /**
     * Combine both record uses, i.e. resulting data in both uses is union of both values.
     *
     * @param {import("./record").Record} a
     * @param {import("./record").Record} b
     */
    static reconcile(a, b) {
        // TODO combine the uses
        // the tracked uses are for efficient deletion of self,
        // so it's fine if we overestimate it a bit
        const data = a.__uses__.data;
        for (const [localId, bFields] of b.__uses__.data.entries()) {
            const aFields = data.get(localId);
            if (!aFields) {
                data.set(localId, bFields);
            } else {
                for (const [name, bCount] of bFields.entries()) {
                    const aCount = aFields.get(name);
                    if (aCount === undefined) {
                        aFields.set(name, bCount);
                    } else {
                        aFields.set(name, aCount + bCount);
                    }
                }
            }
        }
        b.__uses__.data = data;
    }
    /**
     * Track the uses of a record. Each record contains a single `RecordUses`:
     * - Key: a localId of record that uses current record
     * - Value: Map where key is relational field name, and value is number
     *          of time current record is present in this relation.
     *
     * @type {Map<string, Map<string, number>>}}
     */
    data = new Map();
    /** @param {RecordList} list */
    add(list) {
        const record = list.owner;
        let ownerLocalId;
        for (const localId of record.localIds) {
            if (this.data.has(localId)) {
                ownerLocalId = localId;
                break;
            }
        }
        if (!ownerLocalId) {
            ownerLocalId = list.owner.localId;
            this.data.set(ownerLocalId, new Map());
        }
        const use = this.data.get(ownerLocalId);
        if (!use.get(list.name)) {
            use.set(list.name, 0);
        }
        use.set(list.name, use.get(list.name) + 1);
    }
    /** @param {RecordList} list */
    delete(list) {
        const record = list.owner;
        let ownerLocalId;
        for (const localId of record.localIds) {
            if (this.data.has(localId)) {
                ownerLocalId = localId;
                break;
            }
        }
        if (!ownerLocalId) {
            return;
        }
        const use = this.data.get(ownerLocalId);
        if (!use.get(list.name)) {
            return;
        }
        use.set(list.name, use.get(list.name) - 1);
        if (use.get(list.name) === 0) {
            use.delete(list.name);
        }
    }
}
