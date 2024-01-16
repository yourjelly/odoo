/* @odoo-module */

export class RecordUses {
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
