/** @odoo-module **/

/**
 * Module that contains registry for adding new models or patching models.
 * Useful for model manager in order to generate model classes.
 *
 * This code is not in model manager because other JS modules should populate
 * a registry, and it's difficult to ensure availability of the model manager
 * when these JS modules are deployed.
 */

const registry = {};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

/**
 * @private
 * @param {string} modelName
 * @returns {Object}
 */
function _getEntryFromModelName(modelName) {
    if (!registry[modelName]) {
        registry[modelName] = { factory: undefined };
    }
    return registry[modelName];
}

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

/**
 * Applies the provided fields to the model specified by the `modelName`.
 *
 * @param {string} modelName The name of the model to which to apply the patch.
 * @param {Object} fields Fields to be patched.
 */
function patchFields(modelName, fields) {
    const entry = _getEntryFromModelName(modelName);
    if (!entry.factory) {
        throw new Error(`Model "${modelName}" must be registered before patched.`);
    }
    for (const [fieldName, field] of Object.entries(fields)) {
        entry.factory.fields[fieldName] = field;
    }
}

/**
 * Applies the provided function to the identifying fields of the model
 * specified by the `modelName`.
 *
 * @param {string} modelName The name of the model to which to apply the patch.
 * @param {function} patch The function to be applied on the identifying fields.
 */
function patchIdentifyingFields(modelName, patch) {
    const entry = _getEntryFromModelName(modelName);
    if (!entry.factory) {
        throw new Error(`Model "${modelName}" must be registered before patched.`);
    }
    patch(entry.factory.identifyingFields);
}

/**
 * Adds or overrides the provided methods to the model specified by the
 * `modelName`.
 *
 * @param {string} modelName The name of the model to which to apply the patch.
 * @param {Object} methods Methods to be added or overriden.
 */
function patchModelMethods(modelName, methods) {
    const entry = _getEntryFromModelName(modelName);
    if (!entry.factory) {
        throw new Error(`Model "${modelName}" must be registered before patched.`);
    }
    if (!entry.factory.modelMethods) {
        entry.factory.modelMethods = {};
    }
    for (const [methodName, method] of Object.entries(methods)) {
        if (typeof method !== 'function') {
            throw new Error(`Cannot patch model methods on model "${modelName}": values must be typeof function.`);
        }
        if (!entry.factory.modelMethods[methodName]) {
            entry.factory.modelMethods[methodName] = method;
            continue;
        }
        const originalMethod = entry.factory.modelMethods[methodName];
        entry.factory.modelMethods[methodName] = function(...args) {
            const previousSuper = this._super;
            this._super = originalMethod;
            const ret = method.call(this, ...args);
            this._super = previousSuper;
            return ret;
        };
}
}

/**
 * Adds or overrides the provided methods to the records of the model specified
 * by the `modelName`.
 *
 * @param {string} modelName The name of the model to which to apply the patch.
 * @param {Object} methods
 */
function patchRecordMethods(modelName, methods) {
    const entry = _getEntryFromModelName(modelName);
    if (!entry.factory) {
        throw new Error(`Model "${modelName}" must be registered before patched.`);
    }
    if (!entry.factory.recordMethods) {
        entry.factory.recordMethods = {};
    }
    for (const [methodName, method] of Object.entries(methods)) {
        if (typeof method !== 'function') {
            throw new Error(`Cannot patch record methods on model "${modelName}": values must be typeof function.`);
        }
        if (!entry.factory.recordMethods[methodName]) {
            entry.factory.recordMethods[methodName] = method;
            continue;
        }
        const originalMethod = entry.factory.recordMethods[methodName];
        entry.factory.recordMethods[methodName] = function(...args) {
            const previousSuper = this._super;
            this._super = originalMethod;
            const ret = method.call(this, ...args);
            this._super = previousSuper;
            return ret;
        };
    }
}

/**
 * @param {Object} factory
 */
function registerNewModel(factory) {
    if (!factory.modelName) {
        throw new Error("Model is lacking a modelName.");
    }
    if (!factory.identifyingFields) {
        throw new Error(`Model "${factory.modelName}" is lacking identifying fields.`);
    }
    if (!factory.fields) {
        factory.fields = {};
    }
    const entry = _getEntryFromModelName(factory.modelName);
    if (entry.factory) {
        throw new Error(`Model "${factory.modelName}" has already been registered!`);
    }
    Object.assign(entry, { factory });
}

//------------------------------------------------------------------------------
// Export
//------------------------------------------------------------------------------

export {
    patchFields,
    patchIdentifyingFields,
    patchModelMethods,
    patchRecordMethods,
    registerNewModel,
    registry,
};
