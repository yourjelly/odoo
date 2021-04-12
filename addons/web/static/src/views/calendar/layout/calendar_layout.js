/** @odoo-module **/

import { useService } from "../../../services/service_hook";

const { Component } = owl;

const POPOVER_KEY = "web.CalendarPopover";

export default class CalendarLayout extends Component {
  setup() {
    this.services = {
      dialog: useService("dialog"),
      popover: useService("popover"),
    };

    this.currentPopoverId = null;
  }

  get popoverKey() {
    return `${POPOVER_KEY}:${this.currentPopoverId}`;
  }

  displayPart(part, Component, props, handlers) {
    if (part !== "popover" && this.currentPopoverId) {
      this.services.popover.remove(this.popoverKey);
      this.currentPopoverId = null;
    }

    switch (part) {
      case "popover":
        this.displayPopover(Component, props, handlers);
        break;
      case "quick-create":
        this.displayQuickCreate(Component, props, handlers);
        break;
    }
  }

  displayPopover(Component, props, handlers) {
    const { event } = props;
    if (this.currentPopoverId === event.id) {
      return;
    }

    this.currentPopoverId = event.id;
    this.services.popover.add({
      Component,
      handlers,
      key: this.popoverKey,
      onClose: () => {
        if (this.currentPopoverId === event.id) {
          this.currentPopoverId = null;
        }
      },
      props,
    });
  }
  displayQuickCreate(Component, props) {
    this.services.dialog.open(Component, props);
  }
}
CalendarLayout.template = "wowl.CalendarLayout";
