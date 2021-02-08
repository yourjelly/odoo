/** @odoo-module **/

///
/// Extract filter management in another model ?
/// make a custom Search Panel for Calendar [wanted in task 2245464]
///

import { SCALES, SCALE_TO_LUXON_UNIT } from "./view_description";
import { unique } from "../../utils/arrays";

const { EventBus } = owl.core;

/**
 * @typedef {import("./types").Scales} Scales
 * @typedef {import("./types").CalendarFilterInfo} CalendarFilterInfo
 * @typedef {import("./types").CalendarFilter} CalendarFilter
 * @typedef {import("./types").CalendarFilterType} CalendarFilterType
 * @typedef {import("./types").CalendarModelProps} CalendarModelProps
 * @typedef {import("./types").CalendarModelState} CalendarModelState
 * @typedef {import("./types").CalendarEvent} CalendarEvent
 */

const DATE_FORMATS = {
  date: "yyyy-MM-dd",
  datetime: "yyyy-MM-dd HH:mm:ss",
};

function parseDate(str, format) {
  return luxon.DateTime.fromFormat(str, format, {
    zone: "utc",
  }).toLocal();
}

function computeWeekRange(localizationService) {
  if (localizationService.weekStart !== undefined &&
    localizationService.weekStart !== false
  ) {
    const ws = localizationService.weekStart % 7;
    return {
      start: ws,
      end: ws + 6,
    };
  } else {
    const date = luxon.DateTime.utc();
    return {
      start: date.startOf("week").weekday,
      end: date.endOf("week").weekday,
    };
  }
}

export default class CalendarModel extends EventBus {
  constructor(searchModel, services, props) {
    super();

    /**
     * @type {any}
     * @readonly
     */
    this.searchModel = searchModel;
    /**
     * @type {{ model: any, user: any, localization: any }}
     * @readonly
     */
    this.services = services;
    /**
     * @type {CalendarModelProps}
     * @readonly
     */
    this.props = props;

    /**
     * @type {string}
     * @readonly
     */
    this.colorModelName = this.props.fieldMap.color ?
      this.props.fields[this.props.fieldMap.color].relation :
      this.props.modelName;

    /**
     * @type {CalendarModelState}
     */
    this.state = {
      date: this.props.initialDate,
      events: [],
      filters: {},
      scale: this.props.scale,
      range: {
        start: this.props.initialDate,
        end: this.props.initialDate,
      },
      weekRange: computeWeekRange(this.services.localization),
    };

    for (const key of Object.keys(this.props.filtersInfo)) {
      this.state.filters[key] = {};
    }
    this._computeDateRange();
  }

  /**
   * @param {Object} [params]
   * @param {any} [params.date]
   * @param {Scales} [params.scale]
   * @param {Object} [params.filter]
   * @param {string} params.filter.fieldName
   * @param {string | number} params.filter.filterValue
   */
  async load(params) {
    const previousState = Object.assign({}, this.state);

    if (params) {
      if (params.hasOwnProperty("date")) {
        this.state.date = params.date;
        this._computeDateRange();
      }
      if (params.hasOwnProperty("scale")) {
        if (SCALES.includes(params.scale)) {
          this.state.scale = params.scale;
        } else {
          this.state.scale = "week";
        }
        this._computeDateRange();
      }
      if (params.hasOwnProperty("filter")) {
        const filter = this.state.filters[params.filter.fieldName][params.filter.filterValue];
        filter.active = !filter.active;
      }
    }

    await this._loadFilters();

    const domain = this._computeDomain();
    const records = await this.services.model(this.props.modelName)
      .searchRead(domain, this.props.fieldNames);
    this.state.events = records.map((r) => this._convertRecordToEvent(r));

    await this._loadFiltersFromRecords(records);
    await this._loadFilterColors();

    this.trigger("update", previousState);
  }

  //----------------------------------------------------------------------------
  // Public
  //----------------------------------------------------------------------------

  create() {
  }
  unlink() {
  }
  update() {
  }

  /**
   * @param {luxon.DateTime} date
   */
  async setDate(date) {
    await this.load({
      date,
    });
  }
  /**
   * @param {string} fieldName
   * @param {string | number} filterValue
   */
  async toggleFilter(fieldName, filterValue) {
    await this.load({
      filter: {
        fieldName,
        filterValue,
      },
    });
  }
  /**
   *
   */
  async setNextDate() {
    return this.setDate(this.state.date.plus({
      [SCALE_TO_LUXON_UNIT[this.state.scale]]: 1,
    }));
  }
  /**
   *
   */
  async setPreviousDate() {
    return this.setDate(this.state.date.minus({
      [SCALE_TO_LUXON_UNIT[this.state.scale]]: 1,
    }));
  }
  /**
   * @param {Scales} scale
   */
  async setScale(scale) {
    await this.load({
      scale,
    });
  }
  /**
   *
   */
  async setToday() {
    return this.setDate(luxon.DateTime.utc());
  }

  //----------------------------------------------------------------------------
  // Private
  //----------------------------------------------------------------------------

  /**
   * @private
   */
  _computeDateRange() {
    this.state.range = {
      start: this.state.date.startOf(this.state.scale),
      end: this.state.date.endOf(this.state.scale),
    };

    if (this.state.scale !== "day") {
      this.state.range.start = this.state.range.start.set({
        weekday: this.state.weekRange.start
      }).startOf("day");
      this.state.range.end = this.state.range.end.set({
        weekday: this.state.weekRange.end
      }).endOf("day");
    }
  }
  /**
   * @private
   * @returns {any[]}
   */
  _computeDomain() {
    return [
      ...this.searchModel.domain,
      ...this._computeRangeDomain(),
      ...this._computeFilterDomain(),
    ];
  }
  /**
   * @private
   * @returns {any[]}
   */
  _computeFilterDomain() {
    /** @type {Map<string, (string | number)[]>} */
    const authorizedValues = new Map();
    /** @type {Map<string, (string | number)[]>} */
    const avoidValues = new Map();

    for (const [fieldName, filters] of Object.entries(this.state.filters)) {
      if (filters.all && filters.all.active) {
        continue;
      }

      for (const filter of Object.values(filters)) {
        if (this.props.filtersInfo[fieldName].write.model) {
          if (!authorizedValues.has(fieldName)) {
            authorizedValues.set(fieldName, []);
          }
          if (filter.active) {
            authorizedValues.get(fieldName).push(filter.value);
          }
        } else {
          if (!filter.active) {
            if (!avoidValues.has(fieldName)) {
              avoidValues.set(fieldName, []);
            }
            avoidValues.get(fieldName).push(filter.value);
          }
        }
      }
    }

    const domain = [];
    for (const [fieldName, values] of authorizedValues.entries()) {
      domain.push([ fieldName, "in", values ]);
    }
    for (const [fieldName, values] of avoidValues.entries()) {
      if (values.length) {
        domain.push([ fieldName, "not in", values ]);
      }
    }

    return domain;
  }
  /**
   * @private
   * @returns {string[]}
   */
  _computeRangeDomain() {
    const domain = [
      [this.props.fieldMap.date_start, "<=", this.state.range.end.toFormat(DATE_FORMATS.datetime)]
    ];
    if (this.props.fieldMap.date_stop) {
      domain.push(
        [this.props.fieldMap.date_stop, ">=", this.state.range.start.toFormat(DATE_FORMATS.datetime)]
      );
    } else if (!this.props.fieldMap.date_delay) {
      domain.push(
        [this.props.fieldMap.date_start, ">=", this.state.range.start.toFormat(DATE_FORMATS.datetime)]
      );
    }
    return domain;
  }
  /**
   * @private
   * @param {any} event
   * @returns {any}
   */
  _convertEventToRecord(event) {
  }
  /**
   * @private
   * @param {any} record
   * @returns {CalendarEvent}
   */
  _convertRecordToEvent(record) {
    const dateStartType = this.props.fields[this.props.fieldMap.date_start].type;
    const dateStart = parseDate(record[this.props.fieldMap.date_start], DATE_FORMATS[dateStartType])
      .toJSDate();

    let dateStop = dateStart;
    if (this.props.fieldMap.date_stop) {
      const dateStopType = this.props.fields[this.props.fieldMap.date_stop].type;
      dateStop = parseDate(record[this.props.fieldMap.date_stop], DATE_FORMATS[dateStopType])
        .toJSDate();
    }

    const allDay = dateStartType === "date" || this.props.fieldMap.all_day &&
      record[this.props.fieldMap.all_day] || false;

    let colorIndex = false;
    if (this.props.fieldMap.color) {
      const rawValue = record[this.props.fieldMap.color];
      colorIndex = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    }

    return {
      id: record.id,
      title: record.display_name,
      start: dateStart,
      end: dateStop,
      allDay,
      extendedProps: {
        record,
        colorIndex,
      },
    };
  }
  /**
   * @private
   */
  async _loadFilterColors() {
    for (const [fieldName, filterInfo] of Object.entries(this.props.filtersInfo)) {
      const field = this.props.fields[fieldName];

      if (filterInfo.write.model) {
        if (field.relation === this.colorModelName) {
          for (const filter of Object.values(this.state.filters[fieldName])) {
            filter.colorIndex = filter.value;
          }
        }
        continue;
      }

      if (filterInfo.color.model && filterInfo.color.field) {
        const ids = [];
        for (const filter of Object.values(this.state.filters[fieldName])) {
          if (field.relation !== this.colorModelName && filter.value) {
            ids.push(filter.value);
          }
        }

        if (ids.length) {
          const records = await this.services.model(filterInfo.color.model)
            .read(unique(ids), [filterInfo.color.field]);
          for (const record of records) {
            this.state.filters[fieldName][record.id].colorIndex = record[filterInfo.color.field];
          }
        }
      }
    }
  }
  /**
   * @private
   */
  async _loadFilters() {
    for (const [fieldName, filterInfo] of Object.entries(this.props.filtersInfo)) {
      if (filterInfo.write.model) {
        const records = await this.services.model(filterInfo.write.model)
          .searchRead([
            ["user_id", "=", this.services.user.userId]
          ], [filterInfo.write.field]);
        const field = this.props.fields[fieldName];
        const filters = this.state.filters[fieldName];

        // Add filters from fetched records
        for (const record of records) {
          const rawValue = record[filterInfo.write.field];
          const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

          filters[value] = this._makeFilter({
            previousFilter: filters[value],
            value,
            type: "record",
            label: `${Array.isArray(rawValue) ? rawValue[1] : rawValue}`,
            recordId: record.id,
          });
        }

        // Add my profile
        if (["res.partner", "res.users"].includes(field.relation)) {
          const value = field.relation === 'res.partner' ?
            this.services.user.partnerId :
            this.services.user.userId;

          filters[value] = this._makeFilter({
            previousFilter: filters[value],
            value,
            type: "user",
            label: `${this.services.user.name} [${this.services.localization._t("Me")}]`,
          });
        }

        // Add "all" selection
        filters.all = this._makeFilter({
          previousFilter: filters.all,
          value: "all",
          type: "all",
          label: ["res.partner", "res.users"].includes(field.relation) ?
            this.services.localization._t("Everybody's calendars") :
            this.services.localization._t("Everything"),
          active: !!filters.all && filters.all.active,
        });
      }
    }
  }
  /**
   * @private
   * @param {any[]} records
   */
  async _loadFiltersFromRecords(records) {
    const filtersToNameGet = {};

    for (const [fieldName, filterInfo] of Object.entries(this.props.filtersInfo)) {
      const field = this.props.fields[fieldName];

      if (filterInfo.write.model) {
        continue;
      }

      for (const record of records) {
        let fieldValues = [];
        if (!["many2many", "one2many"].includes(field.type)) {
          fieldValues = [record[fieldName]];
        } else {
          fieldValues = record[fieldName];
          if (!filtersToNameGet[field.relation]) {
            filtersToNameGet[field.relation] = [];
          }
          filtersToNameGet[field.relation].push(fieldValues);
        }

        for (const rawValue of fieldValues) {
          const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
          this.state.filters[fieldName][value] = this._makeFilter({
            previousFilter: this.state.filters[fieldName][value],
            value,
            type: "record",
            label: `${Array.isArray(rawValue) ? rawValue[1] : rawValue}`,
            colorIndex: this.colorModelName === field.relation && value,
          });
        }
      }
    }

    // @todo [mcm] name get
  }
  /**
   * @private
   * @param {Object} params
   * @param {CalendarFilter} params.previousFilter
   * @param {string | number} params.value
   * @param {CalendarFilterType} params.type
   * @param {string} params.label
   * @param {number | false} [params.recordId = false]
   * @param {boolean} [params.active = false]
   * @param {number | false} [params.colorIndex = false]
   * @returns {CalendarFilter}
   */
  _makeFilter(params) {
    return {
      type: params.value ? params.type : "undefined",
      recordId: (params.previousFilter && params.previousFilter.recordId) || params.recordId || false,
      value: params.value,
      label: params.value ? params.label : this.services.localization._t("Undefined"),
      active: "active" in params ? params.active : (!params.previousFilter || params.previousFilter.active),
      colorIndex: params.colorIndex || false,
    };
  }
}
