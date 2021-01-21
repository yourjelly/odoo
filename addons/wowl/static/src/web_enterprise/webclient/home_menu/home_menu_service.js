/** @odoo-module **/
const { Component, core, hooks, tags } = owl;
import { HomeMenu } from "./home_menu";
import {
  ControllerNotFoundError,
  clearUncommittedChanges,
} from "../../../action_manager/action_manager";
import { useService } from "../../../core/hooks";
const { EventBus } = core;
import { Mutex } from "@wowl/utils/concurrency";
export const homeMenuService = {
  name: "home_menu",
  dependencies: ["menus", "router", "action_manager"],
  deploy(env) {
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
          appID: menuItem.appID,
          webIcon: menuItem.webIcon,
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

    let hasHomeMenu = false;
    const bus = new EventBus();
    const { apps, menuItems } = processMenuData();
    class HMWrap extends Component {
      constructor() {
        super(...arguments);
        this.hm = useService("home_menu");
        this.menus = useService("menus");
        this.apps = apps;
        this.menuItems = menuItems;
        this.hasHomeMenu = hasHomeMenu;
        hooks.onMounted(() => {
          bus.on("TOGGLE", this, async (cb) => {
            this.hasHomeMenu = !this.hasHomeMenu;
            await this.render();
            cb();
          });
        });
      }
    }
    HMWrap.components = { HomeMenu };
    HMWrap.template = tags.xml`
      <t>
        <HomeMenu t-if="hasHomeMenu" apps="apps" menuItems="menuItems"/>
        <div t-else=""></div>
      </t>`;
    odoo.mainComponentRegistry.add("HomeMenu", HMWrap);

    const mutex = new Mutex();
    async function toggle(show, reload = true) {
      mutex.exec(async () => {
        show = show === undefined ? !hasHomeMenu : Boolean(show);
        if (show !== hasHomeMenu) {
          if (show) {
            await clearUncommittedChanges(env);
            const newHash = {
              "home": "",
              "unlock menu_id": undefined,
            };
            env.services.router.pushState(newHash, true);
          } else {
            if (reload) {
              try {
                await env.services.action_manager.restore();
              } catch (err) {
                if (!(err instanceof ControllerNotFoundError)) {
                  throw err;
                }
                return;
              }
            }
            const currentMenuId = env.services.menus.getCurrentApp();
            if (currentMenuId) {
              env.services.router.pushState({ "lock menu_id": `${currentMenuId.id}` });
            }
          }
          await new Promise(resolve => {
            bus.trigger("TOGGLE", resolve);
          });
          hasHomeMenu = show;
          env.bus.trigger("HOME-MENU:TOGGLED");
          return new Promise(r => setTimeout(r)); // hack: wait to ensure that the url has been updated
        }
      });
    }
    return {
      get hasHomeMenu() {
        return hasHomeMenu;
      },
      toggle,
    };
  },
};
