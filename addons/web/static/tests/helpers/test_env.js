odoo.define('web.test_env', async function (require) {
    "use strict";

    const Bus = require("web.Bus");
    const { buildQuery } = require("web.rpc");
    const session = require('web.session');

    /**
     * Creates a test environment with the given environment object.
     * Any access to a key that has not been explicitly defined in the given environment object
     * will result in an error.
     *
     * @param {Object} [env={}]
     * @param {Function} [providedRPC=null]
     * @returns {Proxy}
     */
    function makeTestEnvironment(env = {}, providedRPC = null) {
        const defaultEnv = {
            _t: env._t || (s => s),
            _lt: env._lt || (s => s),
            bus: new Bus(),
            device: Object.assign({
                isMobile: false,
            }, env.device),
            qweb: new owl.QWeb({ templates: session.owlTemplates }),
            services: Object.assign({
                getCookie() { },
                rpc(params, options) {
                    const query = buildQuery(params);
                    return env.session.rpc(query.route, query.params, options);
                },
            }, env.services),
            session: Object.assign({
                rpc(route, params, options) {
                    if (providedRPC) {
                        return providedRPC(route, params, options);
                    }
                    throw new Error(`No method to perform RPC`);
                },
                url: session.url,
            }, env.session),
            isDebug: env.isDebug || (() => false),
        };
        return Object.assign(env, defaultEnv);
    }

    /**
     * Before each test, we want owl.Component.env to be a fresh test environment.
     */
    QUnit.on('OdooBeforeTestHook', function () {
        owl.Component.env = makeTestEnvironment();
    });

    return makeTestEnvironment;
});
