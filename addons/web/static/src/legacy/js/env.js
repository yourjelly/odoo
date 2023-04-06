/** @odoo-module **/

/**
 * This file defines the env to use in the webclient.
 */

import { env as commonEnv } from "@web/legacy/js/common_env";
import { dataManager } from "@web/legacy/js/services/data_manager";
import { blockUI, unblockUI } from "web.framework";

export const env = Object.assign(commonEnv, { dataManager });
env.services = Object.assign(env.services, { blockUI, unblockUI });
