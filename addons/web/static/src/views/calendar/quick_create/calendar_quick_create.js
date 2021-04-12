/** @odoo-module **/

import { Dialog } from "../../../components/dialog/dialog";

const { Component } = owl;

export default class CalendarQuickCreate extends Component {
  onCancelBtnClick() {
    this.trigger("dialog-closed");
  }
  onCreateBtnClick() {
    // create action
    this.trigger("dialog-closed");
  }
  onEditBtnClick() {
    // edit action
    this.trigger("dialog-closed");
  }
}
CalendarQuickCreate.components = {
  Dialog,
};

CalendarQuickCreate.template = "wowl.CalendarQuickCreate";
