/* @odoo-module */

import { OR_SYM, _0, isCommand, isMany, isRecord, isRelation } from "./misc";

/** @deprecated */
export class DeprecatedRecord {
    static localId(data) {
        const this0 = _0(this);
        let idStr;
        if (typeof data === "object" && data !== null) {
            idStr = this0._localId(this0.id, data);
        } else {
            idStr = data; // non-object data => single id
        }
        return `${this0.name},${idStr}`;
    }
    static _localId(expr, data, { brackets = false } = {}) {
        const this0 = _0(this);
        if (!Array.isArray(expr)) {
            const definition = this0._fields.get(expr);
            if (definition) {
                if (isMany(definition)) {
                    throw new Error("Using a Record.many() as id is not (yet) supported");
                }
                if (!isRelation(definition)) {
                    return data[expr];
                }
                if (isCommand(data[expr])) {
                    // Note: only one() is supported
                    const [cmd, data2] = data[expr].at(-1);
                    if (cmd === "DELETE") {
                        return undefined;
                    } else {
                        return `(${data2?.localId})`;
                    }
                }
                // relational field (note: optional when OR)
                return `(${data[expr]?.localId})`;
            }
            return data[expr];
        }
        const vals = [];
        for (let i = 1; i < expr.length; i++) {
            vals.push(this0._localId(expr[i], data, { brackets: true }));
        }
        let res = vals.join(expr[0] === OR_SYM ? " OR " : " AND ");
        if (brackets) {
            res = `(${res})`;
        }
        return res;
    }
    static new_1(rec1, data) {
        const this0 = _0(this);
        const rec0 = _0(rec1);
        const ids = this0._retrieveIdFromData(data);
        for (const name in ids) {
            if (
                ids[name] &&
                !isRecord(ids[name]) &&
                !isCommand(ids[name]) &&
                isRelation(this0._fields.get(name))
            ) {
                // preinsert that record in relational field,
                // as it is required to make current local id
                ids[name] = this0.store0[this0._fields.get(name).targetModel].preinsert(ids[name]);
            }
        }
        Object.assign(rec0, { localId: this0.localId(ids) });
        Object.assign(rec1, { ...ids });
        return rec0.localId;
    }
}
