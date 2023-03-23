/** @odoo-module **/

import { useBus, useService } from "@web/core/utils/hooks";
import { SEARCH_KEYS } from "@web/search/with_search/with_search";
import { Model } from "@web/views/model";

import { onWillStart, onWillUpdateProps, useComponent } from "@odoo/owl";

/**
 * @typedef {import("@web/search/search_model").SearchParams} SearchParams
 */

/**
 * @param {Object} props
 * @returns {SearchParams}
 */
function getSearchParams(model, props) {
    const params = {};
    for (const key of SEARCH_KEYS) {
        if (model.rootParams.resModel == props.resModel) {
            params[key] = props[key];
        } else {
            // TODO handle domain of submodel here
            params[key] = [];
        }
    }
    return params;
}

/**
 * @template {typeof Model} T
 * @param {T} ModelClass
 * @param {Object} params
 * @param {Object} [options]
 * @param {Function} [options.onUpdate]
 * @param {boolean} [options.ignoreUseSampleModel]
 * @returns {InstanceType<T>}
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
    services.orm = services.orm || useService("orm");

    const model = new ModelClass(component.env, params, services);
    useBus(
        model.bus,
        "update",
        options.onUpdate ||
            (() => {
                component.render(true); // FIXME WOWL reactivity
            })
    );

    let started = false;
    async function load(props) {
        const searchParams = getSearchParams(model, props);
        await model.load(searchParams);

        if (started) {
            model.notify();
        }
    }
    onWillStart(async () => {
        await load(component.props);
        started = true;
    });
    onWillUpdateProps((nextProps) => {
        load(nextProps);
    });

    return model;
}
