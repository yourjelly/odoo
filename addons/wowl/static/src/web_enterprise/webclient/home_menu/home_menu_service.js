/** @odoo-module **/
const { Component, core, hooks, tags } = owl;
import { HomeMenu } from "./home_menu";
import { clearUncommittedChanges } from "../../../action_manager/action_manager";
import { useService } from "../../../core/hooks";
const { EventBus } = core;
export const homeMenuService = {
  name: "home_menu",
  dependencies: ["menus", "router", "action_manager"],
  deploy(env) {
    let hasHomeMenu = false;
    let currentMenuId;
    const bus = new EventBus();
    const { apps, menuItems } = processMenuData();
    let restoreProm;
    class HMWrap extends Component {
      constructor() {
        super(...arguments);
        this.hm = useService("home_menu");
        this.menus = useService("menus");
        this.apps = apps;
        this.menuItems = menuItems;
        hooks.onMounted(() => {
          bus.on("TOGGLE", this, () => {
            this.render();
          });
          this.env.bus.trigger("HOME-MENU:TOGGLED");
        });
        hooks.onPatched(() => {
          this.env.bus.trigger("HOME-MENU:TOGGLED");
        });
      }
    }
    HMWrap.components = { HomeMenu };
    HMWrap.template = tags.xml`
      <t>
        <HomeMenu t-if="hm.hasHomeMenu" apps="apps" menuItems="menuItems"/>
        <div t-else=""></div>
      </t>`;
    odoo.mainComponentRegistry.add("HomeMenu", HMWrap);
    function processMenuData() {
      const menuTree = env.services.menus.getMenuAsTree("root");
      const apps = [];
      const menuItems = [];
      function traverseMenuTree(tree, cb, parents = []) {
        cb(tree, parents);
        tree.childrenTree.forEach((c) => traverseMenuTree(c, cb, parents.concat([tree])));
      }
      traverseMenuTree(menuTree, (menuItem, parents) => {
        if (!menuItem.id || !menuItem.actionID) {
          return;
        }
        const isApp = menuItem.id === menuItem.appID;
        const item = {
          parents: parents
            .slice(1)
            .map((p) => p.name)
            .join(" / "),
          label: menuItem.name,
          id: menuItem.id,
          xmlid: menuItem.xmlid,
          actionID: menuItem.actionID,
          webIcon: menuItem.webIcon,
          appID: menuItem.appID,
        };
        if (isApp) {
          if (menuItem.webIconData) {
            item.webIconData = menuItem.webIconData;
          } else {
            const [iconClass, color, backgroundColor] = (item.webIcon || "").split(",");
            if (backgroundColor !== undefined) {
              // Could split in three parts?
              item.webIcon = { iconClass, color, backgroundColor };
            } else {
              item.webIconData = "/web_enterprise/static/src/img/default_icon_app.png";
            }
          }
        } else {
          item.menuID = parents[1].id;
        }
        if (isApp) {
          apps.push(item);
        } else {
          menuItems.push(item);
        }
      });
      return { apps, menuItems };
    }
    async function callOnToggled(restore = true) {
      if (hasHomeMenu) {
        const newHash = {
          home: "",
          "unlock menu_id": undefined,
        };
        env.services.router.pushState(newHash, true);
      } else {
        if (restore) {
          restoreProm = env.services.action_manager.restore();
          return;
        }
        await restoreProm;
        restoreProm = undefined;
        if (currentMenuId) {
          env.services.router.pushState({ "lock menu_id": currentMenuId });
        }
        currentMenuId = undefined;
      }
      bus.trigger("TOGGLE", hasHomeMenu);
    }
    async function toggle(fswitch) {
      if (fswitch === undefined) {
        fswitch = !hasHomeMenu;
      }
      if (fswitch) {
        await clearUncommittedChanges(env);
      }
      if (fswitch !== hasHomeMenu) {
        hasHomeMenu = fswitch;
        return callOnToggled();
      }
    }
    env.bus.on("ACTION_MANAGER:UI-UPDATED", null, (mode) => {
      if (mode !== "new") {
        currentMenuId = env.services.menus.getCurrentApp() || undefined;
        currentMenuId = currentMenuId && `${currentMenuId.id}`;
        hasHomeMenu = false;
        callOnToggled(false);
      }
    });
    return {
      get hasHomeMenu() {
        return hasHomeMenu;
      },
      toggle,
    };
  },
};
