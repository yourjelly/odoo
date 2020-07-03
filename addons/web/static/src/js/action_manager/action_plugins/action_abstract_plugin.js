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
                'executeAction',
            ];
            if (handledCommands.includes(name)) {
                const { action } = payload[0];
                return action.type === this.constructor.type;
            }
            return false;
        }
        handle({name, payload}) {
            if (name === 'executeAction') {
                const { action , options } = this.pendingState;
                return this.executeAction(action, options);
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
        get pendingState() {
            return this.actionManager.pendingState;
        }

        //----------------------------------------------------------------------
        // Public
        // Normalized shorthands to ActionManager's methods
        //----------------------------------------------------------------------
        dispatch() {
            return this.actionManager._dispatch(...arguments);
        }
        doAction() {
            let [action, options, on_success, on_fail, previousPending] = arguments;
            previousPending = this.pendingState;
            return this.actionManager.dispatch('doAction', action, options, on_success, on_fail, previousPending);
        }
        makeBaseController() {
            return this.actionManager.makeBaseController(...arguments);
        }
        pushController() {
            return this.dispatch('pushController', ...arguments);
        }
        rpc() {
            return this.transactionAdd(this.env.services.rpc(...arguments));
        }
        transactionAdd() {
            return this.actionManager._transaction.add(...arguments);
        }
        _willSwitchAction() {
            return this.actionManager._willSwitchAction();
        }
        addToPendingState(){
            return this.actionManager.addToPendingState(...arguments);
        }
    }
    ActionAbstractPlugin.type = null;

    return ActionAbstractPlugin;
});