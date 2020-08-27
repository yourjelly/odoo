odoo.define('web.CloseActionPlugin', function (require) {
    "use strict";

    /**
     * The purpose of this file is to add the support of Odoo actions of type
     * 'ir.actions.report' to the ActionManager.
     */

    const ActionAbstractPlugin = require('web.ActionAbstractPlugin');
    const ActionManager = require('web.ActionManager');

    class CloseActionPlugin extends ActionAbstractPlugin {
        commit(pendingState) {
            const { onCommit } = pendingState || {};
            if (onCommit) {
                onCommit();
            }
        }
        executeAction(action, options) {
            const dialog = this.controllers[this.currentDialogController];
            // I'm afraid this is mandatory
            // some legacy modals make their main controller
            // do weird stuff (like triggering onchanges)
            // in those cases, owl should not reload those components
            let doOwlReload = true;
            if (dialog && !dialog.isClosing) {
                if (dialog.options && dialog.options.on_close) {
                    dialog.options.on_close(action.infos);
                    dialog.isClosing = true;
                    doOwlReload = false;
                }
            } else if (options.on_close) {
                options.on_close(action.infos);
                doOwlReload = false;
            }
            let onCommit = null;
            if (action.effect) {
                onCommit = () => {
                    const payload = Object.assign({}, action.effect, {force: true});
                    this.env.bus.trigger('show-effect', payload);
                };
            }
            const controllerID = this.currentStack[this.currentStack.length-1];
            let controller;
            if (controllerID) {
                controller = this.controllers[controllerID];
                controller.options = controller.options || {};
                controller.options.on_success = options.on_success;
            }
            this.addToPendingState({
                onCommit, doOwlReload
            });
            return this.pushController(controller);
        }
    }
    CloseActionPlugin.type = 'ir.actions.act_window_close';
    ActionManager.registry.add('ir.actions.act_window_close', CloseActionPlugin, 20);

    return CloseActionPlugin;
});