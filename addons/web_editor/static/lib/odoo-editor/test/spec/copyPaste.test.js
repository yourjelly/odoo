import {
    BasicEditor,
    insertText,
    insertParagraphBreak,
    insertLineBreak,
    testEditor,
    createLink, deleteBackward
} from "../utils.js";

navigator.permissions.query({ name: "clipboard-write" }).then((result) => {
    if (result.state === "granted" || result.state === "prompt") {
        console.log("clipboard Write ok");
    } else {
        console.warn("clipboard Write Access bloqued !");
    }
});

const pasteData = async function (editor, text, type = 'text/plain') {
    await navigator.clipboard.writeText(text);

    var fakeEvent = {
        dataType: 'text/plain',
        data: text,
        clipboardData : {
            getData: (datatype) => type === datatype ? text : null,
        },
        preventDefault: () => {},
    };
    await editor._onPaste(fakeEvent);
};


describe('copy and paste', () => {
    describe('simple text', () => {
        describe('range collapsed', async () => {

            await testEditor(BasicEditor, {
                contentBefore: '<p>ab[]cd</p>',
                stepFunction: async editor => {
                    pasteData(editor, 'x')
                },
                contentAfter: '<p>abx[]cd</p>',
            });
        });
        describe('range not collapsed', async  () => {

        });
    });
    describe('html', () => {
        describe('range collapsed', async  () => {

        });
        describe('range not collapsed', async  () => {

        });
    });
    describe('link', () => {
        describe('range collapsed', async  () => {

        });
        describe('range not collapsed', async  () => {

        });
    });
    describe('images', () => {
        describe('range collapsed', async  () => {

        });
        describe('range not collapsed', async  () => {

        });
    });
    describe('youtube video', () => {
        describe('range collapsed', async  () => {

        });
        describe('range not collapsed', async  () => {

        });
    });
});
