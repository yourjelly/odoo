import { Component } from "@odoo/owl";
import { CrashManager } from "./components/crash_manager/crash_manager";
import { LoadingIndicator } from "./components/loading_indicator/loading_indicator";
import {
  Error504Dialog,
  RedirectWarningDialog,
  SessionExpiredDialog,
  WarningDialog,
} from "./components/error_dialogs/error_dialogs";
import { userMenuItem } from "./components/user_menu/user_menu";
import { _lt } from "./core/localization";
import { Registry } from "./core/registry";
import { actionManagerService } from "./services/action_manager/action_manager";
import { menusService } from "./services/menus";
import { modelService } from "./services/model";
import { notificationService } from "./services/notifications";
import { routerService } from "./services/router";
import { rpcService } from "./services/rpc";
import { uiService } from "./services/ui/ui";
import { userService } from "./services/user";
import { viewManagerService } from "./services/view_manager";
import { ComponentAction, FunctionAction, Service, SystrayItem, Type, View } from "./types";
import { FormView } from "./views/form_view";
import { GraphView } from "./views/graph_view";
import { KanbanView } from "./views/kanban_view";
import { ListView } from "./views/list_view";
import { PivotView } from "./views/pivot_view";

// -----------------------------------------------------------------------------
// Services
// -----------------------------------------------------------------------------

// Services registered in this registry will be deployed in the env. A component
// can then call the hook 'useService' in init with the name of the service it
// needs.
export const serviceRegistry: Registry<Service<any>> = new Registry();

const services = [
  actionManagerService,
  menusService,
  modelService,
  notificationService,
  routerService,
  rpcService,
  uiService,
  userService,
  viewManagerService,
];

for (let service of services) {
  serviceRegistry.add(service.name, service);
}

// -----------------------------------------------------------------------------
// Main Components
// -----------------------------------------------------------------------------

// Components registered in this registry will be rendered inside the root node
// of the webclient.
export const mainComponentRegistry: Registry<Type<Component>> = new Registry();

mainComponentRegistry.add("CrashManager", CrashManager);
mainComponentRegistry.add("LoadingIndicator", LoadingIndicator);

// -----------------------------------------------------------------------------
// Client Actions
// -----------------------------------------------------------------------------

// This registry contains client actions. A client action can be either a
// Component or a function. In the former case, the given Component will be
// instantiated and mounted in the DOM. In the latter, the function will be
// executed
export const actionRegistry: Registry<ComponentAction | FunctionAction> = new Registry();

// -----------------------------------------------------------------------------
// Views
// -----------------------------------------------------------------------------

const views: View[] = [FormView, GraphView, KanbanView, ListView, PivotView];

export const viewRegistry: Registry<View> = new Registry();

for (let view of views) {
  viewRegistry.add(view.name, view);
}

// -----------------------------------------------------------------------------
// Systray
// -----------------------------------------------------------------------------

export const systrayRegistry: Registry<SystrayItem> = new Registry();

systrayRegistry.add("wowl.user_menu", userMenuItem);

// -----------------------------------------------------------------------------
// Custom Dialogs for CrashManager
// -----------------------------------------------------------------------------

export const errorDialogRegistry: Registry<Type<Component>> = new Registry();

errorDialogRegistry.add("odoo.exceptions.AccessDenied", WarningDialog);
errorDialogRegistry.add("odoo.exceptions.AccessError", WarningDialog);
errorDialogRegistry.add("odoo.exceptions.MissingError", WarningDialog);
errorDialogRegistry.add("odoo.exceptions.UserError", WarningDialog);
errorDialogRegistry.add("odoo.exceptions.ValidationError", WarningDialog);
errorDialogRegistry.add("odoo.exceptions.RedirectWarning", RedirectWarningDialog);
errorDialogRegistry.add("odoo.http.SessionExpiredException", SessionExpiredDialog);
errorDialogRegistry.add("werkzeug.exceptions.Forbidden", SessionExpiredDialog);
errorDialogRegistry.add("504", Error504Dialog);
