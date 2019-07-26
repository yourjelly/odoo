(function () {
    'use strict';

    var TestToolbarLink = class extends we3.AbstractPlugin {
        static get autoInstall() {
            return ['Test', 'TestToolbar', 'Text'];
        }

        constructor() {
            super(...arguments);
            this.dependencies = ['Test', 'TestToolbar'];

            // range collapsed: ◆
            // range start: ▶
            // range end: ◀

            var self = this;
            var _editInput = async function (selector, value) {
                var $input = $(selector);
                $input.val(value);
                return self.dependencies.Test.triggerNativeEvents($input[0], ['input']);
            };
            var _clickLink = async function (callbackInit) {
                var $btnLink = $('we3-toolbar we3-button[name="link-add"]');
                await self.dependencies.Test.triggerNativeEvents($btnLink[0], ['mousedown', 'click']);
                await callbackInit();
                await self.dependencies.Test.triggerNativeEvents($('.modal-dialog:visible .btn-primary:contains("Save")')[0], ['mousedown', 'click']);
            };

            this.toolbarTests = [{
                name: "Click LINK: p -> a in p (w/ URL)",
                async: true,
                content: '<p>d▶om t◀o edit</p>',
                do: async function (assert, testName) {
                    await _clickLink(async function () {
                        await new Promise(function (resolve) {
                            setTimeout(resolve, 300); // TODO: remove when find the missing await for modal at first load on website
                        });
                        assert.strictEqual($('.modal-dialog:visible #o_link_dialog_label_input').val(), 'om t', testName + ' (label)');
                        await _editInput('.modal-dialog:visible #o_link_dialog_url_input', '#');
                    });
                },
                test: '<p>d<a href="#">om t</a>◆o edit</p>',
            },
            {
                name: "Click LINK: p -> a in p (w/ URL) (no selection)",
                async: true,
                content: '<p>d◆o edit</p>',
                do: async function () {
                    await _clickLink(async function () {
                        await _editInput('.modal-dialog:visible #o_link_dialog_label_input', 'om t');
                        await _editInput('.modal-dialog:visible #o_link_dialog_url_input', '#');
                    });
                },
                test: '<p>d<a href="#">om t</a>◆o edit</p>',
            },
            {
                name: "Click LINK: a.btn in div -> a.btn.btn-outline-alpha in div (edit) (no selection)",
                content: '<h1><a href="#" class="btn btn-lg btn-outline-alpha">dom t◆o edit</a></h1>',
                do: async function (assert, testName) {
                    await _clickLink(async function () {
                        assert.strictEqual($('.modal-dialog:visible #o_link_dialog_label_input').val(), 'dom to edit', testName + ' (label)');
                        await _editInput($('.modal-dialog:visible #o_link_dialog_url_input'), '#newlink');
                    });
                },
                test: '<h1><a href="#newlink" class="btn btn-lg btn-outline-alpha">dom to edit</a>◆</h1>',
            },
            {
                name: "Click LINK: p -> a in p (w/ Email)",
                async: true,
                content: '<p>d▶om t◀o edit</p>',
                do: async function () {
                    await _clickLink(async function () {
                        await _editInput($('.modal-dialog:visible #o_link_dialog_url_input'), 'john.coltrane@example.com');
                    });
                },
                test: '<p>d<a href="mailto:john.coltrane@example.com">om t</a>◆o edit</p>',
            },
            {
                name: "Click LINK: p -> a in p (w/ URL & Size Large)",
                async: true,
                content: '<p>d▶om t◀o edit</p>',
                do: async function () {
                    await _clickLink(async function () {
                        await _editInput($('.modal-dialog:visible #o_link_dialog_url_input'), '#');
                        await _editInput($('.modal-dialog:visible [name="link_style_size"]'), "lg");
                    });
                },
                test: '<p>d<a class="btn-lg" href="#">om t</a>◆o edit</p>',
            },
            {
                name: "Click LINK: a in p -> a.btn-outline-alpha in p with alpha color and target=\"_blank\"",
                async: true,
                content: '<p><a href="#">◆dom to edit</a></p>',
                do: async function () {
                    await _clickLink(async function () {
                        await _editInput($('.modal-dialog:visible #o_link_dialog_url_input'), '#');
                        await _editInput($('.modal-dialog:visible [name="link_style_shape"]'), "outline");
                        await self.dependencies.Test.triggerNativeEvents($('.modal-dialog:visible .o_link_dialog_color .o_link_dialog_color_item.btn-alpha')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('.modal-dialog:visible .o_switch [name="is_new_window"]')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p><a href="#" class="btn btn-outline-alpha" target="_blank">dom to edit</a>◆</p>',
            },
            // POPOVER
            {
                name: "Click LINK in popover after adding link in p",
                async: true,
                content: '<p>d<a href="/link">◆om t</a>o edit</p>',
                do: async function (assert, testName) {
                    await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Link"] we3-button[name="link-add"]')[0], ['mousedown', 'click']);
                    assert.strictEqual($('.modal-dialog:visible #o_link_dialog_label_input').val(), 'om t', testName + ' (label)');
                    assert.strictEqual($('.modal-dialog:visible #o_link_dialog_url_input').val(), '/link', testName + ' (url)');
                    await _editInput($('.modal-dialog:visible #o_link_dialog_url_input'), '/newlink');
                    await self.dependencies.Test.triggerNativeEvents($('.modal-dialog:visible .modal-footer .btn.btn-primary:contains("Save")')[0], ['mousedown', 'click']);
                },
                test: '<p>d<a href="/newlink">om t</a>◆o edit</p>',
            },
            {
                name: "Click UNLINK in popover after adding link in p",
                async: true,
                content: '<p>d<a href="/link">◆om t</a>o edit</p>',
                do: async function () {
                    await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Link"] we3-button[name="link-remove"]')[0], ['mousedown', 'click']);
                },
                test: '<p>d▶om t◀o edit</p>',
            }
            ];
        }

        start() {
            this.dependencies.Test.add(this);
            return super.start();
        }

        test(assert) {
            var wysiwyg = document.getElementsByTagName('we3-editor')[0];
            this.foreColorDropdown = wysiwyg.querySelector('we3-dropdown[name="Color"]');
            this.foreColorToggler = this.foreColorDropdown.querySelector('we3-toggler');
            return this.dependencies.TestToolbar.test(assert, this.toolbarTests);
        }
    };

    we3.addPlugin('TestToolbarLink', TestToolbarLink);

})();
