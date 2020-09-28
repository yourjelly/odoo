import { Component } from "@odoo/owl";
import { useService } from "../../services";

export class NavBar extends Component {
  static props = {
    menuID: Number,
  };
  static template = "wowl.NavBar";
  menuRepo = useService("menus");
}
