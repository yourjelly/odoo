(function () {
'use strict';


var TestVirtualKeyboard = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Test'];

        this.value = "<p>.◆.</p>";
        this.updatedValue = "<p>.iô</p><p>◆.</p>";
        this.updatedDom = "<p>.iô</p><p>.</p>";

        this.completion = "<p>.chi◆.</p>";
        this.completionValue = "<p>.Christophe ◆.</p>";
        this.completionDom = "<p>.Christophe .</p>";

        this.completionBold = "<p>.<b>chr</b>is◆ .</p>";
        this.completionBoldValue = "<p>.<b>Christophe</b> ◆.</p>";
        this.completionBoldDom = "<p>.<b>Christophe</b> .</p>";
    }

    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    async test (assert) {
        var tests = Object.getOwnPropertyNames(TestVirtualKeyboard.prototype).filter(function (name) {
            return !name.indexOf('_test');
        });
        for (var k = 0; k < tests.length; k++) {
            var name = tests[k];
            assert.ok(true, "test: " + name);
            await this[name](assert);
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    async _testMultikeypress (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue("<p>aaa◆</p>");

        await this._triggerKey([
            // key down char without key up
            ['keydown', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
            ['keypress', {
                key: 'i',
                charCode: 105,
                keyCode: 105,
            }],
            ['beforeInput', {
                data: 'i',
            }],
            ['input', {
                data: 'i',
                insert: 'i',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            // Backspace down char without key up
            ['keydown', {
                key: 'Backspace',
                charCode: 0,
                keyCode: 8,
            }],
            ['beforeInput', {
                inputType: 'deleteContentBackward',
            }],
            ['input', {
                inputType: 'deleteContentBackward',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            // Space down char without key up
            ['keydown', {
                key: ' ',
                charCode: 0,
                keyCode: 32,
            }],
            ['keypress', {
                key: ' ',
                charCode: 32,
                keyCode: 32,
            }],
            ['beforeInput', {
                data: ' ',
            }],
            ['input', {
                data: ' ',
                insert: ' ',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            // keyup
            ['keyup', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Backspace',
                charCode: 0,
                keyCode: 8,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: ' ',
                charCode: 0,
                keyCode: 32,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), "<p>aaa&nbsp;◆</p>", "Should insert a space in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), "<p>aaa&nbsp;</p>", "Should insert a space in the DOM");
    }
    async _testMultikeypressCTRLA (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue("<p>aaa◆</p>");

        await this._triggerKey([
            ['keydown', {
                key: 'Control',
                charCode: 0,
                keyCode: 17,
                ctrlKey: true,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keydown', {
                key: 'a',
                charCode: 0,
                keyCode: 65,
                ctrlKey: true,
            }],
            ['keypress', {
                key: 'a',
                charCode: 1,
                keyCode: 1,
                ctrlKey: true,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'a',
                charCode: 0,
                keyCode: 73,
                ctrlKey: true,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Control',
                charCode: 0,
                keyCode: 17,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), "<p>▶aaa◀</p>", "Should select all in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), "<p>aaa</p>", "Should select all in the DOM without changes");
    }

    async _testAccentUbuntuChrome (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.value);

        // i
        await this._triggerKey([
            ['keydown', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
            ['keypress', {
                key: 'i',
                charCode: 105,
                keyCode: 105,
            }],
            ['beforeInput', {
                data: 'i',
            }],
            ['input', {
                data: 'i',
                insert: 'i',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
        ]);

        await new Promise(setTimeout);

        // ^
        await this._triggerKey([
            ['keyup', {
                key: 'Dead',
                charCode: 0,
                keyCode: 219,
            }],
        ]);

        await new Promise(setTimeout);

        // o
        await this._triggerKey([
            ['keydown', {
                key: 'o',
                charCode: 0,
                keyCode: 79,
            }],
            ['keypress', {
                key: 'ô',
                charCode: 244,
                keyCode: 244,
            }],
            ['beforeInput', {
                data: 'ô',
            }],
            ['input', {
                data: 'ô',
                insert: 'ô',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'o',
                charCode: 0,
                keyCode: 79,
            }],
        ]);

        await new Promise(setTimeout);

        // Enter
        await this._triggerKey([
            ['keydown', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
            ['keypress', {
                key: 'Enter',
                charCode: 13,
                keyCode: 13,
            }],
            ['beforeInput', {
                data: 'null',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.updatedValue, "Should insert the char, accent and enter in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.updatedDom, "Should insert the char, accent and enter in the DOM");
    }
    async _testAccentUbuntuFireFox (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.value);

        // i
        await this._triggerKey([
            ['keydown', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
            ['keypress', {
                key: 'i',
                charCode: 105,
                keyCode: 105,
            }],
            ['input', {
                insert: 'i',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
        ]);

        await new Promise(setTimeout);

        // ^
        await this._triggerKey([
            ['keydown', {
                key: 'Dead',
                charCode: 0,
                keyCode: 0,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Dead',
                charCode: 0,
                keyCode: 0,
            }],
        ]);

        await new Promise(setTimeout);

        // o
        await this._triggerKey([
            ['keydown', {
                key: 'ô',
                charCode: 0,
                keyCode: 79,
            }],
            ['keypress', {
                key: 'ô',
                charCode: 244,
                keyCode: 244,
            }],
            ['input', {
                insert: 'ô',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'o',
                charCode: 0,
                keyCode: 79,
            }],
        ]);

        await new Promise(setTimeout);

        // Enter
        await this._triggerKey([
            ['keydown', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
            ['keypress', {
                key: 'Enter',
                charCode: 13,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.updatedValue, "Should insert the char, accent and enter in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.updatedDom, "Should insert the char, accent and enter in the DOM");
    }
    async _testAccentMacSafari (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.value);

        // i
        await this._triggerKey([
            ['keydown', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
            ['keypress', {
                key: 'i',
                charCode: 105,
                keyCode: 105,
            }],
            ['beforeInput', {
                data: 'i',
            }],
            ['input', {
                data: 'i',
                insert: 'i',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
        ]);

        await new Promise(setTimeout);

        // ^
        await this._triggerKey([
            ['compositionstart', {
            }],
            ['compositionupdate', {
                data: '^',
            }],
            ['beforeInput', {
                data: '^',
            }],
            ['input', {
                data: '^',
                insert: '^',
                inputType: 'textInput',
            }],
            ['keydown', {
                key: 'Dead',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: '^',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        // o
        await this._triggerKey([
            ['beforeInput', {
                data: 'null',
                inputType: 'deleteContentBackward',
            }],
            ['input', {
                data: 'null',
                inputType: 'deleteContentBackward',
            }],
            ['beforeInput', {
                data: 'ô',
            }],
            ['input', {
                data: 'ô',
                inputType: 'textInput',
            }],
            ['compositionend', {
                data: 'ô',
            }],
            ['keydown', {
                key: 'ô',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        var textNode = this.editable.querySelector('p').firstChild;
        textNode.textContent = '.iô.';
        this._selectDOMRange(textNode, 3);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'o',
                charCode: 0,
                keyCode: 79,
            }],
        ]);

        // Enter
        await this._triggerKey([
            ['keydown', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
            ['keypress', {
                key: 'Enter',
                charCode: 13,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.updatedValue, "Should insert the char, accent and enter in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.updatedDom, "Should insert the char, accent and enter in the DOM");
    }
    async _testAccentMacChrome (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.value);

        // i
        await this._triggerKey([
            ['keydown', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
            ['keypress', {
                key: 'i',
                charCode: 105,
                keyCode: 105,
            }],
            ['beforeInput', {
                data: 'i',
            }],
            ['input', {
                data: 'i',
                insert: 'i',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
        ]);

        await new Promise(setTimeout);

        // ^
        await this._triggerKey([
            ['keydown', {
                key: 'Dead',
                charCode: 0,
                keyCode: 229,
            }],
            ['compositionstart', {
            }],
            ['beforeInput', {
                data: '^',
            }],
            ['compositionupdate', {
                data: '^',
            }],
            ['input', {
                data: '^',
                insert: '^',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Dead',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        // o
        await this._triggerKey([
            ['keydown', {
                key: 'ô',
                charCode: 0,
                keyCode: 229,
            }],
            ['beforeInput', {
                data: 'ô',
            }],
            ['compositionupdate', {
                data: 'ô',
            }],
            ['input', {
                data: 'ô',
                insert: 'ô',
                inputType: 'textInput',
            }],
            ['compositionend', {
                data: 'ô',
            }],
        ]);

        var textNode = this.editable.querySelector('p').firstChild;
        textNode.textContent = '.iô.';
        this._selectDOMRange(textNode, 3);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'o',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        // Enter
        await this._triggerKey([
            ['keydown', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
            ['keypress', {
                key: 'Enter',
                charCode: 13,
                keyCode: 13,
            }],
            ['beforeInput', {
                data: 'null',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.updatedValue, "Should insert the char, accent and enter in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.updatedDom, "Should insert the char, accent and enter in the DOM");
    }
    async _testAccentMacFirefox (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.value);

        // i
        await this._triggerKey([
            ['keydown', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
            ['keypress', {
                key: 'i',
                charCode: 105,
                keyCode: 105,
            }],
            ['input', {
                data: 'i',
                insert: 'i',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'i',
                charCode: 0,
                keyCode: 73,
            }],
        ]);

        await new Promise(setTimeout);

        // ^
        await this._triggerKey([
            ['keydown', {
                key: 'Dead',
                charCode: 0,
                keyCode: 160,
            }],
            ['compositionstart', {
            }],
            ['compositionupdate', {
                data: '^',
            }],
            ['input', {
                data: '^',
                insert: '^',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: '^',
                charCode: 0,
                keyCode: 160,
            }],
        ]);

        await new Promise(setTimeout);

        // o
        await this._triggerKey([
            ['keydown', {
                key: 'ô',
                charCode: 0,
                keyCode: 79,
            }],
            ['compositionupdate', {
                data: 'ô',
            }],
            ['compositionend', {
                data: 'ô',
            }],
            ['input', {
                data: 'ô',
                insert: 'ô',
                inputType: 'textInput',
            }],
        ]);

        var textNode = this.editable.querySelector('p').firstChild;
        textNode.textContent = '.iô.';
        this._selectDOMRange(textNode, 3);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'o',
                charCode: 0,
                keyCode: 79,
            }],
        ]);

        await new Promise(setTimeout);

        // Enter
        await this._triggerKey([
            ['keydown', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
            ['keypress', {
                key: 'Enter',
                charCode: 13,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.updatedValue, "Should insert the char, accent and enter in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.updatedDom, "Should insert the char, accent and enter in the DOM");
    }
    async _testAccentSwiftKey (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.value);

        // i
        await this._triggerKey([
            ['keydown', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
            ['beforeInput', {
                data: 'i',
            }],
            ['input', {
                data: 'i',
                insert: 'i',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        // ô
        await this._triggerKey([
            ['keydown', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
            ['beforeInput', {
                data: 'ô',
            }],
            ['input', {
                data: 'ô',
                insert: 'ô',
                inputType: 'textInput',
            }],
        ]);

        var textNode = this.editable.querySelector('p').firstChild;
        textNode.textContent = '.iô.';
        this._selectDOMRange(textNode, 3);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        // Enter
        await this._triggerKey([
            ['keydown', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
            ['beforeInput', {
                data: 'null',
                inputType: 'insertLineBreak',
            }],
            ['keypress', {
                key: 'Enter',
                charCode: 13,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Enter',
                charCode: 0,
                keyCode: 13,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.updatedValue, "Should insert the char, accent and enter in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.updatedDom, "Should insert the char, accent and enter in the DOM");
    }

    async _testCompletionSwiftKey (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.completion);

        // s
        await this._triggerKey([
            ['keydown', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
            ['beforeInput', {
                data: 's',
            }],
            ['input', {
                data: 's',
                insert: 's',
                inputType: 'textInput',
            }],
        ]);

        await new Promise(setTimeout);

        await this._triggerKey([
            ['keyup', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        // Christophe
        await this._triggerKey([
            ['compositionstart', {
                data: '',
            }],
            ['compositionupdate', {
                data: 'chris',
            }],
            ['keydown', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
            ['beforeInput', {
                data: 'Christophe',
                inputType: 'insertCompositionText',
            }],
            ['compositionupdate', {
                data: 'Christophe',
            }],
        ]);

        var textNode = this.editable.querySelector('p').firstChild;
        textNode.textContent = '.Christophe.';
        this._selectDOMRange(textNode, 11);

        await this._triggerKey([
            ['keyup', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
            ['compositionend', {
                data: 'Christophe',
            }],

            // auto add space after autocompletion (if no space after)

            ['keydown', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
            ['beforeInput', {
                data: ' ',
            }],
            ['input', {
                data: ' ',
                insert: ' ',
                inputType: 'textInput',
            }],
            ['keyup', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.completionValue, "Should insert the word in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.completionDom, "Should insert the word in the DOM");
    }

    async _testCompletionWithBoldSwiftKey (assert) {
        var ev;
        var Test = this.dependencies.Test;
        await Test.setValue(this.completionBold);

        // Christophe
        await this._triggerKey([
            ['compositionstart', {
            }],
            ['compositionupdate', {
                data: 'chris',
            }],
            ['keydown', {
                key: 'Unidentified',
                charCode: 0,
                keyCode: 229,
            }],
            ['beforeInput', {
                data: 'Christophe',
                inputType: 'insertCompositionText',
            }],
            ['compositionupdate', {
                data: 'Christophe',
            }],
            ['input', {
                data: 'Christophe',
                inputType: 'insertCompositionText',
            }],
        ]);

        var p = this.editable.querySelector('p');
        p.removeChild(p.firstChild);
        p.firstChild.removeChild(p.firstChild.firstChild);
        p.removeChild(p.firstChild);

        var text = document.createTextNode('.');
        p.insertBefore(text, p.lastChild);

        var b = document.createElement('b');
        b.innerHTML = 'Christophe';
        p.insertBefore(b, p.lastChild);

        p.lastChild.nodeValue = '\u00A0.';

        this._selectDOMRange(b.firstChild, b.firstChild.textContent.length);

        await this._triggerKey([
            ['compositionend', {
                data: 'Christophe',
            }],
        ]);

        await new Promise(setTimeout);

        assert.strictEqual(this.dependencies.Test.getValue(), this.completionBoldValue, "Should insert the word in the Arch");
        assert.strictEqual(this.dependencies.Test.getDomValue(), this.completionBoldDom, "Should insert the word in the DOM");
    }

    async _triggerKey (data) {
        var ev, e;
        for (var k = 0; k < data.length; k++) {
            e = data[k];
            if (ev && e[0] !== 'keydown' && e[0] !== 'keyup' && ev.defaultPrevented) {
                continue;
            }
            if (e[0] === 'textInput' || e[1].inputType === 'textInput') {
                ev = this._triggerTextInput(e[1].data, e[1].insert);
            } else {
                var o = Object.assign({}, e[1]);
                if (e[0] === 'keypress') {
                    o.noTextInput = true;
                }
                ev = await this.dependencies.Test.triggerNativeEvents(this.editable, e[0], o);
            }
        }
    }
    /**
     * @private
     * @param {string} data
     * @param {string} insert
     */
    _triggerTextInput (data, insert) {
        var ev = new (window.InputEvent || window.CustomEvent)('textInput', {
            bubbles: true,
            cancelBubble: false,
            cancelable: true,
            composed: true,
            data: data,
            defaultPrevented: false,
            detail: 0,
            eventPhase: 3,
            isTrusted: true,
            returnValue: true,
            sourceCapabilities: null,
            inputType: 'textInput',
            which: 0,
        });
        this.editable.dispatchEvent(ev);
        if (!ev.defaultPrevented && insert) {
            this.document.execCommand("insertText", 0, insert);
        }
    }

    _selectDOMRange (node, offset) {
        var nativeRange = node.ownerDocument.createRange();
        nativeRange.setStart(node, offset);
        nativeRange.setEnd(node, offset);
        var selection = node.ownerDocument.getSelection();
        if (selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        selection.addRange(nativeRange);
    }
};


we3.addPlugin('TestVirtualKeyboard', TestVirtualKeyboard);

})();
