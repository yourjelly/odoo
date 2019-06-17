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
            return archNode.type === 'WEBSITE-EDITABLE' && archNode.attributes.id === 'wrap';
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
