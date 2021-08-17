/** @odoo-module **/

import { localization } from "@web/core/l10n/localization";

export function computeWeekRange() {
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

export function calculateWeekNumber(date) {
    return luxon.DateTime.fromJSDate(date).weekNumber;
}
