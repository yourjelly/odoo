/** @odoo-module **/

import { makeDeferred } from "../helpers/concurency";
import { suite, test } from "../setup";
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

// suite("perfs", () => {
//     test[`multi=${1_000}`]("multi test hihi", ({ ok }) => ok(true));
// });

suite("HOOT", "Utils", () => {
    test("debounce", async (assert) => {
        const def = makeDeferred();
        const debounced = debounce(function namedFunction(arg) {
            assert.step(`call: ${arg}`);

            def.resolve();
        }, 5);

        assert.equal(debounced.name, "namedFunction (debounced)");

        debounced(1);
        debounced(2);

        assert.verifySteps([]);

        await def;

        assert.verifySteps(["call: 2"]);
    });

    test("deepEqual", (assert) => {
        assert.ok(deepEqual(true, true));
        assert.ok(deepEqual(false, false));
        assert.ok(deepEqual(null, null));
        assert.ok(deepEqual({ b: 2, a: 1 }, { a: 1, b: 2 }));
        assert.ok(deepEqual({ o: { a: [{ b: 1 }] } }, { o: { a: [{ b: 1 }] } }));
        assert.ok(deepEqual([1, 2, 3], [1, 2, 3]));

        assert.not.ok(deepEqual(true, false));
        assert.not.ok(deepEqual(null, undefined));
        assert.not.ok(deepEqual([1, 2, 3], [3, 1, 2]));
    });

    test("formatHumanReadable", (assert) => {
        // Strings
        assert.equal(formatHumanReadable("abc"), `"abc"`);
        assert.equal(formatHumanReadable("a".repeat(300)), `"${"a".repeat(255)}..."`);
        // Numbers
        assert.equal(formatHumanReadable(1), `1`);
        // Other primitives
        assert.equal(formatHumanReadable(true), `true`);
        assert.equal(formatHumanReadable(null), `null`);
        // Functions & classes
        assert.equal(
            formatHumanReadable(function oui() {}),
            `Function oui() { ... }`
        );
        assert.equal(formatHumanReadable(class Oui {}), `class Oui { ... }`);
        // Iterators
        assert.equal(formatHumanReadable([1, 2, 3]), `Array [...]`);
        assert.equal(formatHumanReadable(new Set([1, 2, 3])), `Set [...]`);
        assert.equal(
            formatHumanReadable(
                new Map([
                    ["a", 1],
                    ["b", 2],
                ])
            ),
            `Map [...]`
        );
        // Objects
        assert.equal(formatHumanReadable(/ab(c)d/gi), `/ab(c)d/gi`);
        assert.equal(
            formatHumanReadable(new Date("1997-01-09T12:30:00.000Z")),
            `1997-01-09T12:30:00.000Z`
        );
        assert.equal(formatHumanReadable({ a: { b: 1 } }), `Object { ... }`);
        assert.equal(formatHumanReadable(new Proxy({}, {})), `Object { ... }`);
        assert.equal(formatHumanReadable(window), `Window { ... }`);
        assert.equal(formatHumanReadable(document.createElement("div")), `<div />`);
    });

    test("generateHash", (assert) => {
        assert.equal(generateHash("abc").length, 8);
        assert.equal(generateHash("abcdef").length, 8);
        assert.equal(generateHash("abc"), generateHash("abc"));

        assert.not.equal(generateHash("abc"), generateHash("def"));
    });

    test("isIterable", (assert) => {
        assert.ok(isIterable([1, 2, 3]));
        assert.ok(isIterable(new Set([1, 2, 3])));

        assert.not.ok(isIterable(null));
        assert.not.ok(isIterable("abc"));
        assert.not.ok(isIterable({}));
    });

    test("isRegExpFilter", (assert) => {
        assert.ok(isRegExpFilter("/abc/"));
        assert.ok(isRegExpFilter("/abc/i"));

        assert.not.ok(isRegExpFilter("/abc"));
        assert.not.ok(isRegExpFilter("abc/"));
    });

    test("lookup", (assert) => {
        const list = ["babAba", "bAAab", "cccbCCb"];
        assert.deepEqual(lookup("àâa", list), ["bAAab", "babAba"]);
        assert.deepEqual(lookup("/.b$/", list), ["bAAab", "cccbCCb"]);
    });

    test("makeTaggable", (assert) => {
        assert.equal(typeof makeTaggable(function () {}).withTag, "function");
    });

    test("match", (assert) => {
        assert.ok(match("abc", /^abcd?/));
        assert.ok(match(new Error("error message"), "message"));
    });

    test("shuffle", (assert) => {
        const range = [...Array(1e2)].map((_, i) => i);
        let shuffled = shuffle(range);
        if (deepEqual(range, shuffled)) {
            // In the astronomically low chance the shuffled array remains sorted
            shuffled = shuffle(range);
        }

        assert.not.deepEqual(range, shuffled);
        assert.deepEqual(range, range);
    });

    test("title", (assert) => {
        assert.equal(title("abcDef"), "AbcDef");
    });
});
