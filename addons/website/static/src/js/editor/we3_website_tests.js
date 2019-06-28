(function () {
'use strict';

var TestOdooWebsite = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test', 'OdooWebsite'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Test'];

        // range collapsed: ◆
        // range start: ▶
        // range end: ◀

        this.tests = [
            {
                name: "Range in text",
                content: "<p>aa◆a</p>",
                test: "<p>aa◆a</p>",
            },
            {
                name: "Range between two block (snippet) should re-range to the first block",
                content:   `<section class="pb32 pt32">
                                <div class="container">
                                    <div class="row s_nb_column_fixed">
                                        <div class="col-lg-12 pb16 pt16 s_title" style="text-align:center">
                                            <h1 class="s_title_default"><font style="font-size:62px">Your ▶Site Title</font></h1>
                                        </div>
                                    </div>
                                </div>
                            </section>
                            <section class="pb32 pt32">
                                <div class="container">
                                    <div class="row s_nb_column_fixed">
                                        <div class="col-lg-12 pb16 pt16 s_title" style="text-align:center">
                                            <h1 class="s_title_default"><font style="font-size:62px">Your Site ◀Title</font></h1>
                                        </div>
                                    </div>
                                </div>
                            </section>`,
                test: '<section class="pb32 pt32">'+
                        '<div class="container">'+
                            '<div class="row s_nb_column_fixed">'+
                                '<div class="col-lg-12 pb16 pt16 s_title" style="text-align:center">'+
                                    '<h1 class="s_title_default"><font style="font-size:62px">Your ▶Site Title◀</font></h1>'+
                                '</div>'+
                            '</div>'+
                        '</div>'+
                        '</section>'+
                        '<section class="pb32 pt32">'+
                        '<div class="container">'+
                            '<div class="row s_nb_column_fixed">'+
                                '<div class="col-lg-12 pb16 pt16 s_title" style="text-align:center">'+
                                    '<h1 class="s_title_default"><font style="font-size:62px">Your Site Title</font></h1>'+
                                '</div>'+
                            '</div>'+
                        '</div>'+
                        '</section>',
            },
        ];
    }
    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }
    test (assert) {
        var self = this;
        var Arch = this.dependencies.Arch;
        var Test = this.dependencies.Test;
        var wrapArchNode = Arch.getNode(1).nextUntil(function (archNode) {
            return archNode.isWebsiteEditable && archNode.isWebsiteEditable() && archNode.attributes.id === 'wrap';
        });
        this.tests.forEach(function (test) {
            Test.setValue(test.content, wrapArchNode.id);
            var value = Test.getValue(wrapArchNode.id).replace(/^<div [^>]+>/, '').replace(/<\/div>$/, '');
            assert.strictEqual(value, test.test, test.name);
        });
    }
};

we3.addPlugin('TestOdooWebsite', TestOdooWebsite);

})();


odoo.define('website.we3_tests', function (require) {
"use strict";

var testUtils = require('web.test_utils');
var Widget = require('web.Widget');
var testUtilsMock = require('web.test_utils_mock');
var weTestUtils = require('web_editor.test_utils');
var Wysiwyg = require('web_editor.wysiwyg');


QUnit.module('website', {
    beforeEach: function () {
    },
    afterEach: function () {
    },
}, async function () {

    QUnit.module('home page edition');

    QUnit.test('we3', async function (assert) {
        assert.expect(80);

        var $website = $(`<div id="wrapwrap" class="homepage">
                <header id="top" data-anchor="true" class=" o_affix_enabled">
                    <nav class="bg-light navbar navbar-expand-md navbar-light">
                        <div class="container">
                            <p><a href="/" class="logo navbar-brand"><span data-oe-model="res.company" data-oe-id="1" data-oe-field="logo" data-oe-type="image" data-oe-expression="res_company.logo" role="img" aria-label="Logo of YourCompany" title="YourCompany" class=" o_editable"><img src="/web/image/res.company/1/logo/YourCompany?unique=c804d95" class="img img-fluid" alt="YourCompany"/></span></a></p><button type="button" class="navbar-toggler o_editable" data-toggle="collapse" data-target="#top_menu_collapse" data-oe-model="ir.ui.view" data-oe-id="362" data-oe-field="arch" data-oe-xpath="/data/xpath[2]/nav/div[1]/button[1]"><span class="navbar-toggler-icon"></span></button>
                            <div class="collapse navbar-collapse" id="top_menu_collapse" aria-expanded="false">
                                <ul class="ml-auto nav navbar-nav text-right" id="top_menu">
                                    <li class="nav-item">
                                        <p><a role="menuitem" href="/" class="active nav-link"><span data-oe-model="website.menu" data-oe-id="5" data-oe-field="name" data-oe-type="char" data-oe-expression="submenu.name" class=" o_editable">Home</span></a></p>
                                    </li>
                                    <li class="nav-item">
                                        <p><a role="menuitem" href="/contactus" class=" nav-link"><span data-oe-model="website.menu" data-oe-id="6" data-oe-field="name" data-oe-type="char" data-oe-expression="submenu.name" class=" o_editable">Contact us</span></a></p>
                                    </li>
                                    <li class="divider nav-item"></li>
                                    <li class="dropdown nav-item">
                                        <p><a href="#" class="dropdown-toggle nav-link" data-toggle="dropdown"><span><b>Mitchell Admin</b></span><b></b></a></p>
                                        <div class="dropdown-menu js_usermenu" role="menu">
                                            <p><a href="/my/home" role="menuitem" class="dropdown-item">My Account</a><a id="o_logout" class="dropdown-item" role="menuitem" href="/web/session/logout?redirect=/">Logout</a></p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </nav>
                </header>
                <main>
                    <div id="wrap" class="o_editable oe_empty oe_structure" data-oe-model="ir.ui.view" data-oe-id="402" data-oe-field="arch" data-oe-xpath="/t[1]/t[1]/div[1]">
                        <div class="container o_homepage_editor_welcome_message text-center" style="min-height:615.688px">
                            <h2 class="mt0">Welcome to your <b>Homepage</b>!</h2>
                            <p class="d-md-block d-none lead">Let's start designing.</p>
                            <div class="d-md-inline-flex d-none fade o_tooltip_container">
                                <p>Follow all the</p>
                                <div class="bottom o_tooltip"></div>
                                <p>signs to get your website ready in no time.</p>
                            </div>
                        </div>
                    </div>
                </main>
                <footer id="bottom" data-anchor="true" class="bg-light o_footer">
                    <div id="footer" class="o_editable oe_structure oe_structure_solo" data-oe-id="422" data-oe-xpath="/data/xpath/div" data-oe-model="ir.ui.view" data-oe-field="arch">
                        <section class="pb8 pt16 s_text_block">
                            <div class="container">
                                <div class="row">
                                    <div class="col-lg-4">
                                        <h5>Our Products & Services</h5>
                                        <ul class="list-unstyled">
                                            <li>
                                                <p><a href="/">Home</a></p>
                                            </li>
                                        </ul>
                                    </div>
                                    <div class="col-lg-4" id="connect">
                                        <h5>Connect with us</h5>
                                        <ul class="list-unstyled">
                                            <li>
                                                <p><a href="/contactus">Contact us</a></p>
                                            </li>
                                            <li><i class="fa fa-phone"></i> <span data-oe-model="res.company" data-oe-id="1" data-oe-field="phone" data-oe-type="char" data-oe-expression="res_company.phone" class=" o_editable">+1 (650) 691-3277</span></li>
                                            <li><i class="fa fa-envelope"></i> <span data-oe-model="res.company" data-oe-id="1" data-oe-field="email" data-oe-type="char" data-oe-expression="res_company.email" class=" o_editable">info@yourcompany.example.com</span></li>
                                        </ul>
                                        <p><a class="btn btn-link btn-sm" href="https://www.facebook.com/Odoo"><i class="fa fa-2x fa-facebook-square"></i></a> <a class="btn btn-link btn-sm" href="https://twitter.com/Odoo"><i class="fa fa-2x fa-twitter"></i></a> <a class="btn btn-link btn-sm" href="https://www.linkedin.com/company/odoo"><i class="fa fa-2x fa-linkedin"></i></a> <a class="btn btn-link btn-sm" href="https://www.youtube.com/user/OpenERPonline"><i class="fa fa-2x fa-youtube-play"></i></a> <a class="btn btn-link btn-sm" rel="publisher" href="https://plus.google.com/+Odooapps"><i class="fa fa-2x fa-google-plus-square"></i></a> <a class="btn btn-link btn-sm" href="https://github.com/odoo"><i class="fa fa-2x fa-github"></i></a> <a class="btn btn-link btn-sm" href="https://www.instagram.com/explore/tags/odoo/"><i class="fa fa-2x fa-instagram"></i></a></p>
                                    </div>
                                    <div class="col-lg-4">
                                        <h5><span data-oe-model="res.company" data-oe-id="1" data-oe-field="name" data-oe-type="char" data-oe-expression="res_company.name" class=" o_editable">YourCompany</span> <small> - <a href="/aboutus">About us</a></small></h5>
                                        <p>We are a team of passionate people whose goal is to improve everyone's life through disruptive products. We build great products to solve your business problems.</p>
                                        <p>Our products are designed for small to medium size companies willing to optimize their performance.</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div class="o_footer_copyright">
                        <div class="container py-3">
                            <div class="row">
                                <div class="col-sm text-center text-muted text-sm-left">
                                    <p><span data-oe-model="ir.ui.view" data-oe-id="184" data-oe-field="arch" data-oe-xpath="/data/xpath[3]/div/footer[1]/div[1]/div[1]/div[1]/div[1]/span[1]" class=" o_editable">Copyright ©</span><span data-oe-model="res.company" data-oe-id="1" data-oe-field="name" data-oe-type="char" data-oe-expression="res_company.name" itemprop="name" class=" o_editable">YourCompany</span></p>
                                    <ul class="js_language_selector list-inline mb0">
                                        <li class="list-inline-item">
                                            <div class="dropup"><button class="btn btn-secondary btn-sm dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true"><span>English (US)</span><span class="caret ml4 o_editable" data-oe-model="ir.ui.view" data-oe-id="423" data-oe-field="arch" data-oe-xpath="/t[1]/ul[1]/li[1]/div[1]/button[1]/span[2]"></span></button>
                                                <div class="dropdown-menu" role="menu">
                                                    <p><a class="dropdown-item js_change_lang" href="/en_US/?debug=0" data-default-lang="true" data-lang="en_US">English (US)</a></p>
                                                </div>
                                            </div>
                                        </li>
                                        <li class="list-inline-item">
                                            <p><a class="d-none d-sm-block o_editable" data-oe-model="ir.ui.view" data-oe-id="423" data-oe-field="arch" data-oe-xpath="/t[1]/ul[1]/li[2]/a[1]" href="/web#action=base.action_view_base_language_install&amp;website_id=1&amp;url_return=%2F%5Blang%5D%2F%3Fdebug%3D0"><i class="fa fa-plus-circle"></i> Add a language...</a></p>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>`);
        $('#qunit-fixture').html($website);
        var widget = new Widget();
        var mockServer = testUtilsMock.addMockEnvironment(widget, {
            data: weTestUtils.wysiwygData(),
        });

        var res_id;
        var res_model;
        var xpath;
        var recordInfo = {
            context: {},
            data_res_model: 'website',
            data_res_id: 1,
            get res_id () {
                return res_id;
            },
            set res_id (id) {
                return res_id = id;
            },
            get res_model () {
                return res_model;
            },
            set res_model (model) {
                return res_model = model;
            },
            get xpath () {
                return xpath;
            },
            set xpath (x) {
                return xpath = x;
            },
        };

        var wysiwyg = new Wysiwyg(widget, {
            plugins: {
                Test: true,
                OdooWebsite: true,
            },
            test: {
                assert: assert,
            },
            recordInfo: recordInfo,
            snippets: 'web_editor.snippets',
            dropblockStayOpen: true,
        });

        await wysiwyg.attachTo($website);

        assert.strictEqual($('we3-editor').length, 1, "Editor should be loaded");
        assert.ok($website.is(':hidden'), "Html value should be hidden");
        assert.ok($('we3-editor #wrapwrap:visible'), "Html value should be appear in the editable area");

        await wysiwyg.editor._editor._pluginsManager.call('Test', 'loadTest', ['TestOdooWebsite']);
        await wysiwyg.editor._editor._pluginsManager.call('Test', 'loadTest', ['TestKeyboardChar']);
        await wysiwyg.editor._editor._pluginsManager.call('Test', 'loadTest', ['TestArchAndRules']);

        var target = $('we3-editable #wrap h2 b:first')[0].firstChild;
        var id = wysiwyg.editor._editor._pluginsManager.call('Renderer', 'getID', [target]);
        await wysiwyg.editor._editor._pluginsManager.call('Test', 'setRange', [{scID: id, so: 4}]);
        await wysiwyg.editor._editor._pluginsManager.call('Test', 'keydown', [target, {keyCode: 13}]);

        await wysiwyg.save().then(function (result) {
            var area = result.arch.descendents('isWebsiteEditable');
            assert.strictEqual(area.length, 10, "Should have some edition area");
            var dirty = area.filter(function (a) { return a.className.contains('o_dirty'); });
            assert.strictEqual(dirty.length, 1, "Should have only one dirty area");
        });

        wysiwyg.destroy();

        assert.strictEqual($('we3-editor').length, 0, "Editor should be close");

        $('#qunit-fixture').html('');
    });

});
});
