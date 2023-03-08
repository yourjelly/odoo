/** @odoo-module */

/** TYPES
 * @typedef {object} Field
 * @property {string} name technical name
 * @property {string} type field type
 * @property {string} string display name
 * @property {string} [relation] related model technical name (only for relational fields)
 * @property {boolean} [searchable] true if a field can be searched in database
 */

/**
 * Determines if the given field is a date or datetime field.
 *
 * @param {Field} field Field description
 * @private
 * @returns {boolean} True if the type of the field is date or datetime
 */
export function isDate(field) {
    return ["date", "datetime"].includes(field.type);
}

/**
 * Determines if the given field is a numeric field.
 *
 * @param {Field} field
 *
 * @private
 * @returns {boolean} True if the type of the field is a numeric field
 */
export function isNumeric(field) {
    return ["integer", "float", "monetary"].includes(field.type);
}

/**
 * Determines if the given field is a boolean field.
 *
 * @param {Field} field
 * @returns {boolean} True if the type of the field is a boolean field
 */
export function isBoolean(field) {
    return ["boolean"].includes(field.type);
}

/**
 * Determines if the given field is a string field.
 *
 * @param {Field} field
 * @returns {boolean} True if the type of the field is a string field
 */
export function isString(field) {
    return ["char", "text", "selection"].includes(field.type);
}

export function isMany2Many(field) {
    return field.type === "many2many";
}
