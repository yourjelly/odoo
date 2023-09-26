/** @odoo-module **/

import { registry } from "../registry";
import { jsonrpc } from "./rpc";

export const rpcService = {
    async: true,
    start(env) {
        let rpcId = 0;
        /**
         * @param {string} route
         * @param {Object} params
         * @param {Object} [settings]
         * @param {boolean} settings.silent
         * @param {XMLHttpRequest} settings.xhr
         */
        return function rpc(route, params = {}, settings) {
            return jsonrpc(env, rpcId++, route, params, settings);
        };
    },
};

registry.category("services").add("rpc", rpcService);
