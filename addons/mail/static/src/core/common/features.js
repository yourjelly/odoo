import { whenReady } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { info, registerTemplateExtension } from "@web/core/templates";
import { patch } from "@web/core/utils/patch";

export class Feature {
    static patchFn = patch;
    static __activeFeatures = [];
    /** @type {string} */
    name;
    /** @type {[target: Object, patch: Object][]} */
    __patches = [];
    /** @type {{[name: string]: Object}} */
    __servicesByName = {};
    /** @type {Function[]} */
    __iife = [];
    __templateExtensions = [];

    /**
     * Load every active feature.
     */
    static applyChanges() {
        for (const feature of this.__activeFeatures) {
            for (const [target, patch] of feature.__patches) {
                this.patchFn(target, patch);
            }
            for (const [name, service] of Object.entries(feature.__servicesByName)) {
                registry.category("services").add(name, service);
            }
            feature.__iife.forEach((fn) => fn());
            feature.__templateExtensions.forEach(({ name, template }) => {
                if (!(name in info)) {
                    throw new Error(`Template to inherit ${name} not found.`);
                }
                registerTemplateExtension(name, info[name].url, template);
            });
        }
    }

    /**
     * @param {keyof typeof FEATURES} name
     */
    constructor(name) {
        this.name = name;
    }

    /**
     * Register a patch to be loaded if this feature is enabled.
     *
     * @param {Object} target
     * @param {Object} patch
     */
    registerPatch(target, patch) {
        this.__patches.push([target, patch]);
        return this;
    }

    /**
     * Register a service to be loaded if this feature is enabled.
     *
     * @param {string} name
     * @param {Object} service
     */
    registerService(name, service) {
        if (name in this.__servicesByName) {
            throw new Error(`Service ${name} already exists.`);
        }
        this.__servicesByName[name] = service;
        return this;
    }

    /**
     * Register a function to be immeditately invoked if this feature is
     * enabled.
     *
     * @param {Function} fn
     */
    registerIIFE(fn) {
        this.__iife.push(fn);
        return this;
    }

    registerTemplateExtension(name, template) {
        this.__templateExtensions.push({ name, template });
        return this;
    }

    /**
     * Mark this feature as active. Active features will load all their
     * registered services/patches.
     */
    enable() {
        Feature.__activeFeatures.push(this);
    }
}
const featureByName = {};
/**
 * Return the feature having the given name. If it does not exist yet, create
 * it.
 *
 * @param {string} featureName
 * @returns {Feature}
 */
export function feature(featureName) {
    featureByName[featureName] ??= new Feature(featureName);
    return featureByName[featureName];
}

(async () => {
    await whenReady();
    Feature.applyChanges();
})();
