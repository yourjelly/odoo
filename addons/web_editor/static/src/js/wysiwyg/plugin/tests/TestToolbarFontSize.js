(function () {
'use strict';

var TestToolbarFontSize = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test', 'TestToolbar', 'Text'];
    }

    constructor () {
        super(...arguments);
        this.dependencies = ['Test', 'TestToolbar'];

    // range collapsed: ◆
    // range start: ▶
    // range end: ◀

    this.toolbarTests = [{
            name: "Click 18: default -> 18px",
            content: '<p>dom not to edit</p><p>d▶om t◀o edit</p>',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeToggler, ['mousedown', 'click']);
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeDropdown.querySelector('we3-button[name="size-18"]')[0], ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p>d<font style="font-size: 18px;">▶om t◀</font>o edit</p>',
            },
        },
        {
            name: "Click DEFAULT: 18px -> default",
            content: '<p>dom not to edit</p><p><font style="font-size: 18px;">d▶om t◀o edit</font></p>',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeToggler, ['mousedown', 'click']);
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeDropdown.querySelector('we3-button[name="size-default"]')[0], ['mousedown', 'click']);
            },
            test: {
                content: '<p>dom not to edit</p><p><font style="font-size: 18px;">d</font>▶om t◀<font style="font-size: 18px;">o edit</font></p>',
            },
        },
        {
            name: "Click 18: 26px -> 18px",
            content: '<p><font style="font-size: 26px;">d▶om t◀o edit</font></p>',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeToggler, ['mousedown', 'click']);
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeDropdown.querySelector('we3-button[name="size-18"]')[0], ['mousedown', 'click']);
            },
            test: {
                content: '<p>' +
                    '<font style="font-size: 26px;">d</font>' +
                    '<font style="font-size: 18px;">▶om t◀</font>' +
                    '<font style="font-size: 26px;">o edit</font></p>',
            },
        },
        {
            name: "Click 18 then 'a' (no selection): default -> 18px",
            content: '<p>dom not to edit</p><p>d◆om to edit</p>',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeToggler, ['mousedown', 'click']);
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeDropdown.querySelector('we3-button[name="size-18"]')[0], ['mousedown', 'click']);
                this.keydown('a', $editable, {
                    firstDeselect: true,
                });
            },
            test: {
                content: '<p>dom not to edit</p><p>d<font style="font-size: 18px;">a◆</font>om to edit</p>',
            },
        },
        {
            name: "Click 18 then 'a' (no selection): 26px -> 18px",
            content: '<p><font style="font-size: 26px;">d◆om to edit</font></p>',
            do: async function () {
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeToggler, ['mousedown', 'click']);
                await this.dependencies.Test.triggerNativeEvents(this.fontSizeDropdown.querySelector('we3-button[name="size-18"]')[0], ['mousedown', 'click']);
                this.keydown('a', $editable, {
                    firstDeselect: true,
                });
            },
            test: {
                content: '<p>' +
                    '<font style="font-size: 26px;">d</font>' +
                    '<font style="font-size: 18px;">a◆</font>' +
                    '<font style="font-size: 26px;">om to edit</font></p>',
            },
        },
    ];
    }

    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }

    test (assert) {
        var wysiwyg = document.getElementsByTagName('we3-editor')[0];
        this.fontSizeDropdown = wysiwyg.querySelector('we3-dropdown[name="Font Size"]');
        this.fontSizeToggler = this.fontSizeDropdown.querySelector('we3-toggler');
        return this.dependencies.TestToolbar.test(assert, this.toolbarTests);
    }
};

we3.addPlugin('TestToolbarFontSize', TestToolbarFontSize);

})();
