odoo.define('web_editor.media_crop_tests', function (require) {
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
        TestPopover: false,
        TestRange: false,
        TestUI: false,
        TestRenderer: false,
        TestArchAndRules: false,
        TestToolbarColor: false,
        TestToolbarColorPicker: false,
        TestToolbarWand: false,
        TestToolbarFontStyle: false,
        TestToolbarIndent: false,
        TestToolbarKeymap: false,
        TestToolbarLink: false,
        TestToolbarList: false,
        TestToolbarMedia: false,
        TestToolbarParagraph: false,
        TestKeyboardUnbreakable: false,
        TestKeyboardTab: false,
        TestKeyboardEnter: false,
        TestKeyboardDelete: false,
        TestKeyboardComplex: false,
        TestKeyboardChar: false,
        TestKeyboardBackspace: false,
        TestKeyboardArrow: false,
        TestHistory: false,
    };

    async function createFormAndTest(self) {
        var promise = new Promise((resolve) => self.testOptions.resolve = resolve);

        var form = await testUtils.createView({
            View: FormView,
            model: 'note.note',
            data: self.data,
            arch: '<form><field name="body" widget="html" style="height: 100px"/></form>',
            mockRPC: function (route, args) {
                if (route.indexOf('data:image/png;base64') === 0) {
                    return Promise.resolve();
                }
                if (route.indexOf('youtube') !== -1) {
                    return Promise.resolve();
                }
                if (route.indexOf('/web_editor/static/src/img/') === 0) {
                    return Promise.resolve();
                }
                if (route === '/web_editor/attachment/add_url') {
                    return Promise.resolve({
                        id: 1,
                        public: true,
                        name: 'image',
                        mimetype: 'image/png',
                        checksum: false,
                        url: '/web_editor/static/src/img/transparent.png',
                        image_src: '/web_editor/static/src/img/transparent.png',
                        type: 'url',
                        res_id: 0,
                        res_model: false,
                        access_token: false,
                    });
                }
                return this._super(route, args);
            },
        });
        await promise;
        form.destroy();
        return promise;
    }

    QUnit.module('media crop');

    QUnit.test('Image Crop', async function (assert) {
        assert.expect(8);
        this.testOptions = {
            assert: assert,
            plugins: Object.assign({}, testPlugins, { TestToolbarCrop: true }),
        };
        await createFormAndTest(this);
    });

});
});
