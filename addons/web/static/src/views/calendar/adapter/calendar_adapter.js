/** @odoo-module **/

import { createYearViewPlugin } from "./year_view_plugin";

const { Component } = owl;
const { useRef } = owl.hooks;
const { xml } = owl.tags;

export default class Calendar extends Component {
  setup() {
    this.instance = null;
    this.ref = useRef("fullCalendar");
    this.isViewOrDateUpdated = false;
  }

  mounted() {
    super.mounted(...arguments);

    this.el.setAttribute("scale", this.props.scale);
    this.instance = new FullCalendar.Calendar(this.ref.el, this.options);
    this.instance.render();
  }
  patched() {
    super.patched(...arguments);
    this.el.setAttribute("scale", this.props.scale);

    this.instance.unselect();

    if (this.isViewOrDateUpdated) {
      this.instance.changeView(
        this.constructor.SCALES_TO_FC_VIEW[this.props.scale],
        this.props.date.toJSDate()
      );
    } else {
      this.instance.refetchEvents();
    }
  }
  async willUnmount() {
    await super.willUnmount(...arguments);

    this.instance.destroy();
  }
  async willUpdateProps(nextProps) {
    await super.willUpdateProps(nextProps);

    this.isViewOrDateUpdated =
      nextProps.scale !== this.props.scale ||
      nextProps.date.toMillis() !== this.props.date.toMillis();
  }

  get options() {
    return {
      ...this.props,
      initialDate: this.props.date.toJSDate(),
      defaultView: this.constructor.SCALES_TO_FC_VIEW[this.props.scale],
      plugins: [createYearViewPlugin(FullCalendar), "dayGrid", "interaction", "luxon", "timeGrid"],
    };
  }
}
Calendar.template = xml`<div t-ref="fullCalendar" class="o_calendar_fc" />`;
Calendar.SCALES_TO_FC_VIEW = {
  day: "timeGridDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
  year: "odooYearView",
};
