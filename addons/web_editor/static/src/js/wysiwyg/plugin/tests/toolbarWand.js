(function () {
'use strict';

var TestToolbarWand = class extends we3.AbstractPlugin {
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
                name: "Click H1: p -> h1",
                content: '<p>dom not to edit</p><p>d◆om to edit</p>',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.styleToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents(this.styleDropdown.querySelector('we3-button[name="formatBlock-h1"]'), ['mousedown', 'click']);
                },
                test: {
                    content: '<p>dom not to edit</p><h1>▶dom to edit◀</h1>',
                },
            },
            {
                name: "Click CODE: h1 -> pre",
                content: '<p>dom not to edit</p><h1>d◆om to edit</h1>',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.styleToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents(this.styleDropdown.querySelector('we3-button[name="formatBlock-pre"]'), ['mousedown', 'click']);
                },
                test: {
                    content: '<p>dom not to edit</p><pre>▶dom to edit◀</pre>',
                },
            },
            {
                name: "Click NORMAL: pre -> p",
                content: '<p>dom not to edit</p><pre>d◆om to edit</pre>',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.styleToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents(this.styleDropdown.querySelector('we3-button[name="formatBlock-p"]'), ['mousedown', 'click']);
                },
                test: {
                    content: '<p>dom not to edit</p><p>▶dom to edit◀</p>',
                },
            },
            {
                name: "Click H1 in empty p: empty p -> empty h1",
                content: '<p><br>◆</p>',
                do: async function () {
                    await this.dependencies.Test.triggerNativeEvents(this.styleToggler, ['mousedown', 'click']);
                    await this.dependencies.Test.triggerNativeEvents(this.styleDropdown.querySelector('we3-button[name="formatBlock-h1"]'), ['mousedown', 'click']);
                },
                test: {
                    content: '<h1><br>◆</h1>',
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
        this.styleDropdown = wysiwyg.querySelector('we3-dropdown[name="Style"]');
        this.styleToggler = this.styleDropdown.querySelector('we3-toggler');
        return this.dependencies.TestToolbar.test(assert, this.toolbarTests);
    }
};

we3.addPlugin('TestToolbarWand', TestToolbarWand);

})();
