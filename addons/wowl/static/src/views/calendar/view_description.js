/** @odoo-module **/

import { evaluateExpr } from "../../py/index";
import { unique } from "../../utils/arrays";

/**
 * @typedef {import("./types").Scales} Scales
 * @typedef {{unit: string, view: string}} ScaleInfo
 * @typedef {import("./types").CalendarViewDescription} CalendarViewDescription
 */

/**
 * @type {Record<Scales, ScaleInfo>}
 */
const SCALES_INFO = {
  day: {
    unit: "days",
    view: "timeGridDay",
  },
  week: {
    unit: "weeks",
    view: "timeGridWeek",
  },
  month: {
    unit: "months",
    view: "dayGridMonth",
  },
  // year: {
  //   unit: "years",
  //   view: "dayGridYear",
  // },
};

/**
 * @param {string} key
 * @returns {Record<Scales, string>}
 */
function pickInfo(key) {
  const result = {};
  for (const [scale, info] of Object.entries(SCALES_INFO)) {
    result[scale] = info[key];
  }
  return result;
}

/**
 * @type {SCALES[]}
 */
export const SCALES = Object.keys(SCALES_INFO);

/**
 * @type {Record<Scales, string>}
 */
export const SCALE_TO_LUXON_UNIT = pickInfo("unit");

/**
 * @type {Record<Scales, string>}
 */
export const SCALE_TO_FC_VIEW = pickInfo("view");

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
export default function processViewDescription(viewDescription) {
  const domParser = new DOMParser();
  const arch = domParser.parseFromString(viewDescription.arch, "text/xml").documentElement;
  const descFields = viewDescription.fields || {};

  if (!arch.hasAttribute("date_start")) {
    throw new Error(this.env._t("Calendar view has not defined 'date_start' attribute."));
  }

  const fieldMap = {};
  const fieldNames = descFields.display_name ? ["display_name"] : [];
  for (const fieldAttrName of FIELD_ATTRIBUTE_NAMES) {
    const fieldName = arch.getAttribute(fieldAttrName);
    if (fieldName) {
      fieldNames.push(fieldName);
      fieldMap[fieldAttrName] = fieldName;
    }
  }

  const eventLimitAttr = arch.getAttribute("event_limit");
  const eventLimit = eventLimitAttr && (
    isNaN(+eventLimitAttr) ?
      eventLimitAttr.trim().toLowerCase() === "true" :
      +eventLimitAttr
  );

  const scaleAttr = arch.getAttribute("scales");
  const scales = scaleAttr ?
    scaleAttr.split(',').filter(scale => SCALES.includes(scale)) :
    SCALES;
  let scale = arch.getAttribute("mode") || "week";
  if (!scales.includes(scale)) {
    scale = "week";
  }

  const eventOpenPopup = arch.hasAttribute("event_open_popup");
  const showUnusualDays = arch.hasAttribute("show_unusual_days");
  const hideDate = arch.hasAttribute("hide_date");
  const hideTime = arch.hasAttribute("hide_time");

  const initialDate = luxon.DateTime.utc();

  const canCreate = arch.hasAttribute("create") ? !!JSON.parse(arch.getAttribute("create")) : true;
  const canDelete = arch.hasAttribute("delete") ? !!JSON.parse(arch.getAttribute("delete")) : true;

  const canQuickCreate = !arch.hasAttribute("quick_add") ||
    ["1", "true"].includes(arch.getAttribute("quick_add").toLowerCase());
  // const disableQuickCreate =

  let formViewId = arch.hasAttribute("form_view_id") ?
    parseInt(arch.getAttribute("form_view_id"), 10) : false;
  // if (!formViewId && ...) {...}

  const displayFields = {};
  const filtersInfo = {};

  for (const child of arch.children) {
    if (child.tagName === "field") {
      const fieldName = child.getAttribute("name");
      fieldNames.push(fieldName);

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

        /*
        if (sidebar === false) {
          break;
        }
        */

        if (attributes.avatar_field || attributes.write_model || attributes.filters) {
          filtersInfo[fieldName] = filtersInfo[fieldName] || {
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
          filtersInfo[fieldName].avatar = {
            field: attributes.avatar_field,
            model: descFields[fieldName].relation,
          };
        }
        if (attributes.write_model) {
          filtersInfo[fieldName].write = {
            field: attributes.write_field,
            model: attributes.write_model,
          };
        }
        if (attributes.filters) {
          if (attributes.color) {
            filtersInfo[fieldName].color = {
              field: attributes.color,
              model: descFields[fieldName].relation,
            };
          }
          if (attributes.avatar_field && descFields[fieldName].relation) {
            if (descFields[fieldName].relation.includes(["res.users", "res.partners", "hr.employee"])) {
              filtersInfo[fieldName].avatar.field = "image_128";
            }
            filtersInfo[fieldName].avatar.model = descFields[fieldName].relation;
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
    disableQuickCreate: false,
    displayFields,
    eventLimit,
    eventOpenPopup,
    fields: descFields,
    fieldMap,
    fieldNames: unique(fieldNames),
    filtersInfo,
    formViewId,
    hideDate,
    hideTime,
    initialDate,
    scale,
    scales,
    showUnusualDays,
  };
}
