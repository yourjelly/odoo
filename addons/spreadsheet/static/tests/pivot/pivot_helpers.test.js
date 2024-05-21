import { describe, expect, test } from "@odoo/hoot";
import { getFirstListFunction, getNumberOfListFormulas } from "@spreadsheet/list/list_helpers";
import { toNormalizedPivotValue } from "@spreadsheet/pivot/pivot_model";
import { constants, tokenize, helpers } from "@odoo/o-spreadsheet";
import { patchTranslations } from "@web/../tests/web_test_helpers";
const { getFirstPivotFunction, getNumberOfPivotFunctions, pivotTimeAdapter } = helpers;
const { DEFAULT_LOCALE } = constants;

function stringArg(value) {
    return { type: "STRING", value: `${value}` };
}

describe.current.tags("headless");

describe("spreadsheet > pivot_helpers", () => {
    test("Basic formula extractor", () => {
        const formula = `=PIVOT.VALUE("1", "test") + ODOO.LIST("2", "hello", "bla")`;
        const tokens = tokenize(formula);
        let functionName;
        let args;
        ({ functionName, args } = getFirstPivotFunction(tokens));
        expect(functionName).toBe("PIVOT.VALUE");
        expect(args).toHaveLength(2);
        expect(args[0]).toEqual(stringArg("1"));
        expect(args[1]).toEqual(stringArg("test"));
        ({ functionName, args } = getFirstListFunction(tokens));
        expect(functionName).toBe("ODOO.LIST");
        expect(args).toHaveLength(3);
        expect(args[0]).toEqual(stringArg("2"));
        expect(args[1]).toEqual(stringArg("hello"));
        expect(args[2]).toEqual(stringArg("bla"));
    });

    test("Extraction with two PIVOT formulas", () => {
        const formula = `=PIVOT.VALUE("1", "test") + PIVOT.VALUE("2", "hello", "bla")`;
        const tokens = tokenize(formula);
        const { functionName, args } = getFirstPivotFunction(tokens);
        expect(functionName).toBe("PIVOT.VALUE");
        expect(args).toHaveLength(2);
        expect(args[0]).toEqual(stringArg("1"));
        expect(args[1]).toEqual(stringArg("test"));
        expect(getFirstListFunction(tokens)).toBe(undefined);
    });

    test("Number of formulas", () => {
        const formula = `=PIVOT.VALUE("1", "test") + PIVOT.VALUE("2", "hello", "bla") + ODOO.LIST("1", "bla")`;
        expect(getNumberOfPivotFunctions(tokenize(formula))).toBe(2);
        expect(getNumberOfListFormulas(tokenize(formula))).toBe(1);
        expect(getNumberOfPivotFunctions(tokenize("=1+1"))).toBe(0);
        expect(getNumberOfListFormulas(tokenize("=1+1"))).toBe(0);
        expect(getNumberOfPivotFunctions(tokenize("=bla"))).toBe(0);
        expect(getNumberOfListFormulas(tokenize("=bla"))).toBe(0);
    });

    test("getFirstPivotFunction does not crash when given crap", () => {
        expect(getFirstListFunction(tokenize("=SUM(A1)"))).toBe(undefined);
        expect(getFirstPivotFunction(tokenize("=SUM(A1)"))).toBe(undefined);
        expect(getFirstListFunction(tokenize("=1+1"))).toBe(undefined);
        expect(getFirstPivotFunction(tokenize("=1+1"))).toBe(undefined);
        expect(getFirstListFunction(tokenize("=bla"))).toBe(undefined);
        expect(getFirstPivotFunction(tokenize("=bla"))).toBe(undefined);
        expect(getFirstListFunction(tokenize("bla"))).toBe(undefined);
        expect(getFirstPivotFunction(tokenize("bla"))).toBe(undefined);
    });
});

describe("spreadsheet > toNormalizedPivotValue", () => {
    test("parse values of a selection, char or text field", () => {
        for (const fieldType of ["selection", "text", "char"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            expect(toNormalizedPivotValue(field, "won")).toBe("won");
            expect(toNormalizedPivotValue(field, "1")).toBe("1");
            expect(toNormalizedPivotValue(field, 1)).toBe("1");
            expect(toNormalizedPivotValue(field, "11/2020")).toBe("11/2020");
            expect(toNormalizedPivotValue(field, "2020")).toBe("2020");
            expect(toNormalizedPivotValue(field, "01/11/2020")).toBe("01/11/2020");
            expect(toNormalizedPivotValue(field, "false")).toBe(false);
            expect(toNormalizedPivotValue(field, false)).toBe(false);
            expect(toNormalizedPivotValue(field, "true")).toBe("true");
        }
    });

    test("parse values of time fields", () => {
        for (const fieldType of ["date", "datetime"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            // day
            expect(toNormalizedPivotValue(field, "1/11/2020", "day")).toBe("01/11/2020");
            expect(toNormalizedPivotValue(field, "01/11/2020", "day")).toBe("01/11/2020");
            expect(toNormalizedPivotValue(field, "11/2020", "day")).toBe("11/01/2020");
            expect(toNormalizedPivotValue(field, "1", "day")).toBe("12/31/1899");
            expect(toNormalizedPivotValue(field, 1, "day")).toBe("12/31/1899");
            expect(toNormalizedPivotValue(field, "false", "day")).toBe(false);
            expect(toNormalizedPivotValue(field, false, "day")).toBe(false);
            // week
            expect(toNormalizedPivotValue(field, "11/2020", "week")).toBe("11/2020");
            expect(toNormalizedPivotValue(field, "1/2020", "week")).toBe("1/2020");
            expect(toNormalizedPivotValue(field, "01/2020", "week")).toBe("1/2020");
            expect(toNormalizedPivotValue(field, "false", "week")).toBe(false);
            expect(toNormalizedPivotValue(field, false, "week")).toBe(false);
            // month
            expect(toNormalizedPivotValue(field, "11/2020", "month")).toBe("11/2020");
            expect(toNormalizedPivotValue(field, "1/2020", "month")).toBe("01/2020");
            expect(toNormalizedPivotValue(field, "01/2020", "month")).toBe("01/2020");
            expect(toNormalizedPivotValue(field, "2/11/2020", "month")).toBe("02/2020");
            expect(toNormalizedPivotValue(field, "2/1/2020", "month")).toBe("02/2020");
            expect(toNormalizedPivotValue(field, 1, "month")).toBe("12/1899");
            expect(toNormalizedPivotValue(field, "false", "month")).toBe(false);
            expect(toNormalizedPivotValue(field, false, "month")).toBe(false);
            // year
            expect(toNormalizedPivotValue(field, "2020", "year")).toBe(2020);
            expect(toNormalizedPivotValue(field, 2020, "year")).toBe(2020);
            expect(toNormalizedPivotValue(field, "false", "year")).toBe(false);
            expect(toNormalizedPivotValue(field, false, "year")).toBe(false);

            expect(() => toNormalizedPivotValue(field, "true", "month")).toThrow();
            expect(() => toNormalizedPivotValue(field, true, "month")).toThrow();
            expect(() => toNormalizedPivotValue(field, "won", "month")).toThrow();
        }
    });

    test("parse values of boolean field", () => {
        const field = {
            type: "boolean",
            string: "A field",
        };
        expect(toNormalizedPivotValue(field, "false")).toBe(false);
        expect(toNormalizedPivotValue(field, false)).toBe(false);
        expect(toNormalizedPivotValue(field, "true")).toBe(true);
        expect(toNormalizedPivotValue(field, true)).toBe(true);
        expect(() => toNormalizedPivotValue(field, "11/2020")).toThrow();
        expect(() => toNormalizedPivotValue(field, "2020")).toThrow();
        expect(() => toNormalizedPivotValue(field, "01/11/2020")).toThrow();
        expect(() => toNormalizedPivotValue(field, "1")).toThrow();
        expect(() => toNormalizedPivotValue(field, 1)).toThrow();
        expect(() => toNormalizedPivotValue(field, "won")).toThrow();
    });

    test("parse values of numeric fields", () => {
        for (const fieldType of ["float", "integer", "monetary", "many2one", "many2many"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            expect(toNormalizedPivotValue(field, "2020")).toBe(2020);
            expect(toNormalizedPivotValue(field, "01/11/2020")).toBe(43841); // a date is actually a number in a spreadsheet
            expect(toNormalizedPivotValue(field, "11/2020")).toBe(44136); // 1st of november 2020
            expect(toNormalizedPivotValue(field, "1")).toBe(1);
            expect(toNormalizedPivotValue(field, 1)).toBe(1);
            expect(toNormalizedPivotValue(field, "false")).toBe(false);
            expect(toNormalizedPivotValue(field, false)).toBe(false);
            expect(() => toNormalizedPivotValue(field, "true")).toThrow();
            expect(() => toNormalizedPivotValue(field, true)).toThrow();
            expect(() => toNormalizedPivotValue(field, "won")).toThrow();
        }
    });

    test("parse values of unsupported fields", () => {
        for (const fieldType of ["one2many", "binary", "html"]) {
            const field = {
                type: fieldType,
                string: "A field",
            };
            expect(() => toNormalizedPivotValue(field, "false")).toThrow();
            expect(() => toNormalizedPivotValue(field, false)).toThrow();
            expect(() => toNormalizedPivotValue(field, "true")).toThrow();
            expect(() => toNormalizedPivotValue(field, true)).toThrow();
            expect(() => toNormalizedPivotValue(field, "11/2020")).toThrow();
            expect(() => toNormalizedPivotValue(field, "2020")).toThrow();
            expect(() => toNormalizedPivotValue(field, "01/11/2020")).toThrow();
            expect(() => toNormalizedPivotValue(field, "1")).toThrow();
            expect(() => toNormalizedPivotValue(field, 1)).toThrow();
            expect(() => toNormalizedPivotValue(field, "won")).toThrow();
        }
    });
});

describe("spreadsheet > pivot time adapters formatted value", () => {
    test("Day adapter", (assert) => {
        const adapter = pivotTimeAdapter("day");
        expect(adapter.formatValue("11/12/2020", DEFAULT_LOCALE)).toBe("11/12/2020");
        expect(adapter.formatValue("01/11/2020", DEFAULT_LOCALE)).toBe("1/11/2020");
        expect(adapter.formatValue("12/05/2020", DEFAULT_LOCALE)).toBe("12/5/2020");
    });

    test("Week adapter", (assert) => {
        patchTranslations();
        const adapter = pivotTimeAdapter("week");
        expect(adapter.formatValue("5/2024", DEFAULT_LOCALE)).toBe("W5 2024");
        expect(adapter.formatValue("51/2020", DEFAULT_LOCALE)).toBe("W51 2020");
    });

    test("Month adapter", (assert) => {
        patchTranslations();
        const adapter = pivotTimeAdapter("month");
        expect(adapter.formatValue("12/2020", DEFAULT_LOCALE)).toBe("December 2020");
        expect(adapter.formatValue("02/2020", DEFAULT_LOCALE)).toBe("February 2020");
    });

    test("Quarter adapter", (assert) => {
        patchTranslations();
        const adapter = pivotTimeAdapter("quarter");
        expect(adapter.formatValue("1/2022", DEFAULT_LOCALE)).toBe("Q1 2022");
        expect(adapter.formatValue("3/1998", DEFAULT_LOCALE)).toBe("Q3 1998");
    });

    test("Year adapter", (assert) => {
        const adapter = pivotTimeAdapter("year");
        expect(adapter.formatValue("2020", DEFAULT_LOCALE)).toBe("2020");
        expect(adapter.formatValue("1997", DEFAULT_LOCALE)).toBe("1997");
    });
});
