/** @odoo-module **/

import { useBus } from "@web/core/bus_hook";
import { useService } from "@web/core/service_hook";
import { SEARCH_KEYS } from "../../search/with_search/with_search";

const { core, hooks } = owl;
const { EventBus } = core;
const { useComponent, onWillStart, onWillUpdateProps } = hooks;

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

    load(params) {}
    reload(params) {}

    notify() {
        this.trigger("update");
    }
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

    const loadParams = params.loadParams;
    const initialGroupBy = loadParams.groupBy.slice();

    onWillStart(() => {
        return model.load(loadParams);
    });

    onWillUpdateProps((nextProps) => {
        const params = {};
        for (const key of SEARCH_KEYS) {
            params[key] = nextProps[key];
        }
        if (params.groupBy && params.groupBy.length === 0) {
            params.groupBy = initialGroupBy;
        }
        params.useSampleModel = false;
        return model.reload(params);
    });
    return model;
}
