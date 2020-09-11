odoo.define('web.ActionManager', function (require) {
    "use strict";

    const Context = require('web.Context');
    const { action_registry } = require('web.core');
    const { Model, useModel } = require('web/static/src/js/model.js');
    const Registry = require("web.Registry");

    var pyUtils = require('web.py_utils');
    const { decorate } = require('web.utils');

    class ActionManager extends Model {
        constructor(extensions, config) {
            super(...arguments);
            this.requestId = 0;
            // Before switching views, an event is triggered
            // containing the state of the current controller
            // TODO: convert to dispatch, or own events
            this.env.bus.on('history-back', this, this._onHistoryBack);
            // LPE FIXME: since actionManager is in env; only rely on it
            // and not on the bus anymore
            this.env.bus.on('do-action', this, payload => {
                const { action , options , on_success, on_fail } = payload;
                this.dispatch('doAction', action, options, on_success, on_fail);
            });

            // handled by the ActionManager (either stacked in the current window,
            // or opened in dialogs)
            this.actions = {};

            // 'controllers' is an Object that registers the alive controllers
            // linked registered actions, a controller being an Object with keys
            // (amongst others) 'jsID' (a local identifier) and 'widget' (the
            // instance of the controller's widget)
            this.controllers = {};

            this.committedState = {
                controllerStack: [],
                dialog: null,
            };
            this.pendingState = null;
            const asyncWrapper = this.asyncWrapper.bind(this);
            decorate(this, 'executeFlowAction', asyncWrapper);
            decorate(this, 'restoreController', asyncWrapper);
            decorate(this, 'loadAction', asyncWrapper);
        }
        _constructorExtensionParams() {
            return super._constructorExtensionParams(...arguments).concat([this]);
        }
        get(property) {
            const state = this.pendingState || this.committedState;
            if (property in state) {
                return state[property];
            }
            if (property in this) {
                return this[property];
            }
            return super.get(property);
        }
        dispatch() {
            if (!this.dispatching) {
                this.requestId++;
                this.pendingState = null;
            }
            this.addToPendingState(this.__pendingState);
            this.__pendingState = null;
            try {
                return super.dispatch(...arguments);
            } catch (error) {
                this.handleError(error);
            }
        }
        _dispatch(method, ...args) {
            if (method in this) {
                this[method](...args);
            } 
            return super._dispatch(...arguments);
        }
        resetDispatch(pendingState) {
            this.dispatching = false;
            this.pendingState = null;
            this.__pendingState = pendingState;
        }
        handleError(error) {
            if (error && error.name) {
                if (error.message.startsWith('Plugin Error')) {
                    return;
                }
                throw error;
            }
        }
        get activeDescriptors() {
            const stack = this.currentStack;
            const dialog = this.currentDialogController &&
                this.getFullDescriptorsFromControllerID(this.currentDialogController) || null;
            const main = stack[stack.length-1] &&
                this.getFullDescriptorsFromControllerID(stack[stack.length-1]) || null;
            return { dialog , main };
        }
        get currentDialogController() {
            if (this.pendingState && 'dialog' in this.pendingState) {
                return this.pendingState.dialog;
            }
            return this.committedState.dialog;
        }
        get currentStack() {
            return this.pendingState &&
                this.pendingState.controllerStack ||
                this.committedState.controllerStack;
        }
        get hasDOMresult() {
            return this.pendingState && this.pendingState.hasDOMresult;
        }
        get isFullScreen() {
            return this.currentStack.some((ctID) => {
                const { action } = this.getFullDescriptorsFromControllerID(ctID);
                return action.target === 'fullscreen';
            });
        }
        get actionKeys() {
            const { actionID , hasDOMresult } = this.pendingState || {};
            if (!hasDOMresult) {
                return {
                    main: actionID,
                    dialog: null,
                };
            }
            const stack = this.currentStack;
            const { action: mainAction } = this.getFullDescriptorsFromControllerID(stack[stack.length-1]);
            const { action: dialogAction } = this.getFullDescriptorsFromControllerID(this.currentDialogController);
            let main = mainAction && mainAction.jsID;
            let dialog = dialogAction && dialogAction.jsID;
            return { main , dialog };
        }
        getBreadCrumbs() {
            return this.currentStack.slice(0, -1).map(ctID => {
                const { action , controller } = this.getFullDescriptorsFromControllerID(ctID);
                return {
                    controllerID: ctID,
                    title: controller.displayName || action.name,
                };
            });
        }
        getRawState() {
            return Object.assign(
                {},
                this.committedState,
                this.pendingState,
            );
        }
        //--------------------------------------------------------------------------
        // Main API
        //--------------------------------------------------------------------------
        commit(pendingState) {
            if (!pendingState) {
                return;
            }
            const { controllerStack, dialog } = pendingState;
            if (!controllerStack && !dialog) {
                this._triggerCommitted();
                return;
            }
            let action, controller;
            if (!dialog && controllerStack.length) {
                const contID = controllerStack[controllerStack.length - 1];
                ({ action , controller } = this.getFullDescriptorsFromControllerID(contID));
                // always close dialogs when the current controller changes
                // use case: have a controller that opens a dialog, and from this dialog, have a
                // link/button to perform an action that will be stacked in the breadcrumbs
                // (for instance, a many2one in readonly)
                this.env.bus.trigger('close_dialogs');
                this.committedState.dialog = null;

                // store the action into the sessionStorage so that it can be fully restored on F5
                this.env.services.session_storage.setItem('current_action', action._originalAction);
            } else if (dialog) {
                ({ controller } = this.getFullDescriptorsFromControllerID(dialog));
                this.committedState.dialog = dialog;
            }

            if (controller && controller.options && controller.options.on_success) {
                controller.options.on_success();
                controller.options.on_success = null;
            }
            this.committedState.controllerStack = controllerStack;
            this._cleanActions();
            this._triggerCommitted();
        }
        _triggerCommitted() {
            const committedValue = {};
            if (this.__commitCallBacks) {
                Object.entries(this.__commitCallBacks).forEach(([key, cb]) => {
                    committedValue[key] = cb();
                });
            }
            this.trigger('committed', committedValue);
        }
        /**
         * Executes Odoo actions, given as an ID in database, an xml ID, a client
         * action tag or an action descriptor.
         *
         * @param {number|string|Object} action the action to execute
         * @param {Object} [options] available options detailed below
         * @param {Object} [options.additional_context={}] additional context to be
         *   merged with the action's context.
         * @param {boolean} [options.clear_breadcrumbs=false] set to true to clear
         *   the breadcrumbs history list
         * @param {Function} [options.on_close] callback to be executed when the
         *   current action is active again (typically, if the new action is
         *   executed in target="new", on_close will be executed when the dialog is
         *   closed, if the current controller is still active)
         * @param {Function} [options.on_reverse_breadcrumb] callback to be executed
         *   whenever an anterior breadcrumb item is clicked on
         * @param {boolean} [options.pushState=true] set to false to prevent the
         *   ActionManager from pushing the state when the action is executed (this
         *   is useful when we come from a loadState())
         * @param {boolean} [options.replace_last_action=false] set to true to
         *   replace last part of the breadcrumbs with the action
         * @return {Promise<Object>} resolved with the action when the action is
         *   loaded and appended to the DOM ; rejected if the action can't be
         *   executed (e.g. if doAction has been called to execute another action
         *   before this one was complete).
         */
        doAction(action, options, on_success, on_fail) {
            // Calling on_success and on_fail is necessary for legacy
            // compatibility. Some widget may need to do stuff when a report
            // has been printed
            on_success = on_success || (() => {console.log('SUCCESS', action);});
            on_fail = on_fail || (() => {});
            this._doAction(action, options);
            this.loadAction();
            this.getActionPromise(this.pendingState.promises, options).then(on_success).guardedCatch(on_fail);
        }
        _doAction(action, options) {
            const defaultOptions = {
                additional_context: {},
                clear_breadcrumbs: false,
                on_close: function () {},
                on_reverse_breadcrumb: function () {},
                replace_last_action: false,
            };
            options = Object.assign(defaultOptions, options);
            if (options && options.on_close) {
                console.warn('doAction: on_close callback is deprecated');
            }
            options.actionID = options.actionID || this._nextID('action');
            this.addToPendingState({
                actionID: options.actionID,
                action,
                options,
            });
        }
        loadState() {
            // LPE FIXME: it we don't do this, there is a actionContainer instanciated
            // This is not what we want, this dipatch method is merely a special getter
            // than *can* doAction......
            this.addToPendingState({
                actionID: null,
            });
        }
        getActionPromise(promisesList, options) {
            if (!promisesList) {
                promisesList = this.pendingState && this.pendingState.promises || [];
            }
            const length = promisesList.length;
            let prom = Promise.all(promisesList).then(() => {
                if (promisesList.length > length) {
                    return this.getActionPromise(promisesList);
                }
            });
            if (options) {
                const { on_success , on_fail } = options;
                const settle = func => !(this.pendingState && this.pendingState.hasDOMresult) && func ? func() : null;
                prom = prom.then(() => settle(on_success)).guardedCatch(() => settle(on_fail));
            }
            return prom;
        }
        async loadAction() {
            if (!this.pendingState) {
                throw new Error('LOL');
            }
            let { action , options } = this.pendingState;
            // build or load an action descriptor for the given action
            // TODO maybe registry can do this
            if (typeof action === 'string' && action_registry.contains(action)) {
                // action is a tag of a client action
                action = { type: 'ir.actions.client', tag: action };
            } else if (typeof action === 'string' || typeof action === 'number') {
                // action is an id or xml id
                const loadActionProm = this.env.dataManager.load_action(action, {
                    active_id: options.additional_context.active_id,
                    active_ids: options.additional_context.active_ids,
                    active_model: options.additional_context.active_model,
                });
                action = await this.asyncWrapper(loadActionProm);
            }
            // action.target 'main' is equivalent to 'current' except that it
            // also clears the breadcrumbs
            options.clear_breadcrumbs = action.target === 'main' || options.clear_breadcrumbs;

            action = this._preprocessAction(action, options);
            this.addToPendingState({
                action,
                options,
            });
            if (action.target !== 'new') {
                await this._willSwitchAction();
            }
            this.resetDispatch(this.pendingState);
            return this.dispatch('executeAction', action, options);
        }
        /**
         * Handler for event 'execute_action', which is typically called when a
         * button is clicked. The button may be of type 'object' (call a given
         * method of a given model) or 'action' (execute a given action).
         * Alternatively, the button may have the attribute 'special', and in this
         * case an 'ir.actions.act_window_close' is executed.
         *
         * @param {Object} params
         * @param {Object} params.action_data typically, the html attributes of the
         *   button extended with additional information like the context
         * @param {Object} [params.action_data.special=false]
         * @param {Object} [params.action_data.type] 'object' or 'action', if set
         * @param {Object} params.env
         * @param {function} [params.on_closed]
         * @param {function} [params.on_fail]
         * @param {function} [params.on_success]
         */
        async executeFlowAction(params) {
            const actionData = params.action_data;
            const env = params.env;
            const context = new Context(env.context, actionData.context || {});
            const recordID = env.currentID || null; // pyUtils handles null value, not undefined
            let prom;

            // determine the action to execute according to the actionData
            if (actionData.special) {
                prom = Promise.resolve({
                    type: 'ir.actions.act_window_close',
                    infos: { special: true },
                });
            } else if (actionData.type === 'object') {
                // call a Python Object method, which may return an action to execute
                let args = recordID ? [[recordID]] : [env.resIDs];
                if (actionData.args) {
                    try {
                        // warning: quotes and double quotes problem due to json and xml clash
                        // maybe we should force escaping in xml or do a better parse of the args array
                        const additionalArgs = JSON.parse(actionData.args.replace(/'/g, '"'));
                        args = args.concat(additionalArgs);
                    } catch (e) {
                        console.error("Could not JSON.parse arguments", actionData.args);
                    }
                }
                prom = this.rpc({
                    route: '/web/dataset/call_button',
                    params: {
                        args: args,
                        kwargs: {context: context.eval()},
                        method: actionData.name,
                        model: env.model,
                    },
                });
            } else if (actionData.type === 'action') {
                // FIXME: couldn't we directly call doAction?
                // execute a given action, so load it first
                const additionalContext = Object.assign(pyUtils.eval('context', context), {
                    active_model: env.model,
                    active_ids: env.resIDs,
                    active_id: recordID,
                });
                prom = this.env.dataManager.load_action(actionData.name, additionalContext);
            } else {
                prom = Promise.reject();
            }

            let action;
            try {
                action = await this.asyncWrapper(prom);
            } catch (e) {
                // LPE FIXME: activate this
                // this.handleError(e);
                if (params.on_fail) {
                    params.on_fail();
                }
                return;
            }
            // show effect if button have effect attribute
            // rainbowman can be displayed from two places: from attribute on a button or from python
            // code below handles the first case i.e 'effect' attribute on button.
            let effect = false;
            if (actionData.effect) {
                effect = pyUtils.py_eval(actionData.effect);
            }

            if (action && action.constructor === Object) {
                // filter out context keys that are specific to the current action, because:
                //  - wrong default_* and search_default_* values won't give the expected result
                //  - wrong group_by values will fail and forbid rendering of the destination view
                this.rejectKeysRegex = this.rejectKeysRegex || new RegExp(`\
                    ^(?:(?:default_|search_default_|show_).+|\
                    .+_view_ref|group_by|group_by_no_leaf|active_id|\
                    active_ids|orderedBy)$`
                );
                const oldCtx = {};
                for (const key in env.context) {
                    if (!key.match(this.rejectKeysRegex)) {
                        oldCtx[key] = env.context[key];
                    }
                }
                const ctx = new Context(oldCtx);
                ctx.add(actionData.context || {});
                ctx.add({active_model: env.model});
                if (recordID) {
                    ctx.add({
                        active_id: recordID,
                        active_ids: [recordID],
                    });
                }
                ctx.add(action.context || {});
                action.context = ctx;
                // in case an effect is returned from python and there is already an effect
                // attribute on the button, the priority is given to the button attribute
                action.effect = effect || action.effect;
            } else {
                // if action doesn't return anything, but there is an effect
                // attribute on the button, display rainbowman
                action = {
                    effect: effect,
                    type: 'ir.actions.act_window_close',
                };
            }
            let options = {
                on_close: params.on_closed,
                on_success: params.on_success,
                on_fail: params.on_fail,
            };
            if (this.env.device.isMobile && actionData.mobile) {
                options = Object.assign({}, options, actionData.mobile);
            }
            // LPE Fixme: @AAB why injecting searchPanelDefaultFilters ?
            // action.flags = Object.assign({}, action.flags, { searchPanelDefaultNoFilter: true });
            this.dispatch('doAction', action, options);
        }
        /**
         * Restores a controller from the controllerStack and removes all
         * controllers stacked over the given controller (called when coming back
         * using the breadcrumbs).
         *
         * @param {string} controllerID
         */
        async restoreController(controllerID) {
            if (!controllerID) {
                controllerID = this.currentStack[this.currentStack.length - 1];
            }
            const { action, controller } = this.getFullDescriptorsFromControllerID(controllerID);
            await this._willSwitchAction();
            if (action) {
                if (controller.onReverseBreadcrumb) {
                    await controller.onReverseBreadcrumb();
                }
            }
            this.resetDispatch(this.pendingState);
            this.dispatch('_restoreController', action, controller);
        }
        finalizeTransaction(mode) {
            const pendingState = this.pendingState;
            this.resetDispatch();
            this.dispatching = true;
            this.dispatch(mode, pendingState);
            this.resetDispatch();
        }
        rollBack(pendingState) {
            if (!pendingState)  {
                return;
            }
            const {controllerStack, dialog } = pendingState;
            if (!controllerStack && !dialog) {
                return;
            }
            let controller;
            if (!dialog) {
                const contID = controllerStack[controllerStack.length - 1];
                ({ controller } = this.getFullDescriptorsFromControllerID(contID));
            } else {
                controller = dialog.controller;
            }
            if (controller && controller.options && controller.options.on_fail) {
                controller.options.on_fail();
            } else {
                // this else is a guess
                // there is a little issue with "oops, something went wrong popup"
                // and cannot be tested
                // usecase: make a default_get crash during a do_action
                //this.restoreController();
            }
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------
        makeBaseController(action, params) {
            const controllerID = params.controllerID || this._nextID('controller');
            const index = this._getControllerStackIndex(params);
            const newController = {
                actionID: action.jsID,
                Component: params.Component,
                index: index,
                jsID: controllerID,
            };
            action.controller = newController;
            this.controllers[controllerID] = newController;
            return newController;
        }

        rpc() {
            return this.env.services.rpc(...arguments);
        }
        /**
         * Updates the pendingStack with a given controller. It triggers a rendering
         * of the ActionManager with that controller as active controller (last one
         * of the stack).
         *
         * @private
         * @param {Object} controller
         */
        pushController() {
            this.addToPendingState(
                this._pushController(...arguments),
                { hasDOMresult: true },
            );
        }
        _pushController(controller) {
            if (!controller) {
                return {
                    controllerStack: this.pendingState && this.pendingState.controllerStack || [],
                    dialog: this.pendingState && 'dialog' in this.pendingState && this.pendingState.dialog || null,
                };
            }
            let nextStack = this.currentStack;
            let dialog;
            const action = this.actions[controller.actionID];
            if (action.target !== 'new') {
                nextStack = nextStack.slice(0, controller.index || 0);
                nextStack.push(controller.jsID);
                dialog = null;
                if (controller.options && controller.options.on_reverse_breadcrumb) {
                    const currentControllerID = this.currentStack[this.currentStack.length - 1];
                    if (currentControllerID) {
                        const currentController = this.controllers[currentControllerID];
                        currentController.onReverseBreadcrumb = controller.options.on_reverse_breadcrumb;
                    }
                }
            } else {
                dialog = controller.jsID;
                if (this.currentDialogController) {
                    const {controller: dialogController} = this.getFullDescriptorsFromControllerID(this.currentDialogController);
                    controller.options.on_close = dialogController.options.on_close;
                }
            }
            return {
                controllerStack: nextStack,
                dialog,
            };
        }
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Cleans this.actions and this.controllers according to the current stack.
         *
         * @private
         */
        _cleanActions() {
            const allControllersID = this.currentStack.slice();
            if (this.currentDialogController) {
                allControllersID.push(this.currentDialogController);
            }
            const usedActionIDs = allControllersID.map(controllerID => {
                return this.controllers[controllerID].actionID;
            });
            const cleanedControllers = [];
            for (const controllerID in this.controllers) {
                const controller = this.controllers[controllerID];
                if (!usedActionIDs.includes(controller.actionID)) {
                    cleanedControllers.push(controllerID);
                    delete this.controllers[controllerID];
                }
            }
            const unusedActionIDs = Object.keys(this.actions).filter(actionID => {
                return !usedActionIDs.includes(actionID);
            });
            unusedActionIDs.forEach(actionID => delete this.actions[actionID]);
            return cleanedControllers;
        }
        /**
         * This function is called when the current controller is about to be
         * removed from the DOM, because a new one will be pushed, or an old one
         * will be restored. It ensures that the current controller can be left (for
         * instance, that it has no unsaved changes).
         *
         * @returns {Promise} resolved if the current controller can be left,
         *   rejected otherwise.
         */
        _willSwitchAction() {
            //return Promise.resolve();
            if (this.currentStack.length && !this.currentDialogController) {
                const eventType = 'will-switch-action';
                const subscriptions = this.subscriptions[eventType];
                if (!subscriptions || !subscriptions.length) {
                    return;
                }
                return new Promise((resolve, reject) => {
                    this.trigger(eventType, {resolve, reject});
                });
            }
        }
        /**
         * Returns the index where a controller should be inserted in the controller
         * stack according to the given options. By default, a controller is pushed
         * on the top of the stack.
         *
         * @private
         * @param {options} [options.clear_breadcrumbs=false] if true, insert at
         *   index 0 and remove all other controllers
         * @param {options} [options.index=null] if given, that index is returned
         * @param {options} [options.replace_last_action=false] if true, replace the
         *   last controller of the stack
         * @returns {integer} index
         */
        _getControllerStackIndex(options) {
            let index;
            if ('index' in options) {
                index = options.index;
            } else if (options.clear_breadcrumbs) {
                index = 0;
            } else if (options.replace_last_action) {
                index = this.currentStack.length - 1;
            } else {
                index = this.currentStack.length;
            }
            return index;
        }
        getFullDescriptorsFromControllerID(controllerID) {
            if (!controllerID) {
                return {};
            }
            const controller = this.controllers[controllerID];
            return {
                action: controller && this.actions[controller.actionID],
                controller: controller,
            };
        }
        _nextID(type) {
            return `${type}${this.constructor.nextID++}`;
        }
        /**
         * Preprocesses the action before it is handled by the ActionManager
         * (assigns a JS id, evaluates its context and domains...).
         *
         * @param {Object} action
         * @param {Object} options
         * @returns {Object} shallow copy of action with some new/updated values
         */
        _preprocessAction(action, options) {
            action = Object.assign({}, action);

            // ensure that the context and domain are evaluated
            var context = new Context(this.env.session.user_context, options.additional_context, action.context);
            action.context = pyUtils.eval('context', context);
            if (action.domain) {
                action.domain = pyUtils.eval('domain', action.domain, action.context);
            }
            action._originalAction = JSON.stringify(action);
            action.jsID = options.actionID;
            options.actionID = null;
            this.actions[action.jsID] = action;
            return action;
        }
        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Goes back in the history: if a controller is opened in a dialog, closes
         * the dialog, otherwise, restores the second to last controller from the
         * stack.
         *
         * @private
         */
        _onHistoryBack() {
            if (this.currentDialogController) {
                this.dispatch('doAction', {type: 'ir.actions.act_window_close'});
            } else {
                const length = this.currentStack.length;
                if (length > 1) {
                    this.dispatch('restoreController', this.currentStack[length - 2]);
                }
            }
        }
        addToPendingState(...objs) {
            const pendingState = this.pendingState || {
                actionID: `__dummy__${this.requestId}`,
                requestId: this.requestId,
                hasDOMresult: false,
                promises: [],
            };
            this.pendingState = Object.assign(
                pendingState,
                ...objs
            );
        }
        updateAction(controllerID, data) {
            const { action, controller} = this.getFullDescriptorsFromControllerID(controllerID);
            if (action) {
                Object.assign(action, data.action.commonState);
                action.controllerState = Object.assign({}, action.controllerState, data.action.controllerState);
            }
            if (controller) {
                Object.assign(controller, data.controller);
            }
        }
        asyncWrapper(fnOrProm, ...args) {
            const { actionID, requestId } = this.pendingState;
            const predicate = () =>
                this.pendingState && (
                    requestId === this.pendingState.requestId &&
                    actionID === this.pendingState.actionID
            );
            this.pendingState.__lastProm = this.pendingState.promises[this.pendingState.promises.length-1];
            const prom = new Promise((resolve, reject) => {
                let prom2;
                if (fnOrProm instanceof Function) {
                    prom2 = Promise.resolve().then(() => {
                        return predicate() ? fnOrProm(...args) : Promise.reject();
                    });
                } else {
                    prom2 = fnOrProm;
                }
                prom2.then(result => {
                        if (predicate()) {
                            resolve(result);
                        }
                    })
                    .catch(error => {
                        if (predicate()) {
                            reject(error);
                        }
                });
            });
            this.pendingState.promises.push(prom);
            return prom;
        }
    }
    ActionManager.nextID = 1;


    /**
     *    HOOK
     */
    function useActionManager () {
        const component = owl.Component.current;
        if (!component.env.actionManager) {
            component.env.actionManager = new ActionManager(component.env);
        }
        const actionManager = component.env.actionManager;
        useModel('actionManager');
        const __owl__ = component.__owl__;

        if (!__owl__.parent && !component.parentWidget) {
            const mapping = actionManager.mapping;
            const componentId = __owl__.id;
            const transactionEndFn = commandName => {
                if (mapping[componentId] === actionManager.rev) {
                    return actionManager.finalizeTransaction(commandName);
                }
            };
            const { onPatched, onMounted } = owl.hooks;
            onPatched(() => {
                transactionEndFn('commit');
            });
            onMounted(() => {
                transactionEndFn('commit');
            });
            const catchError = component.catchError;
            component.catchError = function () {
                transactionEndFn('rollBack');
                try {
                    if (catchError) {
                        catchError.call(component, ...arguments);
                    }
                } catch (e) {
                    actionManager.handleError(e);
                }
            };
        }
    }
    ActionManager.registry = new Registry(null);

    ActionManager.useActionManager = useActionManager;
    ActionManager.useCommitCallBack = (key, callback) => {
        const component = owl.Component.current;
        const actionManager = component.env.actionManager;
        if (!actionManager) {
            return;
        }
        const callbacks = actionManager.__commitCallBacks || {};
        actionManager.__commitCallBacks = callbacks;
        owl.hooks.onMounted(() => {
            if (key in callbacks) {
                throw new Error('Pas Glop');
            }
            callbacks[key] = callback;
        });
        owl.hooks.onWillUnmount(() => delete callbacks[key]);
    };

    return ActionManager;

});
