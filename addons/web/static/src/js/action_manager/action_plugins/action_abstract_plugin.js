odoo.define('web.ActionAbstractPlugin', function (require) {
    "use_strict";

    // TODO: CLEAN ME
    class ActionAbstractPlugin {
        constructor(actionManager, env) {
            this.actionManager = actionManager;
            this.env = env;
        }
        willHandle({ name, payload }) {
            const handledCommands = [
                '_EXECUTE',
            ];
            if (handledCommands.includes(name) &&
                payload[0].type === this.constructor.type
            ) {
                return true;
            }
            return false;
        }
        handle({name, payload}) {
            if (name === '_EXECUTE') {
                return this.executeAction(...payload);
            }
        }
        beforeHandle(command) {}
        afterHandle(command) {}
        //----------------------------------------------------------------------
        // API
        //----------------------------------------------------------------------
        /**
         * @throws {Error} message: Plugin Error
         */
        async executeAction(/*action, options*/) {
            throw new Error(`ActionAbstractPlugin for type ${this.type} doesn't implement executeAction.`);
        }
        loadState(/* state, options */) {}
        /** Should unbind every listeners on actionManager
         *  and env.bus at least
         */
        destroy() {}

        //----------------------------------------------------------------------
        // Getters
        // Shorthands to ActionManager's state
        //----------------------------------------------------------------------
        get actions() {
            return this.actionManager.actions;
        }
        get controllers() {
            return this.actionManager.controllers;
        }
        get currentStack() {
            return this.actionManager.currentStack;
        }
        get currentDialogController() {
            return this.actionManager.currentDialogController;
        }
        get rev() {
            return this.actionManager.rev;
        }

        //----------------------------------------------------------------------
        // Public
        // Normalized shorthands to ActionManager's methods
        //----------------------------------------------------------------------
        dispatch() {
            return this.actionManager._dispatch(...arguments);
        }
        doAction() {
            return this.dispatch('DO_ACTION', ...arguments);
        }
        makeBaseController() {
            return this.actionManager.makeBaseController(...arguments);
        }
        pushControllers() {
            return this.dispatch('_PUSH_CONTROLLERS', ...arguments);
        }
        rpc() {
            return this.transactionAdd(this.env.services.rpc(...arguments));
        }
        transactionAdd() {
            return this.actionManager._transaction.add(...arguments);
        }
        _clearUncommittedChanges() {
            return this.actionManager._clearUncommittedChanges();
        }
    }
    ActionAbstractPlugin.type = null;

    return ActionAbstractPlugin;
});