import { Odoo } from "../types";
import { OdooEnv } from "../env";
import { Service } from "../services";

interface Menu {
  id: number | string;
  children: any[];
  name: string;
}

interface MenuTree extends Menu {
  childrenTree?: MenuTree[];
}

interface MenuData {
  [id: number]: Menu;
  [key: string]: Menu;
}

declare const odoo: Odoo;

export class MenuRepository {
  loadMenusUrl = `/wowl/load_menus/${odoo.session_info.cache_hashes.load_menus}`;
  loadMenusPromise?: Promise<MenuData>;
  menusData: MenuData = {};
  env: OdooEnv;
  constructor(env: OdooEnv) {
    this.env = env;
  }
  async _loadMenus(): Promise<MenuData> {
    return this.env.browser.fetch(this.loadMenusUrl).then(async (res) => {
      if (!res.ok) {
        throw new Error("Error while fetching menus");
      }
      return JSON.parse(await res.text());
    });
  }
  async loadMenus(reload: boolean = false): Promise<MenuData> {
    if (!this.loadMenusPromise || reload) {
      this.loadMenusPromise = this._loadMenus();
      this.menusData = await this.loadMenusPromise;
    }
    return this.loadMenusPromise;
  }
  get(menuID: keyof MenuData): Menu {
    return this.menusData[menuID];
  }
  get apps(): Menu[] {
    return this.get("root").children.map((mid: Menu["id"]) => this.get(mid));
  }
  getMenusAsTree(menuID: keyof MenuData): MenuTree {
    const menu = this.get(menuID) as MenuTree;
    if (!menu.childrenTree) {
      menu.childrenTree = menu.children.map((mid: Menu["id"]) => this.getMenusAsTree(mid));
    }
    return menu;
  }
}

export const menusService: Service = {
  name: "menus",
  deploy(env: OdooEnv): MenuRepository {
    const repo = new MenuRepository(env);
    repo.loadMenus();
    return repo;
  },
};
