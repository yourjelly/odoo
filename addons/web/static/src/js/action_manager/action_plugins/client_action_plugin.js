odoo.define('web.ClientActionPlugin', function (require) {
    "use strict";

    /**
     * The purpose of this file is to add the support of Odoo actions of type
     * 'ir.actions.report' to the ActionManager.
     */

    const ActionAbstractPlugin = require('web.ActionAbstractPlugin');
    const ActionManager = require('web.ActionManager');
    const { action_registry } = require('web.core');
    const { Component } = owl;
    const Widget = require('web.Widget');

    class ClientActionPlugin extends ActionAbstractPlugin {
        /**
         * Executes actions of type 'ir.actions.client'.
         *
         * @param {Object} action the description of the action to execute
         * @param {string} action.tag the key of the action in the action_registry
         * @param {Object} options @see doAction for details
         */
        async executeAction(action, options) {
            const ClientAction = action_registry.get(action.tag);
            if (!ClientAction) {
                console.error(`Could not find client action ${action.tag}`, action);
                return Promise.reject();
            } else {
                const proto = ClientAction.prototype;
                if (!(proto instanceof Component) && !(proto instanceof Widget)) {
                    // the client action might be a function, which is executed and
                    // whose returned value might be another action to execute
                    const nextAction = ClientAction(this.env, action);
                    if (nextAction) {
                        action = nextAction;
                        return this.doAction(action);
                    }
                    return;
                }
            }
            const params = Object.assign({}, options, {Component: ClientAction});
            const controller = this.makeBaseController(action, params);
            options.controllerID = controller.jsID;
            controller.options = options;
            action.id = action.id || action.tag;
            return this._pushController(controller);
        }
        async _retoreController(action, controller) {
            await super._restoreController(...arguments);
            this._pushController(controller);
        }
        /**
         * @override
         */
        loadState(state, options) {
            if (typeof state.action === 'string' && action_registry.contains(state.action)) {
                const action = {
                    params: state,
                    tag: state.action,
                    type: 'ir.actions.client',
                };
                this.actionManager.resetDispatch();
                this._doAction(action, options);
                this.addToPendingState({
                    stateLoaded: true,
                });
            }
        }
    }
    ClientActionPlugin.type = 'ir.actions.client';
    ActionManager.registry.add('ir.actions.client', ClientActionPlugin, 20);

    return ClientActionPlugin;
});