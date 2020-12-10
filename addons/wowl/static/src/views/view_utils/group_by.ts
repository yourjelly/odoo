import { Fields } from "../graph/types";
import { DEFAULT_INTERVAL, INTERVAL_OPTIONS, IntervalId } from "./search_utils";

export interface GroupBy {
  fieldName: string;
  interval: IntervalId | null;
  toJSON(): string;
}

function errorMsg(descr: string) {
  return `Invalid groupBy description: ${descr}`;
}

export function getGroupBy(descr: string, fields?: Fields): GroupBy {
  let description: string;
  let fieldName: string;
  let interval: string | null;
  [fieldName, interval] = descr.split(":");
  if (!fieldName) {
    throw Error();
  }
  if (fields) {
    if (!fields[fieldName]) {
      throw Error(errorMsg(descr));
    }
    const fieldType = fields[fieldName].type;
    if (["date", "datetime"].includes(fieldType)) {
      if (!interval) {
        interval = DEFAULT_INTERVAL;
      } else if (!Object.keys(INTERVAL_OPTIONS).includes(interval)) {
        throw Error(errorMsg(descr));
      }
      description = `${fieldName}:${interval}`;
    } else if (interval) {
      throw Error(errorMsg(descr));
    } else {
      description = fieldName;
      interval = null;
    }
  } else {
    if (interval) {
      if (!Object.keys(INTERVAL_OPTIONS).includes(interval)) {
        throw Error(errorMsg(descr));
      }
      description = `${fieldName}:${interval}`;
    } else {
      description = fieldName;
      interval = null;
    }
  }

  return {
    fieldName,
    interval: interval as IntervalId | null,
    toJSON() {
      return description;
    },
  };
}
