/** @odoo-module */

import { registerCleanup } from "@odoo/hoot";
import { patch } from "@web/core/utils/patch";

/**
 * Patch the native Date object
 *
 * Note that it will be automatically unpatched at the end of the test
 *
 * @param {number} [year]
 * @param {number} [month]
 * @param {number} [day]
 * @param {number} [hours]
 * @param {number} [minutes]
 * @param {number} [seconds]
 */
export function patchDate(year, month, day, hours, minutes, seconds) {
    var RealDate = window.Date;
    var actualDate = new RealDate();

    // By default, RealDate uses the browser offset, so we must replace it with the offset fixed in luxon.
    var fakeDate = new RealDate(year, month, day, hours, minutes, seconds);
    if (!(luxon.Settings.defaultZone instanceof luxon.FixedOffsetZone)) {
        throw new Error("luxon.Settings.defaultZone must be a FixedOffsetZone");
    }
    const browserOffset = -fakeDate.getTimezoneOffset();
    const patchedOffset = luxon.Settings.defaultZone.offset();
    const offsetDiff = patchedOffset - browserOffset;
    const correctedMinutes = fakeDate.getMinutes() - offsetDiff;
    fakeDate.setMinutes(correctedMinutes);

    var timeInterval = actualDate.getTime() - fakeDate.getTime();

    // eslint-disable-next-line no-global-assign
    window.Date = (function (NativeDate) {
        function Date(Y, M, D, h, m, s, ms) {
            var length = arguments.length;
            let date;
            if (arguments.length > 0) {
                date =
                    length == 1 && String(Y) === Y // isString(Y)
                        ? // We explicitly pass it through parse:
                          new NativeDate(Date.parse(Y))
                        : // We have to manually make calls depending on argument
                        // length here
                        length >= 7
                        ? new NativeDate(Y, M, D, h, m, s, ms)
                        : length >= 6
                        ? new NativeDate(Y, M, D, h, m, s)
                        : length >= 5
                        ? new NativeDate(Y, M, D, h, m)
                        : length >= 4
                        ? new NativeDate(Y, M, D, h)
                        : length >= 3
                        ? new NativeDate(Y, M, D)
                        : length >= 2
                        ? new NativeDate(Y, M)
                        : length >= 1
                        ? new NativeDate(Y)
                        : new NativeDate();
                // Prevent mixups with unfixed Date object
                date.constructor = Date;
                return date;
            } else {
                date = new NativeDate();
                var time = date.getTime();
                time -= timeInterval;
                date.setTime(time);
                return date;
            }
        }

        // Copy any custom methods a 3rd party library may have added
        for (var key in NativeDate) {
            Date[key] = NativeDate[key];
        }

        // Copy "native" methods explicitly; they may be non-enumerable
        // exception: 'now' uses fake date as reference
        Date.now = function () {
            var date = new NativeDate();
            var time = date.getTime();
            time -= timeInterval;
            return time;
        };
        Date.UTC = NativeDate.UTC;
        Date.prototype = NativeDate.prototype;
        Date.prototype.constructor = Date;

        // Upgrade Date.parse to handle simplified ISO 8601 strings
        Date.parse = NativeDate.parse;
        return Date;
    })(Date);

    registerCleanup(() => {
        window.Date = RealDate;
    });
}

/** @type {typeof patch} */
export function patchWithCleanup(obj, patchValue) {
    registerCleanup(patch(obj, patchValue));
}
