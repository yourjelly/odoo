/** @odoo-module **/

import { escapeRegExp, intersperse, sprintf } from "../utils/strings";
import { localization } from "./localization";
import { _lt } from "./translation";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Inserts "thousands" separators in the provided number.
 *
 * @param {number} [num] integer number
 * @param {string} [thousandsSep=","] the separator to insert
 * @param {number[]} [grouping=[3,0]]
 *   array of relative offsets at which to insert `thousandsSep`.
 *   See `strings.intersperse` method.
 * @returns {string}
 */
function insertThousandsSep(num, thousandsSep = ",", grouping = [3, 0]) {
    let numStr = `${num}`;
    const negative = numStr[0] === "-";
    numStr = negative ? numStr.slice(1) : numStr;
    return (negative ? "-" : "") + intersperse(numStr, grouping, thousandsSep);
}

/**
 * Parses a string into a number.
 *
 * @param {string} value
 * @param {Object} options - additional options
 * @param {string|RegExp} [options.thousandsSep] - the thousands separator used in the value
 * @param {string|RegExp} [options.decimalPoint] - the decimal point used in the value
 * @returns number
 */
function parseNumber(value, options = {}) {
    // a number can have the thousand separator multiple times. ex: 1,000,000.00
    value = value.replaceAll(options.thousandsSep || ",", "");
    // a number only have one decimal separator
    value = value.replace(options.decimalPoint || ".", ".");
    return Number(value);
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

/**
 * Formats a number into a more readable string representing a float.
 *
 * @param {number|false} value
 * @param {Object} options additional options
 * @param {number} [options.precision=2] number of digits to keep after decimal point
 * @param {string} [options.decimalPoint="."] decimal separating character
 * @param {string} [options.thousandsSep=""] thousands separator to insert
 * @param {number[]} [options.grouping]
 *   array of relative offsets at which to insert `thousandsSep`.
 *   See `numbers.insertThousandsSep` method.
 * @returns string
 */
export function formatFloat(value, options = {}) {
    if (value === false) {
        return "";
    }
    const grouping = options.grouping || localization.grouping;
    const thousandsSep = options.thousandsSep || localization.thousandsSep;
    const decimalPoint = options.decimalPoint || localization.decimalPoint;
    const formatted = value.toFixed(options.precision || 2).split(".");
    formatted[0] = insertThousandsSep(+formatted[0], thousandsSep, grouping);
    return formatted.join(decimalPoint);
}

/**
 * Parse a more readable formated string representing a float to a float
 *
 * @param {string} value the formatted number
 * @returns float
 * @throws Error if the value can't be parsed properly
 */
export function parseFloat(value) {
    let thousandsSepRegex = new RegExp(escapeRegExp(localization.thousandsSep), "g");
    let decimalPointRegex = new RegExp(escapeRegExp(localization.decimalPoint), "g");
    const parsed = parseNumber(value, {
        thousandsSep: thousandsSepRegex,
        decimalPoint: decimalPointRegex,
    });
    if (isNaN(parsed)) {
        throw new Error(sprintf(_lt("'%s' is not a correct float").toString(), value));
    }
    return parsed;
}

/**
 * Format a number to a human readable format.
 * By example, 3000 could become 3k. Or massive number can use the scientific exponential notation.
 *
 * @param {number} number to format
 * @param {Object} [options] Options to format
 * @param {number} [options.decimals=0] maximum number of decimals to use
 * @param {number} [options.minDigits=1]
 *    the minimum number of digits to preserve when switching to another
 *    level of thousands (e.g. with a value of '2', 4321 will still be
 *    represented as 4321 otherwise it will be down to one digit (4k))
 * @returns string
 */
export function humanNumber(number, options = { decimals: 0, minDigits: 1 }) {
    number = Math.round(number);
    const decimals = options.decimals || 0;
    const minDigits = options.minDigits || 1;
    const d2 = Math.pow(10, decimals);
    const numberMagnitude = +number.toExponential().split("e+")[1];
    // the case numberMagnitude >= 21 corresponds to a number
    // better expressed in the scientific format.
    if (numberMagnitude >= 21) {
        // we do not use number.toExponential(decimals) because we want to
        // avoid the possible useless O decimals: 1e.+24 preferred to 1.0e+24
        number = Math.round(number * Math.pow(10, decimals - numberMagnitude)) / d2;
        return `${number}e+${numberMagnitude}`;
    }
    // note: we need to call toString here to make sure we manipulate the resulting
    // string, not an object with a toString method.
    const unitSymbols = _lt("kMGTPE").toString();
    const sign = Math.sign(number);
    number = Math.abs(number);
    let symbol = "";
    for (let i = unitSymbols.length; i > 0; i--) {
        const s = Math.pow(10, i * 3);
        if (s <= number / Math.pow(10, minDigits - 1)) {
            number = Math.round((number * d2) / s) / d2;
            symbol = unitSymbols[i - 1];
            break;
        }
    }
    const { decimalPoint, grouping, thousandsSep } = localization;
    const [integerPart, decimalPart] = String(number).split(".");
    const int = insertThousandsSep(sign * Number(integerPart), thousandsSep, grouping);
    if (!decimalPart) {
        return int + symbol;
    }
    return int + decimalPoint + decimalPart + symbol;
}
