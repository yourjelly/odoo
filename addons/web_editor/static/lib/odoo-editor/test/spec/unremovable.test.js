import {
    BasicEditor,
    deleteBackward,
    testEditor,
    unformat,
} from '../utils.js';

describe('Unremovables', () => {
    describe('deleterange', () => {
        it('should remove element which is contenteditable=true even if their parent is contenteditable=false', async () => {
            await testEditor(BasicEditor, {
                contentBefore: unformat(`
                    <p>before[o</p>
                    <div contenteditable="false">
                        <div contenteditable="true"><p>intruder</p></div>
                    </div>
                    <p>o]after</p>`),
                stepFunction: async editor => {
                    await deleteBackward(editor);
                },
                contentAfter: unformat(`
                    <p>before[]after</p>`),
            });
        });
        describe('historyUndo', () => {
            it('should be unchanged after a deleterange and a historyUndo', async () => {
                await testEditor(BasicEditor, {
                    contentBefore: unformat(`
                        <p>[before</p>
                        <div class="oe_unremovable">
                            <div class="oe_unremovable" contenteditable="false"><p>noneditable</p></div>
                            <div class="oe_unremovable"><p>editable</p></div>
                        </div>
                        <p>after]</p>`),
                    stepFunction: async editor => {
                        await deleteBackward(editor);
                        editor.historyUndo();
                    },
                    contentAfter: unformat(`
                        <p>[before</p>
                        <div class="oe_unremovable">
                            <div class="oe_unremovable" contenteditable="false"><p>noneditable</p></div>
                            <div class="oe_unremovable"><p>editable</p></div>
                        </div>
                        <p>after]</p>`),
                });
            });
        });
    });
});
