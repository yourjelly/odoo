import { Action } from "../Action/Action";
import { Component } from "@odoo/owl";
import { NavBar } from "../NavBar/NavBar";

export class WebClient extends Component {
  static components = { Action, NavBar };
  static template = "wowl.WebClient";
}
