import { Action } from "../action/action";
import { Component } from "@odoo/owl";
import { NavBar } from "../navbar/navbar";
import { OdooEnv } from "../../env";

export class WebClient extends Component<{}, OdooEnv> {
  static components = { Action, NavBar };
  static template = "wowl.WebClient";
  Components = this.env.registries.Components.getEntries();
  // notificationService = useService("notifications");

  // rpc = useService("rpc");

  // async willStart() {
  //   await this.rpc({ route: "/web/action/load", params: { action_id: 114 } });
  // }
}
