odoo.define('web.ActionAbstractPlugin', function (require) {
    "use_strict";

    const { Model } = require('web/static/src/js/model.js');
    const { decorate } = require('web.utils');

    // TODO: CLEAN ME
    class ActionAbstractPlugin extends Model.Extension {
        static actionSpecificDecorator(func, ...args) {
            if (this.type === args[0].type) {
                return func(...args);
            }
        }
        constructor(config, parent) {
            super(config);
            this.actionManager = parent;
            this.env = config.env;
            this.asyncWrapper = this.actionManager.asyncWrapper.bind(this.actionManager);
            decorate(this, 'executeAction', this.asyncWrapper);
            decorate(this, '_restoreController', this.asyncWrapper);
            decorate(this, 'rpc', this.asyncWrapper);
            const actionSpecific = this.constructor.actionSpecificDecorator.bind(this.constructor);
            decorate(this, 'executeAction', actionSpecific);
            decorate(this, '_restoreController', actionSpecific);

        }
        //----------------------------------------------------------------------
        // API
        //----------------------------------------------------------------------
        /**
         * @throws {Error} message: Plugin Error
         */
        async executeAction(/*action, options*/) {
            throw new Error(`ActionAbstractPlugin for type ${this.type} doesn't implement executeAction.`);
        }
        async _restoreController() {
            await this.pendingState.__lastProm;
        }
        loadState(/* state, options */) {return;}
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
        _pushController() {
            this.actionManager.resetDispatch(this.pendingState);
            return this.actionManager.dispatch('pushController', ...arguments);
        }
        rpc() {
            return this.env.services.rpc(...arguments);
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