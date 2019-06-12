(function () {
'use strict';

var NOTEDITABLE = class extends we3.ArchNode {
    static parse (archNode) {
        if (archNode.nodeName === 'noteditable') {
            return new NOTEDITABLE(archNode.params, archNode.nodeName, archNode.attributes.toJSON());
        }
    }
    get type () {
        return 'NOTEDITABLE';
    }
    isBlock () {
        return true;
    }
    isEditable () {
        return false;
    }
};
we3.addArchNode('NOTEDITABLE', NOTEDITABLE);

var EDITABLE = class extends we3.ArchNode {
    static parse (archNode) {
        if (archNode.nodeName === 'editable') {
            return new EDITABLE(archNode.params, archNode.nodeName, archNode.attributes.toJSON());
        }
    }
    get type () {
        return 'EDITABLE';
    }
    isBlock () {
        return true;
    }
    isEditable () {
        return true;
    }
};
we3.addArchNode('EDITABLE', EDITABLE);

/**
 * Char codes.
 */
var keyboardMap = {
    "8": "BACKSPACE",
    "9": "TAB",
    "13": "ENTER",
    "16": "SHIFT",
    "17": "CONTROL",
    "18": "ALT",
    "19": "PAUSE",
    "20": "CAPS_LOCK",
    "27": "ESCAPE",
    "32": "SPACE",
    "33": "PAGE_UP",
    "34": "PAGE_DOWN",
    "35": "END",
    "36": "HOME",
    "37": "LEFT",
    "38": "UP",
    "39": "RIGHT",
    "40": "DOWN",
    "45": "INSERT",
    "46": "DELETE",
    "91": "OS_KEY", // 'left command': Windows Key (Windows) or Command Key (Mac)
    "93": "CONTEXT_MENU", // 'right command'
};
new Array(128 - 40).forEach(function (keyCode) {
    keyCode += 40;
    if (!keyboardMap[keyCode]) {
        keyboardMap[keyCode] = String.fromCharCode(keyCode);
    }
});

var reDOMSelection = /^(.+?)(:contents(\(\)\[|\()([0-9]+)[\]|\)])?(->([0-9]+))?$/;


var TestKeyboard = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test', 'Keyboard'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Range', 'Test'];
    }

    /**
     * Perform a series of tests (`keyboardTests`) for using keyboard inputs.
     *
     * @see wysiwyg_keyboard_tests.js
     * @see wysiwyg_tests.js
     *
     * @param {object} assert
     * @param {object[]} keyboardTests
     * @param {string} keyboardTests.name
     * @param {string} keyboardTests.content
     * @param {object[]} keyboardTests.steps
     * @param {string} keyboardTests.steps.start
     * @param {string} [keyboardTests.steps.end] default: steps.start
     * @param {string} keyboardTests.steps.key
     * @param {object} keyboardTests.test
     * @returns {Promise}
     */
    test (assert, keyboardTests) {
        var self = this;
        keyboardTests.forEach(function (test, i) {
            keyboardTests[i].do = keyboardTests[i].do || function () {
                var def = Promise.resolve();
                if (!test.steps) {
                    return def;
                }
                test.steps.forEach(function (step) {
                    def = def.then(self._execStep.bind(self, assert, step, test.name));
                });
                return def;
            }
        });
        return this.dependencies.Test.execTests(assert, keyboardTests);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Move the position because some browsers put the carret
     * at the end of the previous area after normalize.
     *
     * @private
     * @param {object} point
     * @param {Node} point.node
     * @param {int} point.offset
     * @returns {object}
     */
    _endOfAreaBetweenTwoNodes (point) {
        if (
            !point.node.tagName &&
            point.offset === point.node.textContent.length &&
            !/\S|\u00A0/.test(point.node.textContent)
        ) {
            var startNode = point.node;
            point = Object.assing({}, point).nextUntilNode(function (node) {
                return node !== startNode && (!node.tagName || !node.textContent.length);
            }) || point;
        }
        return point;
    }
    /**
     * Execute a step from a test.
     *
     * @param {Object} assert
     * @param {Object} step
     * @param {string} testName
     * @returns {Promise}
     */
    _execStep (assert, step, testName) {
        var self = this;
        return new Promise(function (resolve) {
            if (step.start) {
                self._testSelect(assert, step, testName)
            }
            var target;
            setTimeout(function () {
                if (step.keyCode || step.key) {
                    target = self.dependencies.Range.getRange().ec;
                    if (window.location.search.indexOf('notrycatch') !== -1) {
                        self.dependencies.Test.keydown(target, {
                            key: step.key,
                            keyCode: step.keyCode,
                            ctrlKey: !!step.ctrlKey,
                            shiftKey: !!step.shiftKey,
                            altKey: !!step.altKey,
                            metaKey: !!step.metaKey,
                        });
                    } else {
                        try {
                            self.dependencies.Test.keydown(target, {
                                key: step.key,
                                keyCode: step.keyCode,
                                ctrlKey: !!step.ctrlKey,
                                shiftKey: !!step.shiftKey,
                                altKey: !!step.altKey,
                                metaKey: !!step.metaKey,
                            });
                        } catch (e) {
                            console.error(e);
                            assert.notOk(e.name + '\n\n' + e.stack, testName);
                        }
                    }
                }
                setTimeout(function () {
                    if (step.keyCode || step.key) {
                        target = self.dependencies.Range.getRange().ec;
                        target = !target || target.tagName ? target : target.parentNode;
                        if (target) {
                            self.dependencies.Test.triggerNativeEvents(target, 'keyup', {
                                key: step.key,
                                keyCode: step.keyCode,
                                ctrlKey: !!step.ctrlKey,
                                shiftKey: !!step.shiftKey,
                                altKey: !!step.altKey,
                                metaKey: !!step.metaKey,
                            });
                        } else {
                            assert.notOk("Should have a target to trigger the keyup", testName);
                        }
                    }
                    setTimeout(resolve);
                });
            });
        });
    }
    /**
     * Get nodes within `document`, using the string `selector`.
     *
     * @param {string} selector
     * @param {Node} document
     * @returns {Node []}
     */
    _querySelectorAllWithEq(selector, document) {
        var remainingSelector = selector;
        var baseElement = document;
        var firstEqIndex = remainingSelector.indexOf(':eq(');

        while (firstEqIndex !== -1) {
            var leftSelector = remainingSelector.substring(0, firstEqIndex);
            var rightBracketIndex = remainingSelector.indexOf(')', firstEqIndex);
            var eqNum = remainingSelector.substring(firstEqIndex + 4, rightBracketIndex);
            eqNum = parseInt(eqNum, 10);

            var selectedElements = baseElement.querySelectorAll(leftSelector);
            if (eqNum >= selectedElements.length) {
               return [];
            }
            baseElement = selectedElements[eqNum];

            remainingSelector = remainingSelector.substring(rightBracketIndex + 1).trim();
            // Note - for now we just ignore direct descendants:
            // 'a:eq(0) > i' gets transformed into 'a:eq(0) i'; we could maybe use :scope
            // to fix this later but support is iffy
            if (remainingSelector.charAt(0) === '>') {
                remainingSelector = remainingSelector.substring(1).trim();
            }

            firstEqIndex = remainingSelector.indexOf(':eq(');
        }

        if (remainingSelector !== '') {
            return Array.from(baseElement.querySelectorAll(remainingSelector));
        }

        return [baseElement];
    }
    /**
     * Find nodes within the editable node, using the string `selector`
     * and find the range within it.
     *
     * @param {string} testName
     * @param {Object} assert
     * @param {string} selector
     * @returns {Object}
     */
    _querySelectorAllWithContents (testName, assert, selector) {
        // eg: ".class:contents()[0]->1" selects the first contents of the 'class' class, with an offset of 1
        var sel = selector.match(reDOMSelection);
        try {
            var node = this._querySelectorAllWithEq(sel[1], this.editable)
            // var node = this.editable.querySelectorAll(sel[1]);
        } catch (e) {
            console.error(e);
            assert.notOk(e.message, testName);
            var node = $(sel[1], this.editable);
        }
        node = node[0];
        var point = {
            node: sel[3] ? node.childNodes[+sel[4]] : node,
            offset: sel[5] ? +sel[6] : 0
        };
        if (!point.node || point.offset > (point.node.tagName ? point.node.childNodes : point.node.textContent).length) {
            assert.notOk("Node not found: '" + selector + "' " + (point.node ? "(container: '" + (node.outerHTML || node.textContent) + "')" : ""), testName);
        }
        return point;
    }
    /**
     * Select text in the DOM.
     *
     * @param {string} testName
     * @param {Object} assert
     * @param {Object} start
     * @param {Node} start.node
     * @param {int} start.offset
     * @param {Object} [end]
     * @param {Node} [end.node]
     * @param {int} [end.offset]
     */
    _selectText (testName, assert, start, end) {
        start = this._querySelectorAllWithContents(testName, assert, start);
        var target = start.node;
        target = target.tagName ? target : target.parentNode;
        this.dependencies.Test.triggerNativeEvents(target, 'mousedown');
        if (end) {
            end = this._querySelectorAllWithContents(testName, assert, end);
            this.dependencies.Range.setRange({
                sc: start.node,
                so: start.offset,
                ec: end.node,
                eo: end.offset,
            });
        } else {
            this.dependencies.Range.setRange({
                sc: start.node,
                so: start.offset,
            });
        }
        target = end ? end.node : start.node;
        target = target.tagName ? target : target.parentNode;
        this.dependencies.Test.triggerNativeEvents(target, 'mouseup');
    }
    /**
     * Test the range.
     *
     * @param {Object} assert
     * @param {Object} step
     * @param {string} testName
     */
    _testSelect (assert, step, testName) {
        try {
            this._selectText(testName, assert, step.start, step.end);
        } catch (e) {
            console.error(e);
            assert.notOk(e.message, testName);
        }
        if (!this.dependencies.Range.getRange()) {
            throw 'Wrong range! \n' +
                'Test: ' + testName + '\n' +
                'Selection: ' + step.start + '" to "' + step.end + '"\n' +
                'DOM: ' + this.dependencies.Arch.getValue();
        }
    }
};

we3.addPlugin('TestKeyboard', TestKeyboard);

})();
