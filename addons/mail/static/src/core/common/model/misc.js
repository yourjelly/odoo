/* @odoo-module */

import { markup, toRaw } from "@odoo/owl";
import { registry } from "@web/core/registry";

export const modelRegistry = registry.category("discuss.model");

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
export const IS_RECORD_SYM = Symbol("isRecord");
export const IS_FIELD_DEFINITION_SYM = Symbol("isFieldDefinition");
export const IS_RECORD_FIELD_SYM = Symbol("isRecordField");
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

/** @param {FIELD_SYM} SYM */
export function isField(val) {
    if (val?.[IS_RECORD_FIELD_SYM] || val?.[IS_FIELD_DEFINITION_SYM]) {
        return true;
    }
    return [MANY_SYM, ONE_SYM, ATTR_SYM].includes(val);
}

export function isMany(list) {
    return Boolean(list?.[MANY_SYM]);
}

export function isOne(list) {
    return Boolean(list?.[ONE_SYM]);
}

export function isRecord(record) {
    return Boolean(record?.[IS_RECORD_SYM]);
}

/** @param {FIELD_SYM|RecordList} val */
export function isRelation(val) {
    if ([MANY_SYM, ONE_SYM].includes(val)) {
        return true;
    }
    return isOne(val) || isMany(val);
}
