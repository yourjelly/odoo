import { OdooEditor } from '../../src/OdooEditor.js';
import {
    BasicEditor,
    deleteBackward,
    deleteForward,
    insertText,
    keydown,
    redo,
    testEditor,
    undo,
    triggerEvent,
} from '../utils.js';

describe('Tabs', () => {
    describe('insert Tabulation', () => {
        it('should insert a tab character', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>a[]b</p>',
                stepFunction: async editor => {
                    await keydown(editor.editable, 'Tab');
                },
                contentAfterEdit: '<p>a<span style="display:inline-block; white-space:pre-wrap" contenteditable="false">\u0009</span>[]b</p>',
                contentAfter: '<p>a<span style="display:inline-block; white-space:pre-wrap">\u0009</span>[]b</p>',
            });
        });
        it('should clear selection and insert a tab character', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>a[xxx]b</p>',
                stepFunction: async editor => {
                    await keydown(editor.editable, 'Tab');
                },
                contentAfterEdit: '<p>a<span style="display:inline-block; white-space:pre-wrap" contenteditable="false">\u0009</span>[]b</p>',
                contentAfter: '<p>a<span style="display:inline-block; white-space:pre-wrap">\u0009</span>[]b</p>',
            });
        });
        it('should insert two tab character', async () => {
            await testEditor(BasicEditor, {
                contentBefore: '<p>a[]b</p>',
                stepFunction: async editor => {
                    await keydown(editor.editable, 'Tab');
                    await keydown(editor.editable, 'Tab');
                },
                contentAfterEdit: '<p>a<span style="display:inline-block; white-space:pre-wrap" contenteditable="false">\u0009</span><span style="display:inline-block; white-space:pre-wrap" contenteditable="false">\u0009</span>[]b</p>',
                contentAfter: '<p>a<span style="display:inline-block; white-space:pre-wrap">\u0009</span><span style="display:inline-block; white-space:pre-wrap">\u0009</span>[]b</p>',
            });
        });
    });
});
