/** @odoo-module **/

/**
 * This file defines the env to use in the webclient.
 */

import commonEnv from './common_env';
import dataManager from '@web/legacy/js/services/data_manager';
import { blockUI, unblockUI } from "@web/legacy/js/core/framework";

const env = Object.assign(commonEnv, { dataManager });
env.services = Object.assign(env.services, { blockUI, unblockUI });

export default env;
