import { Component, tags } from "@odoo/owl";
import { useService } from "../../core/hooks";

const { xml } = tags;

export class ViewLoader extends Component<any, any> {
  static template = xml`<t t-component="props.View" t-props="viewProps"/>`;

  vm = useService("view_manager");
  viewProps: any = {};

  async willStart() {
    const params = {
      model: this.props.model,
      views: this.props.views,
      context: this.props.context,
    };
    const options = {
      actionId: this.props.actionId,
      context: this.props.context,
      withActionMenus: this.props.withActionMenus,
      withFilters: this.props.withFilters,
    };
    const viewDescriptions = await this.vm.loadViews(params, options);
    const descr = viewDescriptions[this.props.type];
    this.viewProps.arch = descr.arch;
    this.viewProps.viewId = descr.view_id;
    this.viewProps.fields = descr.fields;
    Object.assign(this.viewProps, this.props);

    // extract props from action
    this.viewProps.limit = this.props.action.limit;

    // todo:
    // white list props to put into viewProps?
    // pass loaded search arch and filters into viewProps
    // -> that way '_useLoadViews' could be remove (hooks.ts)
    // extract everything necessary from action and put it into viewProps
    // handle jsClass here (+ write a test), and probably remove props.View (type is enough)
  }
}
