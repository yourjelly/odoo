import { Action } from "../Action/Action";
import { Component } from "@odoo/owl";
import { NavBar } from "../NavBar/NavBar";
import { OdooEnv } from "../../env";

export class WebClient extends Component<{}, OdooEnv> {
  static components = { Action, NavBar };
  static template = "wowl.WebClient";
  Components = this.env.registries.Components.getEntries();
}
