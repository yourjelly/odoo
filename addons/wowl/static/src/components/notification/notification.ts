import { Component } from "@odoo/owl";
import { useService } from "../../services";

export class Notification extends Component {
  static template = "wowl.Notification";
  static props = {
    id: { type: Number },
    message: { type: String },
    title: { type: String, optional: true },
    buttons: {
      type: Array,
      element: {
        type: Object,
        shape: {
          name: { type: String },
          icon: { type: String, optional: true },
          primary: { type: Boolean, optional: true },
        },
      },
    },
    className: { type: String, optional: true },
    icon: { type: String, optional: true },
  };
  static defaultProps = {
    buttons: [],
    className: "",
  };

  notificationService = useService("notifications");

  _onClickClose() {
    this.notificationService.closeNotification(this.props.id);
  }
}
