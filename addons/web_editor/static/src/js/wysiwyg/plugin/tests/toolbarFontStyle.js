(function () {
'use strict';

var TestToolbarFontStyle = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test', 'TestToolbar', 'FontStyle'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Test', 'TestToolbar'];
    }

    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }

    // range collapsed: ◆
    // range start: ▶
    // range end: ◀

    boldTests = [
        {
            name: "Click BOLD: normal -> bold",
            content: '<p>dom not to edit</p><p>d▶om t◀o edit</p>',
            start: 'p:eq(1):contents()[0]->1',
            end: 'p:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p>d<b>▶om t◀</b>o edit</p>',
                start: 'b:contents()[0]->0',
                end: 'b:contents()[0]->4',
            },
        },
        {
            name: "Click BOLD then 'a': normal -> bold (empty p)",
            content: '<p><br>◆</p>',
            start: 'p->1',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
                this.dependencies.Test.keydown('a', editable);
            },
            test: {
                content: '<p><b>a◆</b></p>',
                start: 'b:contents()[0]->1',
            },
        },
        {
            name: "Click BOLD: normal -> bold (across paragraphs)",
            content: '<p>d▶om to edit</p><p>dom t◀o edit</p>',
            start: 'p:contents()[0]->1',
            end: 'p:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p>d<b>▶om to edit</b></p><p><b>dom t◀</b>o edit</p>',
                start: 'b:contents()[0]->0',
                end: 'b:eq(1):contents()[0]->5',
            },
        },
        {
            name: "Click BOLD then 'a': normal -> bold (no selection)",
            content: '<p>dom not to edit</p><p>dom ◆to edit</p>',
            start: 'p:eq(1):contents()[0]->4',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
                this.dependencies.Test.keydown('a', editable);
            },
            test: {
                content: '<p>dom not to edit</p><p>dom <b>a◆</b>to edit</p>',
                start: 'b:contents()[0]->1',
            },
        },
        {
            name: "Click BOLD: bold -> normal",
            content: '<p>dom not to edit</p><p><b>▶dom to edit◀</b></p>',
            start: 'b:contents()[0]->0',
            end: 'b:contents()[0]->11',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p>▶dom to edit◀</p>',
                start: 'p:eq(1):contents()[0]->0',
                end: 'p:eq(1):contents()[0]->11',
            },
        },
        {
            name: "Click BOLD: bold -> normal (partial selection)",
            content: '<p>dom not to edit</p><p><b>dom ▶to◀ edit</b></p>',
            start: 'b:contents()[0]->4',
            end: 'b:contents()[0]->6',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>dom </b>▶to◀<b>&nbsp;edit</b></p>',
                start: 'p:eq(1):contents()[1]->0',
                end: 'p:eq(1):contents()[1]->2',
            },
        },
        {
            name: "Click BOLD: bold -> normal (no selection)",
            content: '<p>dom not to edit</p><p><b>dom ◆to edit</b></p>',
            start: 'b:contents()[0]->4',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>dom </b>\uFEFF◆<b>to edit</b></p>',
                start: 'p:eq(1):contents()[1]->1',
            },
        },
        {
            name: "Click BOLD: bold + normal -> normal",
            content: '<p><b>d▶om </b>to e◀dit</p>',
            start: 'b:contents()[0]->1',
            end: 'p:contents()[1]->4',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p><b>d▶om to e◀</b>dit</p>',
                start: 'b:contents()[0]->1',
                end: 'b:contents()[0]->8',
            },
        },
        {
            name: "Click BOLD: normal -> bold (with fontawesome)",
            content: '<p>a▶aa<span class="fa fa-heart"></span>bb◀b</p>',
            start: 'p:contents()[0]->1',
            end: 'p:contents()[2]->2',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p>a<b>▶aa<span class="fa fa-heart"></span>bb◀</b>b</p>',
                start: 'b:contents()[0]->0',
                end: 'b:contents()[2]->2',
            },
        },
        {
            name: "Click BOLD: bold -> normal (with fontawesome)",
            content: '<p><b>a▶aa<span class="fa fa-heart"></span>bb◀b</b></p>',
            start: 'b:contents()[0]->1',
            end: 'b:contents()[2]->2',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p><b>a</b>▶aa<span class="fa fa-heart"></span>bb◀<b>b</b></p>',
                start: 'p:contents()[1]->0',
                end: 'p:contents()[3]->2',
            },
        },
    ];
    italicTests = [
        {
            name: "Click ITALIC: bold -> bold + italic",
            content: '<p>dom not to edit</p><p><b>d▶om t◀o edit</b></p>',
            start: 'b:contents()[0]->1',
            end: 'b:contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnItalic, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>d<i>▶om t◀</i>o edit</b></p>',
                start: 'i:contents()[0]->0',
                end: 'i:contents()[0]->4',
            },
        },
        {
            name: "Click ITALIC: bold & normal -> italic & bold + italic (across paragraphs)",
            content: '<p>d▶om <b>to</b> edit</p><p><b>dom t◀o edit</b></p>',
            start: 'p:contents()[0]->1',
            end: 'b:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnItalic, ['mousedown', 'click']);
            },
            test: {
                content: '<p>d<i>▶om </i><b><i>to</i></b><i> edit</i></p><p><b><i>dom t◀</i>o edit</b></p>',
                start: 'i:contents()[0]->0',
                end: 'i:eq(3):contents()[0]->5',
            },
        },
    ];
    strikeThroughTests = [
        {
            name: "Click strikethrough: bold -> bold + strikethrough",
            content: '<p>dom not to edit</p><p><b>d▶om t◀o edit</b></p>',
            start: 'b:contents()[0]->1',
            end: 'b:contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.strikethrough, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>d<s>▶om t◀</s>o edit</b></p>',
                start: 's:contents()[0]->0',
                end: 's:contents()[0]->4',
            },
        },
        {
            name: "Click strikethrough: bold & normal -> strikethrough & bold + strikethrough (across paragraphs)",
            content: '<p>d▶om <b>to</b> edit</p><p><b>dom t◀o edit</b></p>',
            start: 'p:contents()[0]->1',
            end: 'b:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.strikethrough, ['mousedown', 'click']);
            },
            test: {
                content: '<p>d<s>▶om <b>to</b> edit</s></p><p><b><s>dom t◀</s>o edit</b></p>',
                start: 's:contents()[0]->0',
                end: 's:eq(1):contents()[0]->5',
            },
        },
    ];
    subscriptTests = [
        {
            name: "Click subscript: bold -> bold + subscript",
            content: '<p>dom not to edit</p><p><b>d▶om t◀o edit</b></p>',
            start: 'b:contents()[0]->1',
            end: 'b:contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.subscript, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>d<sub>▶om t◀</sub>o edit</b></p>',
                start: 'sub:contents()[0]->0',
                end: 'sub:contents()[0]->4',
            },
        },
        {
            name: "Click subscript: bold & normal -> subscript & bold + subscript (across paragraphs)",
            content: '<p>d▶om <b>to</b> edit</p><p><b>dom t◀o edit</b></p>',
            start: 'p:contents()[0]->1',
            end: 'b:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.subscript, ['mousedown', 'click']);
            },
            test: {
                content: '<p>d<sub>▶om <b>to</b> edit</sub></p><p><b><sub>dom t◀</sub>o edit</b></p>',
                start: 'sub:contents()[0]->0',
                end: 'sub:eq(1):contents()[0]->5',
            },
        },
    ];
    superscriptTests = [
        {
            name: "Click superscript: bold -> bold + superscript",
            content: '<p>dom not to edit</p><p><b>d▶om t◀o edit</b></p>',
            start: 'b:contents()[0]->1',
            end: 'b:contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.superscript, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>d<sup>▶om t◀</sup>o edit</b></p>',
                start: 'sup:contents()[0]->0',
                end: 'sup:contents()[0]->4',
            },
        },
        {
            name: "Click superscript: bold & normal -> superscript & bold + superscript (across paragraphs)",
            content: '<p>d▶om <b>to</b> edit</p><p><b>dom t◀o edit</b></p>',
            start: 'p:contents()[0]->1',
            end: 'b:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.superscript, ['mousedown', 'click']);
            },
            test: {
                content: '<p>d<sup>▶om <b>to</b> edit</sup></p><p><b><sup>dom t◀</sup>o edit</b></p>',
                start: 'sup:contents()[0]->0',
                end: 'sup:eq(1):contents()[0]->5',
            },
        },
    ];
    underlineTests = [
        {
            name: "Click UNDERLINE: bold -> bold + underlined",
            content: '<p>dom not to edit</p><p><b>d▶om t◀o edit</b></p>',
            start: 'b:contents()[0]->1',
            end: 'b:contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnUnderline, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>d<u>▶om t◀</u>o edit</b></p>',
                start: 'u:contents()[0]->0',
                end: 'u:contents()[0]->4',
            },
        },
        {
            name: "Click UNDERLINE: bold & normal -> underlined & bold + underlined (across paragraphs)",
            content: '<p>d▶om <b>to</b> edit</p><p><b>dom t◀o edit</b></p>',
            start: 'p:contents()[0]->1',
            end: 'b:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnUnderline, ['mousedown', 'click']);
            },
            test: {
                content: '<p>d<u>▶om </u><b><u>to</u></b><u> edit</u></p><p><b><u>dom t◀</u>o edit</b></p>',
                start: 'u:contents()[0]->0',
                end: 'u:eq(3):contents()[0]->5',
            },
        },
    ];

    removeFontStyleTests = [
        {
            name: "Click REMOVE FONT STYLE: bold -> normal",
            content: '<p>dom not to edit</p><p><b>d▶om t◀o edit</b></p>',
            start: 'b:contents()[0]->1',
            end: 'b:contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnRemoveStyles, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><b>d</b>▶om t◀<b>o edit</b></p>',
                start: 'p:eq(1):contents()[1]->0',
                end: 'p:eq(1):contents()[1]->4',
            },
        },
        {
            name: "Click REMOVE FONT STYLE: bold, italic, underlined & normal -> normal (across paragraphs)",
            content: '<p>d▶om <b>t<i>o</i></b> e<u>dit</u></p><p><b><u>dom◀</u> to edit</b></p>',
            start: 'p:contents()[0]->1',
            end: 'u:eq(1):contents()[0]->3',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnRemoveStyles, ['mousedown', 'click']);
            },
            test: {
                content: '<p>d▶om to edit</p><p>dom◀<b>&nbsp;to edit</b></p>',
                start: 'p:contents()[0]->1',
                end: 'p:eq(1):contents()[0]->3',
            },
        },
        {
            name: "Click REMOVE FONT STYLE: complex -> normal",
            content: '<p>a▶aa<font style="background-color: rgb(255, 255, 0);">bbb</font></p><p><font style="color: rgb(255, 0, 0);">c◀cc</font></p>',
            start: 'p:contents()[0]->1',
            end: 'font:eq(1):contents()[0]->1',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnRemoveStyles, ['mousedown', 'click']);
            },
            test: {
                content: '<p>a▶aabbb</p><p>c◀<font style="color: rgb(255, 0, 0);">cc</font></p>',
                start: 'p:contents()[0]->1',
                end: 'p:eq(1):contents()[0]->1',
            },
        },
        {
            name: "Click REMOVE FONT STYLE: complex -> normal (with icon)",
            content: '<p>▶a<b>a</b>a<span class="bg-alpha text-alpha fa fa-heart" style="font-size: 10px;"></span>b<b><i>b◀</i>b</b></p>',
            start: 'p:contents()[0]->0',
            end: 'i:contents()[0]->1',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnRemoveStyles, ['mousedown', 'click']);
            },
            test: {
                content: '<p>▶aaa<span class="fa fa-heart"></span>bb◀<b>b</b></p>',
                start: 'p:contents()[0]->0',
                end: 'p:contents()[2]->2',
            },
        },
    ];
    complexFontStyleTests = [
        {
            name: "COMPLEX Click BOLD: italic -> italic bold (partial selection)",
            content: '<p>dom not to edit</p><p><i>d▶om t◀o edit</i></p>',
            start: 'i:contents()[0]->1',
            end: 'i:contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><i>d<b>▶om t◀</b>o edit</i></p>',
                start: 'b:contents()[0]->0',
                end: 'b:contents()[0]->4',
            },
        },
        {
            name: "COMPLEX Click BOLD then 'a': italic bold -> italic (across paragraphs)",
            content: '<p><b><i>d▶om to edit</i></b></p><p><i><b>dom t◀o edit</b></i></p>',
            start: 'i:contents()[0]->1',
            end: 'b:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
                this.dependencies.Test.keydown('a', editable, {
                    firstDeselect: true,
                });
            },
            test: {
                content: '<p><b><i>d</i></b><i>om to edit</i></p><p><i>dom ta◆<b>o edit</b></i></p>',
            },
        },
        {
            name: "COMPLEX Click BOLD then 'a': bold italic -> italic (no selection)",
            content: '<p><b><i>dom ◆to edit</i></b></p>',
            start: 'i:contents()[0]->4',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
                this.dependencies.Test.keydown('a', editable, {
                    firstDeselect: true,
                });
            },
            test: {
                content: '<p><b><i>dom </i></b><i>a◆</i><b><i>to edit</i></b></p>',
            },
        },
        {
            name: "COMPLEX Click BOLD then 'a': underlined italic -> underlined italic bold (across paragraphs)",
            content: '<p><u><i>d▶om to edit</i></u></p><p><i><u>dom t◀o edit</u></i></p>',
            start: 'i:contents()[0]->1',
            end: 'u:eq(1):contents()[0]->5',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
                this.dependencies.Test.keydown('a', editable, {
                    firstDeselect: true,
                });
            },
            test: {
                content: '<p><u><i>d<b>om to edit</b></i></u></p><p><i><u><b>dom ta◆</b>o edit</u></i></p>',
            },
        },
        {
            name: "COMPLEX Click BOLD then 'a': underlined italic -> underlined italic bold (no selection)",
            content: '<p><u><i>d◆om to edit</i></u></p>',
            start: 'i:contents()[0]->1',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.btnBold, ['mousedown', 'click']);
                this.dependencies.Test.keydown('a', editable, {
                    firstDeselect: true,
                });
            },
            test: {
                content: '<p><u><i>d<b>a◆</b>om to edit</i></u></p>',
            },
        },
    ];

    toolbarTests () {
        return this.boldTests
            .concat(this.italicTests)
            .concat(this.underlineTests)
            /* .concat(this.strikeThroughTests)
            .concat(this.superscriptTests)
            .concat(this.subscriptTests) */
            .concat(this.removeFontStyleTests)
            .concat(this.complexFontStyleTests);
    }

    test (assert) {
        var wysiwyg = document.getElementsByTagName('we3-editor')[0];
        var fontStyleGroup = wysiwyg.querySelector('we3-group[data-plugin="FontStyle"]');
        this.btnBold = fontStyleGroup.querySelector('we3-button[name="formatText-b"]');
        this.btnItalic = fontStyleGroup.querySelector('we3-button[name="formatText-i"]');
        this.btnUnderline = fontStyleGroup.querySelector('[name="formatText-u"]');
        this.strikethrough = fontStyleGroup.querySelector('[name="formatText-s]');
        this.superscript = fontStyleGroup.querySelector('[name="formatText-sup"]');
        this.subscript = fontStyleGroup.querySelector('[name="formatText-sub"]');
        this.btnRemoveStyles = fontStyleGroup.querySelector('[name="formatText-remove');
        return this.dependencies.TestToolbar.test(assert, this.toolbarTests());
    }
};

we3.addPlugin('TestToolbarFontStyle', TestToolbarFontStyle);

})();
