import { Context } from "@odoo/owl/dist/types/context";

export type FieldType =
  | "float"
  | "integer"
  | "boolean"
  | "char"
  | "one2many"
  | "many2many"
  | "many2one"
  | "number"
  | "date"
  | "datetime"
  | "selection"
  | "reference";

export interface FieldDefinition {
  relation?: string;
  relation_field?: string;
  string: string;
  type: FieldType;
  default?: any;
  selection?: [any, string][];
  store?: boolean;
  sortable?: boolean;
  context?: Context; // does it exists really?
}

export interface Fields {
  [fieldName: string]: FieldDefinition;
} // similar to ModelFields but without id
