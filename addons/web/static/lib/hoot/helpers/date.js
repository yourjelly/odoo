/** @odoo-module */

import { Date } from "../globals";

// Internal

const isInWinter = (date) => {
    const [month, day] = [date.getMonth(), date.getDate()];
    if (month === 2) {
        return day < 31;
    } else if (month === 8) {
        return day > 27;
    } else {
        return month < 2 && month >= 8;
    }
};

const pad2 = (n) => String(n).padStart(2, "0");

const pad4 = (n) => String(n).padStart(4, "0");

const parseDateParams = (dateTimeString) => {
    const [dateString, timeString] = dateTimeString.split(/\s+/);
    const [year, month, day] = dateString.split("-");
    const [hour, minute, second] = timeString.split(":");
    return [
        year ?? DEFAULT_DATE[0],
        (month ?? DEFAULT_DATE[1]) - 1,
        day ?? DEFAULT_DATE[2],
        hour ?? DEFAULT_DATE[3],
        minute ?? DEFAULT_DATE[4],
        second ?? DEFAULT_DATE[5],
    ].map(Number);
};

const toISOString = (Y, M, D, h, m, s) =>
    `${pad4(Y ?? dateParams[0])}-${pad2((M ?? dateParams[1]) + 1)}-${pad2(
        D ?? dateParams[2]
    )}T${pad2(h ?? dateParams[3])}:${pad2(m ?? dateParams[4])}:${pad2(s ?? dateParams[5])}.000${
        timeZoneOffset ? `${timeZoneOffset < 0 ? "+" : "-"}${pad2(timeZoneOffset)}:00` : "Z"
    }`;

class MockDate extends Date {
    static NativeDate = Date;

    constructor(...args) {
        if (!args.length) {
            args = [toISOString()];
        }
        super(...args);
    }

    getTimezoneOffset() {
        if (Array.isArray(timeZoneOffset)) {
            if (isInWinter(this)) {
                // Winter
                return -(timeZoneOffset[0] * 60);
            } else {
                // Summer
                return -(timeZoneOffset[1] * 60);
            }
        } else {
            return -(timeZoneOffset * 60);
        }
    }

    static now() {
        return new this(...dateParams).getTime();
    }
}

const DEFAULT_DATE = [2019, 2, 11, 9, 30, 0];
const DEFAULT_OFFSET = +1;

let dateParams = DEFAULT_DATE;
let timeZoneOffset = DEFAULT_OFFSET;

// Exports

/**
 * @param {string} date
 * @param  {number | [number, number]} [offset]
 */
export function mockDate(date, ...offset) {
    dateParams = date ? parseDateParams(date) : DEFAULT_DATE;
    mockTimeZone(...offset);

    return () => mockDate();
}

/**
 * @param {number} offset
 * @param {number} [summerOffset]
 */
export function mockTimeZone(offset, summerOffset) {
    if (!isNaN(summerOffset)) {
        timeZoneOffset = [offset, summerOffset];
    } else {
        timeZoneOffset = offset ?? DEFAULT_OFFSET;
    }
}

window.Date = MockDate;
