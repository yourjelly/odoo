/** @odoo-module **/

///
/// Extract filter management in another model ?
/// make a custom Search Panel for Calendar [wanted in task 2245464]
///

import { Model } from "../view_utils/model";

import { localization } from "../../localization/localization_settings";
import { useService } from "../../services/service_hook";
import { formatDateTime, parseDateTime } from "../../utils/dates";
import { formats } from "../../utils/fields";

/**
 * @typedef {import("./calendar_types").Scales} Scales
 * @typedef {import("./calendar_types").CalendarFilterSectionInfo} CalendarFilterSectionInfo
 * @typedef {import("./calendar_types").CalendarFilter} CalendarFilter
 * @typedef {import("./calendar_types").CalendarFilterType} CalendarFilterType
 * @typedef {import("./calendar_types").CalendarModelParams} CalendarModelParams
 * @typedef {import("./calendar_types").CalendarModelState} CalendarModelState
 * @typedef {import("./calendar_types").CalendarEvent} CalendarEvent
 */

const DATE_FORMATS = {
  date: "yyyy-MM-dd",
  datetime: "yyyy-MM-dd HH:mm:ss",
};

const LOAD_CONFIG_KEYS = [
  "date",
  "domain",
  "fieldMap",
  "fieldNames",
  "fields",
  "filterSectionsInfo",
  "modelName",
  "scale",
  "scales",
];

export default class CalendarModel extends Model {
  setup() {
    /** @protected */
    this._services = {
      orm: useService("orm"),
      user: useService("user"),
    };

    /** @protected */
    this._config = {};
    /** @protected */
    this._events = [];
    /** @protected */
    this._filterSections = {};
    /** @protected */
    this._colorModelName = null;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Public
  //////////////////////////////////////////////////////////////////////////////

  //----------------------------------------------------------------------------
  // CRUD
  //----------------------------------------------------------------------------

  /**
   * @param {CalendarEvent} event
   */
  async create(event) {
    const record = this._convertEventToRecord(event);
    await this._services.orm.create(this._config.modelName, record);
  }
  /**
   * @param {Object} [config]
   */
  async load(config = {}) {
    this._updateConfig(config);
    await this._load();
    this.trigger("update");
  }
  /**
   * @param {CalendarEvent} event
   */
  async unlink(event) {
    await this._services.orm.unlink(this._config.modelName, [parseInt(event.id, 10)]);
    await this.load();
  }
  /**
   * @param {CalendarEvent} event
   * @param {Object} [options]
   * @param {boolean} [options.drop=false]
   */
  async update(event, options = {}) {
    const record = this._convertEventToRecord(event, options);
    delete record.name; // name is immutable.

    await this._services.orm.write(this._config.modelName, [parseInt(event.id, 10)], record, {
      from_ui: true,
    });

    await this.load();
  }

  //----------------------------------------------------------------------------
  // Getters
  //----------------------------------------------------------------------------

  /**
   * @type {Date}
   */
  get date() {
    return this._config.date;
  }
  /**
   * @type {Date}
   */
  get dateRangeEnd() {
    return this._config.dateRange.end;
  }
  /**
   * @type {Date}
   */
  get dateRangeStart() {
    return this._config.dateRange.start;
  }
  /**
   * @type {CalendarEvent[]}
   */
  get events() {
    return this._events;
  }
  /**
   * @type {Object[]}
   */
  get filterSections() {
    return Object.entries(this._filterSections).map(([fieldName, filters]) => {
      const filterSectionInfo = this._config.filterSectionsInfo[fieldName];
      return {
        fieldName,
        title: filterSectionInfo.title,
        avatarModel: filterSectionInfo.avatar.model,
        avatarField: filterSectionInfo.avatar.field,
        filters,
      };
    });
  }
  /**
   * @type {Scales}
   */
  get scale() {
    return this._config.scale;
  }
  /**
   * @type {number}
   */
  get weekRangeEnd() {
    return this._config.weekRange.end;
  }
  /**
   * @type {number}
   */
  get weekRangeStart() {
    return this._config.weekRange.start;
  }

  //----------------------------------------------------------------------------
  // Setters
  //----------------------------------------------------------------------------

  /**
   * @param {DateTime} value
   */
  setDate(value) {
    this.load({ date: value });
  }
  setNextDate() {
    this.setDate(this._config.date.plus({ [`${this._config.scale}s`]: 1 }));
  }
  setPreviousDate() {
    this.setDate(this._config.date.minus({ [`${this._config.scale}s`]: 1 }));
  }
  /**
   * @param {Scales} value
   */
  setScale(value) {
    this.load({ scale: value });
  }
  setToday() {
    this.setDate(luxon.DateTime.utc());
  }
  setFilterActive(fieldName, filterValue, active) {
    const section = this._filterSections[fieldName];
    if (section) {
      const filter = section.find((filter) => filter.value === filterValue);
      if (filter) {
        filter.active = active;
      }
    }

    this.load();
  }

  //----------------------------------------------------------------------------
  // Utils
  //----------------------------------------------------------------------------

  /**
   * @param {CalendarEvent} event
   */
  makeContextDefaultsFromEvent(event) {
    if (["month", "year"].includes(this._config.scale)) {
      event = Object.create(event, { allDay: { value: true } });
    }

    const record = this._convertEventToRecord(event);
    const context = {};
    const { fieldMap } = this._config;

    if (record.name) {
      context.default_name = record.name;
    }
    context[`default_${fieldMap.date_start}`] = record[fieldMap.date_start] || null;
    for (const key of ["date_stop", "date_delay", "all_day"]) {
      if (fieldMap[key]) {
        context[`default_${fieldMap[key]}`] = record[fieldMap[key]] || null;
      }
    }

    return context;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Private
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @protected
   * @returns {Promise<Object>}
   */
  async _fetchRecords() {
    return this._services.orm.searchRead(
      this._config.modelName,
      this._computeDomain(),
      this._config.fieldNames
    );
  }
  /**
   * @protected
   */
  async _load() {
    this._config.weekRange = this._computeWeekRange();
    this._config.dateRange = this._computeDateRange();
    await this._loadFilters();
    const records = await this._fetchRecords();
    this._events = this._mapRecordsToEvents(records);
    await this._loadColors();
    await this._loadFiltersFromEvents();
  }
  /**
   * @protected
   */
  async _loadColors() {
    const colorField = this._config.fieldMap.color;
    if (colorField) {
      for (const event of this._events) {
        const raw = event.extendedProps.record[colorField];
        event.extendedProps.colorIndex = Array.isArray(raw) ? raw[0] : raw;
      }

      this._colorModelName = this._config.fields[colorField].relation || this._config.modelName;
    }
  }
  /**
   * @protected
   * @param {Object[]}
   * @returns {CalendarEvent[]}
   */
  _mapRecordsToEvents(records) {
    return records.map((r) => this._convertRecordToEvent(r));
  }
  /**
   * @protected
   * @param {Object} [config]
   */
  _updateConfig(config) {
    for (const key of LOAD_CONFIG_KEYS) {
      if (key in config) {
        this._config[key] = config[key];
      }
    }

    if ("scale" in config) {
      if (!this._config.scales.includes(config.scale)) {
        throw new Error(
          `scale (${config.scale}) should be one of ${this._config.scales.join(", ")}`
        );
      }
    }
    if ("date" in config) {
      this._config.date = config.date.setZone(luxon.Info.normalizeZone(this._services.user.tz));
    }
  }

  //----------------------------------------------------------------------------
  // Computed
  //----------------------------------------------------------------------------

  /**
   * @protected
   * @returns {{start: DateTime, end: DateTime}}
   */
  _computeDateRange() {
    const { date, scale, weekRange } = this._config;

    let start = date.toUTC();
    let end = date.toUTC();

    if (scale !== "week") {
      // startOf("week") does not depend on locale and will always give the
      // "Monday" of the week...
      start = start.startOf(scale);
      end = end.endOf(scale);
    }

    if (scale !== "day") {
      const weekStart = start.weekday < weekRange.start ? weekRange.start - 7 : weekRange.start;
      const weekEnd = end.weekday < weekRange.start ? weekRange.end - 7 : weekRange.end;

      start = start.set({ weekday: weekStart }).startOf("day");
      end = end.set({ weekday: weekEnd }).endOf("day");
    }

    return {
      start: start.setZone(luxon.Info.normalizeZone(this._services.user.tz)),
      end: end.setZone(luxon.Info.normalizeZone(this._services.user.tz)),
    };
  }
  /**
   * @protected
   * @returns {{start: number, end: number}}
   */
  _computeWeekRange() {
    const { weekStart } = localization;
    if (![undefined, false].includes(weekStart)) {
      return {
        start: weekStart,
        end: weekStart + 6,
      };
    } else {
      const today = luxon.DateTime.utc();
      return {
        start: today.startOf("week").weekday,
        end: today.endOf("week").weekday,
      };
    }
  }

  //----------------------------------------------------------------------------
  // Domain
  //----------------------------------------------------------------------------

  /**
   * @protected
   * @returns {[string, string, any][]}
   */
  _computeDomain() {
    return [
      ...this._config.domain,
      ...this._computeDateRangeDomain(),
      ...this._computeFiltersDomain(),
    ];
  }
  /**
   * @protected
   * @returns {[string, string, any][]}
   */
  _computeDateRangeDomain() {
    const { fieldMap, dateRange } = this._config;
    const formattedEnd = dateRange.end.toFormat(DATE_FORMATS.datetime);
    const formattedStart = dateRange.start.toFormat(DATE_FORMATS.datetime);

    const domain = [[fieldMap.date_start, "<=", formattedEnd]];
    if (fieldMap.date_stop) {
      domain.push([fieldMap.date_stop, ">=", formattedStart]);
    } else if (!fieldMap.date_delay) {
      domain.push([fieldMap.date_start, ">=", formattedStart]);
    }
    return domain;
  }
  /**
   * @protected
   * @returns {[string, string, any][]}
   */
  _computeFiltersDomain() {
    // List authorized values for every field
    // fields with an active "all" filter are skipped
    const authorizedValues = {};
    const avoidValues = {};

    for (const [fieldName, filterSection] of Object.entries(this._filterSections)) {
      // Skip "all" filters because they do not affect the domain
      const filterAll = filterSection.find((f) => f.value === "all");
      if (!(filterAll && filterAll.active)) {
        const filterSectionInfo = this._config.filterSectionsInfo[fieldName];

        // Loop over subfilters to complete authorizedValues
        for (const filter of filterSection) {
          if (filterSectionInfo.write.model) {
            if (!authorizedValues[fieldName]) {
              authorizedValues[fieldName] = [];
            }
            if (filter.active) {
              authorizedValues[fieldName].push(filter.value);
            }
          } else {
            if (!filter.active) {
              if (!avoidValues[fieldName]) {
                avoidValues[fieldName] = [];
              }
              avoidValues[fieldName].push(filter.value);
            }
          }
        }
      }
    }

    // Compute the domain
    const domain = [];
    for (const field in authorizedValues) {
      domain.push([field, "in", authorizedValues[field]]);
    }
    for (const field in avoidValues) {
      if (avoidValues[field].length > 0) {
        domain.push([field, "not in", avoidValues[field]]);
      }
    }
    return domain;
  }

  //----------------------------------------------------------------------------
  // Conversion
  //----------------------------------------------------------------------------

  /**
   * @protected
   * @param {CalendarEvent} event
   * @param {Object} [options]
   * @param {boolean} [options.drop=false]
   * @returns {Object}
   */
  _convertEventToRecord(event, options = {}) {
    const { fieldMap, fields, scale } = this._config;
    const record = {};

    record[fieldMap.create_name_field || "name"] = event.title;

    const dateStartType = fields[fieldMap.date_start].type;
    let dateStopType = null;
    if (fieldMap.date_stop) {
      dateStopType = fields[fieldMap.date_stop].type;
    }

    const allDay = event.allDay;
    let start = luxon.DateTime.fromJSDate(event.start).toUTC();
    let end = event.end && luxon.DateTime.fromJSDate(event.end).toUTC();

    if (!end || end.diff(start).milliseconds < 0) {
      if (allDay) {
        end = start;
      } else {
        end = start.plus({ hours: 2 });
      }
    } else if (allDay) {
      end = end.minus({ days: 1 });
    }

    if (allDay) {
      if (!fieldMap.all_day && dateStartType !== "date") {
        if (event.extendedProps && event.extendedProps.recordStart) {
          const recordStart = event.extendedProps.recordStart;
          start = start
            .set({
              hours: recordStart.hours,
              minutes: recordStart.minutes,
              seconds: recordStart.seconds,
            })
            .toUTC();
          const recordEnd = event.extendedProps.recordEnd;
          end = end
            .set({
              hours: recordEnd.hours,
              minutes: recordEnd.minutes,
              seconds: recordEnd.seconds,
            })
            .toUTC();
        } else {
          start = start.set({ hours: 7 });
          end = end.set({ hours: 19 });
        }
      }
    }

    if (fieldMap.all_day) {
      if (event.extendedProps && event.extendedProps.record) {
        record[fieldMap.all_day] =
          (scale !== "month" && event.allDay) ||
          (event.extendedProps.record[fieldMap.all_day] && end.diff(start).milliseconds < 10) ||
          false;
      } else {
        record[fieldMap.all_day] = allDay;
      }
    }

    record[fieldMap.date_start] = formatDateTime(start, {
      format: DATE_FORMATS[dateStartType],
      timezone: true,
    });
    if (fieldMap.date_stop) {
      record[fieldMap.date_stop] = formatDateTime(end, {
        format: DATE_FORMATS[dateStopType],
        timezone: true,
      });
    }

    if (fieldMap.date_delay) {
      if (scale !== "month" || !options.drop) {
        let diff = end.diff(start).milliseconds;
        if (diff <= 0) {
          diff = end.endOf("day").diff(start).milliseconds;
        }
        record[fieldMap.date_delay] = diff / 1000 / 3600;
      }
    }

    return record;
  }
  /**
   * @protected
   * @param {Object} record
   * @returns {CalendarEvent}
   */
  _convertRecordToEvent(record) {
    const { fields, fieldMap } = this._config;

    const dateStartType = fields[fieldMap.date_start].type;
    const dateStart = parseDateTime(record[fieldMap.date_start], {
      format: DATE_FORMATS[dateStartType],
    }).toJSDate();

    let dateStop = dateStart;
    if (fieldMap.date_stop) {
      const dateStopType = fields[fieldMap.date_stop].type;
      dateStop = parseDateTime(record[fieldMap.date_stop], {
        format: DATE_FORMATS[dateStopType],
        timezone: true,
      }).toJSDate();
    }

    const allDay =
      dateStartType === "date" || (fieldMap.all_day && record[fieldMap.all_day]) || false;

    // let colorIndex = false;
    // if (fieldMap.color) {
    //   const rawValue = record[fieldMap.color];
    //   colorIndex = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    // }

    let showTime =
      fieldMap.all_day &&
      record[fieldMap.all_day] &&
      this._config.scale === "month" &&
      dateStartType !== "date";

    return {
      id: record.id,
      title: record.display_name,
      start: dateStart,
      end: dateStop,
      allDay,
      extendedProps: {
        record,
        // colorIndex,
        recordStart: dateStart,
        recordEnd: dateStop,
        showTime,
      },
    };
  }

  //----------------------------------------------------------------------------
  // Filters
  //----------------------------------------------------------------------------

  //////////////////////////////////////////////////////////////////////////////
  // @todo [MCM] This part should be rewritten!
  //////////////////////////////////////////////////////////////////////////////

  async _loadFilters() {
    for (const [fieldName, filterSectionInfo] of Object.entries(this._config.filterSectionsInfo)) {
      if (!this._filterSections[fieldName]) {
        this._filterSections[fieldName] = [];
      }
      await this._loadFilter(fieldName, filterSectionInfo);
    }
  }

  async _loadFilter(fieldName, filterSectionInfo) {
    const { orm, user } = this._services;
    if (!filterSectionInfo.write.model) {
      return;
    }

    const field = this._config.fields[fieldName];
    /** @type {any[]} */
    const records = await orm.searchRead(
      filterSectionInfo.write.model,
      [["user_id", "=", user.userId]],
      [filterSectionInfo.write.field]
    );
    const filters = records.map((record) => {
      const raw = record[filterSectionInfo.write.field];
      const value = Array.isArray(raw) ? raw[0] : raw;
      const isX2M = ["many2many", "one2many"].includes(field.type);
      const formatter = formats[isX2M ? "many2one" : field.type];
      const previousFilter = this._filterSections[fieldName].find((f) => f.value === value);
      // By default, only current user partner is checked.
      return {
        id: record.id,
        value,
        label: formatter(raw, field, {}),
        active: previousFilter ? previousFilter.active : false,
      };
    });

    filters.sort((f1, f2) => f2.label.localeCompare(f1.label));

    // add my profile
    const isUserOrPartner = ["res.partner", "res.users"].includes(field.relation);
    if (isUserOrPartner) {
      const value = field.relation === "res.partner" ? user.partnerId : user.userId;
      let filter = filters.find((filter) => filter.value === value);
      if (filter) {
        filters.splice(filters.indexOf(filter), 1);
      } else {
        const previousFilter = this._filterSections[fieldName].find((f) => f.value === value);
        filter = {
          value,
          label: user.name,
          active: previousFilter ? previousFilter.active : true,
        };
      }
      filters.unshift(filter);
    }

    // add all selection
    const previousFilter = this._filterSections[fieldName].find((f) => f.value === "all");
    filters.push({
      value: "all",
      label: isUserOrPartner ? this.env._t("Everybody's calendars") : this.env._t("Everything"),
      active: previousFilter ? previousFilter.active : false,
    });

    this._filterSections[fieldName] = filters;
  }

  async _loadFiltersFromEvents() {
    const toRead = {};
    const defs = [];
    const colorFilters = {};

    for (const [fieldName, filterSectionInfo] of Object.entries(this._config.filterSectionsInfo)) {
      const field = this._config.fields[fieldName];
      const filters = this._filterSections[fieldName];

      if (filterSectionInfo.write.model) {
        if (field.relation === this._colorModelName) {
          for (const filter of filters) {
            filter.colorIndex = filter.value;
          }
        }
      } else {
        for (const filter of filters) {
          filter.display = !filter.active;
        }

        const fs = [];
        const undefinedFs = [];

        for (const event of this._events) {
          let data = event.extendedProps.record[fieldName];

          if (["one2many", "many2many"].includes(field.type)) {
            if (!toRead[field.relation]) {
              toRead[field.relation] = [];
            }
            toRead[field.relation].push(data);
          } else {
            data = [data];
          }

          for (const raw of data) {
            const value = Array.isArray(raw) ? raw[0] : raw;
            const filter = {
              value,
              label: formats[field.type](raw, field) || this.env._t("Undefined"),
              colorIndex:
                this._colorModelName === (field.relation || this._config.modelName) ? value : false,
              avatarModel: field.relation || this._config.modelName,
            };

            // if field used as color does not have value then push filter in undefinedFs,
            // such filters should come last in filter list with Undefined string, later merge it with fs
            if (value) {
              fs.push(filter);
            } else {
              undefinedFs.push(filter);
            }
          }
        }

        for (const filter of [...fs, ...undefinedFs]) {
          const previousFilter = filters.find((f) => f.value === filter.value);
          if (previousFilter) {
            previousFilter.display = true;
          } else {
            filter.display = true;
            filter.active = true;
            filters.push(filter);
          }
        }

        const { model: colorModel, field: colorField } = filterSectionInfo.color;
        if (colorModel && colorField) {
          const ids = [];
          for (const filter of filters) {
            if (!filter.colorIndex && filter.value) {
              ids.push(filter.value);
            }
          }
          if (!colorFilters[colorModel]) {
            colorFilters[colorModel] = {};
          }
          if (ids.length) {
            const def = this._services.orm
              .read(colorModel, [...new Set(ids)], [colorField])
              .then((records) => {
                for (const record of records) {
                  colorFilters[colorModel][record.id] = record[colorField];
                }
              });

            defs.push(def);
          }
        }
      }
    }

    for (const [model, ids] of Object.entries(toRead)) {
      const def = this._services.orm
        .call(model, "name_get", [[...new Set(ids)]])
        .then((results) => {
          for (const result of results) {
            toRead[model][result[0]] = result[1];
          }
        });

      defs.push(def);
    }

    await Promise.all(defs);

    for (const [fieldName, filterSection] of Object.entries(this._filterSections)) {
      const filterSectionInfo = this._config.filterSectionsInfo[fieldName];
      if (!filterSectionInfo.write.model) {
        if (filterSection.length && filterSection[0].avatarModel in toRead) {
          for (const filter of filterSection) {
            filter.label = toRead[filter.avatarModel][filter.value];
          }
        }
        const colorModel = filterSectionInfo.color.model;
        if (colorModel && colorFilters[colorModel]) {
          for (const filter of filterSection) {
            if (!filter.colorIndex) {
              filter.colorIndex = colorFilters[colorModel][filter.value];
            }
          }
        }
      }
    }
  }
}
