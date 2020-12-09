import { Component } from "@odoo/owl";
import { useService } from "../../../core/hooks";
import { ViewType } from "../../../types";

export class Layout extends Component {
  static template = "wowl.Action";
  am = useService("action_manager");
  vm = useService("view_manager");

  /**
   * Called when an element of the breadcrumbs is clicked.
   *
   * @param {string} jsId
   */
  onBreadcrumbClicked(jsId: string) {
    this.am.restore(jsId);
  }

  /**
   * Called when a view is clicked in the view switcher.
   *
   * @param {ViewType} viewType
   */
  onViewClicked(viewType: ViewType) {
    this.am.switchView(viewType);
  }
}
