/** @odoo-module **/
const loadMenusUrl = `/wowl/load_menus`;
async function fetchLoadMenus(url) {
  const res = await odoo.browser.fetch(url);
  if (!res.ok) {
    throw new Error("Error while fetching menus");
  }
  return res.json();
}
function makeMenus(env, menusData) {
  let currentAppId;
  return {
    getAll() {
      return Object.values(menusData);
    },
    getApps() {
      return this.getMenu("root").children.map((mid) => this.getMenu(mid));
    },
    getMenu(menuID) {
      return menusData[menuID];
    },
    getCurrentApp() {
      if (!currentAppId) {
        return;
      }
      return this.getMenu(currentAppId);
    },
    getMenuAsTree(menuID) {
      const menu = this.getMenu(menuID);
      if (!menu.childrenTree) {
        menu.childrenTree = menu.children.map((mid) => this.getMenuAsTree(mid));
      }
      return menu;
    },
    async selectMenu(menu) {
      menu = typeof menu === "number" ? this.getMenu(menu) : menu;
      if (!menu.actionID) {
        return;
      }
      await env.services.action_manager.doAction(menu.actionID, { clearBreadcrumbs: true });
      this.setCurrentMenu(menu);
    },
    setCurrentMenu(menu) {
      menu = typeof menu === "number" ? this.getMenu(menu) : menu;
      if (menu && menu.appID !== currentAppId) {
        currentAppId = menu.appID;
        env.bus.trigger("MENUS:APP-CHANGED");
        env.services.router.pushState({
          "lock menu_id": `${menu.id}`,
        });
      }
    },
  };
}
export const menusService = {
  name: "menus",
  dependencies: ["action_manager", "router"],
  async deploy(env) {
    const cacheHashes = odoo.session_info.cache_hashes;
    const loadMenusHash = cacheHashes.load_menus || new Date().getTime().toString();
    const menusData = await fetchLoadMenus(`${loadMenusUrl}/${loadMenusHash}`);
    return makeMenus(env, menusData);
  },
};
