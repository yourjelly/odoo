/** @odoo-module */

import { Date } from "../globals";

// Internal

const parseDateParams = (dateTimeString) => {
    const [dateString, timeString] = dateTimeString.split(/\s+/);
    const [year, month, day] = dateString.split("-");
    const [hour, minute, second] = timeString.split(":");
    return [
        year ?? DEFAULT_DATE[0],
        month ?? DEFAULT_DATE[1],
        day ?? DEFAULT_DATE[2],
        hour ?? DEFAULT_DATE[3],
        minute ?? DEFAULT_DATE[4],
        second ?? DEFAULT_DATE[5],
    ];
};

class MockDate extends Date {
    constructor(...args) {
        if (!args.length) {
            args = dateParams;
        }
        super(...args);
    }
}

const DEFAULT_DATE = [2019, 3, 11, 9, 30, 0];

let dateParams = [...DEFAULT_DATE];
let timeZoneOffset = 0;

// Exports

export function mockDate(date, ...offset) {
    dateParams = parseDateParams(date);
    // if (offset.length) {
    //     offset =
    // }
}

export function mockTimeZone(offset, summerOffset) {
    timeZoneOffset = offset;
}

window.Date = MockDate;
