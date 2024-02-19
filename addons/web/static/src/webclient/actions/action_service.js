import { _t } from "@web/core/l10n/translation";
import { browser } from "@web/core/browser/browser";
import { makeContext } from "@web/core/context";
import { useDebugCategory } from "@web/core/debug/debug_context";
import { evaluateExpr } from "@web/core/py_js/py";
import { rpc, rpcBus } from "@web/core/network/rpc";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { Deferred, KeepLast } from "@web/core/utils/concurrency";
import { useBus, useService } from "@web/core/utils/hooks";
import { View, ViewNotFoundError } from "@web/views/view";
import { ActionDialog } from "./action_dialog";
import { CallbackRecorder } from "./action_hook";
import { ReportAction } from "./reports/report_action";
import { UPDATE_METHODS } from "@web/core/orm_service";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { router as _router } from "@web/core/browser/router";

import {
    Component,
    markup,
    onMounted,
    onWillUnmount,
    onError,
    useChildSubEnv,
    xml,
    reactive,
} from "@odoo/owl";
import { downloadReport, getReportUrl } from "./reports/utils";
import { pick } from "@web/core/utils/objects";
import { zip } from "@web/core/utils/arrays";

class BlankComponent extends Component {
    static props = ["onMounted", "withControlPanel", "*"];
    static template = xml`
        <ControlPanel display="{disableDropdown: true}" t-if="props.withControlPanel and !env.isSmall">
            <t t-set-slot="layout-buttons">
                <button class="btn btn-primary invisible"> empty </button>
            </t>
        </ControlPanel>`;
    static components = { ControlPanel };

    setup() {
        useChildSubEnv({ config: { breadcrumbs: [], noBreadcrumbs: true } });
        onMounted(() => this.props.onMounted());
    }
}

const actionHandlersRegistry = registry.category("action_handlers");
const actionRegistry = registry.category("actions");
const viewRegistry = registry.category("views");

/** @typedef {number|false} ActionId */
/** @typedef {Object} ActionDescription */
/** @typedef {"current" | "fullscreen" | "new" | "main" | "self" | "inline"} ActionMode */
/** @typedef {string} ActionTag */
/** @typedef {string} ActionXMLId */
/** @typedef {Object} Context */
/** @typedef {Function} CallableFunction */
/** @typedef {string} ViewType */

/** @typedef {ActionId|ActionXMLId|ActionTag|ActionDescription} ActionRequest */

/**
 * @typedef {Object} ActionOptions
 * @property {Context} [additionalContext]
 * @property {boolean} [clearBreadcrumbs]
 * @property {CallableFunction} [onClose]
 * @property {Object} [props]
 * @property {ViewType} [viewType]
 */

export async function clearUncommittedChanges(env) {
    const callbacks = [];
    env.bus.trigger("CLEAR-UNCOMMITTED-CHANGES", callbacks);
    const res = await Promise.all(callbacks.map((fn) => fn()));
    return !res.includes(false);
}

export const standardActionServiceProps = {
    action: Object, // prop added by _getActionInfo
    actionId: { type: Number, optional: true }, // prop added by _getActionInfo
    className: String, // prop added by the ActionContainer
    globalState: { type: Object, optional: true }, // prop added by _updateUI
    state: { type: Object, optional: true }, // prop added by _updateUI
};

function parseActiveIds(ids) {
    const activeIds = [];
    if (typeof ids === "string") {
        activeIds.push(...ids.split(",").map(Number));
    } else if (typeof ids === "number") {
        activeIds.push(ids);
    }
    return activeIds;
}

const DIALOG_SIZES = {
    "extra-large": "xl",
    large: "lg",
    medium: "md",
    small: "sm",
};

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export class ControllerNotFoundError extends Error {}

export class InvalidButtonParamsError extends Error {}

// -----------------------------------------------------------------------------
// ActionManager (Service)
// -----------------------------------------------------------------------------

// regex that matches context keys not to forward from an action to another
const CTX_KEY_REGEX =
    /^(?:(?:default_|search_default_|show_).+|.+_view_ref|group_by|active_id|active_ids|orderedBy)$/;

// only register this template once for all dynamic classes ControllerComponent
const ControllerComponentTemplate = xml`<t t-component="Component" t-props="componentProps"/>`;

let id = 0;

export function makeActionManager(env, router = _router) {
    const breadcrumbCache = {};
    const keepLast = new KeepLast();
    let controllerStack = _controllersFromState();
    let dialogCloseProm;
    let actionCache = {};
    let dialog = null;

    // The state action (or default user action if none) is loaded as soon as possible
    // so that the next "doAction" will have its action ready when needed.
    const actionParams = _getActionParams();
    if (actionParams && typeof actionParams.actionRequest === "number") {
        const { actionRequest, options } = actionParams;
        _loadAction(actionRequest, options.additionalContext);
    }

    env.bus.addEventListener("CLEAR-CACHES", () => {
        actionCache = {};
    });
    rpcBus.addEventListener("RPC:RESPONSE", (ev) => {
        const { model, method } = ev.detail.data.params;
        if (model === "ir.actions.act_window" && UPDATE_METHODS.includes(method)) {
            actionCache = {};
        }
    });

    // ---------------------------------------------------------------------------
    // misc
    // ---------------------------------------------------------------------------

    function _controllersFromState() {
        const state = router.current;
        if (!state?.actionStack?.length) {
            return [];
        }
        const controllers = state.actionStack.slice(0, -1).map((action) => {
            // create a better display name :
            const controller = {
                jsId: `controller_${++id}`,
                displayName: action.resId
                    ? `${action.model || action.action}:${action.resId}`
                    : action.model || action.action,
                virtual: true,
                action: {},
                props: {},
                state: action,
            };
            if (action.action) {
                controller.action.id = action.action;
                if (action.active_id) {
                    controller.action.context = { active_id: action.active_id };
                }
            }
            if (action.model) {
                controller.action.type = "ir.actions.act_window";
                controller.props.resModel = action.model;
            }
            if (action.resId) {
                controller.state.id = action.resId;
                controller.action.type = "ir.actions.act_window";
                controller.props.resId = action.resId;
                controller.state.view_type = "form";
                controller.props.viewType = "form";
            }
            return controller;
        });
        _loadBreadcrumbs(controllers); // Pursposefully not awaited
        return controllers;
    }

    // FIXME don't load breadcrumbs for controllers for which we already got the
    // display name from itself instead of through here on back/forward.
    async function _loadBreadcrumbs(controllers) {
        const toFetch = [];
        const keys = [];
        for (const { action, state } of controllers) {
            if (action.id === "menu" || actionRegistry.contains(action.id)) {
                continue;
            }
            const actionInfo = pick(state, "action", "model", "resId");
            const key = JSON.stringify(actionInfo);
            keys.push(key);
            if (key in breadcrumbCache) {
                continue;
            }
            toFetch.push(actionInfo);
        }
        if (toFetch.length) {
            const req = rpc("/web/action/load_breadcrumbs", { actions: toFetch });
            for (const [i, info] of toFetch.entries()) {
                const key = JSON.stringify(info);
                breadcrumbCache[key] = req.then((res) => {
                    breadcrumbCache[key] = res[i];
                    return res[i];
                });
            }
        }
        const displayNames = await Promise.all(keys.map((k) => breadcrumbCache[k]));
        const newStack = [];
        for (const [controller, displayName] of zip(controllers, displayNames)) {
            if (displayName === null) {
                console.warn(
                    "The following element was removed from the breadcrumb and from the url.",
                    "This could be because the action wasn't found or because the user doesn't have the right to access to the record",
                    controller.state
                );
                continue;
            }
            controller.displayName = displayName;
            newStack.push(controller);
        }
        // FIXME race condition on controllerStack
        controllerStack = newStack;
    }

    /**
     * Removes the current dialog from the action service's state.
     * It returns the dialog's onClose callback to be able to propagate it to the next dialog.
     *
     * @return {Function|undefined} When there was a dialog, returns its onClose callback for propagation to next dialog.
     */
    function _removeDialog() {
        if (dialog) {
            const { onClose, remove } = dialog;
            dialog = null;
            // Remove the dialog from the dialog_service.
            // The code is well enough designed to avoid falling in a function call loop.
            remove();
            return onClose;
        }
    }

    /**
     * Returns the last controller of the current controller stack.
     *
     * @returns {Controller|null}
     */
    function _getCurrentController() {
        const stack = controllerStack;
        return stack.length ? stack[stack.length - 1] : null;
    }

    /**
     * Given an id, xmlid, tag (key of the client action registry) or directly an
     * object describing an action.
     *
     * @private
     * @param {ActionRequest} actionRequest
     * @param {Context} [context={}]
     * @returns {Promise<Action>}
     */
    async function _loadAction(actionRequest, context = {}) {
        if (typeof actionRequest === "string" && actionRegistry.contains(actionRequest)) {
            // actionRequest is a key in the actionRegistry
            return {
                target: "current",
                tag: actionRequest,
                type: "ir.actions.client",
            };
        }

        if (typeof actionRequest === "string" || typeof actionRequest === "number") {
            // actionRequest is an id or an xmlid
            const additional_context = {
                active_id: context.active_id,
                active_ids: context.active_ids,
                active_model: context.active_model,
            };
            const key = `${JSON.stringify(actionRequest)},${JSON.stringify(additional_context)}`;
            let action;
            if (!actionCache[key]) {
                actionCache[key] = rpc("/web/action/load", {
                    action_id: actionRequest,
                    additional_context,
                });
                action = await actionCache[key];
                if (action.help) {
                    action.help = markup(action.help);
                }
            } else {
                action = await actionCache[key];
            }
            if (!action) {
                return {
                    type: "ir.actions.client",
                    tag: "invalid_action",
                    id: actionRequest,
                };
            }
            return Object.assign({}, action);
        }

        // actionRequest is an object describing the action
        return actionRequest;
    }

    /**
     * this function returns an action description
     * with a unique jsId.
     */
    function _preprocessAction(action, context = {}) {
        try {
            action._originalAction = JSON.stringify(action);
        } catch {
            // do nothing, the action might simply not be serializable
        }
        action.context = makeContext([context, action.context], user.context);
        const domain = action.domain || [];
        action.domain =
            typeof domain === "string"
                ? evaluateExpr(domain, Object.assign({}, user.context, action.context))
                : domain;
        if (action.help) {
            const htmlHelp = document.createElement("div");
            htmlHelp.innerHTML = action.help;
            if (!htmlHelp.innerText.trim()) {
                delete action.help;
            }
        }
        action = { ...action }; // manipulate a copy to keep cached action unmodified
        action.jsId = `action_${++id}`;
        if (action.type === "ir.actions.act_window" || action.type === "ir.actions.client") {
            action.target = action.target || "current";
        }
        if (action.type === "ir.actions.act_window") {
            action.views = [...action.views.map((v) => [v[0], v[1] === "tree" ? "list" : v[1]])]; // manipulate a copy to keep cached action unmodified
            action.controllers = {};
            const target = action.target;
            if (target !== "inline" && !(target === "new" && action.views[0][1] === "form")) {
                // FIXME: search view arch is already sent with load_action, so either remove it
                // from there or load all fieldviews alongside the action for the sake of consistency
                const searchViewId = action.search_view_id ? action.search_view_id[0] : false;
                action.views.push([searchViewId, "search"]);
            }
        }
        return action;
    }

    /**
     * @private
     * @param {string} viewType
     * @throws {Error} if the current controller is not a view
     * @returns {View | null}
     */
    function _getView(viewType) {
        const currentController = controllerStack[controllerStack.length - 1];
        if (currentController.action.type !== "ir.actions.act_window") {
            throw new Error(`switchView called but the current controller isn't a view`);
        }
        const view = currentController.views.find((view) => view.type === viewType);
        return view || null;
    }

    /**
     * Given a controller stack, returns the list of breadcrumb items.
     *
     * @private
     * @param {ControllerStack} stack
     * @returns {Breadcrumbs}
     */
    function _getBreadcrumbs(stack) {
        return stack
            .filter((controller) => controller.action.tag !== "menu")
            .map((controller) => {
                return {
                    jsId: controller.jsId,
                    get name() {
                        return controller.displayName;
                    },
                };
            });
    }

    /**
     * @private
     * @returns {ActionParams | null}
     */
    function _getActionParams(state = router.current) {
        const options = {};
        let actionRequest = null;
        if (state.action) {
            const context = {};
            if (state.active_id) {
                context.active_id = state.active_id;
            }
            if (state.active_ids) {
                context.active_ids = parseActiveIds(state.active_ids);
            } else if (state.active_id) {
                context.active_ids = [state.active_id];
            }
            // ClientAction
            if (actionRegistry.contains(state.action)) {
                actionRequest = {
                    context,
                    params: state,
                    tag: state.action,
                    type: "ir.actions.client",
                };
            } else {
                // The action to load isn't the current one => executes it
                actionRequest = state.action;
                context.params = state;
                Object.assign(options, {
                    additionalContext: context,
                    viewType: state.id ? "form" : state.view_type,
                });
                if (state.id) {
                    options.props = { resId: state.id };
                }
            }
        } else if (state.model) {
            if (state.id || state.view_type === "form") {
                actionRequest = {
                    res_model: state.model,
                    res_id: state.id,
                    type: "ir.actions.act_window",
                    views: [[state.view_id ? state.view_id : false, "form"]], // TODO add tests for view_id
                };
            } else if (state.view_type) {
                // This is a window action on a multi-record view => restores it from
                // the session storage
                const storedAction = browser.sessionStorage.getItem("current_action");
                const lastAction = JSON.parse(storedAction || "{}");
                if (lastAction.help) {
                    lastAction.help = markup(lastAction.help);
                }
                if (lastAction.res_model === state.model) {
                    if (lastAction.context) {
                        // If this method is called because of a company switch, the
                        // stored allowed_company_ids is incorrect.
                        delete lastAction.context.allowed_company_ids;
                    }
                    actionRequest = lastAction;
                    options.viewType = state.view_type;
                }
            }
        }
        if (!actionRequest) {
            const { actionStack } = state;
            // Keep unwinding the actionStack until we find a valid action
            if (actionStack?.length > 1) {
                const nextState = { actionStack: actionStack.slice(0, -1) };
                Object.assign(nextState, nextState.actionStack.at(-1));
                const params = _getActionParams(nextState);
                // Set the index so that we use the existing virtual controller
                // instead of a new one
                if (params.options && params.options.index === undefined) {
                    params.options.index = nextState.actionStack.length - 1;
                }
                return params;
            }
            // Fall back to the home action if no valid action was found
            actionRequest = user.homeActionId;
        }
        return actionRequest ? { actionRequest, options } : null;
    }

    /**
     * @param {ClientAction} action
     * @param {Object} props
     * @returns {{ props: ActionProps, config: Config }}
     */
    function _getActionInfo(action, props) {
        return {
            props: Object.assign({}, props, { action, actionId: action.id }),
            config: {
                actionId: action.id,
                actionType: "ir.actions.client",
                actionFlags: action.flags,
            },
            displayName: action.display_name || action.name || "",
        };
    }

    /**
     * @param {Action} action
     * @returns {ActionMode}
     */
    function _getActionMode(action) {
        if (action.target === "new") {
            // No possible override for target="new"
            return "new";
        }
        if (action.type === "ir.actions.client") {
            const clientAction = actionRegistry.get(action.tag);
            if (clientAction.target) {
                // Target is forced by the definition of the client action
                return clientAction.target;
            }
        }
        if (controllerStack.some((c) => c.action.target === "fullscreen")) {
            // Force fullscreen when one of the controllers is set to fullscreen
            return "fullscreen";
        }
        // Default: current
        return "current";
    }

    /**
     * @private
     * @returns {SwitchViewParams | null}
     */
    function _getSwitchViewParams() {
        const state = router.current;
        if (state.action && !actionRegistry.contains(state.action)) {
            const currentController = controllerStack[controllerStack.length - 1];
            const currentActionId = currentController?.action?.id;
            // Window Action: determines model, viewType etc....
            if (
                currentController &&
                currentController.action.type === "ir.actions.act_window" &&
                currentActionId === state.action
            ) {
                const props = {
                    resId: state.id || false,
                };
                const viewType = state.view_type || currentController.view.type;
                return { viewType, props };
            }
        }
        return null;
    }

    /**
     * @param {BaseView} view
     * @param {ActWindowAction} action
     * @param {BaseView[]} views
     * @param {Object} props
     * @returns {{ props: ViewProps, config: Config }}
     */
    function _getViewInfo(view, action, views, props = {}) {
        const target = action.target;
        const viewSwitcherEntries = views
            .filter((v) => v.multiRecord === view.multiRecord)
            .map((v) => {
                const viewSwitcherEntry = {
                    icon: v.icon,
                    name: v.display_name.toString(),
                    type: v.type,
                    multiRecord: v.multiRecord,
                };
                if (view.type === v.type) {
                    viewSwitcherEntry.active = true;
                }
                return viewSwitcherEntry;
            });
        const context = action.context || {};
        let groupBy = context.group_by || [];
        if (typeof groupBy === "string") {
            groupBy = [groupBy];
        }
        const viewProps = Object.assign({}, props, {
            context,
            display: { mode: target === "new" ? "inDialog" : target },
            domain: action.domain || [],
            groupBy,
            loadActionMenus: target !== "new" && target !== "inline",
            loadIrFilters: action.views.some((v) => v[1] === "search"),
            resModel: action.res_model,
            type: view.type,
            selectRecord: async (resId, { activeIds, mode }) => {
                if (target !== "new" && _getView("form")) {
                    await switchView("form", { mode, resId, resIds: activeIds });
                }
            },
            createRecord: async () => {
                if (target !== "new" && _getView("form")) {
                    await switchView("form", { resId: false });
                }
            },
        });

        if (view.type === "form") {
            if (action.target === "new") {
                viewProps.mode = "edit";
                if (!viewProps.onSave) {
                    viewProps.onSave = (record, params) => {
                        if (params && params.closable) {
                            doAction({ type: "ir.actions.act_window_close" });
                        }
                    };
                }
            }
            if (action.flags && "mode" in action.flags) {
                viewProps.mode = action.flags.mode;
            }
        }

        if (target === "inline") {
            viewProps.searchMenuTypes = [];
        }

        const specialKeys = ["help", "useSampleModel", "limit", "count"];
        for (const key of specialKeys) {
            if (key in action) {
                if (key === "help") {
                    viewProps.noContentHelp = action.help;
                } else {
                    viewProps[key] = action[key];
                }
            }
        }

        if (context.search_disable_custom_filters) {
            viewProps.activateFavorite = false;
        }

        // view specific
        if (action.res_id && !viewProps.resId) {
            viewProps.resId = action.res_id;
        }

        viewProps.noBreadcrumbs =
            "no_breadcrumbs" in action.context ? action.context.no_breadcrumbs : target === "new";
        delete action.context.no_breadcrumbs;
        return {
            props: viewProps,
            config: {
                actionId: action.id,
                actionType: "ir.actions.act_window",
                actionFlags: action.flags,
                views: action.views,
                viewSwitcherEntries,
            },
            displayName: action.display_name || action.name || "",
        };
    }

    /**
     * Computes the position of the controller in the nextStack according to options
     * @param {Object} options
     * @param {boolean} [options.clearBreadcrumbs=false]
     * @param {'replaceLast' | 'replaceLastAction'} [options.stackPosition]
     * @param {number} [options.index]
     */
    function _computeStackIndex(options) {
        let index = null;
        if (options.clearBreadcrumbs) {
            index = 0;
        } else if (options.stackPosition === "replaceCurrentAction") {
            const currentController = controllerStack[controllerStack.length - 1];
            if (currentController) {
                index = controllerStack.findIndex(
                    (ct) => ct.action.jsId === currentController.action.jsId
                );
            }
        } else if (options.stackPosition === "replacePreviousAction") {
            let last;
            for (let i = controllerStack.length - 1; i >= 0; i--) {
                const action = controllerStack[i].action.jsId;
                if (!last) {
                    last = action;
                }
                if (action !== last) {
                    last = action;
                    break;
                }
            }
            if (last) {
                index = controllerStack.findIndex((ct) => ct.action.jsId === last);
            }
            // TODO: throw if there is no previous action?
        } else if ("index" in options) {
            index = options.index;
        } else {
            index = controllerStack.length;
        }
        return index;
    }

    /**
     * Triggers a re-rendering with respect to the given controller.
     *
     * @private
     * @param {Controller} controller
     * @param {UpdateStackOptions} options
     * @param {boolean} [options.clearBreadcrumbs=false]
     * @param {number} [options.index]
     * @returns {Promise<Number>}
     */
    async function _updateUI(controller, options = {}) {
        let resolve;
        let reject;
        let dialogCloseResolve;
        let removeDialogFn;
        const currentActionProm = new Promise((_res, _rej) => {
            resolve = _res;
            reject = _rej;
        });
        const action = controller.action;
        let index = _computeStackIndex(options);
        const controllerArray = [controller];
        if (options.lazyController) {
            // TODO SAD: understand this, maybe remove lazyController
            controllerArray.unshift(options.lazyController);
            if (index !== 0 && controllerStack.length > 0) {
                const lastCtrl = controllerStack[index - 1];
                if (
                    lastCtrl.virtual &&
                    lastCtrl.props.viewType !== "form" &&
                    (lastCtrl.action.id === options.lazyController.action.id ||
                        lastCtrl.action.id === options.lazyController.action.path)
                ) {
                    index--;
                }
            }
        }
        const nextStack = controllerStack.slice(0, index).concat(controllerArray);
        // Compute breadcrumbs
        controller.config.breadcrumbs = reactive(
            action.target === "new" ? [] : _getBreadcrumbs(nextStack)
        );
        controller.config.getDisplayName = () => controller.displayName;
        controller.config.setDisplayName = (displayName) => {
            controller.displayName = displayName;
            if (controller === _getCurrentController()) {
                // if not mounted yet, will be done in "mounted"
                env.services.title.setParts({ action: controller.displayName });
            }
            if (action.target !== "new") {
                // This is a hack to force the reactivity when a new displayName is set
                controller.config.breadcrumbs.push(undefined);
                controller.config.breadcrumbs.pop();
            }
        };
        controller.config.historyBack = () => {
            const previousController = controllerStack[controllerStack.length - 2];
            if (previousController && !dialog) {
                restore(previousController.jsId);
            } else {
                _executeCloseAction();
            }
        };

        class ControllerComponent extends Component {
            static template = ControllerComponentTemplate;
            static Component = controller.Component;
            static props = {
                "*": true,
            };
            setup() {
                this.Component = controller.Component;
                this.titleService = useService("title");
                useDebugCategory("action", { action });
                useChildSubEnv({
                    config: controller.config,
                });
                if (action.target !== "new") {
                    this.__beforeLeave__ = new CallbackRecorder();
                    this.__getGlobalState__ = new CallbackRecorder();
                    this.__getLocalState__ = new CallbackRecorder();
                    useBus(env.bus, "CLEAR-UNCOMMITTED-CHANGES", (ev) => {
                        const callbacks = ev.detail;
                        const beforeLeaveFns = this.__beforeLeave__.callbacks;
                        callbacks.push(...beforeLeaveFns);
                    });
                    if (this.constructor.Component !== View) {
                        useChildSubEnv({
                            __beforeLeave__: this.__beforeLeave__,
                            __getGlobalState__: this.__getGlobalState__,
                            __getLocalState__: this.__getLocalState__,
                        });
                    }
                }
                this.isMounted = false;

                onMounted(this.onMounted);
                onWillUnmount(this.onWillUnmount);
                onError(this.onError);
            }
            onError(error) {
                if (this.isMounted) {
                    // the error occurred on the controller which is
                    // already in the DOM, so simply show the error
                    Promise.resolve().then(() => {
                        throw error;
                    });
                } else {
                    reject(error);
                    if (action.target === "new") {
                        removeDialogFn?.();
                    } else {
                        const index = controllerStack.findIndex(
                            (ct) => ct.jsId === controller.jsId
                        );
                        if (index > 0) {
                            // The error occurred while rendering an existing controller,
                            // so go back to the previous controller, of the current faulty one.
                            // This occurs when clicking on the breadcrumbs.
                            return restore(controllerStack[index - 1].jsId);
                        }
                        if (options.lazyController) {
                            // The error occured while rendering a new controller with a lazyController
                            // we render this lazyController instead.
                            const updateUIOptions = { ...options };
                            delete updateUIOptions.lazyController;
                            return _updateUI(options.lazyController, updateUIOptions);
                        }
                        const lastCt = controllerStack[controllerStack.length - 1];
                        if (lastCt) {
                            // the error occurred while rendering a new controller,
                            // so go back to the last non faulty controller
                            // (the error will be shown anyway as the promise
                            // has been rejected)
                            restore(lastCt.jsId);
                        } else {
                            env.bus.trigger("ACTION_MANAGER:UPDATE", {});
                        }
                    }
                }
            }
            onMounted() {
                if (action.target === "new") {
                    dialogCloseProm = new Promise((_r) => {
                        dialogCloseResolve = _r;
                    }).then(() => {
                        dialogCloseProm = undefined;
                    });
                    dialog = nextDialog;
                } else {
                    controller.getGlobalState = () => {
                        const exportFns = this.__getGlobalState__.callbacks;
                        if (exportFns.length) {
                            return Object.assign({}, ...exportFns.map((fn) => fn()));
                        }
                    };
                    controller.getLocalState = () => {
                        const exportFns = this.__getLocalState__.callbacks;
                        if (exportFns.length) {
                            return Object.assign({}, ...exportFns.map((fn) => fn()));
                        }
                    };

                    controllerStack = nextStack; // the controller is mounted, commit the new stack
                    pushState(controllerStack);
                    this.titleService.setParts({ action: controller.displayName });
                    browser.sessionStorage.setItem(
                        "current_action",
                        action._originalAction || "{}"
                    );
                }
                resolve();
                env.bus.trigger("ACTION_MANAGER:UI-UPDATED", _getActionMode(action));
                this.isMounted = true;
            }
            onWillUnmount() {
                if (action.target === "new" && dialogCloseResolve) {
                    dialogCloseResolve();
                }
            }
            get componentProps() {
                const componentProps = { ...this.props };
                if (this.constructor.Component === View) {
                    componentProps.__beforeLeave__ = this.__beforeLeave__;
                    componentProps.__getGlobalState__ = this.__getGlobalState__;
                    componentProps.__getLocalState__ = this.__getLocalState__;
                }
                return componentProps;
            }
        }
        let nextDialog = null;
        if (action.target === "new") {
            const actionDialogProps = {
                ActionComponent: ControllerComponent,
                actionProps: controller.props,
                actionType: action.type,
            };
            if (action.name) {
                actionDialogProps.title = action.name;
            }
            const size = DIALOG_SIZES[action.context.dialog_size];
            if (size) {
                actionDialogProps.size = size;
            }

            const onClose = _removeDialog();
            removeDialogFn = env.services.dialog.add(ActionDialog, actionDialogProps, {
                onClose: () => {
                    const onClose = _removeDialog();
                    if (onClose) {
                        onClose();
                    }
                },
            });
            nextDialog = {
                remove: removeDialogFn,
                onClose: onClose || options.onClose,
            };
            return currentActionProm;
        }

        const currentController = _getCurrentController();
        if (currentController && currentController.getLocalState) {
            currentController.exportedState = currentController.getLocalState();
        }
        if (controller.exportedState) {
            controller.props.state = controller.exportedState;
        }

        // TODO DAM Remarks:
        // this thing seems useless for client actions.
        // restore and switchView (at least) use this --> cannot be done in switchView only
        // if prop globalState has been passed in doAction, since the action is new the prop won't be overridden in l655.
        // if globalState is not useful for client actions --> maybe use that thing in useSetupView instead of useSetupAction?
        // a good thing: the Object.assign seems to reflect the use of "externalState" in legacy Model class --> things should be fine.
        if (currentController && currentController.getGlobalState) {
            currentController.action.globalState = Object.assign(
                {},
                currentController.action.globalState,
                currentController.getGlobalState() // what if this = {}?
            );
        }
        if (controller.action.globalState) {
            controller.props.globalState = controller.action.globalState;
        }

        const closingProm = _executeCloseAction();

        if (options.clearBreadcrumbs && !options.noEmptyTransition) {
            const def = new Deferred();
            env.bus.trigger("ACTION_MANAGER:UPDATE", {
                id: ++id,
                Component: BlankComponent,
                componentProps: {
                    onMounted: () => def.resolve(),
                    withControlPanel: action.type === "ir.actions.act_window",
                },
            });
            await def;
        }
        if (options.onActionReady) {
            options.onActionReady(action);
        }
        controller.__info__ = {
            id: ++id,
            Component: ControllerComponent,
            componentProps: controller.props,
        };
        env.services.dialog.closeAll();
        env.bus.trigger("ACTION_MANAGER:UPDATE", controller.__info__);
        return Promise.all([currentActionProm, closingProm]).then((r) => r[0]);
    }

    // ---------------------------------------------------------------------------
    // ir.actions.act_url
    // ---------------------------------------------------------------------------

    /**
     * Executes actions of type 'ir.actions.act_url', i.e. redirects to the
     * given url.
     *
     * @private
     * @param {ActURLAction} action
     * @param {ActionOptions} options
     */
    function _executeActURLAction(action, options) {
        let url = action.url;
        if (url && !(url.startsWith("http") || url.startsWith("/"))) {
            url = "/" + url;
        }
        if (action.target === "download" || action.target === "self") {
            browser.location.assign(url);
        } else {
            const w = browser.open(url, "_blank");
            if (!w || w.closed || typeof w.closed === "undefined") {
                const msg = _t(
                    "A popup window has been blocked. You may need to change your " +
                        "browser settings to allow popup windows for this page."
                );
                env.services.notification.add(msg, {
                    sticky: true,
                    type: "warning",
                });
            }
            if (action.close) {
                return doAction(
                    { type: "ir.actions.act_window_close" },
                    { onClose: options.onClose }
                );
            } else if (options.onClose) {
                options.onClose();
            }
        }
    }

    // ---------------------------------------------------------------------------
    // ir.actions.act_window
    // ---------------------------------------------------------------------------

    /**
     * Executes an action of type 'ir.actions.act_window'.
     *
     * @private
     * @param {ActWindowAction} action
     * @param {ActionOptions} options
     */
    async function _executeActWindowAction(action, options) {
        const views = [];
        for (const [, type] of action.views) {
            if (type !== "search" && viewRegistry.contains(type)) {
                views.push(viewRegistry.get(type));
            }
        }
        if (!views.length) {
            throw new Error(`No view found for act_window action ${action.id}`);
        }

        let view = options.viewType && views.find((v) => v.type === options.viewType);
        let lazyView;

        if (view && !view.multiRecord) {
            lazyView = views[0].multiRecord ? views[0] : undefined;
        } else if (!view) {
            view = views[0];
        }

        if (env.isSmall) {
            view = _findView(views, view.multiRecord, action.mobile_view_mode) || view;
            if (lazyView) {
                lazyView =
                    _findView(views, lazyView.multiRecord, action.mobile_view_mode) || lazyView;
            }
        }

        const controller = {
            jsId: `controller_${++id}`,
            Component: View,
            action,
            view,
            views,
            ..._getViewInfo(view, action, views, options.props),
        };
        action.controllers[view.type] = controller;

        const updateUIOptions = {
            clearBreadcrumbs: options.clearBreadcrumbs,
            onClose: options.onClose,
            stackPosition: options.stackPosition,
            onActionReady: options.onActionReady,
            noEmptyTransition: options.noEmptyTransition,
        };
        if ("index" in options) {
            updateUIOptions.index = options.index;
        }

        if (lazyView) {
            updateUIOptions.lazyController = {
                jsId: `controller_${++id}`,
                Component: View,
                action,
                view: lazyView,
                views,
                ..._getViewInfo(lazyView, action, views),
            };
        }

        return _updateUI(controller, updateUIOptions);
    }

    /**
     * @private
     * @param {Array} views an array of views
     * @param {boolean} multiRecord true if we search for a multiRecord view
     * @param {string} viewType type of the view to search
     * @returns {Object|undefined} the requested view if it could be found
     */
    function _findView(views, multiRecord, viewType) {
        return views.find((v) => v.type === viewType && v.multiRecord == multiRecord);
    }

    // ---------------------------------------------------------------------------
    // ir.actions.client
    // ---------------------------------------------------------------------------

    /**
     * Executes an action of type 'ir.actions.client'.
     *
     * @private
     * @param {ClientAction} action
     * @param {ActionOptions} options
     */
    async function _executeClientAction(action, options) {
        const clientAction = actionRegistry.get(action.tag);
        if (clientAction.prototype instanceof Component) {
            if (action.target !== "new") {
                const canProceed = await clearUncommittedChanges(env);
                if (!canProceed) {
                    return;
                }
                if (clientAction.target) {
                    action.target = clientAction.target;
                }
            }
            const controller = {
                jsId: `controller_${++id}`,
                Component: clientAction,
                action,
                ..._getActionInfo(action, options.props),
            };
            const updateUIOptions = {
                clearBreadcrumbs: options.clearBreadcrumbs,
                stackPosition: options.stackPosition,
                onClose: options.onClose,
                index: options.index,
                onActionReady: options.onActionReady,
                noEmptyTransition: options.noEmptyTransition,
            };
            if ("index" in options) {
                updateUIOptions.index = options.index;
            }
            return _updateUI(controller, updateUIOptions);
        } else {
            const next = await clientAction(env, action);
            if (next) {
                return doAction(next, options);
            }
        }
    }

    // ---------------------------------------------------------------------------
    // ir.actions.report
    // ---------------------------------------------------------------------------

    function _executeReportClientAction(action, options) {
        const props = Object.assign({}, options.props, {
            data: action.data,
            display_name: action.display_name,
            name: action.name,
            report_file: action.report_file,
            report_name: action.report_name,
            report_url: getReportUrl(action, "html", user.context),
            context: Object.assign({}, action.context),
        });

        const controller = {
            jsId: `controller_${++id}`,
            Component: ReportAction,
            action,
            ..._getActionInfo(action, props),
        };

        const updateUIOptions = {
            clearBreadcrumbs: options.clearBreadcrumbs,
            stackPosition: options.stackPosition,
            onClose: options.onClose,
        };
        if ("index" in options) {
            updateUIOptions.index = options.index;
        }
        return _updateUI(controller, updateUIOptions);
    }

    /**
     * Executes actions of type 'ir.actions.report'.
     *
     * @private
     * @param {ReportAction} action
     * @param {ActionOptions} options
     */
    async function _executeReportAction(action, options) {
        const handlers = registry.category("ir.actions.report handlers").getAll();
        for (const handler of handlers) {
            const result = await handler(action, options, env);
            if (result) {
                return result;
            }
        }
        if (action.report_type === "qweb-html") {
            return _executeReportClientAction(action, options);
        } else if (action.report_type === "qweb-pdf" || action.report_type === "qweb-text") {
            const type = action.report_type.slice(5);
            let success, message;
            env.services.ui.block();
            try {
                const downloadContext = { ...user.context };
                if (action.context) {
                    Object.assign(downloadContext, action.context);
                }
                ({ success, message } = await downloadReport(rpc, action, type, downloadContext));
            } finally {
                env.services.ui.unblock();
            }
            if (message) {
                env.services.notification.add(message, {
                    sticky: true,
                    title: _t("Report"),
                });
            }
            if (!success) {
                return _executeReportClientAction(action, options);
            }
            const { onClose } = options;
            if (action.close_on_report_download) {
                return doAction({ type: "ir.actions.act_window_close" }, { onClose });
            } else if (onClose) {
                onClose();
            }
        } else {
            console.error(
                `The ActionManager can't handle reports of type ${action.report_type}`,
                action
            );
        }
    }

    // ---------------------------------------------------------------------------
    // ir.actions.server
    // ---------------------------------------------------------------------------

    /**
     * Executes an action of type 'ir.actions.server'.
     *
     * @private
     * @param {ServerAction} action
     * @param {ActionOptions} options
     * @returns {Promise<void>}
     */
    async function _executeServerAction(action, options) {
        const runProm = rpc("/web/action/run", {
            action_id: action.id,
            context: makeContext([user.context, action.context]),
        });
        let nextAction = await keepLast.add(runProm);
        if (nextAction.help) {
            nextAction.help = markup(nextAction.help);
        }
        nextAction = nextAction || { type: "ir.actions.act_window_close" };
        return doAction(nextAction, options);
    }

    async function _executeCloseAction(params = {}) {
        let onClose;
        if (dialog) {
            onClose = _removeDialog();
        } else {
            onClose = params.onClose;
        }
        if (onClose) {
            await onClose(params.onCloseInfo);
        }

        return dialogCloseProm;
    }

    // ---------------------------------------------------------------------------
    // public API
    // ---------------------------------------------------------------------------

    /**
     * Main entry point of a 'doAction' request. Loads the action and executes it.
     *
     * @param {ActionRequest} actionRequest
     * @param {ActionOptions} options
     * @returns {Promise<number | undefined | void>}
     */
    async function doAction(actionRequest, options = {}) {
        const actionProm = _loadAction(actionRequest, options.additionalContext);
        let action = await keepLast.add(actionProm);
        action = _preprocessAction(action, options.additionalContext);
        options.clearBreadcrumbs = action.target === "main" || options.clearBreadcrumbs;
        switch (action.type) {
            case "ir.actions.act_url":
                return _executeActURLAction(action, options);
            case "ir.actions.act_window":
                if (action.target !== "new") {
                    const canProceed = await clearUncommittedChanges(env);
                    if (!canProceed) {
                        return new Promise(() => {});
                    }
                }
                return _executeActWindowAction(action, options);
            case "ir.actions.act_window_close":
                return _executeCloseAction({ onClose: options.onClose, onCloseInfo: action.infos });
            case "ir.actions.client":
                return _executeClientAction(action, options);
            case "ir.actions.report":
                return _executeReportAction(action, options);
            case "ir.actions.server":
                return _executeServerAction(action, options);
            default: {
                const handler = actionHandlersRegistry.get(action.type, null);
                if (handler !== null) {
                    return handler({ env, action, options });
                }
                throw new Error(
                    `The ActionManager service can't handle actions of type ${action.type}`
                );
            }
        }
    }

    /**
     * Executes an action on top of the current one (typically, when a button in a
     * view is clicked). The button may be of type 'object' (call a given method
     * of a given model) or 'action' (execute a given action). Alternatively, the
     * button may have the attribute 'special', and in this case an
     * 'ir.actions.act_window_close' is executed.
     *
     * @param {DoActionButtonParams} params
     * @returns {Promise<void>}
     */
    async function doActionButton(params) {
        // determine the action to execute according to the params
        let action;
        const context = makeContext([params.context, params.buttonContext]);
        if (params.special) {
            action = { type: "ir.actions.act_window_close", infos: { special: true } };
        } else if (params.type === "object") {
            // call a Python Object method, which may return an action to execute
            let args = params.resId ? [[params.resId]] : [params.resIds];
            if (params.args) {
                let additionalArgs;
                try {
                    // warning: quotes and double quotes problem due to json and xml clash
                    // maybe we should force escaping in xml or do a better parse of the args array
                    additionalArgs = JSON.parse(params.args.replace(/'/g, '"'));
                } catch {
                    browser.console.error("Could not JSON.parse arguments", params.args);
                }
                args = args.concat(additionalArgs);
            }
            const callProm = rpc(`/web/dataset/call_button/${params.resModel}/${params.name}`, {
                args,
                kwargs: { context },
                method: params.name,
                model: params.resModel,
            });
            action = await keepLast.add(callProm);
            action =
                action && typeof action === "object"
                    ? action
                    : { type: "ir.actions.act_window_close" };
            if (action.help) {
                action.help = markup(action.help);
            }
        } else if (params.type === "action") {
            // execute a given action, so load it first
            context.active_id = params.resId || null;
            context.active_ids = params.resIds;
            context.active_model = params.resModel;
            action = await keepLast.add(_loadAction(params.name, context));
        } else {
            throw new InvalidButtonParamsError("Missing type for doActionButton request");
        }
        // filter out context keys that are specific to the current action, because:
        //  - wrong default_* and search_default_* values won't give the expected result
        //  - wrong group_by values will fail and forbid rendering of the destination view
        const currentCtx = {};
        for (const key in params.context) {
            if (key.match(CTX_KEY_REGEX) === null) {
                currentCtx[key] = params.context[key];
            }
        }
        const activeCtx = { active_model: params.resModel };
        if (params.resId) {
            activeCtx.active_id = params.resId;
            activeCtx.active_ids = [params.resId];
        }
        action.context = makeContext([currentCtx, params.buttonContext, activeCtx, action.context]);
        // in case an effect is returned from python and there is already an effect
        // attribute on the button, the priority is given to the button attribute
        const effect = params.effect ? evaluateExpr(params.effect) : action.effect;
        const options = { onClose: params.onClose };
        await doAction(action, options);
        if (params.close) {
            await _executeCloseAction();
        }
        if (effect) {
            env.services.effect.add(effect);
        }
    }

    /**
     * Switches to the given view type in action of the last controller of the
     * stack. This action must be of type 'ir.actions.act_window'.
     *
     * @param {ViewType} viewType
     * @param {Object} [props={}]
     * @throws {ViewNotFoundError} if the viewType is not found on the current action
     * @returns {Promise<Number>}
     */
    async function switchView(viewType, props = {}) {
        await keepLast.add(Promise.resolve());
        if (dialog) {
            // we don't want to switch view when there's a dialog open, as we would
            // not switch in the correct action (action in background != dialog action)
            return;
        }
        const controller = controllerStack[controllerStack.length - 1];
        const view = _getView(viewType);
        if (!view) {
            throw new ViewNotFoundError(
                _t("No view of type '%s' could be found in the current action.", viewType)
            );
        }
        const newController = controller.action.controllers[viewType] || {
            jsId: `controller_${++id}`,
            Component: View,
            action: controller.action,
            views: controller.views,
            view,
        };

        const canProceed = await clearUncommittedChanges(env);
        if (!canProceed) {
            return;
        }

        Object.assign(
            newController,
            _getViewInfo(view, controller.action, controller.views, props)
        );
        controller.action.controllers[viewType] = newController;
        let index;
        if (view.multiRecord) {
            index = controllerStack.findIndex((ct) => ct.action.jsId === controller.action.jsId);
            index = index > -1 ? index : controllerStack.length - 1;
        } else {
            // This case would mostly happen when loadState detects a change in the URL.
            // Also, I guess we may need it when we have other monoRecord views
            index = controllerStack.findIndex(
                (ct) => ct.action.jsId === controller.action.jsId && !ct.view.multiRecord
            );
            index = index > -1 ? index : controllerStack.length;
        }
        return _updateUI(newController, { index });
    }

    /**
     * Restores a controller from the controller stack given its id. Typically,
     * this function is called when clicking on the breadcrumbs. If no id is given
     * restores the previous controller from the stack (penultimate).
     *
     * @param {string} jsId
     */
    async function restore(jsId) {
        await keepLast.add(Promise.resolve());
        let index;
        if (!jsId) {
            index = controllerStack.length - 2;
        } else {
            index = controllerStack.findIndex((controller) => controller.jsId === jsId);
        }
        if (index < 0) {
            const msg = jsId ? "Invalid controller to restore" : "No controller to restore";
            throw new ControllerNotFoundError(msg);
        }
        const canProceed = await clearUncommittedChanges(env);
        if (!canProceed) {
            return;
        }
        const controller = controllerStack[index];
        if (controller.virtual) {
            const actionParams = _getActionParams(controller.state);
            if (actionParams) {
                // Params valid => performs a "doAction"
                const { actionRequest, options } = actionParams;
                options.index = index;
                await doAction(actionRequest, options);
                return true;
            }
        }
        if (controller.action.type === "ir.actions.act_window") {
            const { action, exportedState, view, views } = controller;
            const props = { ...controller.props };
            if (exportedState && "resId" in exportedState) {
                // When restoring, we want to use the last exported ID of the controller
                props.resId = exportedState.resId;
            }
            Object.assign(controller, _getViewInfo(view, action, views, props));
        }
        return _updateUI(controller, { index });
    }

    /**
     * Performs a "doAction" or a "switchView" and restores a stack of virtual
     * controllers from the current contents of the URL.
     *
     * @returns {Promise<boolean>} true if doAction or switchView was performed
     */
    async function loadState() {
        // FIXME are we losing important controller state here?
        // In master and under we lose breadcrumbs on back/fw
        controllerStack = _controllersFromState();
        const switchViewParams = _getSwitchViewParams();
        if (switchViewParams) {
            // only when we already have an action in dom
            const { viewType, props } = switchViewParams;
            const view = _getView(viewType);
            if (view) {
                // Params valid and view found => performs a "switchView"
                await switchView(viewType, props);
                return true;
            }
            return false;
        }
        const actionParams = _getActionParams();
        if (actionParams) {
            // Params valid => performs a "doAction"
            const { actionRequest, options } = actionParams;
            await doAction(actionRequest, options);
            return true;
        }
    }

    function pushState(controllerStack) {
        const newState = {};
        const actions = [];
        const lastCtrl = controllerStack[controllerStack.length - 1];
        if (lastCtrl.action.tag === "menu") {
            router.pushState(
                {
                    actionStack: undefined,
                },
                { replace: true }
            );
            return;
        }
        for (const controller of controllerStack) {
            const action = controller.action;
            const props = controller.props;
            const actionState = {};
            if (action.id) {
                actionState.action = action.path || action.id;
            } else if (action.type === "ir.actions.client") {
                actionState.action = action.tag;
            } else if (action.type === "ir.actions.act_window") {
                actionState.model = props.resModel;
            }
            if (action.type === "ir.actions.act_window") {
                if (props.resId || (props.state && props.state.resId)) {
                    actionState.resId = props.resId || (props.state && props.state.resId);
                }
                actionState.view_type = props.type;
                if (actionState.view_type === "form" && !actionState.resId) {
                    actionState.resId = "new";
                }
            }
            if (action.context) {
                const activeId = action.context.active_id;
                if (activeId) {
                    actionState.active_id = activeId;
                }
                const activeIds = action.context.active_ids;
                // we don't push active_ids if it's a single element array containing
                // the active_id to make the url shorter in most cases
                if (activeIds && !(activeIds.length === 1 && activeIds[0] === activeId)) {
                    actionState.active_ids = activeIds.join(",");
                }
            }
            actions.push(actionState);
        }
        if (actions.length) {
            newState.actionStack = actions;
            Object.assign(
                newState,
                pick(newState.actionStack.at(-1), "action", "model", "active_id")
            );
        }
        if (
            lastCtrl.action.type === "ir.actions.act_window" &&
            lastCtrl.props.type !== "form" &&
            lastCtrl.props.type !== lastCtrl.action.views[0][1]
        ) {
            newState.view_type = lastCtrl.props.type;
        }
        router.pushState(newState, { replace: true });
    }
    return {
        doAction,
        doActionButton,
        switchView,
        restore,
        loadState,
        async loadAction(actionRequest, context) {
            const action = await _loadAction(actionRequest, context);
            return _preprocessAction(action, context);
        },
        get currentController() {
            return _getCurrentController();
        },
    };
}

export const actionService = {
    dependencies: ["dialog", "effect", "localization", "notification", "title", "ui"],
    start(env) {
        return makeActionManager(env);
    },
};

registry.category("services").add("action", actionService);
