import { describe, test } from "@odoo/hoot";
import { testEditor } from "./_helpers/editor";
import { insertText, redo, undo } from "./_helpers/user_actions";

function columnsContainer(contents) {
    return `<div class="container o_text_columns"><div class="row">${contents}</div></div>`;
}

function column(size, contents) {
    return `<div class="col-${size}">${contents}</div>`;
}

function columnize(numberOfColumns) {
    return (editor) => {
        editor.dispatch("COLUMNIZE", { numberOfColumns });
    };
}

describe("2 columns", () => {
    test("should display hint for empty columns", async () => {
        await testEditor({
            /* eslint-disable */
            contentBefore:
                columnsContainer(
                    column(6, "<p>[]<br></p>") +
                    column(6, "<p><br></p>")
                ),
            contentAfterEdit:
                columnsContainer(
                    column(6, `<p placeholder="Empty column" class="o-we-hint">[]<br></p>`) +
                    column(6, `<p placeholder="Empty column" class="o-we-hint"><br></p>`)
                ),
            /* eslint-enable */
        });
    });

    test("should do nothing", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(6, "<p>abcd</p>") + column(6, "<h1>[]ef</h1><ul><li>gh</li></ul>")
            ),
            stepFunction: columnize(2),
            contentAfter: columnsContainer(
                column(6, "<p>abcd</p>") + column(6, "<h1>[]ef</h1><ul><li>gh</li></ul>")
            ),
        });
    });

    test("should turn text into 2 columns", async () => {
        await testEditor({
            contentBefore: "<p>[]abcd</p>",
            stepFunction: columnize(2),
            contentAfterEdit:
            /* eslint-disable */
                columnsContainer(
                    column(6, "<p>[]abcd</p>") +
                    column(6, `<p placeholder="Empty column" class="o-we-hint"><br></p>`)
                ) +
                "<p><br></p>",
            contentAfter:
                columnsContainer(
                    column(6, "<p>[]abcd</p>") +
                    column(6, "<p><br></p>")
                ) +
                "<p><br></p>",
            /* eslint-enable */
        });
    });

    test("should turn 3 columns into 2 columns", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(4, "<p>abcd</p>") +
                    column(4, "<h1>e[]f</h1>") +
                    column(4, "<ul><li>gh</li></ul>")
            ),
            stepFunction: columnize(2),
            contentAfter: columnsContainer(
                column(6, "<p>abcd</p>") + column(6, "<h1>e[]f</h1><ul><li>gh</li></ul>")
            ),
        });
    });

    test("should turn 4 columns into 2 columns", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(3, "<p>abcd</p>") +
                    column(3, "<h1>ef</h1>") +
                    column(3, "<ul><li>gh</li></ul>") +
                    column(3, "<p>i[]j</p>")
            ),
            stepFunction: columnize(2),
            contentAfter: columnsContainer(
                column(6, "<p>abcd</p>") + column(6, "<h1>ef</h1><ul><li>gh</li></ul><p>i[]j</p>")
            ),
        });
    });
});
describe("3 columns", () => {
    test("should do nothing", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(4, "<p>abcd</p>") + column(4, "<p><br></p>") + column(4, "<p>[]<br></p>")
            ),
            /* eslint-disable */
            contentBeforeEdit:
                columnsContainer(
                    column(4, "<p>abcd</p>") +
                    column(4, `<p placeholder="Empty column" class="o-we-hint"><br></p>`) +
                    column(4, `<p placeholder="Empty column" class="o-we-hint">[]<br></p>`)
                ),
            /* eslint-enable */
            stepFunction: columnize(3),
            contentAfter: columnsContainer(
                column(4, "<p>abcd</p>") + column(4, "<p><br></p>") + column(4, "<p>[]<br></p>")
            ),
        });
    });

    test("should turn text into 3 columns", async () => {
        await testEditor({
            contentBefore: "<p>ab[]cd</p>",
            stepFunction: columnize(3),
            /* eslint-disable */
            contentAfterEdit:
                columnsContainer(
                    column(4, "<p>ab[]cd</p>") +
                    column(4, `<p placeholder="Empty column" class="o-we-hint"><br></p>`) +
                    column(4, `<p placeholder="Empty column" class="o-we-hint"><br></p>`)
                ) + "<p><br></p>",
            contentAfter:
                columnsContainer(
                    column(4, "<p>ab[]cd</p>") +
                    column(4, "<p><br></p>") +
                    column(4, "<p><br></p>")
                ) + "<p><br></p>",
            /* eslint-enable */
        });
    });

    test("should turn 2 columns into 3 columns", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(6, "<p>abcd</p>") + column(6, "<h1>ef</h1><ul><li>g[]h</li></ul>")
            ),
            stepFunction: columnize(3),
            contentAfter: columnsContainer(
                column(4, "<p>abcd</p>") +
                    column(4, "<h1>ef</h1><ul><li>g[]h</li></ul>") +
                    column(4, "<p><br></p>")
            ),
        });
    });

    test("should turn 4 columns into 3 columns", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(3, "<p>abcd</p>") +
                    column(3, "<h1>e[]f</h1>") +
                    column(3, "<ul><li>gh</li></ul>") +
                    column(3, "<p>ij</p>")
            ),
            stepFunction: columnize(3),
            contentAfter: columnsContainer(
                column(4, "<p>abcd</p>") +
                    column(4, "<h1>e[]f</h1>") +
                    column(4, "<ul><li>gh</li></ul><p>ij</p>")
            ),
        });
    });
});

describe("4 columns", () => {
    test("should do nothing", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(3, "<p>abcd</p>") +
                    column(3, "<p><br></p>") +
                    column(3, "<p><br></p>") +
                    column(3, "<p>[]<br></p>")
            ),
            stepFunction: columnize(4),
            contentAfter: columnsContainer(
                column(3, "<p>abcd</p>") +
                    column(3, "<p><br></p>") +
                    column(3, "<p><br></p>") +
                    column(3, "<p>[]<br></p>")
            ),
        });
    });

    test("should turn text into 4 columns", async () => {
        await testEditor({
            contentBefore: "<p>abcd[]</p>",
            stepFunction: columnize(4),
            contentAfter:
                columnsContainer(
                    column(3, "<p>abcd[]</p>") +
                        column(3, "<p><br></p>") +
                        column(3, "<p><br></p>") +
                        column(3, "<p><br></p>")
                ) + "<p><br></p>",
        });
    });

    test("should turn 2 columns into 4 columns", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(6, "<p>abcd</p>") + column(6, "<h1>[]ef</h1><ul><li>gh</li></ul>")
            ),
            stepFunction: columnize(4),
            contentAfter: columnsContainer(
                column(3, "<p>abcd</p>") +
                    column(3, "<h1>[]ef</h1><ul><li>gh</li></ul>") +
                    column(3, "<p><br></p>") +
                    column(3, "<p><br></p>")
            ),
        });
    });

    test("should turn 3 columns into 4 columns", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(4, "<p>abcd</p>") +
                    column(4, "<h1>ef[]</h1>") +
                    column(4, "<ul><li>gh</li></ul><p>ij</p>")
            ),
            stepFunction: columnize(4),
            contentAfter: columnsContainer(
                column(3, "<p>abcd</p>") +
                    column(3, "<h1>ef[]</h1>") +
                    column(3, "<ul><li>gh</li></ul><p>ij</p>") +
                    column(3, "<p><br></p>")
            ),
        });
    });
});

describe("remove columns", () => {
    test("should do nothing", async () => {
        await testEditor({
            contentBefore: "<p>ab[]cd</p>",
            stepFunction: columnize(0),
            contentAfter: "<p>ab[]cd</p>",
        });
    });

    test("should turn 2 columns into text", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(6, "<p>abcd</p>") + column(6, "<h1>[]ef</h1><ul><li>gh</li></ul>")
            ),
            stepFunction: columnize(0),
            contentAfter: "<p>abcd</p><h1>[]ef</h1><ul><li>gh</li></ul>",
        });
    });

    test("should turn 3 columns into text", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(4, "<p>abcd</p>") +
                    column(4, "<h1>ef[]</h1>") +
                    column(4, "<ul><li>gh</li></ul><p>ij</p>")
            ),
            stepFunction: columnize(0),
            contentAfter: "<p>abcd</p><h1>ef[]</h1><ul><li>gh</li></ul><p>ij</p>",
        });
    });

    test("should turn 4 columns into text", async () => {
        await testEditor({
            contentBefore: columnsContainer(
                column(3, "<p>abcd</p>") +
                    column(3, "<h1>ef</h1>") +
                    column(3, "<ul><li>gh</li></ul><p>ij</p>") +
                    column(3, "<p>[]<br></p>")
            ),
            stepFunction: columnize(0),
            contentAfter: "<p>abcd</p><h1>ef</h1><ul><li>gh</li></ul><p>ij</p><p>[]<br></p>",
        });
    });
});

describe("complex", () => {
    test("should turn text into 2 columns, then 3, 4, 3, 2 and text again", async () => {
        await testEditor({
            contentBefore: "<p>ab[]cd</p>",
            stepFunction: (editor) => {
                columnize(2)(editor);
                columnize(3)(editor);
                columnize(4)(editor);
                columnize(3)(editor);
                columnize(2)(editor);
                columnize(0)(editor);
            },
            // A paragraph was created for each column + after them and
            // they were all kept.
            contentAfter: "<p>ab[]cd</p><p><br></p><p><br></p><p><br></p><p><br></p>",
        });
    });

    test("should not add a container when one already exists", async () => {
        await testEditor({
            contentBefore:
                '<div class="container"><div class="row"><div class="col">' +
                "<p>ab[]cd</p>" +
                "</div></div></div>",
            stepFunction: columnize(2),
            contentAfter:
                '<div class="container"><div class="row"><div class="col">' +
                '<div class="o_text_columns"><div class="row">' + // no "container" class
                '<div class="col-6">' +
                "<p>ab[]cd</p>" +
                "</div>" +
                '<div class="col-6"><p><br></p></div>' +
                "</div></div>" +
                "<p><br></p>" +
                "</div></div></div>",
        });
    });
});

describe("undo", () => {
    test("should be able to write after undo", async () => {
        await testEditor({
            contentBefore: "<p>[]</p>",
            stepFunction: async (editor) => {
                columnize(2)(editor);
                undo(editor);
                insertText(editor, "x");
            },
            contentAfter: "<p>x[]</p>",
        });
    });

    test("should work properly after undo and then redo", async () => {
        await testEditor({
            contentBefore: "<p>[]</p>",
            stepFunction: async (editor) => {
                columnize(2)(editor);
                undo(editor);
                redo(editor);
                insertText(editor, "x");
            },
            contentAfter:
                columnsContainer(column(6, "<p>x[]</p>") + column(6, "<p><br></p>")) +
                "<p><br></p>",
        });
    });
});
