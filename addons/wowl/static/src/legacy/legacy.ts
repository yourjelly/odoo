import { Component, hooks, tags } from "@odoo/owl";
import { ClientActionProps, OdooEnv, ViewProps, Service, ViewId, ViewType, MenuElement } from "../types";
import { useService } from "../core/hooks";
import { useSetupAction } from "../action_manager/action_manager";
import { actionRegistry } from "../action_manager/action_registry";
import { viewRegistry } from "../views/view_registry";
import { Context } from "../core/context";
import { useDebugManager } from "../components/debug_manager/debug_manager";
import { DebuggingAccessRights, editModelDebug } from "../services/debug_manager";
import { ActWindowAction, ClientAction } from "../action_manager/action_manager";


declare const odoo: any;

export function makeLegacyActionManagerService(legacyEnv: any): Service<void> {
  // add a service to redirect 'do-action' events triggered on the bus in the
  // legacy env to the action-manager service in the wowl env
  return {
    name: "legacy_action_manager",
    dependencies: ["action_manager"],
    deploy(env: OdooEnv): void {
      legacyEnv.bus.on("do-action", null, (payload: any) => {
        env.services.action_manager.doAction(payload.action, payload.options || {});
      });
    },
  };
}

export function makeLegacyRpcService(legacyEnv: any): Service<void> {
  return {
    name: "legacy_rpc",
    deploy(env: OdooEnv): void {
      legacyEnv.bus.on("rpc_request", null, (rpcId: number) => {
        env.bus.trigger("RPC:REQUEST", rpcId);
      });
      legacyEnv.bus.on("rpc_response", null, (rpcId: number) => {
        env.bus.trigger("RPC:RESPONSE", rpcId);
      });
      legacyEnv.bus.on("rpc_response_failed", null, (rpcId: number) => {
        env.bus.trigger("RPC:RESPONSE", rpcId);
      });
    },
  };
}

export function makeLegacySessionService(legacyEnv: any, session: any): Service<void> {
  return {
    name: "legacy_session",
    deploy(env: OdooEnv): void {
      // userContext
      const userContext = Object.create(env.services.user.context);
      legacyEnv.session.userContext = userContext;
      // usually core.session
      session.user_context = userContext;
    },
  };
}

export function mapLegacyEnvToWowlEnv(legacyEnv: any, wowlEnv: OdooEnv) {
  // rpc
  legacyEnv.session.rpc = (...args: any[]) => {
    let rejection;
    const prom = new Promise((resolve, reject) => {
      rejection = () => reject();
      const [route, params, settings] = args;
      wowlEnv.services.rpc(route, params, settings).then(resolve).catch(reject);
    });
    (prom as any).abort = rejection;
    return prom;
  };
  // localStorage
  const localStorage = odoo.browser.localStorage;
  legacyEnv.services.local_storage = Object.assign(Object.create(localStorage), {
    getItem(key: string, defaultValue: any) {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    },
    setItem(key: string, value: any) {
      localStorage.setItem(key, JSON.stringify(value));
    },
  });
  // map WebClientReady
  wowlEnv.bus.on("WEB_CLIENT_READY", null, () => {
    legacyEnv.bus.trigger("web_client_ready");
  });
}

interface ComponentAdapter extends Component {
  _trigger_up(ev: any): void;
  widget: any;
}

odoo.define("wowl.ActionAdapters", function (require: any) {
  const {
    ComponentAdapter,
  }: { ComponentAdapter: Type<ComponentAdapter> } = require("web.OwlCompatibility");
  class ActionAdapter extends ComponentAdapter {
    am = useService("action_manager");

    _trigger_up(ev: any) {
      const payload = ev.data;
      if (ev.name === "do_action") {
        this.am.doAction(payload.action);
      } else if (ev.name === "breadcrumb_clicked") {
        this.am.restore(payload.controllerID);
      } else {
        super._trigger_up(ev);
      }
    }

    /**
     * This function is called just before the component will be unmounted,
     * because it will be replaced by another one. However, we need to keep it
     * alive, because we might come back to this one later. We thus return the
     * widget instance, and set this.widget to null so that it is not destroyed
     * by the compatibility layer. That instance will be destroyed by the
     * ActionManager service when it will be removed from the controller stack,
     * and if we ever come back to that controller, the instance will be given
     * in props so that we can re-use it.
     */
    exportState() {
      const widget = this.widget;
      this.widget = null;
      return { __legacy_widget__: widget };
    }
  }

  class ClientActionAdapter extends ActionAdapter {
    constructor(parent: Component, props: any) {
      super(parent, props);
      const envWowl = <OdooEnv>this.env;
      useDebugManager((accessRights: DebuggingAccessRights) =>
        setupDebugAction(accessRights, envWowl, this.props.widgetArgs[0])
      );
      this.env = Component.env;
    }
    async willStart() {
      if (this.props.widget) {
        this.widget = this.props.widget;
        return this.widget.do_show();
      }
      return super.willStart();
    }

    do_push_state() {}
  }

  class ViewAdapter extends ActionAdapter {
    model = useService("model");
    am = useService("action_manager");
    vm = useService("view_manager");
    widget: any;
    constructor(...args: any[]) {
      super(...args);
      const envWowl = <OdooEnv>this.env;
      useDebugManager((accessRights: DebuggingAccessRights) =>
        setupDebugAction(accessRights, envWowl, this.props.viewParams.action)
      );
      useDebugManager((accessRights: DebuggingAccessRights) =>
        setupDebugView(accessRights, envWowl, this, this.props.viewParams.action)
      );
      if (this.props.viewInfo.type === "form") {
        useDebugManager((accessRights: DebuggingAccessRights) =>
          setupDebugViewForm(envWowl, this, this.props.viewParams.action)
        );
      }
      this.env = Component.env;
    }
    async willStart() {
      if (this.props.widget) {
        this.widget = this.props.widget;
        const options = Object.assign({}, this.props.viewParams, {
          shouldUpdateSearchComponents: true,
        });
        return this.widget.reload(options);
      } else {
        const view = new this.props.View(this.props.viewInfo, this.props.viewParams);
        this.widget = await view.getController(this);
        return this.widget._widgetRenderAndInsert(() => {});
      }
    }

    /**
     * Override to add the state of the legacy controller in the exported state.
     */
    exportState() {
      const widgetState = this.widget.exportState();
      const state = super.exportState();
      return Object.assign({}, state, widgetState);
    }

    async loadViews(model: string, context: Context, views: [ViewId, ViewType][]) {
      return (await this.vm.loadViews({ model, views, context }, {})).fields_views;
    }

    /**
     * @private
     * @param {OdooEvent} ev
     */
    _trigger_up(ev: any) {
      const payload = ev.data;
      if (ev.name === "switch_view") {
        const state = ev.target.exportState();
        this.am.switchView(payload.view_type, {
          recordId: payload.res_id,
          recordIds: state.resIds,
          searchModel: state.searchModel,
          searchPanel: state.searchPanel,
        });
      } else if (ev.name === "execute_action") {
        this.am.doActionButton({
          args: payload.action_data.args,
          buttonContext: payload.action_data.context,
          context: payload.env.context,
          model: payload.env.model,
          name: payload.action_data.name,
          recordId: payload.env.currentID || null,
          recordIds: payload.env.resIDs,
          special: payload.action_data.special,
          type: payload.action_data.type,
        });
      } else {
        super._trigger_up(ev);
      }
    }
  }

  return { ClientActionAdapter, ViewAdapter };
});

odoo.define("wowl.legacyClientActions", function (require: any) {
  const { action_registry } = require("web.core");
  const { ClientActionAdapter } = require("wowl.ActionAdapters");
  const Widget = require("web.Widget");

  // registers an action from the legacy action registry to the wowl one, ensuring
  // that widget actions are actually Components
  function registerClientAction(name: string, action: any) {
    if ((action as any).prototype instanceof Widget) {
      // the action is a widget, wrap it into a Component and register that component
      class Action extends Component<ClientActionProps, OdooEnv> {
        static template = tags.xml`<ClientActionAdapter Component="Widget" widgetArgs="widgetArgs" widget="widget" t-ref="controller"/>`;
        static components = { ClientActionAdapter };

        controllerRef = hooks.useRef("controller");

        Widget = action;
        widgetArgs = [this.props.action, {}];
        widget = this.props.state && this.props.state.__legacy_widget__;

        constructor() {
          super(...arguments);
          useSetupAction({
            export: () => (this.controllerRef.comp! as any).exportState(),
          });
        }
      }
      actionRegistry.add(name, Action);
    } else {
      // the action is either a Component or a function, register it directly
      actionRegistry.add(name, action as any);
    }
  }

  // register action already in the legacy registry, and listens to future registrations
  for (const [name, action] of Object.entries(action_registry.entries())) {
    if (!actionRegistry.contains(name)) {
      registerClientAction(name, action);
    }
  }
  action_registry.onAdd(registerClientAction);
});

odoo.define("wowl.legacyViews", async function (require: any) {
  const legacyViewRegistry = require("web.view_registry");
  const { ViewAdapter } = require("wowl.ActionAdapters");
  const Widget = require("web.Widget");

  // registers a view from the legacy view registry to the wowl one, but wrapped
  // into an Owl Component
  function registerView(name: string, LegacyView: any) {
    class Controller extends Component<ViewProps, OdooEnv> {
      static template = tags.xml`
        <ViewAdapter Component="Widget" View="View" viewInfo="viewInfo" viewParams="viewParams" widget="widget" t-ref="controller"/>
      `;
      static components = { ViewAdapter };
      static display_name = LegacyView.prototype.display_name;
      static icon = LegacyView.prototype.icon;
      static multiRecord = LegacyView.prototype.multi_record;
      static type = LegacyView.prototype.viewType;

      vm = useService("view_manager");
      controllerRef = hooks.useRef("controller");

      Widget = Widget; // fool the ComponentAdapter with a simple Widget
      View = LegacyView;
      viewInfo: any = {};
      viewParams = {
        action: this.props.action,
        // legacy views automatically add the last part of the breadcrumbs
        breadcrumbs:
          this.props.breadcrumbs &&
          this.props.breadcrumbs.slice(0, this.props.breadcrumbs.length - 1).map((bc) => {
            return { title: bc.name, controllerID: bc.jsId };
          }),
        modelName: this.props.model,
        currentId: this.props.recordId,
        controllerState: {
          currentId: this.props.recordId || (this.props.state && this.props.state.currentId),
          resIds: this.props.recordIds || (this.props.state && this.props.state.resIds),
          searchModel: this.props.searchModel || (this.props.state && this.props.state.searchModel),
          searchPanel: this.props.searchPanel || (this.props.state && this.props.state.searchPanel),
        },
      };
      widget = this.props.state && this.props.state.__legacy_widget__;

      constructor() {
        super(...arguments);
        useSetupAction({
          export: () => (this.controllerRef.comp! as any).exportState(),
        });
      }

      async willStart() {
        const params = {
          model: this.props.model,
          views: this.props.views,
          context: this.props.context,
        };
        const options = {
          actionId: this.props.actionId,
          context: this.props.context,
          withActionMenus: this.props.withActionMenus,
          withFilters: this.props.withFilters,
        };
        const result: any = await this.vm.loadViews(params, options);
        const fieldsInfo = result.fields_views[this.props.type];
        this.viewInfo = Object.assign({}, fieldsInfo, {
          fields: result.fields,
          viewFields: fieldsInfo.fields,
        });
        let controlPanelFieldsView;
        if (result.fields_views.search) {
          controlPanelFieldsView = Object.assign({}, result.fields_views.search, {
            favoriteFilters: result.filters,
            fields: result.fields,
            viewFields: result.fields_views.search.fields,
          });
        }
        this.viewParams.action = Object.assign({}, this.viewParams.action, {
          controlPanelFieldsView,
          _views: this.viewParams.action.views,
          views: this.props.viewSwitcherEntries,
        });
      }
    }

    if (!viewRegistry.contains(name)) {
      viewRegistry.add(name, Controller);
    }
  }
  // register views already in the legacy registry, and listens to future registrations
  for (const [name, action] of Object.entries(legacyViewRegistry.entries())) {
    registerView(name, action);
  }
  legacyViewRegistry.onAdd(registerView);
});

export function setupDebugAction(
  accessRights: DebuggingAccessRights,
  env: OdooEnv,
  action: ClientAction | ActWindowActionAdapted
): MenuElement[] {
  const actionSeparator: MenuElement = {
    type: "separator",
    sequence: 100,
  };

  let description = env._t("Edit Action");
  const editAction: MenuElement = {
    type: "item",
    description: description,
    callback: () => {
      console.log("Edit Action");
      // edit in debug_manager_backend
      editModelDebug(env, description, action.type, action.id as number);
    },
    sequence: 110,
  };

  description = env._t("View Fields");
  const viewFields: MenuElement = {
    type: "item",
    description: description,
    callback: async () => {
      console.log("View Fields");
      const modelId = (
        await env.services
          .model("ir.model")
          .search([["model", "=", action.res_model as string]], { limit: 1 })
      )[0];

      env.services.action_manager.doAction({
        res_model: "ir.model.fields",
        name: description,
        views: [
          [false, "list"],
          [false, "form"],
        ],
        domain: [["model_id", "=", modelId]],
        type: "ir.actions.act_window",
        context: {
          default_model_id: modelId,
        },
      });
    },
    sequence: 120,
  };

  description = env._t("Manage Filters");
  const manageFilters: MenuElement = {
    type: "item",
    description: description,
    callback: () => {
      // manage_filters
      env.services.action_manager.doAction({
        res_model: "ir.filters",
        name: description,
        views: [
          [false, "list"],
          [false, "form"],
        ],
        type: "ir.actions.act_window",
        context: {
          search_default_my_filters: true,
          search_default_model_id: action.res_model,
        },
      });
    },
    sequence: 130,
  };

  const technicalTranslation: MenuElement = {
    type: "item",
    description: env._t("Technical Translation"),
    callback: () => {
      console.log("Technical Translation");
      //translate
      env.services
        .model("ir.translation")
        .call("get_technical_translations", [action.res_model])
        .then(env.services.action_manager.doAction);
    },
    sequence: 140,
  };

  const accessSeparator: MenuElement = {
    type: "separator",
    sequence: 200,
  };

  description = env._t("View Access Rights");
  const viewAccessRights: MenuElement = {
    type: "item",
    description: description,
    callback: async () => {
      console.log("View Access Rights");
      //actionModelAccess
      const modelId = (
        await env.services
          .model("ir.model")
          .search([["model", "=", action.res_model as string]], { limit: 1 })
      )[0];

      env.services.action_manager.doAction({
        res_model: "ir.model.access",
        name: description,
        views: [
          [false, "list"],
          [false, "form"],
        ],
        domain: [["model_id", "=", modelId]],
        type: "ir.actions.act_window",
        context: {
          default_model_id: modelId,
        },
      });
    },
    sequence: 210,
  };

  description = env._t("Model Record Rules");
  const viewRecordRules: MenuElement = {
    type: "item",
    description: env._t("View Record Rules"),
    callback: async () => {
      console.log("View Record Rules");
      //actionRecordRules
      const modelId = (
        await env.services
          .model("ir.model")
          .search([["model", "=", action.res_model as string]], { limit: 1 })
      )[0];
      env.services.action_manager.doAction({
        res_model: "ir.rule",
        name: description,
        views: [
          [false, "list"],
          [false, "form"],
        ],
        domain: [["model_id", "=", modelId]],
        type: "ir.actions.act_window",
        context: {
          default_model_id: modelId,
        },
      });
    },
    sequence: 220,
  };

  const result: MenuElement[] = [actionSeparator];
  if (action.id) {
    result.push(editAction);
  }
  if (action.res_model) {
    result.push(viewFields);
    result.push(manageFilters);
    result.push(technicalTranslation);

    if (accessRights.canSeeModelAccess || accessRights.canSeeRecordRules) {
      result.push(accessSeparator);
      if (accessRights.canSeeModelAccess) {
        result.push(viewAccessRights);
      }
      if (accessRights.canSeeRecordRules) {
        result.push(viewRecordRules);
      }
    }
  }

  return result;
}

interface ActWindowActionAdapted extends Omit<ActWindowAction, "views"> {
  _views: ActWindowAction["views"];
  views: {
    type: string;
    name: string;
  }[];
}

export function setupDebugView(
  accessRights: DebuggingAccessRights,
  env: OdooEnv,
  component: ComponentAdapter,
  action: ActWindowActionAdapted
): MenuElement[] {
  const viewId = component.props.viewInfo.view_id;

  const viewSeparator: MenuElement = {
    type: "separator",
    sequence: 300,
  };

  const fieldsViewGet: MenuElement = {
    type: "item",
    description: env._t("Fields View Get"),
    callback: () => {
      console.log("Fields View Get");
      // fvg
      // Need Arch
    },
    sequence: 340,
  };

  const displayName = action
    .views!.find((v) => v.type === component.widget.viewType)!
    .name.toString();
  let description = env._t("Edit View: ") + displayName;
  const editView: MenuElement = {
    type: "item",
    description: description,
    callback: () => {
      console.log("Edit View:");
      // edit
      editModelDebug(env, description, "ir.ui.view", viewId);
    },
    sequence: 350,
  };

  description = env._t("Edit ControlPanelView");
  const editControlPanelView: MenuElement = {
    type: "item",
    description: description,
    callback: () => {
      console.log("Edit ControlPanelView");
      editModelDebug(
        env,
        description,
        "ir.ui.view",
        component.props.viewParams.action.controlPanelFieldsView.view_id
      );
    },
    sequence: 360,
  };

  const result = [viewSeparator, fieldsViewGet];
  if (accessRights.canEditView) {
    result.push(editView);
    result.push(editControlPanelView);
  }

  return result;
}

export function setupDebugViewForm(
  env: OdooEnv,
  component: ComponentAdapter,
  action: ActWindowActionAdapted
): MenuElement[] {
  const setDefaults: MenuElement = {
    type: "item",
    description: env._t("Set Defaults"),
    callback: () => {
      console.log("Set Defaults");
      // set_defaults
      // need this._controller.renderer (_controller == widget)
    },
    sequence: 310,
  };

  const viewMetadata: MenuElement = {
    type: "item",
    description: env._t("View Metadata"),
    hide: component.widget.getSelectedIds().length !== 1,
    callback: () => {
      console.log("View Metadata");
      // get_metadata
      // need getSelectedIds
    },
    sequence: 320,
  };

  const description = env._t("Manage Attachments");
  const manageAttachments: MenuElement = {
    type: "item",
    description: description,
    hide: component.widget.getSelectedIds().length !== 1,
    callback: () => {
      console.log("Manage Attachments");
      //get_attachments
      // need getSelectedIds
      if (!component.widget.getSelectedIds().length) {
        console.warn(env._t("No attachment available"));
        return;
      }
      const selectedId = component.widget.getSelectedIds()[0];
      env.services.action_manager.doAction({
        res_model: "ir.attachment",
        name: description,
        views: [
          [false, "list"],
          [false, "form"],
        ],
        type: "ir.actions.act_window",
        domain: [
          ["res_model", "=", action.res_model],
          ["res_id", "=", selectedId],
        ],
        context: {
          default_res_model: action.res_model,
          default_res_id: selectedId,
        },
      });
    },
    sequence: 330,
  };

  const result = [setDefaults];
  if (component.widget.getSelectedIds().length === 1) {
    result.push(viewMetadata);
    result.push(manageAttachments);
  }

  return result;
}
