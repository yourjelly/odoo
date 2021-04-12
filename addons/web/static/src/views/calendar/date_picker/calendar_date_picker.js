/** @odoo-module **/

const { Component } = owl;
const { xml } = owl.tags;

// This component uses JQuery! Should we find another lib for date picker?
export default class CalendarDatePicker extends Component {
  mounted() {
    this.$el.datepicker({
      showOtherMonths: true,
      onSelect: this.onDateSelected.bind(this),
    });
  }
  patched() {
    this.$el.datepicker("setDate", this.props.date.toJSDate());
  }
  willUnmount() {
    this.$el.datepicker("destroy");
    const picker = document.querySelector("#ui-datepicker-div:empty");
    if (picker) {
      picker.remove();
    }
  }

  get $el() {
    return $(this.el);
  }

  onDateSelected(_, info) {
    this.trigger(
      "date-picked",
      luxon.DateTime.utc(+info.currentYear, +info.currentMonth + 1, +info.currentDay)
    );
  }
}
CalendarDatePicker.template = xml`<div class="o_calendar_date_picker" />`;
