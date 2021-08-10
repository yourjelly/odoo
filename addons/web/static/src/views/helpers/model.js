/** @odoo-module **/

import { SEARCH_KEYS } from "@web/search/with_search/with_search";
import { useBus } from "@web/core/bus_hook";
import { useService } from "@web/core/service_hook";

const { core, hooks } = owl;
const { EventBus } = core;
const { onWillStart, onWillUpdateProps, useComponent } = hooks;

export class Model extends EventBus {
    /**
     * @param {Object} env
     * @param {Object} services
     */
    constructor(env, params, services) {
        super();
        this.env = env;
        this.setup(params, services);
    }

    /**
     * @param {Object} params
     * @param {Object} services
     */
    setup(params, services) {}

    /**
     * @param {Object} searchParams
     */
    load(searchParams) {}

    notify() {
        this.trigger("update");
    }
}
Model.services = [];

function getSearchParams(props) {
    const params = {};
    for (const key of SEARCH_KEYS) {
        params[key] = props[key];
    }
    return params;
}

/**
 * @template {Model} T
 * @param {new (env: Object, params: Object, services: Object) => T} ModelClass
 * @param {Object} params
 * @param {Object} [options]
 * @param {Function} [options.onUpdate]
 * @returns {T}
 */
export function useModel(ModelClass, params, options = {}) {
    const component = useComponent();
    if (!(ModelClass.prototype instanceof Model)) {
        throw new Error(`the model class should extend Model`);
    }
    const services = {};
    for (const key of ModelClass.services) {
        services[key] = useService(key);
    }
    const model = new ModelClass(component.env, params, services);
    const { processParams = (x) => x, onUpdate } = options;
    useBus(model, "update", onUpdate || component.render);

    onWillStart(() => {
        const searchParams = getSearchParams(component.props);
        return model.load(processParams(searchParams));
    });

    onWillUpdateProps((nextProps) => {
        const searchParams = getSearchParams(nextProps);
        searchParams.useSampleModel = false; // not sure it is good --> we'll know when implementing dashboard
        return model.load(processParams(searchParams));
    });
    return model;
}
