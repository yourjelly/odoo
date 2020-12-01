import { OdooEnv } from "../types";
import { DateTime } from "luxon";
/**
 * Returns a string representing an many2one.  If the value is false, then we
 * return an empty string.  Note that it accepts two types of input parameters:
 * an array, in that case we assume that the many2one value is of the form
 * [id, nameget], and we return the nameget, or it can be an object, and in that
 * case, we assume that it is a record datapoint from a BasicModel.
 *
 * @param {Array|Object|false} value
 * @param {Object} [field]
 *        a description of the field (note: this parameter is ignored)
 * @param {Object} [options] additional options
 * @param {boolean} [options.escape=false] if true, escapes the formatted value
 * @returns {string}
 */
export function formatMany2one(value: any, field?: any, options?: { escape: boolean }) {
  if (!value) {
    value = "";
  } else if (Array.isArray(value)) {
    // value is a pair [id, nameget]
    value = value[1];
  } else {
    // value is a datapoint, so we read its display_name field, which
    // may in turn be a datapoint (if the name field is a many2one)
    while (value.data) {
      value = value.data.display_name || "";
    }
  }
  if (options && options.escape) {
    value = encodeURIComponent(value);
  }
  return value;
}

/**
 * Returns a string representing a datetime.  If the value is false, then we
 * return an empty string.  Note that this is dependant on the localization
 * settings
 *
 * @params {Moment|false}
 * @param {Object} [field]
 *        a description of the field (note: this parameter is ignored)
 * @param {Object} [options] additional options
 * @param {boolean} [options.timezone=true] use the user timezone when formating the
 *        date
 * @returns {string}
 */
export function formatDateTime(
  value: any,
  env: OdooEnv,
  field?: any,
  options?: { timezone: boolean }
) {
  if (value === false) {
    return "";
  }
  if (!options || !("timezone" in options) || options.timezone) {
    value = value.plus({ minutes: -new Date(value).getTimezoneOffset() });
  }
  return value.toFormat(getLangDatetimeFormat(env));
}

/**
 * Create an Date object
 * The method toJSON return the formated value to send value server side
 *
 * @param {string} value
 * @param {Object} [field]
 *        a description of the field (note: this parameter is ignored)
 * @param {Object} [options] additional options
 * @returns {Moment|false} Moment date object
 */
export function parseDateTime(value: any, env: OdooEnv, field?: any, options?: {}) {
  if (!value) {
    return false;
  }
  const datetime = DateTime.fromSQL(value);

  if (datetime.isValid) {
    return datetime;
  }
  throw new Error(`${env._t("'%s' is not a correct datetime")} ${value}`);
}

// TIME

const normalize_format_table: {
  [id: string]: any;
} = {
  // Python strftime to luxon.js conversion table
  // See openerp/addons/base/views/res_lang_views.xml
  // for details about supported directives
  a: "ccc",
  A: "cccc",
  b: "LLL",
  B: "LLLL",
  d: "dd",
  H: "HH",
  I: "hh",
  j: "o",
  m: "LL",
  M: "mm",
  p: "a",
  S: "ss",
  W: "WW",
  w: "c",
  y: "yy",
  Y: "yyyy",
  c: "ccc LLL d HH:mm:ss yyyy",
  x: "LL/dd/yy",
  X: "HH:mm:ss",
  //'U': 'WW', Not supported
};

const _normalize_format_cache: {
  [id: string]: any;
} = {};

/**
 * Convert Python strftime to escaped moment.js format.
 *
 * @param {String} value original format
 */
function strftime_to_moment_format(value: any) {
  if (_normalize_format_cache[value] === undefined) {
    const isletter = /[a-zA-Z]/,
      output = [];
    let inToken = false;

    for (let index = 0; index < value.length; ++index) {
      let character = value[index];
      if (character === "%" && !inToken) {
        inToken = true;
        continue;
      }
      if (isletter.test(character)) {
        if (inToken && normalize_format_table[character] !== undefined) {
          character = normalize_format_table[character];
        } else {
          character = "[" + character + "]"; // moment.js escape
        }
      }
      output.push(character);
      inToken = false;
    }
    _normalize_format_cache[value] = output.join("");
  }
  return _normalize_format_cache[value];
}

/**
 * Get date format of the user's language
 */
export function getLangDateFormat(env: OdooEnv) {
  return strftime_to_moment_format(env.services.user.dateFormat);
}

/**
 * Get time format of the user's language
 */
export function getLangTimeFormat(env: OdooEnv) {
  return strftime_to_moment_format(env.services.user.timeFormat);
}

/**
 * Get date time format of the user's language
 */
export function getLangDatetimeFormat(env: OdooEnv) {
  return strftime_to_moment_format(
    env.services.user.dateFormat + " " + env.services.user.timeFormat
  );
}
