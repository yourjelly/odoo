import { Odoo } from "./../types";
import { utils } from "@odoo/owl";

export interface Menu {
  id: number|string,
  children: number[],
  name: string,
}

interface MenuData {
  [id: number]: Menu,
}

declare const odoo: Odoo;

export class MenuRepository {
  loadMenusUrl = `/wowl/load_menus/${odoo.session_info.cache_hashes.load_menus}`;
  loadMenusPromise?: Promise<MenuData>;
  menusData: MenuData = {};
  async _loadMenus(): Promise<MenuData> {
    return utils.loadFile(this.loadMenusUrl).then(res => JSON.parse(res));
  }
  async loadMenus(reload: boolean = false): Promise<void> {
    if (!this.loadMenusPromise || reload) {
      this.loadMenusPromise = this._loadMenus();
    }
    this.menusData = reload ? {} : this.menusData;
    Object.assign(this.menusData, await this.loadMenusPromise);
  }
  get(menuID?: number): Menu|Menu[] {
    return !menuID ? Object.values(this.menusData) : this.menusData[menuID];
  }
}
