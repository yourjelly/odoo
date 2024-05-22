import { describe, expect, test } from "@odoo/hoot";
import { queryAllTexts, queryOne } from "@odoo/hoot-dom";
import { mockTimeZone } from "@odoo/hoot-mock";

import {
    defineModels,
    defineParams,
    fields,
    models,
    mountView,
} from "@web/../tests/web_test_helpers";

const MON_TO_SUN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const SUN_TO_SAT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

class Event extends models.Model {
    date_start = fields.Datetime();

    check_access_rights = function() {
        return Promise.resolve(true);
    };

    _records = [{
        id: 1,
        date_start: "2024-05-01 07:30:00",
    }];
}

defineModels([Event]);

async function setup({ mode, tz_offset, week_start }) {
    mockTimeZone(tz_offset);
    defineParams({ lang_parameters: { week_start } });
    await mountView({
        type: "calendar",
        resModel: "event",
        resId: 1,
        arch: /* xml */ `<calendar mode="${mode}" date_start="date_start"/>`,
    });
}

describe("EU", () => {
    const options = { tz_offset: +1, week_start: 1 };

    test("week days (week view)", async () => {
        expect.assertions(8);
        await setup({ ...options, mode: "week" });

        expect(queryAllTexts(".o_cw_day_name")).toEqual(MON_TO_SUN);
        for (let day of MON_TO_SUN) {
            expect(queryOne(`.fc-day-${day.toLowerCase()} .o_cw_day_name`)).toHaveText(day);
        }
    });

    test("week days (month view)", async () => {
        expect.assertions(8);
        await setup({ ...options, mode: "month" });

        expect(queryAllTexts(".o_cw_day_name")).toEqual(MON_TO_SUN);
        for (let day of MON_TO_SUN) {
            expect(queryOne(`.fc-day-${day.toLowerCase()} .o_cw_day_name`)).toHaveText(day);
        }
    });
});

describe("US", () => {
    const options = { tz_offset: -8, week_start: 7 };

    test("week days (week view)", async () => {
        expect.assertions(8);
        await setup({ ...options, mode: "week" });

        expect(queryAllTexts(".o_cw_day_name")).toEqual(SUN_TO_SAT);
        for (let day of SUN_TO_SAT) {
            expect(queryOne(`.fc-day-${day.toLowerCase()} .o_cw_day_name`)).toHaveText(day);
        }
    });

    test("week days (month view)", async () => {
        expect.assertions(8);
        await setup({ ...options, mode: "month" });

        expect(queryAllTexts(".o_cw_day_name")).toEqual(SUN_TO_SAT);
        for (let day of SUN_TO_SAT) {
            expect(queryOne(`.fc-day-${day.toLowerCase()} .o_cw_day_name`)).toHaveText(day);
        }
    });
});
