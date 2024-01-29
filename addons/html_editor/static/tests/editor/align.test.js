/** @odoo-module */

import { describe, test } from "@odoo/hoot";
import { testEditor } from "../test_helpers/editor";
import {
    justifyCenter,
    justifyFull,
    justifyLeft,
    justifyRight,
} from "../test_helpers/user_actions";

describe("left", () => {
    test.todo("should align left", async () => {
        await testEditor({
            contentBefore: "<p>ab</p><p>c[]d</p>",
            stepFunction: justifyLeft,
            contentAfter: "<p>ab</p><p>c[]d</p>",
        });
    });

    test.todo("should not align left a non-editable node", async () => {
        await testEditor({
            contentBefore: '<p>ab</p><div contenteditable="false"><p>c[]d</p></div>',
            contentBeforeEdit:
                '<p>ab</p><div contenteditable="false" data-oe-keep-contenteditable=""><p>c[]d</p></div>',
            stepFunction: justifyLeft,
            contentAfterEdit:
                '<p>ab</p><div contenteditable="false" data-oe-keep-contenteditable=""><p>c[]d</p></div>',
            contentAfter: '<p>ab</p><div contenteditable="false"><p>c[]d</p></div>',
        });
    });

    test.todo("should align several paragraphs left", async () => {
        await testEditor({
            contentBefore: "<p>a[b</p><p>c]d</p>",
            stepFunction: justifyLeft,
            contentAfter: "<p>a[b</p><p>c]d</p>",
        });
    });

    test.todo("should left align a node within a right-aligned node", async () => {
        await testEditor({
            contentBefore: '<div style="text-align: right;"><p>ab</p><p>c[d]e</p></div>',
            stepFunction: justifyLeft,
            contentAfter:
                '<div style="text-align: right;"><p>ab</p><p style="text-align: left;">c[d]e</p></div>',
        });
    });

    test.todo("should left align a node within a right-aligned node and a paragraph", async () => {
        await testEditor({
            contentBefore: '<div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p>',
            stepFunction: justifyLeft,
            contentAfter:
                '<div style="text-align: right;"><p>ab</p><p style="text-align: left;">c[d</p></div><p>e]f</p>',
        });
    });

    test.todo(
        "should left align a node within a right-aligned node and a paragraph, with a center-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: center;"><div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyLeft,
                contentAfter:
                    '<div style="text-align: center;"><div style="text-align: right;"><p>ab</p><p style="text-align: left;">c[d</p></div><p style="text-align: left;">e]f</p></div>',
            });
        }
    );

    test.todo(
        "should left align a node within a right-aligned node and a paragraph, with a left-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: left;"><div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyLeft,
                contentAfter:
                    '<div style="text-align: left;"><div style="text-align: right;"><p>ab</p><p style="text-align: left;">c[d</p></div><p>e]f</p></div>',
            });
        }
    );

    test.todo(
        "should not left align a node that is already within a left-aligned node",
        async () => {
            await testEditor({
                contentBefore: '<div style="text-align: left;"><p>ab</p><p>c[d]e</p></div>',
                stepFunction: justifyLeft,
                contentAfter: '<div style="text-align: left;"><p>ab</p><p>c[d]e</p></div>',
            });
        }
    );

    test.todo(
        "should left align a container within an editable that is center-aligned",
        async () => {
            await testEditor({
                contentBefore:
                    '<div contenteditable="true" style="text-align: center;"><h1>a[]b</h1></div>',
                stepFunction: justifyLeft,
                contentAfter:
                    '<div contenteditable="true" style="text-align: center;"><h1 style="text-align: left;">a[]b</h1></div>',
            });
        }
    );
});

describe("center", () => {
    test.todo("should align center", async () => {
        await testEditor({
            contentBefore: "<p>ab</p><p>c[]d</p>",
            stepFunction: justifyCenter,
            contentAfter: '<p>ab</p><p style="text-align: center;">c[]d</p>',
        });
    });

    test.todo("should align several paragraphs center", async () => {
        await testEditor({
            contentBefore: "<p>a[b</p><p>c]d</p>",
            stepFunction: justifyCenter,
            contentAfter:
                '<p style="text-align: center;">a[b</p><p style="text-align: center;">c]d</p>',
        });
    });

    test.todo("should center align a node within a right-aligned node", async () => {
        await testEditor({
            contentBefore: '<div style="text-align: right;"><p>ab</p><p>c[d]e</p></div>',
            stepFunction: justifyCenter,
            contentAfter:
                '<div style="text-align: right;"><p>ab</p><p style="text-align: center;">c[d]e</p></div>',
        });
    });

    test.todo(
        "should center align a node within a right-aligned node and a paragraph",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p>',
                stepFunction: justifyCenter,
                contentAfter:
                    '<div style="text-align: right;"><p>ab</p><p style="text-align: center;">c[d</p></div><p style="text-align: center;">e]f</p>',
            });
        }
    );

    test.todo(
        "should center align a node within a right-aligned node and a paragraph, with a left-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: left;"><div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyCenter,
                contentAfter:
                    '<div style="text-align: left;"><div style="text-align: right;"><p>ab</p><p style="text-align: center;">c[d</p></div><p style="text-align: center;">e]f</p></div>',
            });
        }
    );

    test.todo(
        "should center align a node within a right-aligned node and a paragraph, with a center-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: center;"><div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyCenter,
                contentAfter:
                    '<div style="text-align: center;"><div style="text-align: right;"><p>ab</p><p style="text-align: center;">c[d</p></div><p>e]f</p></div>',
            });
        }
    );

    test.todo(
        "should not center align a node that is already within a center-aligned node",
        async () => {
            await testEditor({
                contentBefore: '<div style="text-align: center;"><p>ab</p><p>c[d]e</p></div>',
                stepFunction: justifyCenter,
                contentAfter: '<div style="text-align: center;"><p>ab</p><p>c[d]e</p></div>',
            });
        }
    );

    test.todo(
        "should center align a left-aligned container within an editable that is center-aligned",
        async () => {
            await testEditor({
                contentBefore:
                    '<div contenteditable="true" style="text-align: center;"><h1 style="text-align: left;">a[]b</h1></div>',
                stepFunction: justifyCenter,
                contentAfter:
                    '<div contenteditable="true" style="text-align: center;"><h1 style="text-align: center;">a[]b</h1></div>',
            });
        }
    );
});

describe("right", () => {
    test.todo("should align right", async () => {
        await testEditor({
            contentBefore: "<p>ab</p><p>c[]d</p>",
            stepFunction: justifyRight,
            contentAfter: '<p>ab</p><p style="text-align: right;">c[]d</p>',
        });
    });

    test.todo("should align several paragraphs right", async () => {
        await testEditor({
            contentBefore: "<p>a[b</p><p>c]d</p>",
            stepFunction: justifyRight,
            contentAfter:
                '<p style="text-align: right;">a[b</p><p style="text-align: right;">c]d</p>',
        });
    });

    test.todo("should right align a node within a center-aligned node", async () => {
        await testEditor({
            contentBefore: '<div style="text-align: center;"><p>ab</p><p>c[d]e</p></div>',
            stepFunction: justifyRight,
            contentAfter:
                '<div style="text-align: center;"><p>ab</p><p style="text-align: right;">c[d]e</p></div>',
        });
    });

    test.todo(
        "should right align a node within a center-aligned node and a paragraph",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: center;"><p>ab</p><p>c[d</p></div><p>e]f</p>',
                stepFunction: justifyRight,
                contentAfter:
                    '<div style="text-align: center;"><p>ab</p><p style="text-align: right;">c[d</p></div><p style="text-align: right;">e]f</p>',
            });
        }
    );

    test.todo(
        "should right align a node within a center-aligned node and a paragraph, with a justify-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: justify;"><div style="text-align: center;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyRight,
                contentAfter:
                    '<div style="text-align: justify;"><div style="text-align: center;"><p>ab</p><p style="text-align: right;">c[d</p></div><p style="text-align: right;">e]f</p></div>',
            });
        }
    );

    test.todo(
        "should right align a node within a center-aligned node and a paragraph, with a right-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: right;"><div style="text-align: center;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyRight,
                contentAfter:
                    '<div style="text-align: right;"><div style="text-align: center;"><p>ab</p><p style="text-align: right;">c[d</p></div><p>e]f</p></div>',
            });
        }
    );

    test.todo(
        "should not right align a node that is already within a right-aligned node",
        async () => {
            await testEditor({
                contentBefore: '<div style="text-align: right;"><p>ab</p><p>c[d]e</p></div>',
                stepFunction: justifyRight,
                contentAfter: '<div style="text-align: right;"><p>ab</p><p>c[d]e</p></div>',
            });
        }
    );

    test.todo(
        "should right align a container within an editable that is center-aligned",
        async () => {
            await testEditor({
                contentBefore:
                    '<div contenteditable="true" style="text-align: center;"><h1>a[]b</h1></div>',
                stepFunction: justifyRight,
                contentAfter:
                    '<div contenteditable="true" style="text-align: center;"><h1 style="text-align: right;">a[]b</h1></div>',
            });
        }
    );
});

describe("justify", () => {
    test.todo("should align justify", async () => {
        await testEditor({
            contentBefore: "<p>ab</p><p>c[]d</p>",
            stepFunction: justifyFull,
            contentAfter: '<p>ab</p><p style="text-align: justify;">c[]d</p>',
        });
    });

    test.todo("should align several paragraphs justify", async () => {
        await testEditor({
            contentBefore: "<p>a[b</p><p>c]d</p>",
            stepFunction: justifyFull,
            contentAfter:
                '<p style="text-align: justify;">a[b</p><p style="text-align: justify;">c]d</p>',
        });
    });

    test.todo("should justify align a node within a right-aligned node", async () => {
        await testEditor({
            contentBefore: '<div style="text-align: right;"><p>ab</p><p>c[d]e</p></div>',
            stepFunction: justifyFull,
            contentAfter:
                '<div style="text-align: right;"><p>ab</p><p style="text-align: justify;">c[d]e</p></div>',
        });
    });

    test.todo(
        "should justify align a node within a right-aligned node and a paragraph",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p>',
                stepFunction: justifyFull,
                contentAfter:
                    '<div style="text-align: right;"><p>ab</p><p style="text-align: justify;">c[d</p></div><p style="text-align: justify;">e]f</p>',
            });
        }
    );

    test.todo(
        "should justify align a node within a right-aligned node and a paragraph, with a center-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: center;"><div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyFull,
                contentAfter:
                    '<div style="text-align: center;"><div style="text-align: right;"><p>ab</p><p style="text-align: justify;">c[d</p></div><p style="text-align: justify;">e]f</p></div>',
            });
        }
    );

    test.todo(
        "should justify align a node within a right-aligned node and a paragraph, with a justify-aligned common ancestor",
        async () => {
            await testEditor({
                contentBefore:
                    '<div style="text-align: justify;"><div style="text-align: right;"><p>ab</p><p>c[d</p></div><p>e]f</p></div>',
                stepFunction: justifyFull,
                contentAfter:
                    '<div style="text-align: justify;"><div style="text-align: right;"><p>ab</p><p style="text-align: justify;">c[d</p></div><p>e]f</p></div>',
            });
        }
    );

    test.todo(
        "should not justify align a node that is already within a justify-aligned node",
        async () => {
            await testEditor({
                contentBefore: '<div style="text-align: justify;"><p>ab</p><p>c[d]e</p></div>',
                stepFunction: justifyFull,
                contentAfter: '<div style="text-align: justify;"><p>ab</p><p>c[d]e</p></div>',
            });
        }
    );

    test.todo(
        "should justify align a container within an editable that is center-aligned",
        async () => {
            await testEditor({
                contentBefore:
                    '<div contenteditable="true" style="text-align: center;"><h1>a[]b</h1></div>',
                stepFunction: justifyFull,
                contentAfter:
                    '<div contenteditable="true" style="text-align: center;"><h1 style="text-align: justify;">a[]b</h1></div>',
            });
        }
    );
});
