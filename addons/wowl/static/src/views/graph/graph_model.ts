import { SearchModel, ModelParams } from "../view_utils/search_model";
import { ReadGroupResult } from "../../services/model";
import { sortBy } from "../../utils/arrays";
import { ChartData, ChartDataSets } from "chart.js";
import { Fields } from "./view";
import { DomainListRepr } from "../../core/domain";

export interface GraphModelParams extends ModelParams {
  fields: Fields;
  activeMeasure: string;
}

export interface DataPoint {
  resId: number;
  count: number;
  domain: DomainListRepr;
  value: any;
  labels: string[];
  originIndex: number;
}

export interface DataSet extends ChartDataSets {
  originIndex: number;
  domains: DomainListRepr[];
}

export interface Data extends ChartData {
  labels: string[][];
  datasets: DataSet[];
}

export type Mode = "bar" | "line" | "pie";
export const MODES: Mode[] = ["bar", "line", "pie"];

export type Order = "ASC" | "DESC" | null;
export const ORDERS: Order[] = ["ASC", "DESC", null];

export type NoContentHelperData = null | { description: string; title: string };

// to remove in some way
export class DateClasses<T = string> {
  private __array: T[][];
  private __referenceIndex: number | null = null;

  constructor(array: T[][]) {
    this.__array = array;
    for (let i = 0; i < this.__array.length; i++) {
      const arr = this.__array[i];
      if (arr.length && this.__referenceIndex === null) {
        this.__referenceIndex = i;
      }
    }
  }
  classLabel(index: number, o: T): string {
    return `${this.__array[index].indexOf(o)}`;
  }
  classMembers(classLabel: string): T[] {
    const classNumber = Number(classLabel);
    const classMembers = new Set<T>();
    for (const arr of this.__array) {
      if (arr[classNumber] !== undefined) {
        classMembers.add(arr[classNumber]);
      }
    }
    return [...classMembers];
  }
  representative(classLabel: string, index?: number): T | null {
    const classNumber = Number(classLabel);
    const i = index === undefined ? this.__referenceIndex : index;
    if (!i) {
      return null;
    }
    return this.__array[i][classNumber];
  }
  arrayLength(index: number): number {
    return this.__array[index].length;
  }
}

export class GraphModel extends SearchModel {
  fields: Fields = {};

  dataPoints: DataPoint[] = [];

  noContentHelperData: NoContentHelperData = null;
  data: null | Data = null;
  dateClasses: DateClasses | null = null;

  private __activeMeasure: string = "__count__";
  private __mode: Mode = "bar";
  private __order: Order = null;

  get activeMeasure() {
    return this.__activeMeasure;
  }

  set activeMeasure(measure: string) {
    this.__activeMeasure = measure;
    this.loadGraph();
    this.trigger("UPDATE");
  }

  get comparisonIndex(): number {
    return -1; // adapt when comparisons are available
  }

  get origins(): string[] {
    return [""]; // adapt when comparisons are available
  }

  get mode(): Mode {
    return this.__mode;
  }

  set mode(mode: Mode) {
    this.__mode = mode;
    this.prepareChartData();
    this.trigger("UPDATE");
  }

  get order() {
    return this.__order;
  }

  set order(order: Order) {
    this.__order = order;
    this.prepareChartData();
    this.trigger("UPDATE");
  }

  /**
   * Process this.groupBy in order to keep only the finer interval option for
   * elements based on date/datetime field (e.g. 'date:year'). This means that
   * 'week' is prefered to 'month'. The field stays at the place of its first occurence.
   * For instance,
   * ['foo', 'date:month', 'bar', 'date:week'] becomes ['foo', 'date:week', 'bar'].
   */
  get processedGroupBy(): string[] {
    // const groupBysMap = new Map();
    // for (const gb of this.groupBy) {
    //   let [fieldName, interval] = gb.split(":");
    //   const field = this.fields[fieldName];
    //   if (["date", "datetime"].includes(field.type)) {
    //     if (Object.keys(INTERVAL_OPTIONS).includes(interval)) {
    //       interval = interval || DEFAULT_INTERVAL;
    //     } else {
    //       throw Error("invalid interval")
    //     }
    //   }
    //   if (groupBysMap.has(fieldName)) {
    //     const registeredInterval = groupBysMap.get(fieldName);
    //     if (rankInterval(registeredInterval) < rankInterval(interval)) {
    //       groupBysMap.set(fieldName, interval);
    //     }
    //   } else {
    //     groupBysMap.set(fieldName, interval);
    //   }
    // }
    // return [...groupBysMap].map(([fieldName, interval]) => {
    //   if (interval) {
    //     return `${fieldName}:${interval}`;
    //   }
    //   return fieldName;
    // });
    return this.groupBy.map((g) => g.toJSON()); // adapt in future
  }

  async load(params: GraphModelParams) {
    await super.load(params);
    this.fields = params.fields;
    await this.loadGraph();
  }

  async _update() {
    await this.loadGraph();
  }

  /**
   * Filters out some dataPoints because they would lead to bad graphics.
   * The filtering is done with respect to the graph view mode.
   * Note that the method does not alter this.state.dataPoints, since we
   * want to be able to change of mode without fetching data again:
   * we simply present the same data in a different way.
   * Note: this should be moved to the model at some point.
   */
  filterDataPoints(): DataPoint[] {
    let dataPoints = [];
    if (this.mode === "line") {
      let counts = 0;
      for (const dataPoint of this.dataPoints) {
        if (dataPoint.labels[0] !== this.env._t("Undefined")) {
          dataPoints.push(dataPoint);
        }
        counts += dataPoint.count;
      }
      // data points with zero count might have been created on purpose (fill_temporal)
      // we only remove them if there are no data point with positive count
      if (counts === 0) {
        dataPoints = [];
      }
    } else {
      dataPoints = this.dataPoints.filter((dataPoint) => dataPoint.count > 0);
    }
    return dataPoints;
  }

  /**
   * Determines whether the data are good, and displays an error message
   * if this is not the case.
   */
  getNoContentHelper(processedDataPoints: DataPoint[]): NoContentHelperData {
    if (this.mode === "pie") {
      const dataPoints = processedDataPoints;
      const someNegative = dataPoints.some((dataPt) => dataPt.value < 0);
      const somePositive = dataPoints.some((dataPt) => dataPt.value > 0);
      if (someNegative && somePositive) {
        return {
          title: this.env._t("Invalid data"),
          description: [
            this.env._t("Pie chart cannot mix positive and negative numbers. "),
            this.env._t("Try to change your domain to only display positive results"),
          ].join(""),
        };
      }
    }
    return null;
  }

  /**
   * Sorts datapoints according to the current order (ASC or DESC).
   * Note: this should be moved to the model at some point.
   */
  sortDataPoints(dataPoints: DataPoint[]): DataPoint[] {
    if (
      this.domains.length === 1 &&
      this.order &&
      this.mode !== "pie" &&
      this.processedGroupBy.length
    ) {
      // group data by their x-axis value, and then sort datapoints
      // based on the sum of values by group in ascending/descending order
      const [groupByFieldName] = this.processedGroupBy[0].split(":");
      const { type } = this.fields[groupByFieldName];
      const groupedDataPoints: { [key in string | number]: DataPoint[] } = {};
      for (const dataPt of dataPoints) {
        const key = type === "many2one" ? dataPt.resId : dataPt.labels[0];
        if (!groupedDataPoints[key]) {
          groupedDataPoints[key] = [];
        }
        groupedDataPoints[key].push(dataPt);
      }
      const groupTotal = (group: DataPoint[]) => group.reduce((sum, { value }) => sum + value, 0);
      let order; // pff un truc va mal ici
      if (this.order === "ASC") {
        order = "asc" as "asc";
      }
      if (this.order === "DESC") {
        order = "desc" as "desc";
      }
      dataPoints = sortBy<DataPoint[]>(Object.values(groupedDataPoints), groupTotal, order).reduce(
        (acc, group) => acc.concat(group),
        []
      ); // probleme with flat and typscript ... see https://stackoverflow.com/questions/53556409/typescript-flatmap-flat-flatten-doesnt-exist-on-type-any
    }
    return dataPoints;
  }

  /**
   * Determines the initial section of the labels array over which
   * a dataset has to be completed. The section only depends on the
   * datasets origins.
   */
  getDatasetDataLength(originIndex: number, defaultLength: number): number {
    if (this.mode !== "pie" && this.comparisonIndex === 0) {
      return this.dateClasses!.arrayLength(originIndex);
    }
    return defaultLength;
  }

  /**
   * Determines the dataset to which the data point belongs.
   * @private
   * @param {Object} dataPoint
   * @returns {string}
   */
  _getDatasetLabel(dataPoint: DataPoint): string {
    const { labels, originIndex } = dataPoint;
    if (this.mode === "pie") {
      return this.origins[originIndex];
    }
    // ([origin] + second to last groupBys) or measure
    let datasetLabel = labels.slice(1).join("/");
    if (this.origins.length > 1) {
      datasetLabel = this.origins[originIndex] + (datasetLabel ? "/" + datasetLabel : "");
    }
    datasetLabel = datasetLabel || this.fields[this.activeMeasure].string;
    return datasetLabel;
  }

  /**
   * Gets the label over which the data point is.
   */
  _getLabel(dataPoint: DataPoint): string[] {
    const { labels, originIndex } = dataPoint;
    const index = this.comparisonIndex;
    if (this.mode !== "pie") {
      if (index === 0) {
        return [this.dateClasses!.classLabel(originIndex, labels[index])];
      } else {
        return labels.slice(0, 1);
      }
    } else if (index === 0) {
      return [this.dateClasses!.classLabel(originIndex, labels[index]), ...labels.slice(index + 1)];
    } else {
      return labels;
    }
  }

  getDateClasses(dataPoints: DataPoint[]): DateClasses {
    const dateSets: Set<string>[] = this.origins.map(() => new Set<string>());
    for (const { labels, originIndex } of dataPoints) {
      const date: string = labels[this.comparisonIndex];
      if (date !== undefined) {
        dateSets[originIndex].add(date);
      }
    }
    const arrays: string[][] = dateSets.map((dateSet) => [...dateSet]);
    return new DateClasses(arrays);
  }

  /**
   * Separates dataPoints coming from the read_group(s) into different
   * datasets. This function returns the parameters data and labels used
   * to produce the charts.
   */
  prepareData(dataPoints: DataPoint[]): Data {
    const labelMap: { [key: string]: number } = {};
    const labels = [];
    const labelIndexes = new WeakMap<object, number>();
    for (const dataPt of dataPoints) {
      const label = this._getLabel(dataPt);
      const labelKey = `${dataPt.resId}:${JSON.stringify(label)}`;
      const index = labelMap[labelKey];
      if (index === undefined) {
        labelMap[labelKey] = labels.length;
        labelIndexes.set(dataPt, labels.length);
        labels.push(label);
      } else {
        labelIndexes.set(dataPt, index);
      }
    }

    // dataPoints --> datasets
    const datasetsTmp: { [key: string]: DataSet } = {};
    for (const dp of dataPoints) {
      const datasetLabel = this._getDatasetLabel(dp);
      if (!(datasetLabel in datasetsTmp)) {
        const dataLength = this.getDatasetDataLength(dp.originIndex, labels.length);
        datasetsTmp[datasetLabel] = {
          data: new Array(dataLength).fill(0),
          domains: new Array(dataLength).fill([]),
          label: datasetLabel,
          originIndex: dp.originIndex,
        };
      }
      const labelIndex = labelIndexes.get(dp) as number;
      datasetsTmp[datasetLabel].data![labelIndex] = dp.value;
      datasetsTmp[datasetLabel].domains![labelIndex] = dp.domain;
    }
    // sort by origin
    const datasets = sortBy(Object.values(datasetsTmp), "originIndex");
    return { datasets, labels };
  }

  processDataPoints(): DataPoint[] {
    const filteredDataPoints = this.filterDataPoints();
    const processedDataPoints = this.sortDataPoints(filteredDataPoints);
    return processedDataPoints;
  }

  prepareChartData() {
    const processedDataPoints = this.processDataPoints();
    this.noContentHelperData = this.getNoContentHelper(processedDataPoints);
    if (this.noContentHelperData) {
      this.dateClasses = null;
      this.data = null;
    } else {
      this.dateClasses =
        this.comparisonIndex === 0 ? null : this.getDateClasses(processedDataPoints);
      this.data = this.noContentHelperData ? null : this.prepareData(processedDataPoints);
    }
  }

  async loadGraph() {
    await this.loadDataPoints();
    this.prepareChartData();
  }

  /**
   * Fetch and process graph data.  It is basically a(some) read_group(s)
   * with correct fields for each domain.  We have to do some light processing
   * to separate date groups in the field list, because they can be defined
   * with an aggregation function, such as my_date:week.
   */
  async loadDataPoints() {
    const processedGroupBy = this.processedGroupBy;
    const fields: string[] = processedGroupBy.map((gb) => {
      return gb.split(":")[0];
    });
    if (this.activeMeasure !== "__count__") {
      let measure = this.activeMeasure;
      if (this.fields[this.activeMeasure].type === "many2one") {
        measure += ":count_distinct";
      }
      fields.push(measure);
    }

    const proms: Promise<DataPoint[]>[] = [];
    this.domains.forEach((domain, originIndex) => {
      proms.push(
        this.env.services
          .model(this.modelName)
          .readGroup(
            domain,
            fields,
            processedGroupBy,
            { lazy: true }, // what is this thing???
            { fill_temporal: true } // + old this.chart.context
          )
          .then((data: ReadGroupResult) => {
            const dataPoints = [];
            for (const group of data.groups) {
              const { __count, __domain: domain } = group;
              const labels = processedGroupBy.map((gb) => {
                return this._sanitizeValue(group[gb], gb.split(":")[0]);
              });

              var count = __count || group[processedGroupBy[0] + "_count"] || 0; // we should have always count
              var value = this.activeMeasure === "__count__" ? count : group[this.activeMeasure];
              if (value instanceof Array) {
                // when a many2one field is used as a measure AND as a grouped
                // field, bad things happen.  The server will only return the
                // grouped value and will not aggregate it.  Since there is a
                // name clash, we are then in the situation where this value is
                // an array.  Fortunately, if we group by a field, then we can
                // say for certain that the group contains exactly one distinct
                // value for that field.
                value = 1;
              }
              const resId =
                group[processedGroupBy[0]] instanceof Array ? group[processedGroupBy[0]][0] : -1;
              dataPoints.push({ resId, count, domain, value, labels, originIndex });
            }
            return dataPoints;
          })
      );
    });

    this.dataPoints = await Promise.all(proms).then((promResults: DataPoint[][]) => {
      const dataPoints = [];
      for (const result of promResults) {
        dataPoints.push(...result);
      }
      return dataPoints;
    });
  }

  /**
   * Helper function (for _processData), turns various values in a usable
   * string form, that we can display in the interface.
   */
  _sanitizeValue(value: any, fieldName: string): string {
    // Should we forced to do that each time ???
    const { type } = this.fields[fieldName];
    if (value === false && type !== "boolean") {
      return this.env._t("Undefined");
    }
    if (Array.isArray(value)) {
      return value[1];
    }
    if (fieldName && type === "selection") {
      // const selected = _.where(this.fields[fieldName].selection, {0: value})[0]; // to change !!!!
      const selected = false; // change that
      return selected ? selected[1] : value;
    }
    return value.toString();
  }
}
