(function () {
'use strict';

var TestHistory = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test', 'History', 'FontStyle', 'TestKeyboard'];
    }
    constructor () {
        super(...arguments);
        var self = this;
        this.dependencies = ['Arch', 'Range', 'Renderer', 'Test'];

        // range collapsed: ◆
        // range start: ▶
        // range end: ◀
    }

    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    async test (assert) {
        var tests = Object.getOwnPropertyNames(TestHistory.prototype).filter(function (name) {
            return !name.indexOf('_test');
        });
        for (var k = 0; k < tests.length; k++) {
            await this[tests[k]](assert);
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    async _testInsertCharColapsedRange (assert) {
        var dom = "<p>dom to edit◆</p>";
        var domDOM = "<p>dom to edit</p>";
        var domA = "<p>dom to editA◆</p>";
        var domADOM = "<p>dom to editA</p>";
        assert.ok(true, "test: _testInsertCharColapsedRange");

        this.dependencies.Test.setValue(dom);

        var undo = this.editor.querySelector('we3-button[data-plugin="History"][data-method="undo"]');
        var redo = this.editor.querySelector('we3-button[data-plugin="History"][data-method="redo"]');

        assert.ok(undo.classList.contains('disabled'), "The undo button should be disabled");
        assert.ok(redo.classList.contains('disabled'), "The redo button should be disabled");

        this.dependencies.Arch.insert('A');

        assert.strictEqual(this.dependencies.Test.getValue(), domA, "Should insert the char");
        assert.strictEqual(this.editable.querySelector('test-container').innerHTML, domADOM, "Should insert the char in DOM");
        assert.ok(!undo.classList.contains('disabled'), "The undo button should be enabled");
        assert.ok(redo.classList.contains('disabled'), "The redo button should be disabled");

        await this.dependencies.Test.triggerNativeEvents(undo, ['mousedown', 'click', 'mouseup']);

        assert.strictEqual(this.dependencies.Test.getValue(), dom, "Should restore the previous dom and range");
        assert.strictEqual(this.editable.querySelector('test-container').innerHTML, domDOM, "Should restore the previous dom and range in DOM");
        assert.ok(undo.classList.contains('disabled'), "The undo button should be disabled");
        assert.ok(!redo.classList.contains('disabled'), "The redo button should be enabled");

        await this.dependencies.Test.triggerNativeEvents(redo, ['mousedown', 'click', 'mouseup']);

        assert.strictEqual(this.dependencies.Test.getValue(), domA, "Should restore the dom (with char) and range");
        assert.strictEqual(this.editable.querySelector('test-container').innerHTML, domADOM, "Should restore the dom (with char) and range in DOM");
        assert.ok(!undo.classList.contains('disabled'), "The undo button should be enabled");
        assert.ok(redo.classList.contains('disabled'), "The redo button should be disabled");
    }
    async _testInsertCharRange (assert) {
        var dom = "<p>dom to edit◆</p>";
        var domA = "<p>dom to editA◆</p>";
        var domARange = "<p>do▶m to ed◀itA</p>";
        assert.ok(true, "test: _testInsertCharRange");

        this.dependencies.Test.setValue(dom);

        var undo = this.editor.querySelector('we3-button[data-plugin="History"][data-method="undo"]');
        var redo = this.editor.querySelector('we3-button[data-plugin="History"][data-method="redo"]');
        var ID = this.dependencies.Renderer.getID(this.editable.querySelector('p').firstChild);

        this.dependencies.Arch.insert('A');

        this.dependencies.Range.setRange({
            scID: ID,
            so: 2,
            ecID: ID,
            eo: 9,
        });

        assert.strictEqual(this.dependencies.Test.getValue(), domARange, "Should insert the char then rerange");

        await this.dependencies.Test.triggerNativeEvents(undo, ['mousedown', 'click', 'mouseup']);

        assert.strictEqual(this.dependencies.Test.getValue(), domA, "Should restore the previous range");
        assert.ok(!undo.classList.contains('disabled'), "The undo button should be enabled");
        assert.ok(!redo.classList.contains('disabled'), "The redo button should be enabled");

        await this.dependencies.Test.triggerNativeEvents(undo, ['mousedown', 'click', 'mouseup']);

        assert.strictEqual(this.dependencies.Test.getValue(), dom, "Should restore the dom (with char) and range");
        assert.ok(undo.classList.contains('disabled'), "The undo button should be disabled");
        assert.ok(!redo.classList.contains('disabled'), "The redo button should be enabled");
    }
};

we3.addPlugin('TestHistory', TestHistory);

})();
