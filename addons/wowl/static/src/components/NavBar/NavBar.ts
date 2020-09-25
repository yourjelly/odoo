import { Component } from "@odoo/owl";
import { Menu , MenuRepository } from "./../../classes/MenuRepository";

export class NavBar extends Component {
  static props = {
    menuID: Number,
    menuRepo: MenuRepository,
  }
  static template = "wowl.NavBar";
  get apps(): Menu[] {
    const repo = this.props.menuRepo;
    return repo.get('root').children.map((mid: number) => repo.get(mid));
  }
}
