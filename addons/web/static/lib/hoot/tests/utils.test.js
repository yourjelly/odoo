/** @odoo-module **/

import { expect } from "../expect";
import { makeDeferred } from "../helpers/concurency";
import { suite, test } from "../hoot";
import {
    debounce,
    deepEqual,
    formatHumanReadable,
    generateHash,
    isIterable,
    isRegExpFilter,
    lookup,
    makeTaggable,
    match,
    shuffle,
    title,
} from "../utils";

suite("@odoo/hoot", "Utils", () => {
    test("debounce", async () => {
        const def = makeDeferred();
        const debounced = debounce(function namedFunction(arg) {
            expect.step(`call: ${arg}`);

            def.resolve();
        }, 5);

        expect(debounced.name).toBe("namedFunction (debounced)");

        debounced(1);
        debounced(2);

        expect.verifySteps([]);

        await def;

        expect.verifySteps(["call: 2"]);
    });

    test("deepEqual", () => {
        expect(deepEqual(true, true)).toBeTruthy();
        expect(deepEqual(false, false)).toBeTruthy();
        expect(deepEqual(null, null)).toBeTruthy();
        expect(deepEqual({ b: 2, a: 1 }, { a: 1, b: 2 })).toBeTruthy();
        expect(deepEqual({ o: { a: [{ b: 1 }] } }, { o: { a: [{ b: 1 }] } })).toBeTruthy();
        expect(deepEqual([1, 2, 3], [1, 2, 3])).toBeTruthy();

        expect(deepEqual(true, false)).not.toBeTruthy();
        expect(deepEqual(null, undefined)).not.toBeTruthy();
        expect(deepEqual([1, 2, 3], [3, 1, 2])).not.toBeTruthy();
    });

    test("formatHumanReadable", () => {
        // Strings
        expect(formatHumanReadable("abc")).toBe(`"abc"`);
        expect(formatHumanReadable("a".repeat(300))).toBe(`"${"a".repeat(255)}..."`);
        // Numbers
        expect(formatHumanReadable(1)).toBe(`1`);
        // Other primitives
        expect(formatHumanReadable(true)).toBe(`true`);
        expect(formatHumanReadable(null)).toBe(`null`);
        // Functions & classes
        expect(formatHumanReadable(function oui() {})).toBe(`Function oui() { ... }`);
        expect(formatHumanReadable(class Oui {})).toBe(`class Oui { ... }`);
        // Iterators
        expect(formatHumanReadable([1, 2, 3])).toBe(`Array [...]`);
        expect(formatHumanReadable(new Set([1, 2, 3]))).toBe(`Set [...]`);
        expect(
            formatHumanReadable(
                new Map([
                    ["a", 1],
                    ["b", 2],
                ])
            )
        ).toBe(`Map [...]`);
        // Objects
        expect(formatHumanReadable(/ab(c)d/gi)).toBe(`/ab(c)d/gi`);
        expect(formatHumanReadable(new Date("1997-01-09T12:30:00.000Z"))).toBe(
            `1997-01-09T12:30:00.000Z`
        );
        expect(formatHumanReadable({ a: { b: 1 } })).toBe(`Object { ... }`);
        expect(formatHumanReadable(new Proxy({}, {}))).toBe(`Object { ... }`);
        expect(formatHumanReadable(window)).toBe(`Window { ... }`);
        expect(formatHumanReadable(document.createElement("div"))).toBe(`<div />`);
    });

    test("generateHash", () => {
        expect(generateHash("abc").length).toBe(8);
        expect(generateHash("abcdef").length).toBe(8);
        expect(generateHash("abc")).toBe(generateHash("abc"));

        expect(generateHash("abc")).not.toBe(generateHash("def"));
    });

    test("isIterable", () => {
        expect(isIterable([1, 2, 3])).toBeTruthy();
        expect(isIterable(new Set([1, 2, 3]))).toBeTruthy();

        expect(isIterable(null)).not.toBeTruthy();
        expect(isIterable("abc")).not.toBeTruthy();
        expect(isIterable({})).not.toBeTruthy();
    });

    test("isRegExpFilter", () => {
        expect(isRegExpFilter("/abc/")).toBeTruthy();
        expect(isRegExpFilter("/abc/i")).toBeTruthy();

        expect(isRegExpFilter("/abc")).not.toBeTruthy();
        expect(isRegExpFilter("abc/")).not.toBeTruthy();
    });

    test("lookup", () => {
        const list = ["babAba", "bAAab", "cccbCCb"];
        expect(lookup("àâa", list)).toEqual(["bAAab", "babAba"]);
        expect(lookup("/.b$/", list)).toEqual(["bAAab", "cccbCCb"]);
    });

    test("makeTaggable", () => {
        expect(typeof makeTaggable(function () {}).withTag).toBe("function");
    });

    test("match", () => {
        expect(match("abc", /^abcd?/)).toBeTruthy();
        expect(match(new Error("error message"), "message")).toBeTruthy();
    });

    test("shuffle", () => {
        const range = [...Array(1e2)].map((_, i) => i);
        let shuffled = shuffle(range);
        if (deepEqual(range, shuffled)) {
            // In the astronomically low chance the shuffled array remains sorted
            shuffled = shuffle(range);
        }

        expect(range).not.toEqual(shuffled);
        expect(range).toEqual(range);
    });

    test("title", () => {
        expect(title("abcDef")).toBe("AbcDef");
    });
});
