/** @odoo-module */

import { describe, test } from "@odoo/hoot";
import { deleteForward, testEditor, insertText } from "../../helpers";
import { unformat } from "../../utils";

/**
 * content of the "deleteForward" sub suite in editor.test.js
 */

async function twoDeleteForward(editor) {
    await deleteForward(editor);
    await deleteForward(editor);
}

describe("Selection collapsed", () => {
    describe("Basic", () => {
        test.todo("should do nothing", async () => {
            // TODO the addition of <br/> "correction" part was judged
            // unnecessary to enforce, the rest of the test still makes
            // sense: not removing the unique <p/> and keeping the
            // cursor at the right place.
            // await testEditor({
            //     contentBefore: '<p>[]</p>',
            //     stepFunction: deleteForward,
            //     contentAfter: '<p>[]</p>',
            // });
            // TODO this cannot actually be tested currently as a
            // backspace/delete in that case is not even detected
            // (no input event to rollback)
            // await testEditor({
            //     contentBefore: '<p>[<br>]</p>',
            //     stepFunction: deleteForward,
            //     // The <br> is there only to make the <p> visible.
            //     // It does not exist in VDocument and selecting it
            //     // has no meaning in the DOM.
            //     contentAfter: '<p>[]<br></p>',
            // });
            await testEditor({
                contentBefore: "<p>abc[]</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>abc[]</p>",
            });
        });

        test("should delete the first character in a paragraph", async () => {
            await testEditor({
                contentBefore: "<p>[]abc</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]bc</p>",
            });
        });

        test.todo("should delete a character within a paragraph", async () => {
            await testEditor({
                contentBefore: "<p>a[]bc</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>a[]c</p>",
            });
        });

        test.todo("should delete the last character in a paragraph", async () => {
            await testEditor({
                contentBefore: "<p>ab[]c</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>ab[]</p>",
            });
            await testEditor({
                contentBefore: "<p>ab []c</p>",
                stepFunction: deleteForward,
                // The space should be converted to an unbreakable space
                // so it is visible.
                contentAfter: "<p>ab&nbsp;[]</p>",
            });
        });

        test("should merge a paragraph into an empty paragraph", async () => {
            await testEditor({
                contentBefore: "<p>[]<br></p><p>abc</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]abc</p>",
            });
        });

        test.todo("should merge P node correctly ", async () => {
            await testEditor({
                contentBefore: "<div>a<p>b[]</p><p>c</p>d</div>",
                stepFunction: deleteForward,
                contentAfter: "<div>a<p>b[]c</p>d</div>",
            });
        });

        test.todo("should merge node correctly", async () => {
            await testEditor({
                contentBefore: '<div>a<span class="a">b[]</span><p>c</p>d</div>',
                stepFunction: deleteForward,
                contentAfter: '<div>a<span class="a">b[]</span>c<br>d</div>',
            });
        });

        test.todo("should merge SPAN node correctly ", async () => {
            await testEditor({
                contentBefore: '<div>a<span class="a">bc[]</span><span class="a">de</span>f</div>',
                stepFunction: deleteForward,
                contentAfter: '<div>a<span class="a">bc[]e</span>f</div>',
            });
        });

        test.todo("should merge diferent element correctly", async () => {
            await testEditor({
                contentBefore: '<div>a<span class="a">b[]</span><p>c</p>d</div>',
                stepFunction: deleteForward,
                contentAfter: '<div>a<span class="a">b[]</span>c<br>d</div>',
            });
        });

        test.todo("should ignore ZWS", async () => {
            await testEditor({
                contentBefore: "<p>ab[]\u200Bc</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>ab[]</p>",
            });
            await testEditor({
                contentBefore: "<p>de[]\u200B</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>de[]</p>",
            });
            await testEditor({
                contentBefore: "<p>[]\u200Bf</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]<br></p>",
            });
        });

        test.todo("should delete through ZWS and Empty Inline", async () => {
            await testEditor({
                contentBefore: '<p>a[]b<span class="style">c</span>de</p>',
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                    await deleteForward(editor);
                    await deleteForward(editor);
                },
                contentAfter: "<p>a[]e</p>",
            });
        });

        test.todo("ZWS: should delete element content but keep cursor in", async () => {
            await testEditor({
                contentBefore: '<p>ab<span class="style">[]cd</span>ef</p>',
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                    await deleteForward(editor);
                },
                contentAfterEdit:
                    '<p>ab<span class="style" data-oe-zws-empty-inline="">[]\u200B</span>ef</p>',
                contentAfter: '<p>ab<span class="style">[]\u200B</span>ef</p>',
            });
            await testEditor({
                contentBefore: '<p>ab<span class="style">[]cd</span>ef</p>',
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                    await deleteForward(editor);
                    await insertText(editor, "x");
                },
                contentAfter: '<p>ab<span class="style">x[]</span>ef</p>',
            });
        });

        test.todo("should ignore ZWS and merge", async () => {
            await testEditor({
                contentBefore:
                    '<p><span class="removeme" data-oe-zws-empty-inline="">[]\u200B</span><b>ab</b></p>',
                contentBeforeEdit:
                    '<p><span class="removeme" data-oe-zws-empty-inline="">[]\u200B</span><b>ab</b></p>',
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                    await insertText(editor, "x");
                },
                contentAfter: "<p><b>x[]b</b></p>",
            });
            await testEditor({
                contentBefore:
                    '<p><span class="removeme" data-oe-zws-empty-inline="">[]\u200B</span><span class="a">cd</span></p>',
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                    await insertText(editor, "x");
                },
                contentAfter: '<p><span class="a">x[]d</span></p>',
            });
            await testEditor({
                contentBefore:
                    '<p><span class="removeme" data-oe-zws-empty-inline="">[]\u200B</span><br><b>ef</b></p>',
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                    await insertText(editor, "x");
                },
                contentAfter: "<p><b>x[]ef</b></p>",
            });
        });

        test.todo("should not break unbreakables", async () => {
            await testEditor({
                contentBefore:
                    `<div class="oe_unbreakable"><div class="oe_unbreakable">` +
                    `<div class="oe_unbreakable"><div class="oe_unbreakable">[]<br></div>` +
                    `<div class="oe_unbreakable">abc</div></div></div></div>`,
                stepFunction: deleteForward,
                contentAfter:
                    `<div class="oe_unbreakable"><div class="oe_unbreakable">` +
                    `<div class="oe_unbreakable">` +
                    `<div class="oe_unbreakable">[]abc</div></div></div></div>`,
            });
        });

        test("should not merge p with an unbreakable.", async () => {
            await testEditor({
                contentBefore: `<p>ab[]</p><table><tbody><tr><td>cd</td></tr></tbody></table>`,
                stepFunction: deleteForward,
                contentAfter: `<p>ab[]</p><table><tbody><tr><td>cd</td></tr></tbody></table>`,
            });
            await testEditor({
                contentBefore: `<p>ab[]</p><div class="oe_unbreakable">cd</div>`,
                stepFunction: deleteForward,
                contentAfter: `<p>ab[]</p><div class="oe_unbreakable">cd</div>`,
            });
        });

        test.todo("should delete empty p just before an unbreakable.", async () => {
            await testEditor({
                contentBefore: `<p>[]</p><table><tbody><tr><td>cd</td></tr></tbody></table>`,
                stepFunction: deleteForward,
                contentAfter: `<table><tbody><tr><td>[]cd</td></tr></tbody></table>`,
            });
            await testEditor({
                contentBefore: `<p>[]</p><div class="oe_unbreakable">cd</div>`,
                stepFunction: deleteForward,
                contentAfter: `<div class="oe_unbreakable">[]cd</div>`,
            });
            await testEditor({
                contentBefore: `<p class="oe_unbreakable no-class">[]<br></p><div class="oe_unbreakable class-name">cd</div>`,
                stepFunction: deleteForward,
                contentAfter: `<div class="oe_unbreakable class-name">[]cd</div>`,
            });
        });

        test.todo('should remove contenteditable="false"', async () => {
            await testEditor({
                contentBefore: `<div>[]<span contenteditable="false">abc</span>def</div>`,
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                },
                contentAfter: `<div>[]def</div>`,
            });
        });

        test.todo('should remove contenteditable="False"', async () => {
            await testEditor({
                contentBefore: `<div>[]<span contenteditable="False">abc</span>def</div>`,
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                },
                contentAfter: `<div>[]def</div>`,
            });
        });
    });

    describe("white spaces", () => {
        describe("no intefering spaces", () => {
            test.todo("should delete a br line break", async () => {
                await testEditor({
                    contentBefore: "<p>abc[]<br>def</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>abc[]def</p>",
                });
            });

            test("should delete a line break and merge the <p>", async () => {
                await testEditor({
                    contentBefore: "<p>abc[]</p><p>def</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>abc[]def</p>",
                });
            });
        });

        describe("intefering spaces", () => {
            test.todo("should delete a br line break", async () => {
                await testEditor({
                    contentBefore: "<p>abc[]<br> def</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>abc[]def</p>",
                });
            });

            test.todo("should merge the two <p>", async () => {
                await testEditor({
                    contentBefore: "<p>abc[]</p> <p>def</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>abc[]def</p>",
                });
                await testEditor({
                    contentBefore: "<p>abc[]</p> <p>def</p> orphan node",
                    stepFunction: deleteForward,
                    contentAfter: '<p>abc[]def</p><p style="margin-bottom: 0px;"> orphan node</p>',
                });
            });

            test.todo("should delete the space if the second <p> is display inline", async () => {
                await testEditor({
                    contentBefore: '<div>abc[] <p style="display: inline">def</p></div>',
                    stepFunction: deleteForward,
                    contentAfter: '<div>abc[]<p style="display: inline">def</p></div>',
                });
            });

            test.todo("should delete the space between the two <span>", async () => {
                await testEditor({
                    contentBefore:
                        '<div><span class="a">abc[]</span> <span class="a">def</span></div>',
                    stepFunction: deleteForward,
                    contentAfter: '<div><span class="a">abc[]def</span></div>',
                });
            });

            test.todo("should delete the space before a <span>", async () => {
                await testEditor({
                    contentBefore: '<div>abc[] <span class="a">def</span></div>',
                    stepFunction: deleteForward,
                    contentAfter: '<div>abc[]<span class="a">def</span></div>',
                });
            });
        });

        describe("intefering spaces, multiple deleteForward", () => {
            test.todo("should delete a br line break", async () => {
                await testEditor({
                    contentBefore: "<p>abc[]x<br> def</p>",
                    stepFunction: twoDeleteForward,
                    contentAfter: "<p>abc[]def</p>",
                });
            });

            test.todo("should merge the two <p>", async () => {
                await testEditor({
                    contentBefore: "<p>abc[]x</p> <p>def</p>",
                    stepFunction: twoDeleteForward,
                    contentAfter: "<p>abc[]def</p>",
                });
            });

            test.todo("should delete the space if the second <p> is display inline", async () => {
                await testEditor({
                    contentBefore: '<div>abc[]x <p style="display: inline">def</p></div>',
                    stepFunction: twoDeleteForward,
                    contentAfter: '<div>abc[]<p style="display: inline">def</p></div>',
                });
            });

            test.todo("should delete the space between the two <span>", async () => {
                await testEditor({
                    contentBefore:
                        '<div><span class="a">abc[]x</span> <span class="a">def</span></div>',
                    stepFunction: twoDeleteForward,
                    contentAfter: '<div><span class="a">abc[]def</span></div>',
                });
            });

            test.todo("should delete the space before a <span>", async () => {
                await testEditor({
                    contentBefore: '<div>abc[]x <span class="a">def</span></div>',
                    stepFunction: twoDeleteForward,
                    contentAfter: '<div>abc[]<span class="a">def</span></div>',
                });
            });
        });
    });

    describe("Line breaks", () => {
        describe("Single", () => {
            test.todo("should delete a leading line break", async () => {
                await testEditor({
                    contentBefore: "<p>[]<br>abc</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>[]abc</p>",
                });
                await testEditor({
                    contentBefore: "<p>[]<br> abc</p>",
                    stepFunction: deleteForward,
                    // The space after the <br> is expected to be parsed
                    // away, like it is in the DOM.
                    contentAfter: "<p>[]abc</p>",
                });
            });

            test.todo("should delete a line break within a paragraph", async () => {
                await testEditor({
                    contentBefore: "<p>ab[]<br>cd</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab[]cd</p>",
                });
                await testEditor({
                    contentBefore: "<p>ab []<br>cd</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab []cd</p>",
                });
                await testEditor({
                    contentBefore: "<p>ab[]<br> cd</p>",
                    stepFunction: deleteForward,
                    // The space after the <br> is expected to be parsed
                    // away, like it is in the DOM.
                    contentAfter: "<p>ab[]cd</p>",
                });
            });

            test.todo("should delete a trailing line break", async () => {
                await testEditor({
                    contentBefore: "<p>abc[]<br><br></p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>abc[]</p>",
                });
                await testEditor({
                    contentBefore: "<p>abc []<br><br></p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>abc&nbsp;[]</p>",
                });
            });

            test.todo(
                "should delete a character and a line break, emptying a paragraph",
                async () => {
                    await testEditor({
                        contentBefore: "<p>[]a<br><br></p><p>bcd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>[]<br></p><p>bcd</p>",
                    });
                }
            );

            test.todo("should delete a character before a trailing line break", async () => {
                await testEditor({
                    contentBefore: "<p>ab[]c<br><br></p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab[]<br><br></p>",
                });
            });
        });

        describe("Consecutive", () => {
            test("should merge a paragraph into a paragraph with 4 <br>", async () => {
                // 1
                await testEditor({
                    contentBefore: "<p>ab</p><p><br><br><br><br>[]</p><p>cd</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab</p><p><br><br><br>[]cd</p>",
                });
                // 2-1
                await testEditor({
                    contentBefore: "<p>ab</p><p><br><br><br>[]<br></p><p>cd</p>",
                    stepFunction: deleteForward,
                    // This should be identical to 1
                    contentAfter: "<p>ab</p><p><br><br><br>[]cd</p>",
                });
            });

            test.todo("should delete a trailing line break", async () => {
                // 3-1
                await testEditor({
                    contentBefore: "<p>ab</p><p><br><br>[]<br><br></p><p>cd</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab</p><p><br><br>[]<br></p><p>cd</p>",
                });
            });

            test.todo(
                "should delete a trailing line break, then merge a paragraph into a paragraph with 3 <br>",
                async () => {
                    // 3-2
                    await testEditor({
                        contentBefore: "<p>ab</p><p><br><br>[]<br><br></p><p>cd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>ab</p><p><br><br>[]cd</p>",
                    });
                }
            );

            test.todo("should delete a line break (1)", async () => {
                // 4-1
                await testEditor({
                    contentBefore: "<p>ab</p><p><br>[]<br><br><br></p><p>cd</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab</p><p><br>[]<br><br></p><p>cd</p>",
                });
            });

            test.todo("should delete two line breaks (1)", async () => {
                // 4-2
                await testEditor({
                    contentBefore: "<p>ab</p><p><br>[]<br><br><br></p><p>cd</p>",
                    stepFunction: async (editor) => {
                        await deleteForward(editor);
                        await deleteForward(editor);
                    },
                    contentAfter: "<p>ab</p><p><br>[]<br></p><p>cd</p>",
                });
            });

            test.todo(
                "should delete two line breaks, then merge a paragraph into a paragraph with 2 <br>",
                async () => {
                    // 4-3
                    await testEditor({
                        contentBefore: "<p>ab</p><p><br>[]<br><br><br></p><p>cd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>ab</p><p><br>[]cd</p>",
                    });
                }
            );

            test.todo("should delete a line break (2)", async () => {
                // 5-1
                await testEditor({
                    contentBefore: "<p>ab</p><p>[]<br><br><br><br></p><p>cd</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab</p><p>[]<br><br><br></p><p>cd</p>",
                });
            });

            test.todo("should delete two line breaks (2)", async () => {
                // 5-2
                await testEditor({
                    contentBefore: "<p>ab</p><p>[]<br><br><br><br></p><p>cd</p>",
                    stepFunction: async (editor) => {
                        await deleteForward(editor);
                        await deleteForward(editor);
                    },
                    contentAfter: "<p>ab</p><p>[]<br><br></p><p>cd</p>",
                });
            });

            test.todo("should delete three line breaks (emptying a paragraph)", async () => {
                // 5-3
                await testEditor({
                    contentBefore: "<p>ab</p><p>[]<br><br><br><br></p><p>cd</p>",
                    stepFunction: async (editor) => {
                        await deleteForward(editor);
                        await deleteForward(editor);
                        await deleteForward(editor);
                    },
                    contentAfter: "<p>ab</p><p>[]<br></p><p>cd</p>",
                });
            });

            test.todo(
                "should delete three line breaks, then merge a paragraph into an empty parargaph",
                async () => {
                    // 5-4
                    await testEditor({
                        contentBefore: "<p>ab</p><p>[]<br><br><br><br></p><p>cd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>ab</p><p>[]cd</p>",
                    });
                }
            );

            test("should merge a paragraph with 4 <br> into a paragraph with text", async () => {
                // 6-1
                await testEditor({
                    contentBefore: "<p>ab[]</p><p><br><br><br><br></p><p>cd</p>",
                    stepFunction: deleteForward,
                    contentAfter: "<p>ab[]<br><br><br><br></p><p>cd</p>",
                });
            });

            test.todo(
                "should merge a paragraph with 4 <br> into a paragraph with text, then delete a line break",
                async () => {
                    // 6-2
                    await testEditor({
                        contentBefore: "<p>ab[]</p><p><br><br><br><br></p><p>cd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>ab[]<br><br><br></p><p>cd</p>",
                    });
                }
            );

            test.todo(
                "should merge a paragraph with 4 <br> into a paragraph with text, then delete two line breaks",
                async () => {
                    // 6-3
                    await testEditor({
                        contentBefore: "<p>ab[]</p><p><br><br><br><br></p><p>cd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>ab[]<br><br></p><p>cd</p>",
                    });
                }
            );

            test.todo(
                "should merge a paragraph with 4 <br> into a paragraph with text, then delete three line breaks",
                async () => {
                    // 6-4
                    await testEditor({
                        contentBefore: "<p>ab[]</p><p><br><br><br><br></p><p>cd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>ab[]</p><p>cd</p>",
                    });
                }
            );

            test.todo(
                "should merge a paragraph with 4 <br> into a paragraph with text, then delete three line breaks, then merge two paragraphs with text",
                async () => {
                    // 6-5
                    await testEditor({
                        contentBefore: "<p>ab[]</p><p><br><br><br><br></p><p>cd</p>",
                        stepFunction: async (editor) => {
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                            await deleteForward(editor);
                        },
                        contentAfter: "<p>ab[]cd</p>",
                    });
                }
            );
        });
    });

    describe("Pre", () => {
        test.todo("should delete a character in a pre", async () => {
            await testEditor({
                contentBefore: "<pre>ab[]cd</pre>",
                stepFunction: deleteForward,
                contentAfter: "<pre>ab[]d</pre>",
            });
        });

        test.todo("should delete a character in a pre (space before)", async () => {
            await testEditor({
                contentBefore: "<pre>     ab[]cd</pre>",
                stepFunction: deleteForward,
                contentAfter: "<pre>     ab[]d</pre>",
            });
        });

        test.todo("should delete a character in a pre (space after)", async () => {
            await testEditor({
                contentBefore: "<pre>ab[]cd     </pre>",
                stepFunction: deleteForward,
                contentAfter: "<pre>ab[]d     </pre>",
            });
        });

        test.todo("should delete a character in a pre (space before and after)", async () => {
            await testEditor({
                contentBefore: "<pre>     ab[]cd     </pre>",
                stepFunction: deleteForward,
                contentAfter: "<pre>     ab[]d     </pre>",
            });
        });

        test.todo("should delete a space in a pre", async () => {
            await testEditor({
                contentBefore: "<pre>  []   ab</pre>",
                stepFunction: deleteForward,
                contentAfter: "<pre>  []  ab</pre>",
            });
        });

        test.todo("should delete a newline in a pre", async () => {
            await testEditor({
                contentBefore: "<pre>ab[]\ncd</pre>",
                stepFunction: deleteForward,
                contentAfter: "<pre>ab[]cd</pre>",
            });
        });

        test("should delete all leading space in a pre", async () => {
            await testEditor({
                contentBefore: "<pre>[]     ab</pre>",
                stepFunction: async (BasicEditor) => {
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                },
                contentAfter: "<pre>[]ab</pre>",
            });
        });

        test.todo("should delete all trailing space in a pre", async () => {
            await testEditor({
                contentBefore: "<pre>ab[]     </pre>",
                stepFunction: async (BasicEditor) => {
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                    await deleteForward(BasicEditor);
                },
                contentAfter: "<pre>ab[]</pre>",
            });
        });
    });

    describe("Formats", () => {
        test.todo("should delete a character after a format node", async () => {
            await testEditor({
                contentBefore: "<p><b>abc[]</b>def</p>",
                stepFunction: deleteForward,
                contentAfter: "<p><b>abc[]</b>ef</p>",
            });
            await testEditor({
                contentBefore: "<p><b>abc</b>[]def</p>",
                stepFunction: deleteForward,
                // The selection is normalized so we only have one way
                // to represent a position.
                contentAfter: "<p><b>abc[]</b>ef</p>",
            });
        });
    });

    describe("Merging different types of elements", () => {
        test("should merge a paragraph with text into a heading1 with text", async () => {
            await testEditor({
                contentBefore: "<h1>ab[]</h1><p>cd</p>",
                stepFunction: deleteForward,
                contentAfter: "<h1>ab[]cd</h1>",
            });
        });

        test("should merge an empty paragraph into a heading1 with text", async () => {
            await testEditor({
                contentBefore: "<h1>ab[]</h1><p><br></p>",
                stepFunction: deleteForward,
                contentAfter: "<h1>ab[]</h1>",
            });
        });

        test("should remove empty paragraph (keeping the heading)", async () => {
            await testEditor({
                contentBefore: "<p><br>[]</p><h1>ab</h1>",
                stepFunction: deleteForward,
                contentAfter: "<h1>[]ab</h1>",
            });
        });

        test.todo("should merge a text following a paragraph (keeping the text)", async () => {
            await testEditor({
                contentBefore: "<p>ab[]</p>cd",
                stepFunction: deleteForward,
                contentAfter: "<p>ab[]cd</p>",
            });
            await testEditor({
                contentBefore: "<p>ab[]</p>cd<p>ef</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>ab[]cd</p><p>ef</p>",
            });
        });
    });

    describe("With attributes", () => {
        test("should remove empty paragraph with class", async () => {
            await testEditor({
                contentBefore: '<p class="a"><br>[]</p><p>abc</p>',
                stepFunction: deleteForward,
                contentAfter: "<p>[]abc</p>",
            });
        });

        test.todo("should merge two paragraphs with spans of same classes", async () => {
            await testEditor({
                contentBefore:
                    '<p><span class="a">dom to[]</span></p><p><span class="a">edit</span></p>',
                stepFunction: deleteForward,
                contentAfter: '<p><span class="a">dom to[]edit</span></p>',
            });
        });

        test("should merge two paragraphs with spans of different classes without merging the spans", async () => {
            await testEditor({
                contentBefore:
                    '<p><span class="a">dom to[]</span></p><p><span class="b">edit</span></p>',
                stepFunction: deleteForward,
                contentAfter: '<p><span class="a">dom to[]</span><span class="b">edit</span></p>',
            });
        });

        test.todo(
            "should merge two paragraphs of different classes, each containing spans of the same class",
            async () => {
                await testEditor({
                    contentBefore:
                        '<p class="a"><span class="b">ab[]</span></p><p class="c"><span class="b">cd</span></p>',
                    stepFunction: deleteForward,
                    contentAfter: '<p class="a"><span class="b">ab[]cd</span></p>',
                });
            }
        );

        test("should merge two paragraphs of different classes, each containing spans of different classes without merging the spans", async () => {
            await testEditor({
                contentBefore:
                    '<p class="a"><span class="b">ab[]</span></p><p class="c"><span class="d">cd</span></p>',
                stepFunction: deleteForward,
                contentAfter:
                    '<p class="a"><span class="b">ab[]</span><span class="d">cd</span></p>',
            });
        });

        test.todo(
            "should delete a line break between two spans with bold and merge these formats",
            async () => {
                await testEditor({
                    contentBefore:
                        '<p><span class="a"><b>ab[]</b></span><br/><span class="a"><b>cd</b></span></p>',
                    stepFunction: deleteForward,
                    contentAfter: '<p><span class="a"><b>ab[]cd</b></span></p>',
                });
            }
        );

        test.todo(
            "should delete a character in a span with bold, then a line break between two spans with bold and merge these formats",
            async () => {
                await testEditor({
                    contentBefore:
                        '<p><span class="a"><b>a[]b</b></span><br><span class="a"><b><br>cde</b></span></p>',
                    stepFunction: async (editor) => {
                        await deleteForward(editor);
                        await deleteForward(editor);
                    },
                    contentAfter: '<p><span class="a"><b>a[]<br>cde</b></span></p>',
                });
            }
        );
    });

    describe("Nested editable zone (inside contenteditable=false element)", () => {
        test.todo(
            "should not remove the uneditable nesting zone nor the editable nested zone if the last element of the nested zone is empty",
            async () => {
                await testEditor({
                    contentBefore: unformat(`
                        <div contenteditable="false">
                            <div contenteditable="true">
                                <p>[]<br></p>
                            </div>
                        </div>
                    `),
                    stepFunction: deleteForward,
                    contentAfter: unformat(`
                        <div contenteditable="false">
                            <div contenteditable="true">
                                <p>[]<br></p>
                            </div>
                        </div>
                    `),
                });
            }
        );

        test.todo(
            "should not remove the uneditable nesting zone nor the editable nested zone even if there is a paragraph before",
            async () => {
                await testEditor({
                    contentBefore: unformat(`
                        <p>content</p>
                        <div contenteditable="false">
                            <div contenteditable="true">
                                <p>[]<br></p>
                            </div>
                        </div>
                    `),
                    stepFunction: deleteForward,
                    contentAfter: unformat(`
                        <p>content</p>
                        <div contenteditable="false">
                            <div contenteditable="true">
                                <p>[]<br></p>
                            </div>
                        </div>
                    `),
                });
            }
        );

        test.todo(
            "should not remove the uneditable nesting zone nor the editable nested zone if the last element of the nested zone is not empty",
            async () => {
                await testEditor({
                    contentBefore: unformat(`
                        <div contenteditable="false">
                            <div contenteditable="true">
                                <p>content[]</p>
                            </div>
                        </div>
                    `),
                    stepFunction: deleteForward,
                    contentAfter: unformat(`
                        <div contenteditable="false">
                            <div contenteditable="true">
                                <p>content[]</p>
                            </div>
                        </div>
                    `),
                });
            }
        );

        test.todo("should remove the uneditable nesting zone from the outside", async () => {
            await testEditor({
                contentBefore: unformat(`
                        <p>content[]</p>
                        <div contenteditable="false">
                            <div contenteditable="true">
                                <p>content</p>
                            </div>
                        </div>
                    `),
                stepFunction: deleteForward,
                contentAfter: unformat(`
                        <p>content[]</p>
                    `),
            });
        });
    });

    describe("POC extra tests", () => {
        test("should not remove a table without selecting it", async () => {
            await testEditor({
                contentBefore: unformat(
                    `<p>ab[]</p>
                        <table><tbody>
                            <tr><td>cd</td><td>ef</td></tr>
                            <tr><td>gh</td><td>ij</td></tr>
                        </tbody></table>
                        <p>kl</p>`
                ),
                stepFunction: deleteForward,
                contentAfter: unformat(
                    `<p>ab[]</p>
                        <table><tbody>
                            <tr><td>cd</td><td>ef</td></tr>
                            <tr><td>gh</td><td>ij</td></tr>
                        </tbody></table>
                        <p>kl</p>`
                ),
            });
        });

        test.todo("should not merge a table into its next sibling", async () => {
            await testEditor({
                contentBefore: unformat(
                    `<p>ab</p>
                        <table><tbody>
                            <tr><td>cd</td><td>ef</td></tr>
                            <tr><td>gh</td><td>ij[]</td></tr>
                        </tbody></table>
                        <p>kl</p>`
                ),
                stepFunction: deleteForward,
                contentAfter: unformat(
                    `<p>ab</p>
                        <table><tbody>
                            <tr><td>cd</td><td>ef</td></tr>
                            <tr><td>gh</td><td>ij[]</td></tr>
                        </tbody></table>
                        <p>kl</p>`
                ),
            });
        });

        test.todo("should delete the list item", async () => {
            await testEditor({
                contentBefore: unformat(
                    `<table><tbody>
                            <tr>
                                <td><ul><li>[a</li><li>b</li><li>c]</li></ul></td>
                                <td><ul><li>A</li><li>B</li><li>C</li></ul></td>
                            </tr>
                        </tbody></table>`
                ),
                stepFunction: deleteForward,
                contentAfter: unformat(
                    `<table><tbody>
                            <tr>
                                <td><ul><li>[]<br></li></ul></td>
                                <td><ul><li>A</li><li>B</li><li>C</li></ul></td>
                            </tr>
                        </tbody></table>`
                ),
            });
        });
    });
});

describe("Selection not collapsed", () => {
    test.todo("should delete part of the text within a paragraph", async () => {
        // Forward selection
        await testEditor({
            contentBefore: "<p>ab[cd]ef</p>",
            stepFunction: deleteForward,
            contentAfter: "<p>ab[]ef</p>",
        });
        // Backward selection
        await testEditor({
            contentBefore: "<p>ab]cd[ef</p>",
            stepFunction: deleteForward,
            contentAfter: "<p>ab[]ef</p>",
        });
    });

    test.todo("should merge node correctly", async () => {
        await testEditor({
            contentBefore: '<div>a<span class="a">b[c</span><p>d]e</p>f</div>',
            stepFunction: deleteForward,
            contentAfter: '<div>a<span class="a">b[]</span>e<br>f</div>',
        });
    });

    test.todo("should delete part of the text across two paragraphs", async () => {
        // Forward selection
        await testEditor({
            contentBefore: "<div>a<p>b[c</p><p>d]e</p>f</div>",
            stepFunction: deleteForward,
            contentAfter: "<div>a<p>b[]e</p>f</div>",
        });
        // Backward selection
        await testEditor({
            contentBefore: "<div>a<p>b]c</p><p>d[e</p>f</div>",
            stepFunction: deleteForward,
            contentAfter: "<div>a<p>b[]e</p>f</div>",
        });
    });

    test.todo("should not delete single remaining empty inline", async () => {
        // Forward selection
        await testEditor({
            contentBefore: "<h1><i>[abcdef]</i></h1>",
            stepFunction: deleteForward,
            // The flagged 200B is there to preserve the font so if we
            // write now, we still write in the font element's style.
            contentAfterEdit: '<h1><i data-oe-zws-empty-inline="">[]\u200B</i><br></h1>',
            // The flagged 200B is removed by the sanitizer if its
            // parent remains empty.
            contentAfter: "<h1>[]<br></h1>",
        });
    });

    test.todo("should not delete styling nodes if not selected", async () => {
        await testEditor({
            contentBefore: '<p>a<span class="style-class">[bcde]</span>f</p>',
            stepFunction: deleteForward,
            contentAfter: '<p>a<span class="style-class">[]\u200B</span>f</p>',
        });
    });

    test.todo("should delete styling nodes when delete if empty", async () => {
        await testEditor({
            contentBefore: '<p>ab <span class="style-class">[cd]</span> ef</p>',
            stepFunction: async (editor) => {
                await deleteForward(editor);
                await deleteForward(editor);
            },
            contentAfter: "<p>ab []ef</p>",
        });
        await testEditor({
            contentBefore: '<p>uv<span class="style-class">[wx]</span>yz</p>',
            stepFunction: async (editor) => {
                await deleteForward(editor);
                await deleteForward(editor);
            },
            contentAfter: "<p>uv[]z</p>",
        });
    });

    test.todo("should delete across two paragraphs", async () => {
        // Forward selection
        await testEditor({
            contentBefore: "<p>ab[cd</p><p>ef]gh</p>",
            stepFunction: deleteForward,
            contentAfter: "<p>ab[]gh</p>",
        });
        // Backward selection
        await testEditor({
            contentBefore: "<p>ab]cd</p><p>ef[gh</p>",
            stepFunction: deleteForward,
            contentAfter: "<p>ab[]gh</p>",
        });
    });

    test.todo("should delete all the text in a paragraph", async () => {
        // Forward selection
        await testEditor({
            contentBefore: "<p>[abc]</p>",
            stepFunction: deleteForward,
            contentAfter: "<p>[]<br></p>",
        });
        // Backward selection
        await testEditor({
            contentBefore: "<p>]abc[</p>",
            stepFunction: deleteForward,
            contentAfter: "<p>[]<br></p>",
        });
    });

    test.todo(
        "should delete a complex selection accross format nodes and multiple paragraphs",
        async () => {
            // Forward selection
            await testEditor({
                contentBefore: "<p><b>ab[cd</b></p><p><b>ef<br/>gh</b>ij<i>kl]</i>mn</p>",
                stepFunction: deleteForward,
                contentAfter: "<p><b>ab[]</b>mn</p>",
            });
            await testEditor({
                contentBefore: "<p><b>ab[cd</b></p><p><b>ef<br/>gh</b>ij<i>k]l</i>mn</p>",
                stepFunction: deleteForward,
                contentAfter: "<p><b>ab[]</b><i>l</i>mn</p>",
            });
            // Backward selection
            await testEditor({
                contentBefore: "<p><b>ab]cd</b></p><p><b>ef<br/>gh</b>ij<i>kl[</i>mn</p>",
                stepFunction: deleteForward,
                contentAfter: "<p><b>ab[]</b>mn</p>",
            });
            await testEditor({
                contentBefore: "<p><b>ab]cd</b></p><p><b>ef<br/>gh</b>ij<i>k[l</i>mn</p>",
                stepFunction: deleteForward,
                contentAfter: "<p><b>ab[]</b><i>l</i>mn</p>",
            });
        }
    );

    test.todo(
        "should delete all contents of a complex DOM with format nodes and multiple paragraphs",
        async () => {
            // Forward selection
            await testEditor({
                contentBefore: "<p><b>[abcd</b></p><p><b>ef<br/>gh</b>ij<i>kl</i>mn]</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]<br></p>",
            });
            // Backward selection
            await testEditor({
                contentBefore: "<p><b>]abcd</b></p><p><b>ef<br/>gh</b>ij<i>kl</i>mn[</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]<br></p>",
            });
        }
    );

    test.todo("should delete a selection accross a heading1 and a paragraph", async () => {
        // Forward selection
        await testEditor({
            contentBefore: "<h1>ab [cd</h1><p>ef]gh</p>",
            stepFunction: deleteForward,
            contentAfter: "<h1>ab []gh</h1>",
        });
        // Backward selection
        await testEditor({
            contentBefore: "<h1>ab ]cd</h1><p>ef[gh</p>",
            stepFunction: deleteForward,
            contentAfter: "<h1>ab []gh</h1>",
        });
    });

    test.todo(
        "should delete a selection from the beginning of a heading1 with a format to the middle of a paragraph + start of editable",
        async () => {
            //Forward selection
            await testEditor({
                contentBefore: "<h1><b>[abcd</b></h1><p>ef]gh1</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]gh1</p>",
            });
            await testEditor({
                contentBefore: "<h1>[<b>abcd</b></h1><p>ef]gh2</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]gh2</p>",
            });
            // Backward selection
            await testEditor({
                contentBefore: "<h1><b>]abcd</b></h1><p>ef[gh3</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]gh3</p>",
            });
            await testEditor({
                contentBefore: "<h1>]<b>abcd</b></h1><p>ef[gh4</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>[]gh4</p>",
            });
        }
    );

    test.todo(
        "should delete a selection from the beginning of a heading1 with a format to the middle of a paragraph + content",
        async () => {
            await testEditor({
                contentBefore: "<p>content</p><h1><b>[abcd</b></h1><p>ef]gh1</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>content</p><p>[]gh1</p>",
            });
            await testEditor({
                contentBefore: "<p>content</p><h1>[<b>abcd</b></h1><p>ef]gh2</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>content</p><p>[]gh2</p>",
            });
        }
    );

    test.todo(
        "should delete a selection from the beginning of a heading1 to the end of a paragraph",
        async () => {
            //Forward selection
            await testEditor({
                contentBefore: "<h1>[abcd</h1><p>ef]</p><h2>1</h2>",
                stepFunction: deleteForward,
                contentAfter: "<h1>[]<br></h1><h2>1</h2>",
            });
            await testEditor({
                contentBefore: "<h1>[abcd</h1><p>ef]</p><h2>2</h2>",
                stepFunction: deleteForward,
                contentAfter: "<h1>[]<br></h1><h2>2</h2>",
            });
            // Backward selection
            await testEditor({
                contentBefore: "<h1>]abcd</h1><p>ef[</p><h2>3</h2>",
                stepFunction: deleteForward,
                contentAfter: "<h1>[]<br></h1><h2>3</h2>",
            });
            await testEditor({
                contentBefore: "<h1>]abcd</h1><p>ef[</p><h2>4</h2>",
                stepFunction: deleteForward,
                contentAfter: "<h1>[]<br></h1><h2>4</h2>",
            });
        }
    );

    test.todo(
        "should delete a selection from the beginning of a heading1 with a format to the end of a paragraph",
        async () => {
            //Forward selection
            await testEditor({
                contentBefore: "<h1><u>[abcd</u></h1><p>ef]</p><h2>1</h2>",
                stepFunction: deleteForward,
                contentAfterEdit:
                    '<h1><u data-oe-zws-empty-inline="">[]\u200B</u><br></h1><h2>1</h2>',
                contentAfter: "<h1>[]<br></h1><h2>1</h2>",
            });
            await testEditor({
                contentBefore: "<h1>[<u>abcd</u></h1><p>ef]</p><h2>2</h2>",
                stepFunction: deleteForward,
                contentAfterEdit:
                    '<h1><u data-oe-zws-empty-inline="">[]\u200B</u><br></h1><h2>2</h2>',
                contentAfter: "<h1>[]<br></h1><h2>2</h2>",
            });
            // Backward selection
            await testEditor({
                contentBefore: "<h1><u>]abcd</u></h1><p>ef[</p><h2>3</h2>",
                stepFunction: deleteForward,
                contentAfterEdit:
                    '<h1><u data-oe-zws-empty-inline="">[]\u200B</u><br></h1><h2>3</h2>',
                contentAfter: "<h1>[]<br></h1><h2>3</h2>",
            });
            await testEditor({
                contentBefore: "<h1>]<u>abcd</u></h1><p>ef[</p><h2>4</h2>",
                stepFunction: deleteForward,
                contentAfterEdit:
                    '<h1><u data-oe-zws-empty-inline="">[]\u200B</u><br></h1><h2>4</h2>',
                contentAfter: "<h1>[]<br></h1><h2>4</h2>",
            });
        }
    );

    test.todo("should not break unbreakables", async () => {
        await testEditor({
            contentBefore:
                `<div class="oe_unbreakable"><div class="oe_unbreakable">` +
                `<div class="oe_unbreakable"><div class="oe_unbreakable">a[bc</div>` +
                `<div class="oe_unbreakable">de]f</div></div></div></div>`,
            stepFunction: deleteForward,
            contentAfter:
                `<div class="oe_unbreakable"><div class="oe_unbreakable">` +
                `<div class="oe_unbreakable"><div class="oe_unbreakable">a[]</div>` +
                `<div class="oe_unbreakable">f</div></div></div></div>`,
        });
        await testEditor({
            contentBefore: '<p class="oe_unbreakable">a[bc</p><p class="oe_unbreakable">de]f</p>',
            stepFunction: deleteForward,
            contentAfter: '<p class="oe_unbreakable">a[]</p><p class="oe_unbreakable">f</p>', // JW without oe_breakable classes of course
        });
    });

    test.todo("should delete a heading (triple click delete)", async () => {
        await testEditor({
            contentBefore: "<h1>[abc</h1><p>]def</p>",
            stepFunction: deleteForward,
            // JW cAfter: '<p>[]def</p>',
            contentAfter: "<h1>[]<br></h1><p>def</p>",
        });
        await testEditor({
            contentBefore: "<h1>[abc</h1><p>]<br></p><p>def</p>",
            stepFunction: deleteForward,
            contentAfter: "<h1>[]<br></h1><p><br></p><p>def</p>",
        });
    });

    test("should delete last character of paragraph, ignoring the selected paragraph break", async () => {
        await testEditor({
            contentBefore: "<p>ab[c</p><p>]def</p>",
            // This type of selection (typically done with a triple
            // click) is "corrected" before remove so triple clicking
            // doesn't remove a paragraph break.
            stepFunction: deleteForward,
            contentAfter: "<p>ab[]</p><p>def</p>",
        });
    });

    test.todo(
        "should delete first character of paragraph, as well as selected paragraph break",
        async () => {
            await testEditor({
                contentBefore: "<p>abc[</p><p>d]ef</p>",
                stepFunction: deleteForward,
                contentAfter: "<p>abc[]ef</p>",
            });
        }
    );

    test("should delete last character of paragraph, ignoring the selected paragraph break leading to an unbreakable", async () => {
        await testEditor({
            contentBefore: '<p>ab[c</p><p t="unbreak">]def</p>',
            // This type of selection (typically done with a triple
            // click) is "corrected" before remove so triple clicking
            // doesn't remove a paragraph break.
            stepFunction: deleteForward,
            contentAfter: '<p>ab[]</p><p t="unbreak">def</p>',
        });
    });

    test.todo(
        "should delete first character of unbreakable, ignoring selected paragraph break",
        async () => {
            await testEditor({
                contentBefore: '<p>abc[</p><p t="unbreak">d]ef</p>',
                stepFunction: deleteForward,
                contentAfter: '<p>abc[]</p><p t="unbreak">ef</p>',
            });
        }
    );

    test.todo("should remove a fully selected table", async () => {
        await testEditor({
            contentBefore: unformat(
                `<p>a[b</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>k]l</p>`
            ),
            stepFunction: deleteForward,
            contentAfter: "<p>a[]l</p>",
        });
    });

    test.todo(
        "should only remove the text content of cells in a partly selected table",
        async () => {
            await testEditor({
                contentBefore: unformat(
                    `<table><tbody>
                        <tr><td>cd</td><td class="o_selected_td">e[f</td><td>gh</td></tr>
                        <tr><td>ij</td><td class="o_selected_td">k]l</td><td>mn</td></tr>
                        <tr><td>op</td><td>qr</td><td>st</td></tr>
                    </tbody></table>`
                ),
                stepFunction: deleteForward,
                contentAfter: unformat(
                    `<table><tbody>
                        <tr><td>cd</td><td>[]<br></td><td>gh</td></tr>
                        <tr><td>ij</td><td><br></td><td>mn</td></tr>
                        <tr><td>op</td><td>qr</td><td>st</td></tr>
                    </tbody></table>`
                ),
            });
        }
    );

    test.todo(
        "should remove some text and a table (even if the table is partly selected)",
        async () => {
            await testEditor({
                contentBefore: unformat(
                    `<p>a[b</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>g]h</td><td>ij</td></tr>
                    </tbody></table>
                    <p>kl</p>`
                ),
                stepFunction: deleteForward,
                contentAfter: unformat(
                    `<p>a[]</p>
                    <p>kl</p>`
                ),
            });
        }
    );

    test.todo(
        "should remove a table and some text (even if the table is partly selected)",
        async () => {
            await testEditor({
                contentBefore: unformat(
                    `<p>ab</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>i[j</td></tr>
                    </tbody></table>
                    <p>k]l</p>`
                ),
                stepFunction: deleteForward,
                contentAfter: unformat(
                    `<p>ab</p>
                    <p>[]l</p>`
                ),
            });
        }
    );

    test.todo("should remove some text, a table and some more text", async () => {
        await testEditor({
            contentBefore: unformat(
                `<p>a[b</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>k]l</p>`
            ),
            stepFunction: deleteForward,
            contentAfter: `<p>a[]l</p>`,
        });
    });

    test.todo("should remove a selection of several tables", async () => {
        await testEditor({
            contentBefore: unformat(
                `<table><tbody>
                        <tr><td>cd</td><td>e[f</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <table><tbody>
                        <tr><td>cd</td><td>e]f</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>`
            ),
            stepFunction: deleteForward,
            contentAfter: `<p>[]<br></p>`,
        });
    });

    test.todo("should remove a selection including several tables", async () => {
        await testEditor({
            contentBefore: unformat(
                `<p>0[1</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>23</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>45</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>67]</p>`
            ),
            stepFunction: deleteForward,
            contentAfter: `<p>0[]</p>`,
        });
    });

    test.todo("should remove everything, including several tables", async () => {
        await testEditor({
            contentBefore: unformat(
                `<p>[01</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>23</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>45</p>
                    <table><tbody>
                        <tr><td>cd</td><td>ef</td></tr>
                        <tr><td>gh</td><td>ij</td></tr>
                    </tbody></table>
                    <p>67]</p>`
            ),
            stepFunction: deleteForward,
            contentAfter: `<p>[]<br></p>`,
        });
    });

    test.todo("should empty an inline unremovable but remain in it", async () => {
        await testEditor({
            contentBefore: '<p>ab<b class="oe_unremovable">[cd]</b>ef</p>',
            stepFunction: deleteForward,
            contentAfter: '<p>ab<b class="oe_unremovable">[]\u200B</b>ef</p>',
        });
    });

    test.todo(
        "should remove element which is contenteditable=true even if their parent is contenteditable=false",
        async () => {
            await testEditor({
                contentBefore: unformat(`
                    <p>before[o</p>
                    <div contenteditable="false">
                        <div contenteditable="true"><p>intruder</p></div>
                    </div>
                    <p>o]after</p>`),
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                },
                contentAfter: unformat(`
                    <p>before[]after</p>`),
            });
        }
    );

    test.todo(
        "should extend the range to fully include contenteditable=false that are partially selected at the end of the range",
        async () => {
            await testEditor({
                contentBefore: unformat(`
                    <p>before[o</p>
                    <div contenteditable="false">
                        <div contenteditable="true"><p>intruder]</p></div>
                    </div>
                    <p>after</p>`),
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                },
                contentAfter: unformat(`
                    <p>before[]</p><p>after</p>`),
            });
        }
    );

    test.todo(
        "should extend the range to fully include contenteditable=false that are partially selected at the start of the range",
        async () => {
            await testEditor({
                contentBefore: unformat(`
                    <p>before</p>
                    <div contenteditable="false">
                        <div contenteditable="true"><p>[intruder</p></div>
                    </div>
                    <p>o]after</p>`),
                stepFunction: async (editor) => {
                    await deleteForward(editor);
                },
                contentAfter: unformat(`
                    <p>before[]after</p>`),
            });
        }
    );
});
