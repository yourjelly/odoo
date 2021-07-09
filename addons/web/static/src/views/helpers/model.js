/** @odoo-module **/

import { SEARCH_KEYS } from "@web/search/with_search/with_search";
import { useBus } from "@web/core/bus_hook";
import { useService } from "@web/core/service_hook";

const { core, hooks } = owl;
const { EventBus } = core;
const { useComponent, onWillStart, onWillUpdateProps } = hooks;

const LOAD_KEYS = [...SEARCH_KEYS, 'resId', 'resIds'];

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

function getSearchParams(props, initialGroupBy) {
    const params = {};
    for (const key of LOAD_KEYS) {
        params[key] = props[key];
    }
    if (params.groupBy && params.groupBy.length === 0) {
        params.groupBy = initialGroupBy.slice();
    }
    return params;
}

/**
 * @template {Model} T
 * @param {new (env: Object, params: Object, services: Object) => T} ModelClass
 * @param {Object} loadParams
 * @param {Object} [options]
 * @param {Function} [options.onUpdate]
 * @returns {T}
 */
export function useModel(ModelClass, loadParams, options = {}) {
    const component = useComponent();
    if (!(ModelClass.prototype instanceof Model)) {
        throw new Error(`the model class should extend Model`);
    }
    const services = {};
    for (const key of ModelClass.services) {
        services[key] = useService(key);
    }
    const model = new ModelClass(component.env, loadParams, services);
    useBus(model, "update", options.onUpdate || component.render);

    const initialGroupBy = (loadParams.groupBy || component.props.groupBy).slice();

    onWillStart(() => {
        const searchParams = getSearchParams(component.props, initialGroupBy);
        return model.load(searchParams);
    });

    onWillUpdateProps((nextProps) => {
        const searchParams = getSearchParams(component.props, initialGroupBy);
        searchParams.useSampleModel = false;
        return model.load(searchParams);
    });
    return model;
}
