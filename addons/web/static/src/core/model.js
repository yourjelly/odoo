/** @odoo-module **/

import { useBus } from "@web/core/bus_hook";
import { useService } from "@web/core/service_hook";

const { core, hooks } = owl;
const { EventBus } = core;
const { useComponent } = hooks;

export class Model extends EventBus {
    /**
     * @param {Object} env
     * @param {Object} services
     */
    constructor(env, services) {
        super();
        this.env = env;
        this.setup(services);
    }

    /**
     * @param {Object} services
     */
    setup(services) {}
}

/**
 * @template {Model} T
 * @param {Object} params
 * @param {new (env: Object, services: Object) => T} params.Model
 * @param {Function} [params.onUpdate]
 * @returns {T}
 */
export function useModel(params) {
    const component = useComponent();
    const ModelClass = params.Model;
    if (!(ModelClass.prototype instanceof Model)) {
        throw new Error(`the model class should extend Model`);
    }
    const services = {};
    for (const key of ModelClass.services || []) {
        services[key] = useService(key);
    }
    const model = new ModelClass(component.env, services);
    useBus(model, "update", params.onUpdate || component.render);
    return model;
}
