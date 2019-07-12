(function () {
'use strict';

/**
 * This tests complex interactions between various plugins of the default configuration.
 * Disable if you do not use all plugins of the default configuration.
 */

var TestComplex = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test'];
    }
    constructor () {
        super(...arguments);
        var self = this;
        this.dependencies = ['Range', 'Test'];

        // range collapsed: ◆
        // range start: ▶
        // range end: ◀

        this.tests = [
            {
                name: "Bold -> Unbold -> Deselect -> Convert list type (depends on: FontStyle, List)",
                content: "<ul><li><p>a▶b◀c</p></li></ul>",
                do: async function () {
                    self.dependencies.Test.triggerNativeEvents(self.btnBold, ['mousedown', 'click']);
                    self.dependencies.Test.triggerNativeEvents(self.btnBold, ['mousedown', 'click']);
                    self._collapseRange(false);
                    self.dependencies.Test.triggerNativeEvents(self.btnOl, ['mousedown', 'click']);
                },
                test: "<ol><li><p>ab◆c</p></li></ol>",
            },
        ];
    }
    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }
    test (assert) {
        var wysiwyg = document.getElementsByTagName('we3-editor')[0];

        var fontStyleGroup = wysiwyg.querySelector('we3-group[data-plugin="FontStyle"]');
        this.btnBold = fontStyleGroup.querySelector('we3-button[name="formatText-b"]');

        var listGroup = wysiwyg.querySelector('we3-group[data-plugin="List"]');
        this.btnOl = listGroup.querySelector('we3-button[name="list-ol"]');

        return this.dependencies.Test.execTests(assert, this.tests);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Set a new range by collapsing the current one.
     *
     * @param {boolean} onStart true to collapse on the start point
     */
    _collapseRange (onStart) {
        var currentRange = this.dependencies.Range.getRange();
        var collapsedRange = currentRange.collapse(onStart);
        this.dependencies.Range.setRange(collapsedRange);
    }
};

we3.addPlugin('TestComplex', TestComplex);

})();
