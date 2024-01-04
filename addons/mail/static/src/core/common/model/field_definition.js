/* @odoo-module */

import { ATTR_SYM, FIELD_DEFINITION_SYM, MANY_SYM, ONE_SYM } from "./misc";

export class FieldDefinition {
    [FIELD_DEFINITION_SYM] = true;
    /** @type {typeof import("./record").Record} */
    Model;
    /**
     * name of field on the model.
     *
     * @type {string}
     */
    name;
    /** true when this is an attribute, i.e. a non-relational field. */
    [ATTR_SYM] = false;
    /** true when this is a many relation. */
    [MANY_SYM] = false;
    /** true when this is a one relation. */
    [ONE_SYM] = false;
    /** the default value of this attribute. */
    default;
    /** whether the attribute is an html field. Useful to automatically markup when the insert is trusted. */
    html = false;
    /**
     * model name of records contained in this relational field.
     *
     * @type {typeof import("./record").Record}
     */
    targetModel;
    /**
     * if set the field is computed based on provided function.
     * The `this` of function is the record, and the function is recalled whenever any field
     * in models used by this compute function is changed. The return value is the new value of
     * the field. On relational field, passing a (list of) record(s) or data work as expected.
     *
     * @type {() => any}
     */
    compute;
    /**
     * when field is computed, determines whether the computation
     * of this field is eager or lazy. By default, fields are computed lazily, which means that
     * they are computed when dependencies change AND when this field is being used. In eager mode,
     * the field is immediately (re-)computed when dependencies changes, which matches the built-in
     * behaviour of OWL reactive.
     */
    eager = false;
    /** name of inverse relational field in targetModel. */
    inverse;
    /**
     * hook that is called when relation is updated with a record being added.
     * Callback param is record being added into relation.
     *
     * @type {(r: Record) => void}
     */
    onAdd;
    /**
     * hook that is called when relation is updated with a record being deleted.
     * Callback param is record being deleted from relation.
     *
     * @type {(r: Record) => void}
     */
    onDelete;
    /**
     * hook that is called when field is updated.
     *
     * @type {() => void}
     */
    onUpdate;
    /**
     * if defined, this many relational field is automatically sorted by this function.
     *
     * @type {(r1: Record, r2: Record) => number}
     */
    sort;
    NEXT_TS = 0;

    /** @param {Object} vals */
    constructor(vals) {
        Object.assign(this, vals);
    }
}
