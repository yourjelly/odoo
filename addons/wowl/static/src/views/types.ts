import { Component } from "@odoo/owl";
import { Type } from "../types";

export type ViewType =
  | "list"
  | "form"
  | "kanban"
  | "calendar"
  | "pivot"
  | "graph"
  | "activity"
  | "grid"
  | string;

export interface View {
  name: string;
  type: ViewType;
  Component: Type<Component>;
}
