/** @odoo-module **/
import { deployServices } from "./webclient/setup";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} OdooEnv
 * @property {Object} services
 * @property {EventBus} bus
 * @property {string} debug
 * @property {(str: string) => string} _t
 * @property {boolean} [isSmall]
 */

// -----------------------------------------------------------------------------
// makeEnv
// -----------------------------------------------------------------------------

/**
 * Return a value Odoo Env object
 *
 * @param {string} debug
 * @returns {OdooEnv}
 */
export async function makeEnv(debug) {
  const env = {
    qweb: new owl.QWeb(),
    bus: new owl.core.EventBus(),
    services: {},
    debug,
  };
  // define shortcut properties coming from some services
  Object.defineProperty(env, "isSmall", {
    get() {
      if (!env.services.ui) {
        throw new Error("UI service not initialized!");
      }
      return env.services.ui.isSmall;
    },
  });
  Object.defineProperty(env, "_t", {
    get() {
      if (!env.services.localization) {
        throw new Error("Localization service not initialized!");
      }
      return env.services.localization._t;
    },
  });
  Object.defineProperty(env.qweb, "translateFn", {
    get() {
      if (!env.services.localization) {
        throw new Error("Localization service not initialized!");
      }
      return env.services.localization._t;
    },
  });
  await deployServices(env);
  return env;
}
