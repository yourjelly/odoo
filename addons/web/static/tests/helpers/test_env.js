odoo.define("web.test_env", async function (require) {
"use strict";

const { bus } = require("web.core");
const config = require("web.config");
const session = require("web.session");
const rpc = require("web.rpc");

/**
 * Creates a test environment with the given environment object.
 * Some methods will throw an error if called while not being explicitly implemented.
 *
 * @param {Object} [env={}]
 */
function makeTestEnvironment(env = {}) {
    /**
     * Helper allowing to prevent the use of some functions if they are not implemented
     * first in the `env` object.
     *
     * @param {string} fnPath dot-separated path to designated property
     * @param {Function} [callback] custom callback to be called as a wrapper: it
     *      will take the implemented function as the first argument and will
     *      transmit the remaining arguments.
     */
    function _mandatory(fnPath) {
        return function () {
            const properties = fnPath.split('.');
            throw new Error(`Method "${properties.pop()}" not implemented in object "${['env', ...properties].join('.')}"`);
        };
    }

    // Bus
    const testBus = Object.create(bus, {
        // mandatory bus functions
        // ...
    });

    // Config
    const testConfig = Object.assign({}, config, {
        isDebug: _mandatory('config.isDebug'),
        // ...
    }, env.config);

    // RPC
    const testRPC = 'rpc' in env ?
        function (params, options) {
            const query = rpc.buildQuery(params);
            return env.rpc(query.route, query.params, options);
        } :
        _mandatory('rpc');

    // Services
    const testServices = Object.assign({
        blockUI: _mandatory('services.blockUI'),
        getCookie: _mandatory('services.getCookie'),
        httpRequest: _mandatory('services.httpRequest'),
        navigate: _mandatory('services.navigate'),
        reloadPage: _mandatory('services.reloadPage'),
        setCookie: _mandatory('services.setCookie'),
        unblockUI: _mandatory('services.unblockUI'),
        // ...
    }, env.services);

    // Session
    const testSession = Object.assign({}, session, {
        // mandatory session functions
        // ...
    }, env.session);

    // Translation
    const testTranslate = '_t' in env ? env._t : _mandatory('_t');

    // QWeb instance
    const testQweb = new owl.QWeb({ templates: session.owlTemplates });

    // TODO: we should not always add bus
    // --> general problem: how to extend correctly the env
    // use option like useBus, useConfig,... ?
    // TODO: allow to use mockReadGroup,... ?
    return {
        bus: testBus,
        config: testConfig,
        qweb: testQweb,
        rpc: testRPC,
        services: testServices,
        session: testSession,
        _t: testTranslate,
    };
}

return makeTestEnvironment;

});
