/** @odoo-module **/

import CalendarModel from "./calendar_model";
import CalendarAdapter from "./adapter/calendar_adapter";
import CalendarDatePicker from "./date_picker/calendar_date_picker";
import CalendarLayout from "./layout/calendar_layout";
import CalendarPopover from "./popover/calendar_popover";
import CalendarQuickCreate from "./quick_create/calendar_quick_create";

import { viewRegistry } from "../view_registry";
import { useModel } from "../view_utils/model";

import { useSetupAction } from "../../actions/action_hook";
import { Registry } from "../../core/registry";
import { localization } from "../../localization/localization_settings";
import { _lt } from "../../localization/translation";
import { evaluateExpr } from "../../py_js/py";
import { useService } from "../../services/service_hook";
import { parseDateTime } from "../../utils/dates";

const { Component } = owl;
const { useRef, useState } = owl.hooks;

/**
 * @typedef {import("./calendar_types").Scales} Scales
 * @typedef {import("./calendar_types").CalendarViewDescription} CalendarViewDescription
 * @typedef {import("./calendar_types").CalendarViewState} CalendarViewState
 * @typedef {import("./calendar_types").CalendarFilterSectionInfo} CalendarFilterSectionInfo
 * @typedef {import("./calendar_types").CalendarFilter} CalendarFilter
 * @typedef {import("./calendar_types").CalendarFilterType} CalendarFilterType
 * @typedef {import("./calendar_types").CalendarModelState} CalendarModelState
 */

const HOUR_FORMATS = {
  12: {
    hour: "numeric",
    minute: "2-digit",
    omitZeroMinute: true,
    meridiem: "short",
  },
  24: {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  },
};

const SCALES_INFO = {
  day: {
    label: _lt("Day"),
  },
  week: {
    label: _lt("Week"),
  },
  month: {
    label: _lt("Month"),
  },
  year: {
    label: _lt("Year"),
  },
};
const SCALES = Object.keys(SCALES_INFO);
const SCALES_LABELS = Object.entries(SCALES_INFO).reduce((acc, info) => {
  acc[info[0]] = info[1].label;
  return acc;
}, {});

const FIELD_ATTRIBUTE_NAMES = [
  "date_start",
  "date_delay",
  "date_stop",
  "all_day",
  "recurrence_update",
  "create_name_field",
  "color",
];

/**
 * @param {any} viewDescription
 * @returns {CalendarViewDescription}
 */
function processViewDescription(viewDescription) {
  const domParser = new DOMParser();
  const arch = domParser.parseFromString(viewDescription.arch, "text/xml").documentElement;
  const descFields = viewDescription.fields || {};

  if (!arch.hasAttribute("date_start")) {
    throw new Error(_lt("Calendar view has not defined 'date_start' attribute."));
  }

  const fieldMap = {};
  const fieldNames = new Set(descFields.display_name ? ["display_name"] : []);
  for (const fieldAttrName of FIELD_ATTRIBUTE_NAMES) {
    const fieldName = arch.getAttribute(fieldAttrName);
    if (fieldName) {
      fieldNames.add(fieldName);
      fieldMap[fieldAttrName] = fieldName;
    }
  }

  const evalContext = { true: true, false: false };
  const eventLimit = evaluateExpr(arch.getAttribute("event_limit") || "false", evalContext);

  const scaleAttr = arch.getAttribute("scales");
  const scales = scaleAttr
    ? scaleAttr.split(",").filter((scale) => SCALES.includes(scale))
    : SCALES;
  let scale = arch.getAttribute("mode");
  if (!scales.includes(scale)) {
    scale = "week";
  }

  const openEventInDialog = evaluateExpr(
    arch.getAttribute("event_open_popup") || "false",
    evalContext
  );
  const showUnusualDays = evaluateExpr(
    arch.getAttribute("show_unusual_days") || "false",
    evalContext
  );
  const hideDate = evaluateExpr(arch.getAttribute("hide_date") || "false", evalContext);
  const hideTime = evaluateExpr(arch.getAttribute("hide_time") || "false", evalContext);

  const contextDate = viewDescription.context.initial_date;
  const date = parseDateTime(contextDate) || luxon.DateTime.utc();

  const canCreate = arch.hasAttribute("create") ? !!JSON.parse(arch.getAttribute("create")) : true;
  const canDelete = arch.hasAttribute("delete") ? !!JSON.parse(arch.getAttribute("delete")) : true;

  const canQuickCreate = evaluateExpr(arch.getAttribute("quick_add") || "true", evalContext);

  const formViewId = arch.hasAttribute("form_view_id")
    ? parseInt(arch.getAttribute("form_view_id"), 10)
    : false;

  const displayFields = {};
  const filterSectionsInfo = {};

  for (const child of arch.children) {
    if (child.tagName === "field") {
      const fieldName = child.getAttribute("name");
      fieldNames.add(fieldName);

      if (!child.hasAttribute("invisible") || child.hasAttribute("filters")) {
        const attributes = {
          options: {},
          modifiers: {},
        };
        for (const attribute of child.attributes) {
          if (attribute.name === "modifiers") {
            attributes[attribute.name] = JSON.parse(attribute.value);
          } else if (attribute.name === "options") {
            attributes[attribute.name] = evaluateExpr(attribute.value);
          } else {
            attributes[attribute.name] = attribute.value;
          }
        }

        if (!attributes.invisible) {
          displayFields[fieldName] = {
            attrs: attributes,
          };
        }

        if (attributes.avatar_field || attributes.write_model || attributes.filters) {
          filterSectionsInfo[fieldName] = filterSectionsInfo[fieldName] || {
            title: descFields[fieldName].string,
            fieldName: fieldName,
            avatar: {
              field: null,
              model: null,
            },
            color: {
              field: null,
              model: null,
            },
            write: {
              field: null,
              model: null,
            },
          };
        }

        if (attributes.avatar_field) {
          filterSectionsInfo[fieldName].avatar = {
            field: attributes.avatar_field,
            model: descFields[fieldName].relation,
          };
        }
        if (attributes.write_model) {
          filterSectionsInfo[fieldName].write = {
            field: attributes.write_field,
            model: attributes.write_model,
          };
        }
        if (attributes.filters) {
          if (attributes.color) {
            filterSectionsInfo[fieldName].color = {
              field: attributes.color,
              model: descFields[fieldName].relation,
            };
          }
          if (attributes.avatar_field && descFields[fieldName].relation) {
            if (
              descFields[fieldName].relation.includes(["res.users", "res.partners", "hr.employee"])
            ) {
              filterSectionsInfo[fieldName].avatar.field = "image_128";
            }
            filterSectionsInfo[fieldName].avatar.model = descFields[fieldName].relation;
          }
        }
      }
    }
  }

  return {
    canCreate,
    canDelete,
    canEdit: !descFields[fieldMap.date_start].readonly,
    canQuickCreate,
    displayFields,
    eventLimit,
    openEventInDialog,
    fieldMap,
    fieldNames: [...fieldNames],
    filterSectionsInfo,
    formViewId,
    hideDate,
    hideTime,
    date,
    scale,
    scales,
    showUnusualDays,
  };
}

function computeCalendarOptions(component) {
  const { desc, props, model } = component;

  function highlightEvents(el, eventId) {
    const eventEls = el.querySelectorAll(`[data-event-id="${eventId}"]`);
    for (const eventEl of eventEls) {
      eventEl.classList.add("o_cw_custom_hover");
    }
  }

  return {
    allDaySlot: desc.fieldMap.all_day || props.fields[desc.fieldMap.date_start].type === "date",
    allDayText: _lt("All day"),
    date: model.date,
    dayNames: luxon.Info.weekdays("long"),
    dayNamesShort: luxon.Info.weekdays("short"),
    dir: localization.direction,
    droppable: true,
    editable: desc.canEdit,
    eventLimit: desc.eventLimit,
    eventResizableFromStart: true,
    events: (info, successCB) => {
      successCB(model.events);
    },
    firstDay: model.weekRangeStart,
    header: false,
    height: "parent",
    longPressDelay: 500,
    monthNames: luxon.Info.months("long"),
    monthNamesShort: luxon.Info.months("short"),
    navLinks: false,
    nowIndicator: true,
    scale: model.scale,
    selectable: desc.canCreate && component.hasCreateRight,
    selectMirror: true,
    slotLabelFormat:
      localization.timeFormat.search("%H") !== -1 ? HOUR_FORMATS[24] : HOUR_FORMATS[12],
    snapDuration: { minutes: 15 },
    unselectAuto: false,
    views: {
      dayGridMonth: {
        columnHeaderFormat: (info) => luxon.DateTime.fromJSDate(info.date.marker).toFormat("EEEE"),
      },
      timeGridDay: {
        columnHeaderFormat: (info) => luxon.DateTime.fromJSDate(info.date.marker).toFormat("DDD"),
      },
      timeGridWeek: {
        columnHeaderFormat: (info) => luxon.DateTime.fromJSDate(info.date.marker).toFormat("EEE d"),
      },
    },
    weekLabel: _lt("Week"),
    weekNumberCalculation: function (date) {
      // Since FullCalendar v4 ISO 8601 week date is preferred so we force the old system
      return moment(date).week();
    },
    weekNumbers: true,
    weekNumbersWithinDays: true,

    eventClick({ jsEvent, event }) {
      highlightEvents(component.el, event.id);

      component.showEventDescription(event);
    },
    eventDrop({ event }) {
      model.update(event, { drop: true });
    },
    eventRender({ el, event, view }) {
      el.dataset.eventId = event.id;
      el.classList.add("o_calendar_event");
      el.classList.add(
        `o_calendar_event_color_${
          typeof event.extendedProps.colorIndex === "number" ? event.extendedProps.colorIndex : 1
        }`
      );

      const injectedContent = component.renderEvent(event);
      injectedContent.classList.add("fc-content");

      el.replaceChild(injectedContent, el.querySelector(".fc-content"));

      const bg = document.createElement("div");
      bg.classList.add("fc-bg");
      el.appendChild(bg);

      el.addEventListener("dblclick", function () {
        component.showEventForm(event);
      });
    },
    eventResize({ event }) {
      model.update(event);
    },

    // Add/Remove a class on hover to style multiple days events.
    // The css ":hover" selector can't be used because these events
    // are rendered using multiple elements.
    eventMouseEnter({ event }) {
      highlightEvents(component.el, event.id);
    },
    eventMouseLeave({ event }) {
      if (!event.id) {
        return;
      }
      const eventEls = component.el.querySelectorAll(`[data-event-id="${event.id}"]`);
      for (const el of eventEls) {
        el.classList.remove("o_cw_custom_hover");
      }
    },

    eventDragStart({ event }) {
      highlightEvents(component.el, event.id);
    },
    eventResizeStart({ event }) {
      highlightEvents(component.el, event.id);
    },

    select({ start, end, allDay }) {
      const data = {
        start,
        end,
        allDay,
      };
      component.showEventForm(data);
    },
  };
}

export default class CalendarView extends Component {
  setup() {
    /**
     * @type {CalendarViewState}
     */
    this.state = useState({
      title: "",
    });

    this.services = {
      action: useService("action"),
      orm: useService("orm"),
      title: useService("title"),
      user: useService("user"),
    };

    this.layoutRef = useRef("layout");

    useSetupAction({});

    this.model = useModel({
      Model: this.constructor.Model,
      onUpdate: this.onModelUpdate,
    });

    this.hasCreateRight = false;

    console.log(this);
  }

  /**
   * @override
   */
  async willStart() {
    const { arch, context, fields } = this.props;
    this.desc = processViewDescription({ arch, context, fields });

    await this.model.load(Object.assign({}, this.props, this.desc));

    this.hasCreateRight = await this.services.orm.call(
      this.props.modelName,
      "check_access_rights",
      ["create", false]
    );
    this._updateTitles();
  }

  //----------------------------------------------------------------------------
  // Getters
  //----------------------------------------------------------------------------

  get controlPanelConfig() {
    const { breadcrumbs, display, viewSwitcherEntries } = this.props;
    return {
      breadcrumbs,
      display: display.controlPanel,
      displayName: this.state.title,
      viewSwitcherEntries,
    };
  }
  get calendarOptions() {
    return this.constructor.computeCalendarOptions(this);
  }
  get componentRegistries() {
    return this.constructor.componentRegistries;
  }
  get popoverActions() {
    return {
      edit: (ev) => {
        this.showEventForm(ev.detail);
      },
      delete: (ev) => {
        this.model.unlink(ev.detail);
      },
    };
  }
  get scaleLabels() {
    return SCALES_LABELS;
  }

  //----------------------------------------------------------------------------
  // Public
  //----------------------------------------------------------------------------

  showEventDescription(event) {
    const { CalendarPopover } = this.constructor.components;
    this.layoutRef.comp.displayPart(
      "popover",
      CalendarPopover,
      {
        event,
        canDelete: this.desc.canDelete,
      },
      this.popoverActions
    );
  }
  showEventForm(event, options = {}) {
    const context = Object.assign(
      {},
      this.props.context,
      options.context,
      this.model.makeContextDefaultsFromEvent(event)
    );

    if (this.desc.canQuickCreate) {
      const { CalendarQuickCreate } = this.constructor.components;
      this.layoutRef.comp.displayPart("quick-create", CalendarQuickCreate, {
        context,
        model: this.props.model,
        title: context.default_name || this.env._t("New Event"),
      });
    } else {
      let formViewId = this.desc.formViewId;
      if (this.props.views) {
        const formView = this.props.views.find((v) => v[1] === "form");
        if (formView) {
          formViewId = formView[0];
        }
      }

      this.services.action.doAction({
        type: "ir.actions.act_window",
        res_model: this.props.model,
        views: [[formViewId, "form"]],
        target: this.desc.openEventInDialog ? "new" : "current",
        context,
      });
    }
  }
  renderEvent(event) {
    const context = Object.create(this);
    context.event = event;
    const str = this.env.qweb.renderToString(this.constructor.eventTemplate, context);
    const parser = new DOMParser();
    return parser.parseFromString(str, "application/xml").documentElement;
  }

  //----------------------------------------------------------------------------
  // Private
  //----------------------------------------------------------------------------

  /**
   * @private
   */
  _updateTitles() {
    const formatOptions = { year: "numeric" };
    switch (this.model.scale) {
      case "day":
        Object.assign(formatOptions, { month: "long", day: "numeric" });
        break;
      case "week":
        Object.assign(formatOptions, { month: "short", day: "numeric" });
        break;
      case "month":
        Object.assign(formatOptions, { month: "long" });
        break;
    }

    const formatter = Intl.DateTimeFormat(this.services.user.lang.replace("_", "-"), formatOptions);

    let title = formatter.format(this.model.date.toJSDate());
    if (this.model.scale === "week") {
      const dateStartParts = formatter.formatToParts(this.model.dateRangeStart.toJSDate());
      const dateEndParts = formatter.formatToParts(
        this.model.dateRangeEnd.minus({ days: 1 }).toJSDate()
      );
      const indexOfDayPart = dateEndParts.findIndex((p) => p.type === "day");

      dateStartParts.splice(
        indexOfDayPart + 1,
        0,
        {
          type: "literal",
          value: " – ",
        },
        dateEndParts[indexOfDayPart]
      );

      title = dateStartParts.map((p) => p.value).join("");
    }

    this.state.title = `${this.props.displayName} (${title})`;
    this.services.title.setParts({
      view: title,
    });
  }

  //----------------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------------

  onDatePicked(ev) {
    let scale = "week";

    if (this.model.date.hasSame(ev.detail, "day")) {
      const rs = SCALES.slice().reverse();
      scale = rs[(rs.indexOf(this.model.scale) + 1) % rs.length];
    } else {
      const currentDate = this.model.date.set({
        weekday:
          this.model.date.weekday < this.model.weekRangeStart
            ? this.model.weekRangeStart - 7
            : this.model.weekRangeStart,
      });
      const pickedDate = ev.detail.set({
        weekday:
          ev.detail.weekday < this.model.weekRangeStart
            ? this.model.weekRangeStart - 7
            : this.model.weekRangeStart,
      });

      // a.hasSame(b, "week") does not depend on locale and week alway starts on Monday
      if (currentDate.hasSame(pickedDate, "week")) {
        scale = "day";
      }
    }

    this.model.load({
      scale,
      date: ev.detail,
    });
  }
  onDeleteBtnClick() {
    // this.model.unlink(this.state.event.data);
  }

  async onModelUpdate() {
    this.layoutRef.comp.displayPart("calendar");
    this.render();
    this._updateTitles();
  }
}

CalendarView.type = "calendar";
CalendarView.display_name = "calendar";
CalendarView.icon = "fa-calendar";
CalendarView.multiRecord = true;
CalendarView.template = "wowl.CalendarView"; // @todo [MCM] rename to web
CalendarView.components = {
  CalendarAdapter,
  CalendarLayout,
  CalendarDatePicker,
  CalendarPopover,
  CalendarQuickCreate,
};
CalendarView.Model = CalendarModel;
CalendarView.searchMenuTypes = ["filter", "favorite"];
CalendarView.withSearchModel = true;

CalendarView.eventTemplate = "wowl.CalendarView.event";

CalendarView.componentRegistries = {
  info: new Registry(),
  search: new Registry(),
};
CalendarView.computeCalendarOptions = computeCalendarOptions;

viewRegistry.add("calendar", CalendarView);
