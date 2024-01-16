/* @odoo-module */

import { markup, toRaw } from "@odoo/owl";
import { registry } from "@web/core/registry";

export const modelRegistry = registry.category("discuss.model");

export const VERSION = {
    CURRENT: 1,
    AVAILABLE: [0, 1],
};

/**
 * Class of markup, useful to detect content that is markup and to
 * automatically markup field during trusted insert
 */
export const Markup = markup("").constructor;

/** @typedef {ATTR_SYM|MANY_SYM|ONE_SYM} FIELD_SYM */
export const ATTR_SYM = Symbol("attr");
export const MANY_SYM = Symbol("many");
export const ONE_SYM = Symbol("one");
export const OR_SYM = Symbol("or");
export const AND_SYM = Symbol("and");
export const RECORD_SYM = Symbol("Record");
export const FIELD_DEFINITION_SYM = Symbol("FieldDefinition");
export const RECORD_FIELD_SYM = Symbol("RecordField");
export const STORE_SYM = Symbol("Store");

/**
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function _0(obj) {
    const raw = toRaw(obj);
    if (!raw) {
        return raw;
    }
    return raw._0 ?? raw;
}

export function AND(...args) {
    return [AND_SYM, ...args];
}
export function OR(...args) {
    return [OR_SYM, ...args];
}

/** @param {FieldDefinition} */
export function isAttr(definition) {
    return Boolean(definition?.[ATTR_SYM]);
}

export function isCommand(data) {
    return ["ADD", "DELETE", "ADD.noinv", "DELETE.noinv"].includes(data?.[0]?.[0]);
}

export function isRecord(record) {
    return Boolean(record?.[RECORD_SYM]);
}

/**
 * @param {typeof import("./record").Record} Model
 * @param {string} fieldName
 */
export function isRelation(Model, fieldName) {
    return Model.fieldsMany.get(fieldName) || Model.fieldsOne.get(fieldName);
}

// /** @param {string} objectId */
// function isSelfLocalId(objectId) {
//     const version = objectIdToVersion(objectId);
//     if (version === 0) {
//         return true;
//     }
//     try {
//         const startNumber = objectId.lastIndexOf("{");
//         const endNumber = objectId.lastIndexOf("}");
//         const isNumber = Number.isInteger(Number(objectId.substring(startNumber + 1, endNumber)));
//         const startSelfId = objectId.lastIndexOf("(");
//         const endSelfId = objectId.lastIndexOf(")");
//         const isSelf = objectId.substring(startSelfId + 1, endSelfId);
//         return isNumber && isSelf;
//     } catch {
//         return false;
//     }
// }
// /** @returns {string} */
// function objectIdToModel(objectId) {
//     const version = objectIdToVersion(objectId);
//     if (version === 0) {
//         // shape of object id example: Persona,partner AND 3
//         return objectId.split(",")[0];
//     }
//     // shape of object id: ModelName{field: value,field: value}[VERSION]
//     // local object id:    ModelName{number}(SELF_ID)[VERSION]
//     return objectId.substring(0, objectId.indexOf("{"));
// }
// /** @param {string} objectId */
// function objectIdToVersion(objectId) {
//     // if objectId has a version, it's at the very end, e.g. "[1]" for VERSION 1
//     const versionStart = objectId?.lastIndexOf("[");
//     if (versionStart === -1) {
//         return 0;
//     }
//     return Number(objectId.substring(versionStart + 1));
// }
