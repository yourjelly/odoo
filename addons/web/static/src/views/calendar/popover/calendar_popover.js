/** @odoo-module **/

import { formatDateTime } from "../../../utils/dates";

const { Component } = owl;

export default class CalendarPopover extends Component {
  get title() {
    return this.props.event.title;
  }
  get dateRange() {
    return formatDateTime(luxon.DateTime.fromJSDate(this.props.event.start), {
      format: "DDDD",
      timezone: "local",
    });
  }

  get target() {
    return `[data-event-id="${this.props.event.id}"]`;
  }

  async onEditBtnClick() {
    this.trigger("edit", this.props.event);
  }
  async onDeleteBtnClick() {
    this.trigger("delete", this.props.event);
  }
}
CalendarPopover.template = "wowl.CalendarPopover";
