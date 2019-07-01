(function () {
'use strict';

var TestToolbarBackgroundColor = class extends we3.AbstractPlugin {
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
                /* name: "Click THEME COLORS - ALPHA: default -> alpha theme color",
                content: '<p>dom not to edit</p><p>dom to edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'p:eq(1):contents()[0]->5',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.bgColorToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents(this.bgColorDropdown.querySelector('we3-button[name="color-bg-alpha"]'), ['mousedown', 'click']);
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font class="bg-alpha">om t</font>o edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            {
                name: "Click THEME COLORS - BLACK 25: alpha theme color & default -> black 25",
                content: '<p>dom not to edit</p><p>do<font class="bg-alpha">m to </font>edit</p>',
                start: 'p:eq(1):contents()[0]->1',
                end: 'font:contents()[0]->3',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.bgColorToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents($btnsBgColor.filter('.bg-black-25')[0], ['mousedown', 'click']);
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font class="bg-black-25">om t</font><font class="bg-alpha">o </font>edit</p>',
                    start: 'font:contents()[0]->0',
                    end: 'font:contents()[0]->4',
                },
            },
            { */
                name: "Click COMMON COLORS - BLUE #0000FF: black 25 & default -> blue #0000FF",
                content: '<p>dom not to edit</p><p>d▶o<font class="bg-black-25">m t◀o </font>edit</p>',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.bgColorToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents(this.bgColorDropdown.querySelector('we3-button[name="color-#0000FF"]'), ['mousedown', 'click']);
                },
                test: {
                    content: '<p>dom not to edit</p><p>d<font style="background-color: rgb(0, 0, 255);">▶om t◀</font><font class="bg-black-25">o </font>edit</p>',
                },
            },
                {
                name: "Click RESET TO DEFAULT: black 25 & default -> default",
                content: '<p>dom not to edit</p><p>d▶o<font class="bg-black-25">m t◀o </font>edit</p>',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.bgColorToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents(this.bgColorDropdown.querySelector('we3-button[name="color-reset"]'), ['mousedown', 'click']);
                },
                test: {
                    content: '<p>dom not to edit</p><p>d▶om t◀<font class="bg-black-25">o </font>edit</p>',
                },
            },
            // {
            //     name: "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875A7B",
            //     content: '<p>dom not to edit</p><p>do<font style="background-color: rgb(0, 0, 255);">m to </font>edit</p>',
            //     start: 'p:eq(1):contents()[0]->1',
            //     end: 'font:contents()[0]->3',
            //     async: true,
            //     do: async function () {
            //         testName = "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875A7B";

            //         await this.dependencies.Test.triggerNativeEvents(this.bgColorToggler, ['mousedown', 'click']);
            //         await this.dependencies.Test.triggerNativeEvents(this.bgColorDropdown.querySelector('we3-button:contains("Custom color")'), ['mousedown', 'click']);
            //         await testUtils.fields.editAndTrigger($('.modal-dialog .o_hex_input'), '#875A7B', 'change');
            //         await this.dependencies.Test.triggerNativeEvents($('.o_technical_modal .modal-footer .btn-primary:contains("Choose")')[0], ['mousedown', 'click']);
            //         await this.dependencies.Test.triggerNativeEvents(this.bgColorDropdown.find('[name="Custom colors"] button:last')[0], ['mousedown', 'click']);

            //         assert.deepEqual(wysiwyg.getValue(),
            //             '<p>dom not to edit</p><p>d<font style="background-color: rgb(135, 90, 123);">om t</font><font style="background-color: rgb(0, 0, 255);">o </font>edit</p>',
            //             testName);
            //         var range = this.dependencies.Test.select('font:contents()[0]->0',
            //             'font:contents()[0]->4',
            //             $editable);
            //         assert.deepEqual(Wysiwyg.getRange($editable[0]).getPoints(), range, testName + carretTestSuffix);
            //     },
            // },
        ];
    }

    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }

    test (assert) {
        var wysiwyg = document.getElementsByTagName('we3-editor')[0];
        this.bgColorDropdown = wysiwyg.querySelector('we3-dropdown[name="Background color"]');
        this.bgColorToggler = this.bgColorDropdown.querySelector('we3-toggler');
        return this.dependencies.TestToolbar.test(assert, this.toolbarTests);
    }
};

we3.addPlugin('TestToolbarBackgroundColor', TestToolbarBackgroundColor);

})();
