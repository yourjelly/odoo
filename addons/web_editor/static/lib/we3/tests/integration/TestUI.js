(function () {
'use strict';

var TestUI = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test', 'Toolbar'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Test', 'Toolbar'];
    }

    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }

    async test (assert) {
        await this._testEnabledToolbar(assert);
    }

    async _testEnabledToolbar (assert) {
        var self = this;
        var Test = self.dependencies.Test;
        var input = document.createElement('input');
        var firstButton = this.editor.querySelector('we3-toolbar we3-group we3-button, we3-toolbar we3-group we3-toggler');

        this.editor.parentNode.insertBefore(input, this.editor);
        await Test.click(this.editable);
        assert.ok(!firstButton.classList.contains('disabled'), "Should enable the toolbar on focus the editor");
        await Test.click(input);
        assert.ok(firstButton.classList.contains('disabled'), "Should disabled the toolbar on blur the editor");
        await Test.click(this.editable);
        assert.ok(!firstButton.classList.contains('disabled'), "Should re-enable the toolbar on re-focus the editor");

        this.editor.parentNode.removeChild(input);
    }
};

we3.addPlugin('TestUI', TestUI);

})();
