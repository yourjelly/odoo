/** @odoo-module **/

import CalendarModel from "./model";
import processViewDescription from "./view_description";
import { SCALE_TO_FC_VIEW } from "./view_description";

import { useSearch, useSetupView } from "../view_utils/hooks";

import { useService } from "../../core/hooks";


const { Component } = owl;
const {
  useRef,
  useState,
} = owl.hooks;

/**
 * @typedef {import("./types").Scales} Scales
 * @typedef {import("./types").CalendarViewState} CalendarViewState
 * @typedef {import("./types").CalendarFilterInfo} CalendarFilterInfo
 * @typedef {import("./types").CalendarFilter} CalendarFilter
 * @typedef {import("./types").CalendarModelState} CalendarModelState
 */


const FILTER_TYPE_SEQUENCE = ["user", "record", "undefined", "all"];
const HOUR_FORMATS = {
  12: {
    hour: 'numeric',
    minute: '2-digit',
    omitZeroMinute: true,
    meridiem: 'short',
  },
  24: {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  },
};


export default class CalendarView extends Component {
  constructor() {
    super(...arguments);

    /**
     * @type {CalendarViewState}
     */
    this.state = useState({
      title: "",
    });

    this.services = {
      localization: useService("localization"),
      model: useService("model"),
      title: useService("title"),
      user: useService("user"),
    };

    useSetupView({});

    this.searchModel = useSearch({
      searchMenuTypes: ["filter", "favorite"],
      onSearchUpdate: this.onSearchUpdate.bind(this),
    });

    this.model = new CalendarModel(this.searchModel, {
        localization: this.services.localization,
        model: this.services.model,
        user: this.services.user,
      }, {
        fields: this.props.fields,
        fieldMap: this.props.fieldMap,
        fieldNames: this.props.fieldNames,
        filtersInfo: this.props.filtersInfo,
        initialDate: this.props.initialDate,
        modelName: this.props.model, // <-- props.model should be renamed into props.modelName
        scale: this.props.scale,
        scales: this.props.scales,
      }
    );

    this.hasCreateRight = false;
    this.calendarRef = useRef("calendar");

    this.groupedEventElements = new Map();

    console.log(this);
  }

  /**
   * @override
   */
  async willStart() {
    await this.model.load();
    this.hasCreateRight = await this.services.model(this.props.model)
      .call("check_access_rights", ["create", false]);
  }
  /**
   * @override
   */
  mounted() {
    super.mounted();
    this.model.on("update", this, this.onModelUpdate);
    this.calendar = new FullCalendar.Calendar(this.calendarRef.el, this.calendarOptions);
    this.calendar.render();
    this._updateTitles();
  }
  /**
   * @override
   */
  willUnmount() {
    this.model.off("update", this);
    if (this.calendar) {
      this.calendar.destroy();
    }
  }

  //----------------------------------------------------------------------------
  // Getters
  //----------------------------------------------------------------------------

  /**
   *
   */
  get calendarOptions() {
    return {
      allDayContent: this.env._t("All day"),
      allDaySlot: this.props.fieldMap.all_day ||
        this.props.fields[this.props.fieldMap.date_start].type === "date",
      dayMaxEventRows: this.props.eventLimit,
      dayNames: luxon.Info.weekdays(),
      dayNamesShort: luxon.Info.weekdays("short"),
      direction: this.services.localization.direction,
      droppable: true,
      editable: this.props.canEdit,
      eventResizableFromStart: true,
      events: (_, successCB) => {
        console.log("fetch", this.model.state.events);
        successCB(this.model.state.events);
      },
      firstDay: this.model.state.weekRange.start,
      headerToolbar: false,
      height: "100%",
      initialDate: this.model.state.date.toJSDate(),
      initialView: SCALE_TO_FC_VIEW[this.model.state.scale],
      locale: moment.locale(), // luxon does not give the local locale
      longPressDelay: 500,
      monthNames: luxon.Info.months(),
      monthNamesShort: luxon.Info.months("short"),
      nowIndicator: true,
      navLinks: false,
      selectMirror: true,
      selectable: this.props.canCreate && this.hasCreateRight,
      slotLabelFormat: this.services.localization.timeFormat.search("%H") !== -1 ?
        HOUR_FORMATS[24] :
        HOUR_FORMATS[12],
      snapDuration: { minute: 15 },
      unselectAuto: false,
      views: {
        dayGridMonth: {
          dayHeaderContent: (info) => luxon.DateTime.fromJSDate(info.date).toFormat("EEEE"),
          weekNumberContent: (info) => `${info.num}`,
        },
        timeGrid: {
          weekNumberContent: (info) => `${this.env._t("Week")} ${info.num}`,
        },
        timeGridDay: {
          dayHeaderContent: (info) => luxon.DateTime.fromJSDate(info.date).toFormat("DDD"),
        },
        timeGridWeek: {
          dayHeaderContent: (info) => luxon.DateTime.fromJSDate(info.date).toFormat("EEE d"),
        },
      },
      weekNumberCalculation: function (date) {
        // use momentjs to get old week number system because luxon uses ISO 8601
        return moment(date).week();
        // return luxon.DateTime.fromJSDate(date).weekNumber;
      },
      weekNumbers: true,

      eventClassNames: (info) => {
        return [
          "o_calendar_event",
          `o_cw_filter_color_${info.event.extendedProps.colorIndex}`,
        ];
      },
      eventContent: (info) => {
        return {
          html: this.env.qweb.renderToString("wowl.CalendarView.event", {
            ...this,
            event: info.event,
          }),
        };
      },
      eventClick: (info) => {
      },
      eventDidMount: (info) => {
        if (!this.groupedEventElements.has(info.event.id)) {
          this.groupedEventElements.set(info.event.id, []);
        }
        this.groupedEventElements.get(info.event.id).push(info.el);
      },
      eventWillUnmount: (info) => {
        if (this.groupedEventElements.has(info.event.id)) {
          this.groupedEventElements.delete(info.event.id);
        }
      },
      eventMouseEnter: (info) => {
        if (this.groupedEventElements.has(info.event.id)) {
          for (const el of this.groupedEventElements.get(info.event.id)) {
            el.classList.add("o_cw_custom_hover");
          }
        }
      },
      eventMouseLeave: (info) => {
        if (this.groupedEventElements.has(info.event.id)) {
          for (const el of this.groupedEventElements.get(info.event.id)) {
            el.classList.remove("o_cw_custom_hover");
          }
        }
      },
      select: (info) => {
      },
    };
  }
  get filterGroups() {
    const result = [];

    for (const entry of Object.entries(this.props.filtersInfo)) {
      /** @type {CalendarFilterInfo} */
      const filterInfo = entry[1];

      const filters = this.model.state.filters[filterInfo.fieldName];
      const items = Array.from(Object.values(filters))
        .sort((a, b) => {
          const ia = FILTER_TYPE_SEQUENCE.indexOf(a.type);
          const ib = FILTER_TYPE_SEQUENCE.indexOf(b.type);
          if (ia === ib) {
            // @todo [mcm] should be natural sorting
            return b.label.localeCompare(a.label);
          }
          return ia - ib;
        });

      const group = {
        key: filterInfo.fieldName,
        title: filterInfo.title,
        items,
      };

      result.push(group);
    }

    return result;
  }

  //----------------------------------------------------------------------------
  // Public
  //----------------------------------------------------------------------------



  //----------------------------------------------------------------------------
  // Private
  //----------------------------------------------------------------------------

  /**
   * @private
   * @param {CalendarModelState} previousState
   */
  _updateCalendar(previousState) {
    if (previousState.scale !== this.model.state.scale ||
      previousState.date.toMillis() !== this.model.state.date.toMillis()
    ) {
      this.calendar.changeView(
        SCALE_TO_FC_VIEW[this.model.state.scale],
        this.model.state.date.toJSDate()
      );
    } else {
      this.calendar.refetchEvents();
    }
    this._updateTitles();
  }
  /**
   * @private
   */
  _updateTitles() {
    this.state.title = `${this.props.action.name} (${this.calendar.view.title})`;
    this.services.title.setParts({
      view: this.calendar.view.title,
    });
  }

  //----------------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------------

  /**
   * @param {CalendarModelState} previousState
   */
  async onModelUpdate(previousState) {
    this.render();
    this._updateCalendar(previousState);
  }
  /**
   *
   */
  async onSearchUpdate() {
    await this.model.load();
  }
}

CalendarView.type = "calendar";
CalendarView.display_name = "calendar";
CalendarView.icon = "fa-calendar";
CalendarView.multiRecord = true;
CalendarView.template = "wowl.CalendarView";
CalendarView.components = {
};
CalendarView.processArch = processViewDescription;

CalendarView.style = owl.tags.css`
  .o_cw_filter_color_0 { color: black !important; }
  .o_cw_filter_color_1 { color: red !important; }
  .o_cw_filter_color_2 { color: green !important; }
  .o_cw_filter_color_3 { color: blue !important; }
  .o_cw_filter_color_4 { color: yellow !important; }
  .o_cw_filter_color_5 { color: magenta !important; }
  .o_cw_filter_color_6 { color: pink !important; }
  .o_cw_filter_color_7 { color: orange !important; }
  .o_cw_filter_color_8 { color: purple !important; }
`;
