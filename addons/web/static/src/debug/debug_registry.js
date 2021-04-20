/** @odoo-module **/

import { Registry } from "../core/registry";

/**
 * Use for items that are globally accessible.
 */
export const globalDebugRegistry = (odoo.globalDebugRegistry = new Registry());

/**
 * Used for items that are visible only in a specific view context.
 */
export const viewDebugRegistry = (odoo.viewDebugRegistry = new Registry());
