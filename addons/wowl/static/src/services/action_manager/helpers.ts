import { Component } from "@odoo/owl";
import { OdooEnv, Type, View } from "./../../types";

type ActionType =
  | "ir.actions.act_url"
  | "ir.actions.act_window"
  | "ir.actions.act_window_close"
  | "ir.actions.client"
  | "ir.actions.report"
  | "ir.actions.server";
type ActionTarget = "current" | "main" | "new" | "fullscreen" | "inline";

type ActionId = number;
type ActionXMLId = string;
type ActionTag = string;
interface ActionDescription {
  target: ActionTarget;
  type: ActionType;
  [key: string]: any;
}
export type ActionRequest = ActionId | ActionXMLId | ActionTag | ActionDescription;
export interface ActionOptions {
  clearBreadcrumbs?: boolean;
}

export interface Action {
  id?: number;
  jsId: string;
  name: string;
  context: object;
  target: "current";
  type: ActionType;
}
export interface ClientAction extends Action {
  tag: string;
  type: "ir.actions.client";
}
type ViewId = number | false;
type ViewType = string;
export interface ActWindowAction extends Action {
  id: number;
  type: "ir.actions.act_window";
  res_model: string;
  views: [ViewId, ViewType][];
}
export interface ServerAction extends Action {
  id: number;
  type: "ir.actions.server";
}

export interface Controller {
  jsId: string;
  Component: Type<Component<{}, OdooEnv>>;
  action: ClientAction | ActWindowAction;
}

export interface ViewController extends Controller {
  action: ActWindowAction;
  view: View;
  views: View[];
}

// function makeStandardAction(action: ActionRequest, options:ActionOptions): ClientAction {
//   action = Object.assign({}, action);
//   action.jsId = ++actionId;
//   // LPE FIXME
//   // ensure that the context and domain are evaluated
//   //var context = new Context(this.env.session.user_context, options.additional_context, action.context);
//   //action.context = pyUtils.eval('context', context);
//   //if (action.domain) {
//   //    action.domain = pyUtils.eval('domain', action.domain, action.context);
//   //}
//   // action._originalAction = JSON.stringify(action);
//   return action;
// }
