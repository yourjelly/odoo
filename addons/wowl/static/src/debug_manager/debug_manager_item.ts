import { MenuElement, MenuElementFactory, Odoo, OdooEnv } from "../types";
import { routeToUrl } from "../services/router";
import { Registry } from "../core/registry";
import { DomainListRepr as Domain } from "../core/domain";

declare const odoo: Odoo;

// Backend Debug Manager Items

export function runJSTestsItem(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Run JS Tests"),
    callback: () => {
      console.log("Run JS Tests");
      odoo.browser.open(odoo.browser.location.origin + "/wowl/tests?mod=*");
    },
    sequence: 10,
  };
}

export function runJSTestsMobileItem(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Run JS Mobile Tests"),
    callback: () => {
      console.log("Run JS Mobile Tests");
      odoo.browser.open(odoo.browser.location.origin + "/wowl/tests/mobile?mod=*");
    },
    sequence: 20,
  };
}

export function runClickTestItem(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Run Click Everywhere Test"),
    callback: () => {
      console.log("Run Click Everywhere Test");
      // TODO need to imp ?
      // perform_click_everywhere_test
    },
    sequence: 30,
  };
}

export function openViewItem(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Open View"),
    callback: () => {
      console.log("Open View");
      // New Dialog with tree view inside
      // select_view
      // TODO Need to be fix
      // Error when we select a record
      // Not the good button
      // disable_multiple_selection don't work
      env.services.action_manager.doAction({
        type: "ir.actions.act_window",
        res_model: "ir.ui.view",
        name: env._t("Select a view"),
        disable_multiple_selection: true,
        domain: [
          ["type", "!=", "qweb"],
          ["type", "!=", "search"],
        ],
        views: [[false, "list"]],
        view_mode: "list",
        target: "new",
      });
    },
    sequence: 40,
  };
}

// Global Debug Manager Items

export function globalSeparator(env: OdooEnv): MenuElement {
  return {
    type: "separator",
    sequence: 400,
  };
}

export function activateAssetsDebugging(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Activate Assets Debugging"),
    callback: () => {
      console.log("Activate Assets Debugging");
      odoo.browser.location.search = "?debug=assets";
    },
    sequence: 410,
  };
}

export function activateTestsAssetsDebugging(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Activate Tests Assets Debugging"),
    callback: () => {
      console.log("Activate Tests Assets Debugging");
      odoo.browser.location.search = "?debug=assets,tests";
    },
    sequence: 420,
  };
}

export function regenerateAssets(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Regenerate Assets Bundles"),
    callback: () => {
      // TODO Uncaught (in promise) TypeError: Illegal invocation
      console.log("Regenerate Assets Bundles");
      const domain: Domain = [
        "&",
        ["res_model", "=", "ir.ui.view"],
        "|",
        ["name", "=like", "%.assets_%.css"],
        ["name", "=like", "%.assets_%.js"],
      ];
      env.services
        .model("ir.attachment")
        .search(domain)
        .then((ids) => {
          env.services
            .model("ir.attachment")
            .unlink(ids)
            .then(() => {
              odoo.browser.location.reload();
            });
        });
    },
    sequence: 430,
  };
}

export function becomeSuperuser(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Become Superuser"),
    hide: !env.services.user.isAdmin,
    callback: () => {
      console.log("Become Superuser");
      //TODO  add /wowl/become
      odoo.browser.location.href = odoo.browser.location.origin + "/wowl/become";
    },
    sequence: 440,
  };
}

export function leaveDebugMode(env: OdooEnv): MenuElement {
  return {
    type: "item",
    description: env._t("Leave the Developer Tools"),
    callback: () => {
      console.log("Leave the Developer Tools");
      let route = env.services.router.current;
      route.search.debug = "";
      odoo.browser.location.href = odoo.browser.location.origin + routeToUrl(route);
    },
    sequence: 450,
  };
}

export const backendDebugManagerItems = [
  runJSTestsItem,
  runJSTestsMobileItem,
  runClickTestItem,
  openViewItem,
];

export const globalDebugManagerItems = [
  globalSeparator,
  activateAssetsDebugging,
  regenerateAssets,
  becomeSuperuser,
  leaveDebugMode,
  activateTestsAssetsDebugging,
];


export const debugManagerRegistry: Registry<MenuElementFactory> = new Registry();
backendDebugManagerItems.forEach((item) => {
  debugManagerRegistry.add(item.name, item);
});
globalDebugManagerItems.forEach((item) => {
  debugManagerRegistry.add(item.name, item);
});