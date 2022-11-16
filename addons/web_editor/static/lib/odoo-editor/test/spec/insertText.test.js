import {
    testEditor,
    BasicEditor,
    insertText,
} from '../utils.js';

describe('Insert Text', () => {
    describe('Selection collapsed', () => {
        describe('Basic', () => {
            it('should insert a char into an empty paragraph', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>[]<br></p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'a');
                    },
                    contentAfter: '<p>a[]</p>',
                });
            });
            it('should insert a char before another char', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>[]b</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'a');
                    },
                    contentAfter: '<p>a[]b</p>',
                });
            });
            it('should insert a char after another char', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>a[]</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'b');
                    },
                    contentAfter: '<p>ab[]</p>',
                });
            });
        });
    });
    describe('Selection not collapsed', () => {
        describe('Basic', () => {
            it('should insert a char into an empty paragraph', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>[x]</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'a');
                    },
                    contentAfter: '<p>a[]</p>',
                });
            });
            it('should insert a char before another char', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>[x]b</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'a');
                    },
                    contentAfter: '<p>a[]b</p>',
                });
            });
            it('should insert a char after another char', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>a[x]</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'b');
                    },
                    contentAfter: '<p>ab[]</p>',
                });
            });
        });
        describe('Complex selection', () => {
            it('should insert a char into an empty paragraph', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>[x<b>x<i>y</i>z</b>x]</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'a');
                    },
                    contentAfter: '<p>a[]</p>',
                });
            });
            it('should insert a char before another char', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>[x<b>x<i>y</i>z</b>x]b</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'a');
                    },
                    contentAfter: '<p>a[]b</p>',
                });
            });
            it('should insert a char after another char', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: '<p>a[x<b>x<i>y</i>z</b>x]</p>',
                    stepFunction: async editor => {
                        await insertText(editor, 'b');
                    },
                    contentAfter: '<p>ab[]</p>',
                });
            });
        });
        describe('Special cases selection', () => {
            it('should insert at the selection', async () => {
                await testEditor(BasicEditor, {
                    contentBefore:
`<div><ul>
                           <li><t t-out="object.event_id.location" data-oe-t-inline="true">Y</t>
                                            [(<a href="#test">link</a>)]
                            </li>
</ul></div>`,
                    stepFunction: async editor => {
                        await insertText(editor, 'x');
                    },
                    contentAfter: "undefined yet",
                });
            });
        });
    });
});
