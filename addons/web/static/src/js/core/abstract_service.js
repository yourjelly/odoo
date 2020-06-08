odoo.define('web.AbstractService', function (require) {
"use strict";

var Class = require('web.Class');
const { serviceRegistry } = require("web.core");
var Mixins = require('web.mixins');
var ServicesMixin = require('web.ServicesMixin');


var AbstractService = Class.extend(Mixins.EventDispatcherMixin, ServicesMixin, {
    dependencies: [],
    init: function (env) {
        Mixins.EventDispatcherMixin.init.call(this, arguments);
        this.env = env;
    },
    /**
     * @abstract
     */
    start: function () {},
    /**
     * Directly calls the requested service, instead of triggering a
     * 'call_service' event up, which wouldn't work as services have no parent
     *
     * @param {OdooEvent} ev
     */
    _trigger_up: function (ev) {
        Mixins.EventDispatcherMixin._trigger_up.apply(this, arguments);
        if (ev.is_stopped()) {
            return;
        }
        const payload = ev.data;
        if (ev.name === 'call_service') {
            let args = payload.args || [];
            if (payload.service === 'ajax' && payload.method === 'rpc') {
                // ajax service uses an extra 'target' argument for rpc
                args = args.concat(ev.target);
            }
            const service = this.env.services[payload.service];
            const result = service[payload.method].apply(service, args);
            payload.callback(result);
        } else if (ev.name === 'do_action' && this.env.actionManager) {
            this.env.actionManager.doAction(payload.action, payload.options)
                .then(ev.data.on_success || (() => {}))
                .guardedCatch(ev.data.on_fail || (() => {}));
        }
    },

    //--------------------------------------------------------------------------
    // Static
    //--------------------------------------------------------------------------

    /**
     * Deploy services in the env (specializations of AbstractService registered
     * into the serviceRegistry).
     *
     * @static
     * @param {Object} env
     */
    deployServices(env) {
        const UndeployedServices = {}; // dict containing classes of undeployed services
        function _deployServices() {
            let done = false;
            while (!done) {
                const serviceName = _.findKey(UndeployedServices, Service => {
                    // no missing dependency
                    return !_.some(Service.prototype.dependencies, depName => {
                        return !env.services[depName];
                    });
                });
                if (serviceName) {
                    const Service = UndeployedServices[serviceName];
                    const service = new Service(env);
                    env.services[serviceName] = service;
                    delete UndeployedServices[serviceName];
                    service.start();
                } else {
                    done = true;
                }
            }
        }
        Object.keys(serviceRegistry.map).forEach(serviceName => {
            if (serviceName in UndeployedServices) {
                throw new Error(`Service ${serviceName} is already loaded.`);
            }
            UndeployedServices[serviceName] = serviceRegistry.get(serviceName);
        });
        serviceRegistry.onAdd((serviceName, Service) => {
            if (serviceName in env.services || serviceName in UndeployedServices) {
                throw new Error(`Service ${serviceName} is already loaded.`);
            }
            UndeployedServices[serviceName] = Service;
            _deployServices();
        });
        _deployServices();
    }
});

return AbstractService;
});
