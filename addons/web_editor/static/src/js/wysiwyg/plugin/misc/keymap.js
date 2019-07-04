(function () {
'use strict';

// var Dialog = require('web.Dialog');

var keyMapPlugin = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Keyboard'];
    }
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_help.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.help',
            active: '_active',
            enabled: '_enabled',
        };
        this.editableDomEvents = {
            keydown: '_onKeydown',
        };
        this.codeFromName = {
            'BACKSPACE': 8,
            'TAB': 9,
            'ENTER': 13,
            'SPACE': 32,
            'DELETE': 46,
            // Arrow
            'LEFT': 37,
            'UP': 38,
            'RIGHT': 39,
            'DOWN': 40,
            // Number: 0-9
            'NUM0': 48,
            'NUM1': 49,
            'NUM2': 50,
            'NUM3': 51,
            'NUM4': 52,
            'NUM5': 53,
            'NUM6': 54,
            'NUM7': 55,
            'NUM8': 56,
            // Alphabet: a-z
            'B': 66,
            'E': 69,
            'I': 73,
            'J': 74,
            'K': 75,
            'L': 76,
            'R': 82,
            'S': 83,
            'U': 85,
            'V': 86,
            'Y': 89,
            'Z': 90,
            'SLASH': 191,
            'LEFTBRACKET': 219,
            'BACKSLASH': 220,
            'RIGHTBRACKET': 221
        };
        this.dependencies = ['Range', 'Modal'];

        var self = this;
        this.nameFromCode = {};
        Object.keys(this.codeFromName).forEach(function (key) {
            self.nameFromCode[self.codeFromName[key]] = key;
        });

        var defaults = JSON.parse(JSON.stringify(we3.options.keyMap));
        var mac = Object.assign({}, defaults.mac, this.options.keyMap && this.options.keyMap.mac);
        var pc = Object.assign({}, defaults.pc, this.options.keyMap && this.options.keyMap.pc);
        var help = Object.assign({}, defaults.help, this.options.keyMap && this.options.keyMap.help);
        var keyMap = this.options.env.isMac ? mac : pc;

        this.keyMap = {};
        Object.keys(keyMap).forEach(function (shortcut) {
            var command = keyMap[shortcut];
            if (!command) {
                return;
            }
            var pluginMethod = command.split('.');
            var pluginName = pluginMethod[0];
            var method = pluginMethod[1].split(':');
            self.keyMap[shortcut] = {
                command: command,
                shortcut: shortcut,
                pluginName: pluginName,
                methodName: method[0],
                value: method[1] === 'true' ? true : (method[1] === 'false' ? false : method[1]),
                description: help[command] && self.options.translate('KeyMap', help[command]),
            };
            if (!help[command]) {
                console.info("No description for '" + command + "'");
            }
        });
    }
    /**
     * @see Manager.translatePluginString
     */
    translatePluginTerm (pluginName, value, originalValue, elem, attributeName) {
        if (attributeName !== 'title' || !this.dependencies[pluginName]) {
            return value;
        }
        var methodName = elem.getAttribute('data-method');
        var keyMap = Object.values(this.keyMap);
        for (var k = 0; k < keyMap.length; k++) {
            var item = keyMap[k];
            if (item.pluginName === pluginName && item.methodName === methodName) {
                return value + ' [' + item.shortcut + ']';
            }
        }
        return value;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Restore the hidden close button.
     */
    showHelpDialog () {
        var self = this;
        return new Promise(function (resolve) {
            var fragment = self.options.renderTemplate('KeyMap', 'wysiwyg.help_dialog', {
                keyMap: Object.values(self.keyMap),
            });
            var title = self.options.translate('KeyMap', 'Help');
            self.dependencies.Modal.add(self.pluginName, title, fragment, [], function onClose() {
                resolve({ noChange: true });
            });
        });
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        return false;
    }
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return true;
    }
    _eventToShortcut (ev) {
        var keys = [];
        if (ev.metaKey) {
            keys.push('CMD');
        }
        if (ev.ctrlKey && !ev.altKey) {
            keys.push('CTRL');
        }
        if (ev.shiftKey) {
            keys.push('SHIFT');
        }
        var keyName = this.nameFromCode[ev.keyCode];
        if (keyName) {
            keys.push(keyName);
        }
        return keys.join('+');
    }

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    _onKeydown (ev) {
        if (!ev.keyCode) {
            return;
        }
        var shortcut = this._eventToShortcut(ev);
        var item = shortcut ? this.keyMap[shortcut] : null;

        if (!item) {
            return;
        }

        ev.preventDefault();

        this._parentedParent.call(item.pluginName, item.methodName, [item.value, this.dependencies.Range.getRange()]);
    }
};

we3.addPlugin('KeyMap', keyMapPlugin);

})();
