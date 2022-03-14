import {
    BasicEditor,
    insertText,
    keydown,
    nextTickFrame,
    testEditor,
    unformat,
} from '../utils.js';

/**
 * In the following tests, a fake keydown is generated. In cases where
 * the behavior is left up to the browser, nothing should happen. There will be
 * a change only when a navigationNode is inserted if the conditions are met.
 * As the code for the navigationNode is symmetrical, there is not much point in
 * doing extensive testing for both events (ArrowUp and ArrowDown). Only a basic
 * case will be tested for both to validate the symmetry.
 */
describe('NavigationNode', () => {
    describe('Selection change', () => {
        /**
         * The first part of this test re-enacts another test which proves that
         * a navigationNode is created. The second part of this test changes the
         * selection in order to remove it, so, the final result is unchanged.
         */
        it('should remove a navigationNode when the selection change outside of the magicnode', async () => {
            await testEditor(BasicEditor, {
                contentBefore: unformat(`
                    <div>
                        <p>[]<br></p>
                    </div>`),
                stepFunction: async editor => {
                    const sel = document.getSelection();
                    const anchorNode = sel.anchorNode;
                    await keydown(editor.editable, 'ArrowDown');
                    sel.removeAllRanges();
                    const range = document.createRange();
                    range.setStart(anchorNode, 0);
                    range.collapse(true);
                    sel.addRange(range);
                    await nextTickFrame();
                },
                contentAfter: unformat(`
                    <div>
                        <p>[]<br></p>
                    </div>`),
            });
        });
        /**
         * Same test as before, but a text is inserted in the navigationNode
         * before changing the selection.
         */
        it('should not remove a navigationNode as long as its content was modified', async () => {
            await testEditor(BasicEditor, {
                contentBefore: unformat(`
                    <div>
                        <p>[]<br></p>
                    </div>`),
                stepFunction: async editor => {
                    const sel = document.getSelection();
                    const anchorNode = sel.anchorNode;
                    await keydown(editor.editable, 'ArrowDown');
                    await insertText(editor, 'text');
                    sel.removeAllRanges();
                    const range = document.createRange();
                    range.setStart(anchorNode, 0);
                    range.collapse(true);
                    sel.addRange(range);
                    await nextTickFrame();
                },
                contentAfter: unformat(`
                    <div>
                        <p>[]<br></p>
                    </div>
                    <p>text</p>`),
            });
        });
    });
    describe('One depth variance', () => {
        describe('ArrowUp', () => {
            it('should create a navigationNode when the carret is in an editable and it is the only child of its parent', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <div>
                            <p>[]<br></p>
                        </div>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowUp');
                    },
                    contentAfter: unformat(`
                        <p>[]<br></p>
                        <div>
                            <p><br></p>
                        </div>`),
                });
            });
        });
        describe('ArrowDown', () => {
            it('should create a navigationNode when the carret is in an editable and it is the only child of its parent', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <div>
                            <p>[]<br></p>
                        </div>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowDown');
                    },
                    contentAfter: unformat(`
                        <div>
                            <p><br></p>
                        </div>
                        <p>[]<br></p>`),
                });
            });
            it('should not create a navigationNode when the carret is on a <p> and the sibling is editable', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <p>[]<br></p>
                        <div><p><br></p></div>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowDown');
                    },
                    contentAfter: unformat(`
                        <p>[]<br></p>
                        <div><p><br></p></div>`),
                });
            });
            it('should not create a navigationNode when the carret is in an editable and the sibling is a <p>', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <div>
                            <p>[]<br></p>
                        </div>
                        <p><br></p>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowDown');
                    },
                    contentAfter: unformat(`
                        <div>
                            <p>[]<br></p>
                        </div>
                        <p><br></p>`),
                });
            });
            it('should create a navigationNode from the sibling if the sibling is not editable', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <p>[]<br></p>
                        <div contenteditable="false"><p><br></p></div>
                        <div><p><br></p></div>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowDown');
                    },
                    contentAfter: unformat(`
                        <p><br></p>
                        <div contenteditable="false"><p><br></p></div>
                        <p>[]<br></p>
                        <div><p><br></p></div>`),
                });
            });
            describe('In a <div>', () => {
                it('should create a navigationNode when the carret is in an editable and the sibling is editable', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: unformat(`
                            <div><div>
                                    <p>[]<br></p>
                                </div>
                                <div><p><br></p></div>
                            </div>`),
                        stepFunction: async editor => {
                            await keydown(editor.editable, 'ArrowDown');
                        },
                        contentAfter: unformat(`
                            <div><div>
                                    <p><br></p>
                                </div>
                                <p>[]<br></p>
                                <div><p><br></p></div>
                            </div>`),
                    });
                });
            });
            describe('In a <td> (table)', () => {
                it('should create a navigationNode when the carret is in an editable and the sibling is editable', async () => {
                    await testEditor(BasicEditor, {
                        contentBefore: unformat(`
                            <table><tbody><tr><td><div>
                                    <p>[]<br></p>
                                </div>
                                <div><p><br></p></div>
                            </td></tr></tbody></table>`),
                        stepFunction: async editor => {
                            await keydown(editor.editable, 'ArrowDown');
                        },
                        contentAfter: unformat(`
                            <table><tbody><tr><td><div>
                                    <p><br></p>
                                </div>
                                <p>[]<br></p>
                                <div><p><br></p></div>
                            </td></tr></tbody></table>`),
                    });
                });
            });
        });
    });
    describe('Multi-depth variance', () => {
        describe('ArrowUp', () => {
            it('should not create a navigationNode in a non editable parent and should check siblings in the right direction', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <div contenteditable="false">
                            <div contenteditable="true"><p><br></p></div>
                        </div>
                        <div contenteditable="false">
                            <div contenteditable="true"><p>[]<br></p></div>
                        </div>
                        <p><br></p>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowUp');
                    },
                    contentAfter: unformat(`
                        <div contenteditable="false">
                            <div contenteditable="true"><p><br></p></div>
                        </div>
                        <p>[]<br></p>
                        <div contenteditable="false">
                            <div contenteditable="true"><p><br></p></div>
                        </div>
                        <p><br></p>`),
                });
            });
            it('should enforce moving the carret when changing browsing context (because of a contenteditable=false parent) in case a navigationNode is not needed', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <div>
                            <p>text</p>
                            <div contenteditable="false">
                                <div contenteditable="true"><p>[]<br></p></div>
                            </div>
                        </div>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowUp');
                    },
                    contentAfter: unformat(`
                        <div>
                            <p>text[]</p>
                            <div contenteditable="false">
                                <div contenteditable="true"><p><br></p></div>
                            </div>
                        </div>`),
                });
            });
        });
        describe('ArrowDown', () => {
            it('should create a navigationNode in the first editable parent when exiting an editable which has a non-editable parent', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <div>
                            <div contenteditable="false">
                                <div contenteditable="true"><p>[]<br></p></div>
                            </div>
                        </div>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowDown');
                    },
                    contentAfter: unformat(`
                        <div>
                            <div contenteditable="false">
                                <div contenteditable="true"><p><br></p></div>
                            </div>
                            <p>[]<br></p>
                        </div>`),
                });
            });
            it('should enforce moving the carret when changing browsing context (because of a contenteditable=false parent) in case a navigationNode is not needed', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <div>
                            <div contenteditable="false">
                                <div contenteditable="true"><p>[]<br></p></div>
                            </div>
                            <p>text</p>
                        </div>`),
                    stepFunction: async editor => {
                        await keydown(editor.editable, 'ArrowDown');
                    },
                    contentAfter: unformat(`
                        <div>
                            <div contenteditable="false">
                                <div contenteditable="true"><p><br></p></div>
                            </div>
                            <p>[]text</p>
                        </div>`),
                });
            });
        });
    });
});
