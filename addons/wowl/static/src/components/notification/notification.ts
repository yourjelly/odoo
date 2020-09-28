import { Component } from "@odoo/owl";

export class Notification extends Component {
  static template = "wowl.Notification";
  static props = {
    message: { type: String },
    title: { type: String, optional: true },
    buttons: { type: Array, optional: true },
    className: { type: String, optional: true },
    icon: { type: String, optional: true },
  };
  static defaultProps = {
    buttons: [],
    className: "",
  };
}
