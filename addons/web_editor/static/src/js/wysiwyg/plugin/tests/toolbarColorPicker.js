(function () {
'use strict';

var TestToolbarColorPicker = class extends we3.AbstractPlugin {
    static get autoInstall() {
        return ['Test', 'TestToolbar', 'Paragraph', 'TestToolbarColor'];
    }
    constructor() {
        super(...arguments);
        var self = this;
        this.dependencies = ['Test', 'TestToolbar'];

        // range collapsed: ◆
        // range start: ▶
        // range end: ◀

        this.foreColorTests = [
            {
                name: "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875A7B",
                content: '<p>dom not to edit</p><p>d▶o<font style="color: rgb(0, 0, 255);">m t◀o </font>edit</p>',
                do: async function () {
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorToggler, ['mousedown', 'click']);
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorDropdown.querySelector('we3-button[data-method="custom"]'), ['mousedown', 'click']);

                    $('.modal-dialog .o_hex_input').val('#875A7B').change();
                    await self.dependencies.Test.triggerNativeEvents($('.o_technical_modal .modal-footer .btn-primary')[0], ['mousedown', 'click']);
                },
                test: '<p>dom not to edit</p><p>d<font style="color:#875a7b">▶om t◀</font><font style="color:rgb(0, 0, 255)">o </font>edit</p>',
            },
            {
                name: "Click CUSTOM COLORS then CUSTOM COLOR: change blue input",
                content: '<p>d▶om to◀ edit</p>',
                do: async function (assert, testName) {
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorToggler, ['mousedown', 'click']);
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorDropdown.querySelector('we3-button[data-method="custom"]'), ['mousedown', 'click']);

                    $('.modal-dialog .o_blue_input').val('100').change();
                    assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#ff0064', testName + ' (hex)');
                    assert.deepEqual($('.modal-dialog .o_hue_input').val(), '337', testName + ' (hue)');
                    await self.dependencies.Test.triggerNativeEvents($('.o_technical_modal .modal-footer .btn-primary')[0], ['mousedown', 'click']);
                },
                test: '<p>d<font style="color:#ff0064">▶om to◀</font> edit</p>',
            },
            {
                name: "CUSTOM COLOR: change hue, saturation and lightness inputs",
                content: '<p>d▶om to◀ edit</p>',
                do: async function (assert, testName) {
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorToggler, ['mousedown', 'click']);
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorDropdown.querySelector('we3-button[data-method="custom"]'), ['mousedown', 'click']);

                    $('.modal-dialog .o_hue_input').val('337').change();
                    $('.modal-dialog .o_saturation_input').val('50').change();
                    $('.modal-dialog .o_lightness_input').val('40').change();
                    assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#99335a', testName + ' (hex)');
                    assert.deepEqual($('.modal-dialog .o_green_input').val(), '51', testName + ' (green)');
                    await self.dependencies.Test.triggerNativeEvents($('.o_technical_modal .modal-footer .btn-primary')[0], ['mousedown', 'click']);
                },
                test: '<p>d<font style="color:#99335a">▶om to◀</font> edit</p>',
            },
            {
                name: "CUSTOM COLOR: mousedown on area",
                content: '<p>d▶om to◀ edit</p>',
                do: async function (assert, testName) {
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorToggler, ['mousedown', 'click']);
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorDropdown.querySelector('we3-button[data-method="custom"]'), ['mousedown', 'click']);

                    var $area = $('.modal-dialog .o_color_pick_area');
                    var pos = $area.offset();
                    $area.trigger($.Event("mousedown", {
                        which: 1,
                        pageX: pos.left + 50,
                        pageY: pos.top + 50
                    }));
                    $area.trigger('mouseup');

                    assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#cfafaf', testName + ' (hex)');
                    assert.deepEqual($('.modal-dialog .o_red_input').val(), '207', testName + ' (red)');
                    assert.deepEqual($('.modal-dialog .o_green_input').val(), '175', testName + ' (green)');
                    assert.deepEqual($('.modal-dialog .o_blue_input').val(), '175', testName + ' (blue)');
                    assert.deepEqual($('.modal-dialog .o_hue_input').val(), '0', testName + ' (hue)');
                    assert.deepEqual($('.modal-dialog .o_saturation_input').val(), '25', testName + ' (saturation)');
                    assert.deepEqual($('.modal-dialog .o_lightness_input').val(), '75', testName + ' (lightness)');

                    await self.dependencies.Test.triggerNativeEvents($('.o_technical_modal .modal-footer .btn-primary')[0], ['mousedown', 'click']);
                },
                test: '<p>d<font style="color:#cfafaf">▶om to◀</font> edit</p>',
            },
            {
                name: "CUSTOM COLOR: mousedow on sliders",
                content: '<p>d▶om to◀ edit</p>',
                do: async function (assert, testName) {
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorToggler, ['mousedown', 'click']);
                    await self.dependencies.Test.triggerNativeEvents(self.foreColorDropdown.querySelector('we3-button[data-method="custom"]'), ['mousedown', 'click']);

                    var $slider1 = $('.modal-dialog .o_slider_pointer');
                    var pos1 = $slider1.offset();
                    $slider1.trigger($.Event("mousedown", {
                        which: 1,
                        pageX: pos1.left,
                        pageY: pos1.top + 50
                    }));
                    $slider1.trigger('mouseup');

                    assert.deepEqual($('.modal-dialog .o_hex_input').val(), '#83ff00', testName + ' (hex)');

                    var $slider2 = $('.modal-dialog .o_opacity_slider');
                    var pos2 = $slider2.offset();
                    $slider2.trigger($.Event("mousedown", {
                        which: 1,
                        pageX: pos2.left,
                        pageY: pos2.top + 80
                    }));
                    $slider2.trigger('mouseup');

                    assert.deepEqual($('.modal-dialog .o_hue_input').val(), '89', testName + ' (hue)');
                    assert.deepEqual($('.modal-dialog .o_opacity_input').val(), '60', testName + ' (opacity)');

                    await self.dependencies.Test.triggerNativeEvents($('.o_technical_modal .modal-footer .btn-primary')[0], ['mousedown', 'click']);
                },
                test: '<p>d<font style="color:rgba(131, 255, 0, 0.6)">▶om to◀</font> edit</p>',
            },
        ];
        this.bgColorTests = [
            {
                name: "Click CUSTOM COLORS then CUSTOM COLOR: blue #0000FF & default -> #875a7b",
                content: '<p>dom not to edit</p><p>d▶o<font style="background-color: rgb(0, 0, 255);">m t◀o </font>edit</p>',
                do: async function (assert, testName) {
                    await self.dependencies.Test.triggerNativeEvents(self.bgColorToggler, ['mousedown', 'click']);
                    await self.dependencies.Test.triggerNativeEvents(self.bgColorDropdown.querySelector('we3-button[data-method="custom"]'), ['mousedown', 'click']);
                    $('.modal-dialog .o_hex_input').val('#875a7b').change();
                    await self.dependencies.Test.triggerNativeEvents($('.o_technical_modal .modal-footer .btn-primary')[0], ['mousedown', 'click']);
                },
                test: '<p>dom not to edit</p><p>d<font style="background-color:#875a7b">▶om t◀</font><font style="background-color:rgb(0, 0, 255)">o </font>edit</p>',
            },
        ];

        this.toolbarTests = this.foreColorTests
            .concat(this.bgColorTests);
    }

    start() {
        this.dependencies.Test.add(this);
        return super.start();
    }

    test(assert) {
        var wysiwyg = document.getElementsByTagName('we3-editor')[0];
        this.foreColorDropdown = wysiwyg.querySelector('we3-dropdown[name="Color"]');
        this.foreColorToggler = this.foreColorDropdown.querySelector('we3-toggler');
        this.bgColorDropdown = wysiwyg.querySelector('we3-dropdown[name="Background color"]');
        this.bgColorToggler = this.bgColorDropdown.querySelector('we3-toggler');
        return this.dependencies.TestToolbar.test(assert, this.toolbarTests);
    }
};

we3.addPlugin('TestToolbarColorPicker', TestToolbarColorPicker);

})();
