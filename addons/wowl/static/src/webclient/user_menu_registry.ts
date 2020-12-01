import { Registry } from "../core/registry";
import { MenuElementFactory } from "../types";
import {
  documentationItem,
  logOutItem,
  odooAccountItem,
  preferencesItem,
  separator,
  shortCutsItem,
  supportItem,
} from "./user_menu/user_menu_items";

// -----------------------------------------------------------------------------
// Default UserMenu items
// -----------------------------------------------------------------------------

export const userMenuRegistry: Registry<MenuElementFactory> = new Registry();

userMenuRegistry
  .add("documentation", documentationItem)
  .add("support", supportItem)
  .add("shortcuts", shortCutsItem)
  .add("separator", separator)
  .add("profile", preferencesItem)
  .add("odoo_account", odooAccountItem)
  .add("log_out", logOutItem);
