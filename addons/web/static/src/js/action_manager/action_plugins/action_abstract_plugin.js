odoo.define('web.ActionAbstractPlugin', function (require) {
    "use_strict";

    const { Model } = require('web/static/src/js/model.js');
    const { decorate } = require('web.utils');
    // TODO: CLEAN ME
    class ActionAbstractPlugin extends Model.Extension {
        constructor(config, parent) {
            super(config);
            this.actionManager = parent;
            this.env = config.env;
            const asyncWrapper = this.actionManager.asyncWrapper.bind(this.actionManager);
            decorate(this, 'executeAction', asyncWrapper);
            decorate(this, '_restoreController', asyncWrapper);
        }
        //----------------------------------------------------------------------
        // API
        //----------------------------------------------------------------------
        /**
         * @throws {Error} message: Plugin Error
         */
        dispatch(method, ...args) {
            if (method in ActionAbstractPlugin.prototype && args[0].type !== this.constructor.type) {
                return;
            }
            return super.dispatch(...arguments);
        }
        async executeAction(/*action, options*/) {
            throw new Error(`ActionAbstractPlugin for type ${this.type} doesn't implement executeAction.`);
        }
        async _restoreController() {
            await this.pendingState.__lastProm;
        }
        loadState(/* state, options */) {}
        /** Should unbind every listeners on actionManager
         *  and env.bus at least
         */

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
        _doAction() {
            return this.actionManager.dispatch('doAction', ...arguments);
        }
        makeBaseController() {
            return this.actionManager.makeBaseController(...arguments);
        }
        pushController() {
            return this.actionManager.dispatch('pushController', ...arguments);
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