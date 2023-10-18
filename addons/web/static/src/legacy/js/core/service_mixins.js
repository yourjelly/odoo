/** @odoo-module **/

import { SERVICES_METADATA } from "@web/env";
import {
    ConnectionAbortedError,
    ConnectionLostError,
    RPCError,
} from "@web/core/network/rpc_service";
import { Component } from "@odoo/owl";

function protectMethod(widget, fn) {
    return function (...args) {
        return new Promise((resolve, reject) => {
            Promise.resolve(fn.call(this, ...args))
                .then((result) => {
                    if (!widget.isDestroyed()) {
                        resolve(result);
                    }
                })
                .catch((reason) => {
                    if (!widget.isDestroyed()) {
                        if (reason instanceof RPCError || reason instanceof ConnectionLostError) {
                            // we do not reject an error here because we want to pass through
                            // the legacy guardedCatch code
                            reject({ message: reason, event: $.Event(), legacy: true });
                        } else if (reason instanceof ConnectionAbortedError) {
                            reject({ message: reason.message, event: $.Event("abort") });
                        } else {
                            reject(reason);
                        }
                    }
                });
        });
    };
}

var ServicesMixin = {
    bindService: function (serviceName) {
        const { services } = Component.env;
        const service = services[serviceName];
        if (!service) {
            throw new Error(`Service ${serviceName} is not available`);
        }
        if (serviceName in SERVICES_METADATA) {
            if (service instanceof Function) {
                return protectMethod(this, service);
            } else {
                const methods = SERVICES_METADATA[serviceName];
                const result = Object.create(service);
                for (const method of methods) {
                    result[method] = protectMethod(this, service[method]);
                }
                return result;
            }
        }
        return service;
    },
};

export default ServicesMixin;
