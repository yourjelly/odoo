(function () {
'use strict';

var rangeCollapsed = '\u25C6'; // ◆
var rangeStart = '\u25B6'; // ▶
var rangeEnd = '\u25C0'; // ◀

var regExpRange = new RegExp('(' + rangeStart + '|' + rangeEnd + '|' + rangeCollapsed + ')', 'g');
var regExpRangeToCollapsed = new RegExp(rangeStart + rangeEnd, 'g');
var other = '[^' + rangeStart + '' + rangeEnd + ']*';
var regExpRangeCollapsed = new RegExp('^(' + other + ')(' + rangeCollapsed + ')(' + other + ')$');
var regExpRangeNotCollapsed = new RegExp('^(' + other + ')(' + rangeStart + ')?(' + other + ')(' + rangeEnd + ')?(' + other + ')$');
var regSpace = /\u00A0/g;
var regInvisible = /\uFEFF/g;

/////////////////////////////////////////////////////////////////

var VIRTUAL = we3.getArchNode('TEXT-VIRTUAL');
var TEST = class extends VIRTUAL {
    //--------------------------------------------------------------------------
    // static
    //--------------------------------------------------------------------------

    static parse (json) {
        if (TEST._isTestingVirtualNode(json)) {
            return TEST._createTestingVirtualNode(json);
        }
    }
    static _createTestingVirtualNode (json) {
        if (json.type === 'TEST') {
            return json;
        }
        var childNodes = [];
        var matches = json.nodeValue.match(regExpRangeCollapsed) || json.nodeValue.match(regExpRangeNotCollapsed);
        if (matches) {
            matches.shift();
            matches.forEach(function (match) {
                if (match === rangeCollapsed) {
                    childNodes.push({
                        type: 'TEST',
                        nodeValue: rangeStart,
                    });
                    childNodes.push({
                        type: 'TEST',
                        nodeValue: rangeEnd,
                    });
                } else if (match && match.length) {
                    var type = match === rangeStart || match === rangeEnd ? 'TEST' : 'TEXT';
                    childNodes.push({
                        type: type,
                        nodeValue: match,
                    });
                }
            });
            return {
                type: 'FRAGMENT',
                childNodes: childNodes,
            };
        }
        return json;
    }
    static _isTestingVirtualNode (json) {
        return regExpRange.test(json.nodeValue);
    }

    //--------------------------------------------------------------------------
    // public
    //--------------------------------------------------------------------------

    constructor (params, nodeName, attributes, nodeValue) {
        super(...arguments)
        this.nodeValue = nodeValue;
    }
    isVisibleText () {
        return true;
    }
    isTestNode () {
        return true;
    }
    toString (options) {
        return this.nodeValue;
    }
    get type () {
        return 'TEST';
    }

    //--------------------------------------------------------------------------
    // private
    //--------------------------------------------------------------------------

    _applyRulesArchNode () {}
};
we3.addArchNode('TEST', TEST);

/////////////////////////////////////////////////////////////////

function deepEqual (v1, v2) {
    if (v1 === v2) {
        return true;
    }
    if (typeof v1 === 'object' && typeof v2 === 'object') {
        var k1 = Object.keys(v1);
        var k2 = Object.keys(v2);
        if (k1.length !== k2.length) {
            return false;
        }
        for (var i = 0; i < k1.length; i++) {
            var key = k1[i];
            if (!deepEqual(v1[key], v2[key])) {
                return false;
            }
        }
        return true;
    }
}
function log (result, testName, value) {
    if (testName.startsWith('<')) {
        console.info('%cTEST: ' + testName, 'background-color: grey; color: black; padding: 2px;');
        var reRun = window.location.origin +
            window.location.pathname +
            window.location.search +
            (window.location.search ? '&' : '?') +
            'we3-test=' + escape(testName.slice(1, -1)) +
            window.location.hash;
        console.debug(reRun);
    } else if (result === true) {
        console.info('%cTEST: ' + testName, 'color: green;');
    } else if (result === false) {
        console.error('TEST: ', testName, '=>', value);
    }
}
/**
 * Get the event type based on its name.
 *
 * @private
 * @param {string} eventName
 * @returns string
 *  'mouse' | 'keyboard' | 'unknown'
 */
function _eventType(eventName) {
    var types = {
        mouse: ['click', 'mouse', 'pointer', 'contextmenu', 'select', 'wheel'],
        keyboard: ['key'],
    };
    var type = 'unknown';
    Object.keys(types).forEach(function (key, index) {
        var isType = types[key].some(function (str) {
            return eventName.indexOf(str) !== -1;
        });
        if (isType) {
            type = key;
        }
    });
    return type;
}


var TestPlugin = class extends we3.AbstractPlugin {
    /**
     *@param {Object} options
     *@param {Object} options.testAssertObject
     *@param {function} options.testAssertObject.ok
     *@param {function} options.testAssertObject.notOk
     *@param {function} options.testAssertObject.strictEqual
     *@param {function} options.testAssertObject.deepEqual
     *@param {Object} options.returnTestResults called at the test ending
     **/
    constructor (parent, params, options) {
        super(...arguments)
        var self = this;
        this.dependencies = ['Arch', 'Range', 'Rules'];
        this._plugins = [this];
        this._allPluginsAreReady = false;
        this._complete = false;

        this.assert = {
            ok (value, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.ok(value, testName);
                } else {
                    var didPass = !!value;
                    log(didPass, testName, value);
                    return didPass;
                }
            },
            notOk (value, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.notOk(value, testName);
                } else {
                    var didPass = !value;
                    log(!value, testName, value);
                    return didPass;
                }
            },
            strictEqual (value, expectedValue, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.strictEqual(value, expectedValue, testName);
                } else {
                    var didPass = value === expectedValue;
                    log(didPass, testName, value);
                    return didPass;
                }
            },
            deepEqual (value, expectedValue, testName) {
                if (self.options.testAssertObject) {
                    self.options.testAssertObject.deepEqual(value, expectedValue, testName);
                } else {
                    var didPass = deepEqual(value, expectedValue);
                    log(didPass, testName, value);
                    return didPass;
                }
            },
        };
    }
    start () {
        var promise = super.start();
        this.dependencies.Rules.addStructureRule({
            nodes: {
                methods: ['isTestNode'],
            },
            permittedParents: {
                methods: ['isTrue'],
            },
        });
        return promise;
    }
    setEditorValue () {
        super.setEditorValue()
        if (!this._allPluginsAreReady) {
            this._allPluginsAreReady = true;
            setTimeout(this._loadTests.bind(this));
        }
    }
    destroy () {
        this._isDestroyed = true;
        if (!this._complete) {
            var assert = this.options.testAssertObject || this.assert;
            assert.notOk(true, "The editor are destroyed before all tests are complete");
            this._terminate();
        }
        super.destroy();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    add (plugin) {
        this._plugins.push(plugin);
    }
    execTests (assert, tests) {
        var self = this;
        var nTests = tests.length;
        var nOKTests = 0;
        var defPollTest = Promise.resolve();
        // tests = JSON.parse(JSON.stringify(tests || [])); // why?

        while (tests.length) {
            defPollTest = defPollTest.then(this._pollTest.bind(this, assert, tests.shift())).then(function (success) {
                nOKTests += success ? 1 : 0;
            });
        }

        return defPollTest.then(function () {
            return self._logFinalResult(nTests, nOKTests);
        });
    }
    keydown (target, keyPress) {
        var self = this;
        target = target.tagName ? target : target.parentNode;
        if (!keyPress.keyCode) {
            for (var keyCode in this.utils.keyboardMap) {
                if (this.utils.keyboardMap[keyCode] === keyPress.key) {
                    keyPress.keyCode = +keyCode;
                    break;
                }
            }
        } else {
            keyPress.key = this.utils.keyboardMap[keyPress.keyCode] || String.fromCharCode(keyPress.keyCode);
        }
        keyPress.keyCode = keyPress.keyCode;
        this.triggerNativeEvents(target, 'keydown', keyPress).then(function (ev) {
            ev = ev[0] || ev; // (only one event was triggered)
            if (!ev.defaultPrevented) {
                if (keyPress.key.length === 1) {
                    self._textInput(target, keyPress.key);
                    document.execCommand("insertText", 0, keyPress.key);
                } else {
                    console.debug('Native "' + keyPress.key + '" is not supported in test');
                }
            }
        });
        this.triggerNativeEvents(target, 'keyup', keyPress);
        return target;
    }
    click (target, DOMRangeOffset) {
        var self = this;
        var node = target.tagName ? target : target.parentNode;
        return this.triggerNativeEvents(node, 'mousedown').then(function (ev) {
            if (!ev.defaultPrevented) {
                self._selectRange(target, DOMRangeOffset|0);
            }
            return self.triggerNativeEvents(node, 'click').then(function () {
                return self.triggerNativeEvents(node, 'mouseup');
            });
        });
    }
    getValue () {
        var params = this.dependencies.Arch.getNode(1).params; // TODO: Remove hardcoded 1 (=> apply customRules on parsing !, and after changes)
        var range = this.dependencies.Range.getRange();
        var archNode;
        if (range.isCollapsed()) {
            archNode = new TEST(params, null, null, rangeCollapsed);
            this.dependencies.Arch.insert(archNode);
        } else {
            archNode = new TEST(params, null, null, rangeEnd);
            this.dependencies.Arch.insert(archNode, range.ec, range.eo);
            archNode = new TEST(params, null, null, rangeStart);
            this.dependencies.Arch.insert(archNode, range.sc, range.so);
        }
        var result = this.dependencies.Arch.getValue()
            .replace(regExpRangeToCollapsed, rangeCollapsed)
            .replace(regSpace, '&nbsp;')
            .replace(regInvisible, '&#65279;');
        this.dependencies.Arch.getValue('◆◆◆◆◆');
        return result;
    }
    setValue (value) {
        var self = this;
        this.dependencies.Arch.setEditorValue(value);
        var clone = this.dependencies.Arch.getNode(1);
        var options = {
            doCrossUnbreakables: true,
        };
        var start = clone.nextUntil(function (a) { return a.type === 'TEST'; }, options);
        var end = start ? start.nextUntil(function (a) { return a.type === 'TEST'; }, options) : null;

        this.dependencies.Arch.setEditorValue(value.replace(regExpRange, ''));

        var range;
        if (!start) {
            range = {
                scID: 1,
                so: 0,
                ecID: 1,
                eo: 0,
            };
        } else {
            var archNode = this.dependencies.Arch.getNode(1);
            function getRange (o) {
                var offset = 0;
                var path = o.path();
                var prev = o.previousSibling();
                if (prev && prev.isText()) {
                    path[path.length - 1]--;
                    offset += prev.length();
                }
                // if range selection on the same text node
                prev = prev && prev.isText() && prev.previousSibling();
                if (prev && prev.isText()) {
                    path[path.length - 1]--;
                    offset += prev.length();
                }
                var arch = archNode.applyPath(path.slice());
                if (!arch) {
                    offset = path.pop();
                    arch = archNode.applyPath(path.slice());
                }
                var value = {
                    arch: arch,
                    so: offset,
                };
                if (value.arch.id && !o.isRoot()) {
                    self.dependencies.Arch.bypassUpdateConstraints(o.remove.bind(o));
                }
                return value;
            }
            var s = getRange(start);
            var e = getRange(end);
            range = {
                scID: s.arch.id,
                so: s.so,
                ecID: e.arch.id,
                eo: e.so,
            };
        }

        this.dependencies.Range.setRange(range);
    }
    test (assert) {
        var test = false;
        this._plugins.forEach(function (plugin) {
            if (plugin.pluginName === 'TestAutoInstall') {
                test = true;
            }
        });
        assert.ok(test, 'Should find "TestAutoInstall" plugin');
        return Promise.resolve();
    }
    /**
     * Trigger events natively (as opposed to the jQuery way)
     * on the specified target.
     *
     * @param {node} el
     * @param {string []} events
     * @param {object} [options]
     * @returns Promise <Event []>
     */
    triggerNativeEvents (el, events, options) {
        options = _.defaults(options || {}, {
            view: window,
            bubbles: true,
            cancelable: true,
        });
        var isMulti = true;
        if (typeof events === 'string') {
            isMulti = false;
            events = [events];
        }
        var assert = this.options.testAssertObject || this.assert;
        var triggeredEvents = []
        events.forEach(function (eventName) {
            var event;
            switch (_eventType(eventName)) {
                case 'mouse':
                    event = new MouseEvent(eventName, options);
                    break;
                case 'keyboard':
                    event = new KeyboardEvent(eventName, options);
                    break;
                default:
                    event = new Event(eventName, options);
                    break;
            }

            var onerror = window.onerror;
            window.onerror = function (e) {
                window.onerror = onerror;
                console.error(e);
                assert.notOk(e, 'ERROR Event: ' + eventName);
            }
            el.dispatchEvent(event);
            window.onerror = onerror;

            triggeredEvents.push(event);
        });
        return new Promise(function (resolve) {
            setTimeout(function (argument) {
                resolve(isMulti ? triggeredEvents : triggeredEvents[0]);
            }, 0);
        });
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _execAssert (assert, test) {
        if (test.test) {
            var value = this.getValue();
            if (assert.strictEqual(value, test.test, test.name)) {
                return true;
            }
        }
        return false;
    }
    _isTestingVirtualNode (json) {
        return regExpRange.test(json.nodeValue);
    }
    _loadTest (plugin) {
        if (this._isDestroyed) {
            return Promise.resolve();
        }
        var assert = this.options.testAssertObject || this.assert;
        this.triggerUp('set_value', {value: ''});
        assert.ok(true, '<' + plugin.pluginName + '>');
        try {
            return plugin.test(assert);
        } catch (e) {
            assert.notOk(e, 'ERROR');
            return Promise.resolve();
        }
    }
    _loadTests () {
        var self = this;
        var reRun = window.location.search.match(/we3-test=([^&]+)/);
        var promise = Promise.resolve();
        this._plugins.forEach(function (plugin) {
            if (reRun && plugin.pluginName !== reRun[1]) {
                return;
            }
            promise = promise.then(self._loadTest.bind(self, plugin));
        });
        promise.then(this._terminate.bind(this));
    }
    _logFinalResult (nTests, nOKTests) {
        if (nTests - nOKTests === 0) {
            var css = 'background-color: green; color: white;';
            console.info('%cAll ' + nTests + ' tests OK.', css);
        } else {
            console.warn('Result: ' + nOKTests + '/' + nTests + ' passed. ' + (nTests - nOKTests) + ' to go.');
        }
    }
    _pollTest (assert, test) {
        this.setValue(test.content);

        if (test.do) {
            return test.do(assert, test.name).then(this._execAssert.bind(this, assert, test));
        }

        return this._execAssert(assert, test);
    }
    _selectRange (sc, so) {
        var nativeRange = sc.ownerDocument.createRange();
        nativeRange.setStart(sc, so);
        nativeRange.setEnd(sc, so);
        var selection = sc.ownerDocument.getSelection();
        if (selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        selection.addRange(nativeRange);
    }
    _terminate () {
        this._complete = true;
        if (this.options.returnTestResults) {
            this.options.returnTestResults(this._results);
        }
    }
    _textInput (target, char) {
        var ev = new CustomEvent('textInput', {
            bubbles: true,
            cancelBubble: false,
            cancelable: true,
            composed: true,
            data: char,
            defaultPrevented: false,
            detail: 0,
            eventPhase: 3,
            isTrusted: true,
            returnValue: true,
            sourceCapabilities: null,
            type: "textInput",
            which: 0,
        });
        ev.data = char;
        target.dispatchEvent(ev);

         if (!ev.defaultPrevented) {
            document.execCommand("insertText", 0, ev.data);
        }
    }
};


var TestAutoInstall = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Test'];
    }
    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }
    test (assert) {
        return Promise.resolve();
    }
};


we3.addPlugin('Test', TestPlugin);
we3.addPlugin('TestAutoInstall', TestAutoInstall);

})();
