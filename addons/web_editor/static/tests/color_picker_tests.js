odoo.define('web_editor.color_picker_tests', function (require) {
"use strict";

var ajax = require('web.ajax');
var FormView = require('web.FormView');
var testUtils = require('web.test_utils');
var weTestUtils = require('web_editor.test_utils');
var Wysiwyg = require('web_editor.wysiwyg');

QUnit.module('web_editor', {
    beforeEach: function () {
        this.data = weTestUtils.wysiwygData({
            'note.note': {
                fields: {
                    display_name: {
                        string: "Displayed name",
                        type: "char"
                    },
                    body: {
                        string: "Message",
                        type: "html"
                    },
                },
                records: [{
                    id: 1,
                    display_name: "first record",
                    body: "<p>toto toto toto</p><p>tata</p>",
                }],
            },
        });

        testUtils.mock.patch(ajax, {
            loadAsset: function (xmlId) {
                if (xmlId === 'template.assets') {
                    return Promise.resolve({
                        cssLibs: [],
                        cssContents: ['body {background-color: red;}']
                    });
                }
                if (xmlId === 'template.assets_all_style') {
                    return Promise.resolve({
                        cssLibs: $('link[href]:not([type="image/x-icon"])').map(function () {
                            return $(this).attr('href');
                        }).get(),
                        cssContents: ['body {background-color: red;}']
                    });
                }
                throw 'Wrong template';
            },
        });

        var self = this;
        testUtils.mock.patch(Wysiwyg, {
            init: function () {
                this._super(...arguments);

                this.options = Object.assign({}, this.options, {
                    plugins: Object.assign({}, this.options.plugins, self.testOptions.plugins, {
                        Test: true,
                    }),
                    test: Object.assign({
                        callback: self.testOptions.resolve,
                        auto: true,
                        assert: self.testOptions.assert,
                    }, this.options.test),
                });
            }
        });
    },
    afterEach: function () {
        testUtils.mock.unpatch(Wysiwyg);
        testUtils.mock.unpatch(ajax);
    },
}, function () {

    var testPlugins = {
        TestArchAndRules: false,
        TestComplex: false,
        TestHistory: false,
        TestKeyboardArrow: false,
        TestKeyboardBackspace: false,
        TestKeyboardChar: false,
        TestKeyboardComplex: false,
        TestKeyboardDelete: false,
        TestKeyboardEnter: false,
        TestKeyboardTab: false,
        TestKeyboardUnbreakable: false,
        TestPopover: false,
        TestRange: false,
        TestRenderer: false,
        TestToolbarColor: false,
        TestToolbarFontStyle: false,
        TestToolbarIndent: false,
        TestToolbarKeymap: false,
        TestToolbarLink: false,
        TestToolbarList: false,
        TestToolbarMedia: false,
        TestToolbarParagraph: false,
        TestToolbarWand: false,
        TestUI: false,
    };

    async function createFormAndTest(self) {
        var promise = new Promise((resolve) => self.testOptions.resolve = resolve);

        var form = await testUtils.createView({
            View: FormView,
            model: 'note.note',
            data: self.data,
            arch: '<form><field name="body" widget="html" style="height: 100px"/></form>',
        });
        await promise;
        form.destroy();
        return promise;
    }

    QUnit.module('Custom Color');

    QUnit.test('Custom Color Picker', async function (assert) {
        assert.expect(25);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, { TestToolbarColorPicker: true }),
        };
        await createFormAndTest(this);
    });

});
});
