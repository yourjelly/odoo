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
function getSearchParams(model, props, component) {
    const params = {};
    for (const key of SEARCH_KEYS) {
        if (model.rootParams.resModel == props.resModel) {
            params[key] = props[key];
        } else {
            if (key == "domain") {
                const production_ids = component.mrp_production.root.records.map((r) => r.resId);
                if (model.rootParams.resModel == "mrp.workorder") {
                    params[key] = [["production_id", "in", production_ids]];
                    continue;
                } else if (model.rootParams.resModel == "stock.move") {
                    params[key] = [
                        "|",
                        ["production_id", "in", production_ids],
                        ["raw_material_production_id", "in", production_ids],
                    ];
                    continue;
                }
            }
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
 * @returns {InstanceType<T>}
 */
export function useModels(ModelClass, paramsList, options = {}) {
    const component = useComponent();
    if (!(ModelClass.prototype instanceof Model)) {
        throw new Error(`the model class should extend Model`);
    }
    const services = {};
    for (const key of ModelClass.services) {
        services[key] = useService(key);
    }
    services.orm = services.orm || useService("orm");

    const models = [];
    for (const params of paramsList) {
        const model = new ModelClass(component.env, params, services);
        models.push(model);
    }

    useBus(
        models[models.length - 1].bus,
        "update",
        options.onUpdate ||
            (() => {
                component.render(true); // FIXME WOWL reactivity
            })
    );

    async function load(props) {
        for (const model of models) {
            const searchParams = getSearchParams(model, props, component);
            await model.load(searchParams);
        }
    }

    onWillStart(async () => {
        await load(component.props);
    });
    onWillUpdateProps((nextProps) => {
        load(nextProps);
    });

    return models;
}
