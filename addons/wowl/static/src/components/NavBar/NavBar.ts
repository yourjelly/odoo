import { Component } from "@odoo/owl";
import type { MenuRepository } from "../../services/menus";
import { useService } from "./../../services";

export class NavBar extends Component {
  static props = {
    menuID: Number,
  };
  static template = "wowl.NavBar";
  menuRepo: MenuRepository = useService("menusService");
  async willStart(): Promise<any> {
    await this.menuRepo.loadMenus();
  }
}
