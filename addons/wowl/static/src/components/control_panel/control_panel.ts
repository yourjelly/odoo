import { Component } from "@odoo/owl";
import { useService } from "../../core/hooks";

export class ControlPanel extends Component {
  static template = "wowl.ControlPanel";
  actionManager = useService("action_manager");

  get breadcrumbs() {
    return this.actionManager.getBreadcrumbs();
  }
  get views() {
    return this.actionManager.getViews();
  }

  _onBreadcrumbClicked(jsId: string) {
    this.actionManager.restore(jsId);
  }
  _onViewClicked(viewType: string) {
    this.actionManager.switchView(viewType);
  }
  _onExecuteAction(actionId: number) {
    this.actionManager.doAction(actionId);
  }
}
