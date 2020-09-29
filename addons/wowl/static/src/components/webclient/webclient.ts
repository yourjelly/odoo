import { Action } from "../action/action";
import { Component } from "@odoo/owl";
import { NavBar } from "../navbar/navbar";
import { OdooEnv } from "../../env";
// import { useService } from "../../services";

export class WebClient extends Component<{}, OdooEnv> {
  static components = { Action, NavBar };
  static template = "wowl.WebClient";
  Components = this.env.registries.Components.getEntries();
  // notificationService = useService("notifications");

  // rpc = useService("rpc");

  // async willStart() {
  //   const data = await this.rpc({ model: "sale.order", method: "read", args: [[7], ["state", "partner_id"]]});
  //   console.log(data)
  // }
}
