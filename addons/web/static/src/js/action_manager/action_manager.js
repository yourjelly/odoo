odoo.define('web.ActionManager', function (require) {
    "use strict";

    const ActionAbstractPlugin = require('web.ActionAbstractPlugin');
    const Context = require('web.Context');
    const { action_registry } = require('web.core');
    const { Model, useModel } = require('web.model');

    var pyUtils = require('web.py_utils');
    const { TransactionalChain } = require('web.concurrency');

    const { core } = owl;

    class HotPluginAbleModel extends Model {
        // TODO: doc ALL!!!
        // TODO: check type of PLugin ???
        static registerPlugin(Plugin) {
            this.Plugins = this.Plugins || [];
            this.Plugins.push(Plugin);
            if (this.instanceBus) {
                this.instanceBus.trigger('plugin-registered', Plugin);
            }
        }
        constructor(env) {
            super(...arguments);
            this.env = env;
            this.plugins = [];
            const instance = this;
            const _bus = this.constructor.instanceBus || new core.EventBus();
            this.constructor.instanceBus = _bus;
            _bus.on('plugin-registered', null, Plugin => {
                instance.instanciatePlugin.call(instance, Plugin);
            });

            this.constructor.Plugins.forEach(P => this.instanciatePlugin(P));
        }
        cancelPreviousCommand() {
            if (this.currentCommand) {
                this.currentCommand.stopped = true;
            }
            this.currentCommand = null;
        }
        getHandlers(/* command */) {/* return handlers */}
        async _process(command, handlers) {
            const handled = [];
            for (const h of handlers) {
                handled.push(h.handle(command));
            }
            const results = await Promise.all(handled);

            return results.find(r => r !== undefined);
        }
        _prepareCommand(commandString, ...args) {
            return {
                name: commandString,
                payload: args,
                rev: this.rev,
                setNotify(bool) {
                    const comm =  this.root ? this.root : this;
                    comm.triggerNotify = bool;
                }
            };
        }
        /**
         * Exposed public dispatch: initiates a transaction
         */
        async dispatch(commandString, ...args) {
            const command = this._prepareCommand(...arguments);

            const handlers = this.getHandlers(command);
            handlers.forEach(h => h.beforeHandle(command));
            if (command.stopped) {
                return false;
            }
            this.cancelPreviousCommand();
            this.currentCommand = command;

            let results;
            try {
                results = await this._process(command, handlers);
            } catch (e) {
                this.handleError(e);
            }
            if (command.triggerNotify) {
                await Promise.resolve().then(() => {
                    if (command.rev === this.rev && !command.stopped) {
                        this._notifyComponents();
                    }
                });
            }
            return results;
        }
        /**
         * To be used by plugins or self
         * Doesn't initiate a transaction
         * MUST be used inside one though
         */
        async _dispatch(commandString, ...args) {
            const command = this._prepareCommand(...arguments);

            const handlers = this.getHandlers(command);
            handlers.forEach(h => h.beforeHandle(command));
            if (command.stopped) {
                return false;
            }
            command.root = this.currentCommand;
            return this._process(command, handlers);
        }
        instanciatePlugin(Plugin) {
            // TODO: clean API of generic Plugin
            const plugin = new Plugin(this, this.env);
            this.plugins.push(plugin);
        }
        handleError(error) {
            if (!(error && error.message && error.message.startsWith('Plugin Error'))) {
                throw error;
            }
        }
    }

    class ActionManager extends HotPluginAbleModel {
        constructor() {
            super(...arguments);
            this._transaction = new TransactionalChain();
            // Before switching views, an event is triggered
            // containing the state of the current controller
            // TODO: convert to dispatch, or own events
            this.env.bus.on('history-back', this, this._onHistoryBack);

            // handled by the ActionManager (either stacked in the current window,
            // or opened in dialogs)
            this.actions = {};

            // 'controllers' is an Object that registers the alive controllers
            // linked registered actions, a controller being an Object with keys
            // (amongst others) 'jsID' (a local identifier) and 'widget' (the
            // instance of the controller's widget)
            this.controllers = {};

            this.requestId = 0;
            this.committedState = {
                controllerStack: [],
                dialog: null,
            };
            this.pendingState = null;
        }
        cancelPreviousCommand() {
            this._transaction.add(Promise.resolve());
            this.pendingState = null;
            this.requestId++;
            super.cancelPreviousCommand();
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
        getHandlers(command) {
            const exclusives = [
                'EXECUTE_IN_FLOW',
                'pushController', 'RESTORE_CONTROLLER',
                '_ROLLBACK',
            ];
            const handlers = [[50 , this]];
            if (!exclusives.includes(command.name)) {
                this.plugins.forEach(h => {
                    const willHandle = h.willHandle(command);
                    if (willHandle) {
                        const priority = parseInt(willHandle) ? willHandle : 50;
                        handlers.push([priority , h]);
                    }
                });
            }
            handlers.sort((a, b) => {
                return a[0] - b[0];
            });
            return handlers.map(el => el[1]);
        }
        //--------------------------------------------------------------------------
        // Main API
        //--------------------------------------------------------------------------
        beforeHandle(){/* */}
        commit() {
            if (!this.pendingState) {
                return;
            }
            this._dispatch('_COMMIT');
            const { controllerStack, dialog } = this.pendingState;
            if (!controllerStack && !dialog) {
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
            const controllerCleaned = this._cleanActions();
            this.cancelPreviousCommand();
            return { controllerCleaned };
        }
        handle(command) {
            const { name, payload } = command;
            switch (name) {
                case "doAction":
                    command.setNotify(true);
                    return this.doAction(...payload);
                case "EXECUTE_IN_FLOW":
                    return this.executeInFlowAction(...payload);
                case "pushController":
                    command.setNotify(true);
                    return this.pushController(...payload);
                case "RESTORE_CONTROLLER":
                    return this.restoreController(...payload);
                case "executeAction": {
                    // always render, because some actions may resolve to no node
                    command.setNotify(true);
                    this.addToPendingState(payload[0]);
                }
            }
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
        doAction(action, options, on_success, on_fail, previousPending) {
            // Calling on_success and on_fail is necessary for legacy
            // compatibility. Some widget may need to do stuff when a report
            // has been printed
            on_success = on_success || (() => {console.log('SUCCESS', action);});
            on_fail = on_fail || (() => {});
            this.addToPendingState(previousPending || {});
            this._doAction(action, options);
            this._prepareActionPromise().then(on_success).guardedCatch(on_fail);
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
        getActionPromise() {
            return this.pendingState && this.pendingState.actionPromise;
        }
        _prepareActionPromise() {
            let actionDone;
            this.pendingState.actionPromise = new Promise((resolve, reject) => {
                this.pendingState.loaded = false;
                const { actionID , requestId } = this.pendingState;
                actionDone = this.loadAction()
                    .then(() => {
                        if (requestId === this.pendingState.requestId &&
                            actionID === this.pendingState.actionID) {
                            this.pendingState.loaded = true;
                            resolve(this.pendingState.hasDOMresult);
                        }
                    })
                    .guardedCatch(error => {
                        if (requestId === this.pendingState.requestId &&
                            actionID === this.pendingState.actionID) {
                            reject(error);
                        }
                    });
            });
            return actionDone;
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
                action = await this._transaction.add(loadActionProm);
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
            return this.dispatch('executeAction', this.pendingState);
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
        async executeInFlowAction(params) {
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
                action = await this._transaction.add(prom);
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
            action.flags = Object.assign({}, action.flags, { searchPanelDefaultNoFilter: true });
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
            await this._willSwitchAction();
            const { action, controller } = this.getFullDescriptorsFromControllerID(controllerID);
            if (action) {
                if (controller.onReverseBreadcrumb) {
                    await controller.onReverseBreadcrumb();
                }
            }
            return this._dispatch('_RESTORE', action, controller);
        }
        rollBack() {
            if (!this.pendingState)  {
                return;
            }
            const {controllerStack, dialog } = this.pendingState;
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
            this.cancelPreviousCommand();
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
                return new Promise((resolve, reject) => {
                    this.trigger('will-switch-action', {resolve, reject});
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
                    this.dispatch('RESTORE_CONTROLLER', this.currentStack[length - 2]);
                }
            }
        }
        _prepareCommand() {
            const cmd = super._prepareCommand(...arguments);
            cmd.requestId = this.requestId;
            return cmd;
        }
        addToPendingState(...objs) {
            const pendingState = this.pendingState || {
                hasDOMresult: false,
                requestId: this.requestId,
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
                    return actionManager[commandName]();
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
            component.catchError = function() {
                if (catchError) {
                    catchError.call(component, ...arguments);
                }
                transactionEndFn('rollBack');
                //actionManager.dispatch('RESTORE_CONTROLLER');
            };
            // TODO: clean bindings from component
        }
    }

    ActionManager.useActionManager = useActionManager;

    return ActionManager;

});
