import { Action } from "../Action/Action";
import { Component } from "@odoo/owl";
import { NavBar } from "../NavBar/NavBar";
import { useService } from "./../../hooks";

export class WebClient extends Component {
  static components = { Action, NavBar };
  static template = "wowl.WebClient";
  rpc = useService("rpc");

  willStart() {
    return this.rpc();
  }
}
