(function () {
'use strict';

var id = 0;
var PluginsManager = we3.PluginsManager;
var utils = we3.utils;

we3.Editor = class extends we3.EventDispatcher {
    constructor (parent, params) {
        super(parent);
        if (!params) {
            params = parent;
            parent = null;
        }
        var self = this;
        this.editorEvents = {
            'mousedown document': '_onMouseDown',
            'mouseenter document': '_onMouseEnter',
            'mouseleave document': '_onMouseLeave',
            'mousemove document': '_onMouseMove',
            'blur editable': '_onBlurEditable',
            'focus editable': '_onFocusEditable',
            'paste editable': '_onPaste',
        };
        this._templates = {};
        this.id = 'wysiwyg-' + (++id);

        this.editor = document.createElement('we3-editor');
        this.container = document.createElement('we3-editable-container');
        this.editable = document.createElement('we3-editable');
        this.editable.contentEditable = 'true';

        this._editableContainer = [];
        this.beforeContainer = [];
        this.afterContainer = [];
        this.beforeEditable = [];
        this.afterEditable = [];

        this._saveEventMethods();
        this._prepareOptions(params);

        this._pluginsManager = new PluginsManager(this, {
                id: this.id,
                plugins: this.plugins,
                editable: this.editable,
                editor: this.editor,
                addEditableContainer (node) {
                    if (self._isInsertEditableInContainers) {
                        throw new Error("Plugin content allready inserted, you can't change the container");
                    } else {
                        self._editableContainer.push(node);
                    }
                },
                insertBeforeContainer (node) {
                    if (self._isInsertEditableContainers) {
                        self.editor.insertBefore(node, self.editor.firstChild);
                    } else {
                        self.beforeContainer.push(node);
                    }
                },
                insertAfterContainer (node) {
                    if (self._isInsertEditableContainers) {
                        self.editor.appendChild(node);
                    } else {
                        self.afterContainer.push(node);
                    }
                },
                insertBeforeEditable (node) {
                    if (self._isInsertEditableInContainers) {
                        self.editable.parentNode.insertBefore(node, self.editable.parentNode.firstChild);
                    } else {
                        self.beforeEditable.push(node);
                    }
                },
                insertAfterEditable (node) {
                    if (self._isInsertEditableInContainers) {
                        self.editable.parentNode.appendChild(node);
                    } else {
                        self.afterEditable.push(node);
                    }
                },
            },
            this.options);
    }
    start (target) {
        var self = this;
        if (target.wysiwygEditor) {
            target.wysiwygEditor.destroy();
        }
        this.target = target;
        this.target.wysiwygEditor = this;
        this.target.dataset.dataWysiwygId = this.id;

        this.on('wysiwyg_blur', this, this._onBlurCustom.bind(this));
        this.on('command', this, function () { throw new Error(); });
        this.on('get_value', this, this._onGetValue.bind(this));
        this.on('set_value', this, this._onSetValue.bind(this));

        return this.isInitialized().then(function () {
            if (self._isDestroyed) {
                return;
            }
            self._insertEditorContainers();
            self._insertEditableInContainers();
            return self._pluginsManager.start();
        }).then(function () {
            if (self._isDestroyed) {
                return;
            }
            self._afterStartAllPlugins();
            if (self.target.tagName !== "TEXTAREA") {
                self._targetID = self.target.id;
                self._targetClassName = self.target.className;
                self.target.removeAttribute('id');
                self.editable.id = self._targetID;
                self.editable.className = self._targetClassName;
            }
        });
    }
    destroy () {
        this._isDestroyed = true;
        if (this.editor && this.editor.parentNode) {
            this.editor.parentNode.removeChild(this.editor);
            this._destroyEvents();
        }
        if (this.target) {
            this.target.wysiwygEditor = null;
            this.target.id = this._targetID;
            this.target.className = this._targetClassName;
            this.target.style.display = '';
        }
        super.destroy();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Cancel the edition and destroy the editor.
     */
    cancel () {
        this._pluginsManager.cancelEditor();
        this.destroy();
    }
    /**
     * Set the focus on the element.
     */
    focus () {
        this.editable.focus();
    }
    /**
     * Get the value of the editable element.
     *
     * @returns {String}
     */
    getValue (options) {
        // $editable.find('.o_wysiwyg_to_remove').remove();
        // $editable.find('[contenteditable]').removeAttr('contenteditable');
        // $editable.find('.o_fake_not_editable').removeClass('o_fake_not_editable');
        // $editable.find('.o_fake_editable').removeClass('o_fake_editable');
        // $editable.find('[class=""]').removeAttr('class');
        // $editable.find('[style=""]').removeAttr('style');
        // $editable.find('[title=""]').removeAttr('title');
        // $editable.find('[alt=""]').removeAttr('alt');
        // // $editable.find('a.o_image, span.fa, i.fa').html('');
        // $editable.find('[aria-describedby]').removeAttr('aria-describedby').removeAttr('data-original-title');

        return this._pluginsManager.getEditorValue(null, options);
    }
    /**
     * Return true if the content has changed.
     *
     * @returns {Boolean}
     */
    isDirty () {
        var isDirty = this._value !== this.getValue();
        if (!this._dirty && isDirty) {
            console.warn("not dirty flag ? Please fix it.");
        }
        return isDirty;
    }
    isInitialized () {
        return this._pluginsManager.isInitialized();
    }
    /**
     * Save the content in the target
     *      - in init option beforeSave
     *      - receive editable jQuery DOM as attribute
     *      - called after deactivate codeview if needed
     * @returns {Promise}
     *      - resolve with true if the content was dirty
     */
    save () {
        var self = this;
        var isDirty = this.isDirty();
        return this._pluginsManager.saveEditor().then(function (html) {
            self.target.innerText = html;
            self.target.innerHTML = html;
            return {
                isDirty: isDirty,
                value: html,
            };
        });
    }
    /**
     * @param {String} value
     */
    setValue (value) {
        this._pluginsManager.setEditorValue(value || '');
        this.triggerUp('change');
    }
    reset (value) {
        this._value = value || this._value;
        this._pluginsManager.setEditorValue(this._value);
        this._dirty = false;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Bind the events defined in the editorEvents property.
     *
     * @private
     */
    _bindEvents () {
        var self = this;
        this.editorEvents.forEach(function (event) {
            if (event.target === 'document') {
                window.top.document.addEventListener(event.name, event.method, true);
                self.editable.ownerDocument.addEventListener(event.name, event.method, false);
            } else {
                self[event.target].addEventListener(event.name, event.method, false);
            }
        });
    }
    _insertEditorContainers () {
        this._isInsertEditableContainers = true;
        this.editor.style.display = 'none';
        this.editor.id = this.id;
        if (this.target.nextSibling) {
            this.target.parentNode.insertBefore(this.editor, this.target.nextSibling);
        } else if (this.target.parentNode) {
            this.target.parentNode.appendChild(this.editor);
        } else {
            console.info("Can't insert this editor on a node without any parent");
        }
        var node;
        var editableContainer = this.editor;
        while (node = this.beforeContainer.pop()) {
            this.editor.appendChild(node);
        }
        while (node = this._editableContainer.shift()) {
            editableContainer.appendChild(node);
            editableContainer = node;
        }

        editableContainer.appendChild(this.container);

        while (node = this.afterContainer.pop()) {
            this.editor.appendChild(node);
        }
    }
    _insertEditableInContainers () {
        this._isInsertEditableInContainers = true;
        var node;
        while (node = this.beforeEditable.pop()) {
            this.container.appendChild(node);
        }
        this.container.appendChild(this.editable);
        while (node = this.afterEditable.shift()) {
            this.container.appendChild(node);
        }
    }
    /**
     * Destroy all events defined in `editorEvents`.
     */
    _destroyEvents () {
        var self = this;
        this.editorEvents.forEach(function (event) {
            if (event.target === 'document') {
                window.top.document.removeEventListener(event.name, event.method, true);
                self.editable.removeEventListener(event.name, event.method, false);
            } else {
                self[event.target].removeEventListener(event.name, event.method, false);
            }
        });
    }
    /**
     * Return a list of the descendents of the current object.
     *
     * @private
     */
    _getDecendents () {
        var children = this.getChildren();
        var descendents = [];
        var child;
        while ((child = children.pop())) {
            descendents.push(child);
            children = children.concat(child.getChildren());
        }
        return descendents;
    }
    /**
     * Method to call after completion of the `start` method.
     *
     * @private
     */
    _afterStartAllPlugins () {
        this.target.style.display = 'none';
        this.editor.style.display = '';
        var value = this.target[this.target.tagName === "TEXTAREA" ? 'value' : 'innerHTML'];
        this.reset(value);
        this._bindEvents();
    }
    /**
     * Return true if the given node is in the editor.
     * Note: a button in the MediaDialog returns true.
     *
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    _isEditorContent (node) {
        if (this.editor === node || this.editor.contains(node)) {
            return true;
        }

        var descendents = this._getDecendents().map(function (obj) {
            return Object.values(obj);
        });
        descendents = utils.uniq(utils.flatten(descendents));
        var childrenDom = descendents.filter(function (pluginNode) {
            return pluginNode && pluginNode.DOCUMENT_NODE &&
                pluginNode.tagName && pluginNode.tagName !== 'BODY' && pluginNode.tagName !== 'HTML' &&
                pluginNode.contains(node);
        });
        return !!childrenDom.length;
    }
    /**
     * Return the last added, non-null element in an array.
     *
     * @private
     * @param {any []} array
     * @returns {any}
     */
    _unstack (array) {
        var result = null;
        for (var k = array.length - 1; k >= 0; k--) {
            if (array[k] !== null) {
                result = array[k];
                break;
            }
        }
        return result;
    }
    /**
     * @todo Remove JQuery
     * @private
     * @param {Object} params
     */
    _prepareOptions (params) {
        var self = this;
        params = utils.deepClone(params);
        var defaults = (function def (defaults) {
            defaults = defaults && defaults.slice ? defaults.slice() : Object.assign({}, defaults);
            Object.keys(defaults).forEach(function (key) {
                var val = defaults[key];
                if (val && typeof val === 'object' && !('ignoreCase' in val && val.test) && (typeof val.style !== "object" || typeof val.ownerDocument !== "object")) {
                    defaults[key] = def(val);
                }
            });
            return defaults;
        })(we3.options);
        utils.defaults(params, defaults);
        utils.defaults(params.env, defaults.env);
        utils.defaults(params.plugins, defaults.plugins);
        utils.defaults(params, {
            loadTemplates: this._loadTemplates.bind(this),
            renderTemplate: this._renderTemplate.bind(this),
            translateTemplateNodes: this._translateTemplateNodes.bind(this),
            translate: this._translateString.bind(this),
        });

        var superGetXHR = this._getXHR.bind(this);
        var getXHR = params.getXHR || superGetXHR;
        params.getXHR = function (pluginName, url, values) {
            return getXHR(pluginName, url, values, superGetXHR);
        };

        var renderTemplate = params.renderTemplate;
        params.renderTemplate = function (pluginName, template, values) {
            var fragment = document.createElement('we3-fragment');
            fragment.innerHTML = renderTemplate(pluginName, template, values);
            self.options.translateTemplateNodes(pluginName, fragment);
            return fragment.innerHTML;
        },
        params.hasFocus = function () {return self._isFocused;};

        this.plugins = params.plugins;
        delete params.plugins;
        this.options = utils.deepFreeze(utils.deepClone(params));
    }
    /**
     * @param {string[]} templatesDependencies
     * @returns {Promise}
     */
    _loadTemplates (templatesDependencies) {
        var xmlPath;
        var promises = [];
        var _onLoadTemplates = this._onLoadTemplates.bind(this);
        while ((xmlPath = templatesDependencies.shift())) {
            promises.push(null, this.options.getXHR(xmlPath).then(_onLoadTemplates));
        }
        return Promise.all(promises);
    }
    _getXHR (pluginName, url, values) {
        url = url[0] === '/' ? url : this.options.xhrPath + url;
        return new Promise(function (resolve) {
            var oReq = new XMLHttpRequest();
            oReq.addEventListener("load", function (html) {
                resolve(this.responseText);
            });
            oReq.addEventListener("error", resolve);
            var getValues = Object.keys(values || {}).map(function (key) {
                return escape(key) + '=' + escape(values[key]);
            });
            oReq.open("GET", url + (getValues.length ? '?' + getValues.join('&') : ''));
            oReq.send();
        });
    }
    /**
     * @param {string} pluginName
     * @param {string} template
     * @param {any} values
     * @returns {string}
     */
    _renderTemplate (pluginName, template, values) {
        if (!(template in this._templates)) {
            throw new Error('Template "' + template + '" not found.');
        }
        return this._templates[template];
    }
    /**
     * @param {string} pluginName
     * @param {element} node
     * @returns {string}
     */
    _translateTemplateNodes (pluginName, node) {
        var self = this;
        var regExpText = /^([\s\n\r\t]*)(.*?)([\s\n\r\t]*)$/;
        var attributesToTranslate = ['title', 'alt', 'help', 'placeholder', 'aria-label'];
        (function translateNodes(elem) {
            if (elem.attributes) {
                Object.values(elem.attributes).forEach(function (attribute) {
                    if (attributesToTranslate.indexOf(attribute.name) !== -1) {
                        var text = attribute.value.match(regExpText);
                        if (text && text[2].length) {
                            var value = text[1] + self.options.translate(pluginName, text[2]) + text[3];
                            value = self._pluginsManager.translatePluginString(pluginName, value, text[2], elem, attribute.name);
                            attribute.value = value;
                        }
                    }
                });
            }

            var nodes = elem.childNodes;
            var i = nodes.length;
            while (i--) {
                var node = nodes[i];
                if (node.nodeType == 3) {
                    var text = node.nodeValue.match(regExpText);
                    if (text && text[2].length) {
                        var value = text[1] + self.options.translate(pluginName, text[2]) + text[3];
                        value = self._pluginsManager.translatePluginString(pluginName, value, text[2], node, 'nodeValue');
                        node.nodeValue = value;
                    }
                } else if (node.nodeType == 1 || node.nodeType == 9 || node.nodeType == 11) {
                    translateNodes(node);
                }
            }
        })(node);
    }
    /**
     * @param {string} pluginName
     * @param {string} string
     * @returns {string}
     */
    _translateString (pluginName, string) {
        string = string.replace(/\s\s+/g, ' ');
        if (this.options.lang && this.options.lang[string]) {
            return this.options.lang[string];
        }
        console.warn("Missing translation: " + string);
        return string;
    }
    /**
     * Save all event methods defined in editorEvents for safe destruction.
     *
     * @private
     */
    _saveEventMethods () {
        var self = this;
        var events = [];
        Object.keys(this.editorEvents).forEach(function (key) {
            var parts = key.split(' ');
            events.push({
                name: parts[0],
                target: parts[1],
                method: self[self.editorEvents[key]].bind(self),
            });
        });
        this.editorEvents = events;
    }
    _mouseEventFocus () {
        this._onMouseDownTime = null;
        if (!this._editableHasFocus && !this._isEditorContent(document.activeElement)) {
            this.editable.focus();
        }
        if (!this._isFocused) {
            this._isFocused = true;
            this._onFocus();
        }
    }

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * triggerUp 'blur'.
     *
     * @private
     * @param {Object} [options]
     */
    _onBlur (options) {
        this._pluginsManager.blurEditor();
        this.triggerUp('blur', options);
    }
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onBlurEditable () {
        var self = this;
        this._editableHasFocus = false;
        if (!this._isFocused) {
            return;
        }
        if (!this._justFocused && !this._mouseInEditor) {
            if (this._isFocused) {
                this._isFocused = false;
                this._onBlur();
            }
        } else if (!this._forceEditableFocus) {
            this._forceEditableFocus = true;
            setTimeout(function () {
                if (!self._isEditorContent(document.activeElement)) {
                    self.editable.focus();
                }
                self._forceEditableFocus = false; // prevent stack size exceeded.
            });
        } else {
            this._mouseInEditor = null;
        }
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onBlurCustom (ev) {
        ev.stopPropagation();
        this._isFocused = false;
        this._forceEditableFocus = false;
        this._mouseInEditor = false;
        this.target.focus();
        this._onBlur(ev.data);
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onCommand (ev) {
        var self = this;
        ev.stopPropagation();
        // if (ev.data.disableRange) {
        //     this._pluginsManager.call('Range', 'clear');
        // } else {
        //     this._pluginsManager.call('Range', 'save');
        // }
        Promise.all([ev.data.method.apply(null, ev.data.args)]).then(function (result) {
            // if (!ev.data.disableRange) {
            //     self._pluginsManager.call('Range', 'restore');
            // }
            if (result && result.noChange) {
                return;
            }
            self._pluginsManager.changeEditorValue();
            self.triggerUp('change');
            if (ev.data.callback) {
                ev.data.callback(result);
            }
        });
    }
    /**
     * triggerUp 'wysiwyg_focus'.
     *
     * @private
     * @param {Object} [options]
     */
    _onFocus (options) {
        this._pluginsManager.focusEditor();
        this.triggerUp('focus', options);
    }
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onFocusEditable () {
        var self = this;
        this._editableHasFocus = true;
        this._justFocused = true;
        setTimeout(function () {
            self._justFocused = true;
        });
    }
    /**
     * @private
     * @param {OdooEvent} ev
     * @return {any}
     */
    _onGetValue (ev) {
        return ev.data.callback(this.getValue(ev.data.options || {}));
    }
    /**
     * @private
     * @param {string} html
     */
    _onLoadTemplates (html) {
        var self = this;
        var fragment = document.createElement('we3-fragment');
        fragment.innerHTML = html;
        fragment.querySelectorAll('[t-name]').forEach(function (template) {
            var templateName = template.getAttribute('t-name');
            template.removeAttribute('t-name');
            self._templates[templateName] = template.tagName === 'T' ? template.innerHTML : template.outerHTML;
        });
    }
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseDown (ev) {
        if (this._isEditorContent(ev.target)) {
            this._mouseEventFocus();
            this._onMouseDownTime = setTimeout(this._mouseEventFocus.bind(this));
        } else if (this._isFocused) {
            this._isFocused = false;
            this._onBlur();
        }
    }
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseEnter (ev) {
        if (this._isFocused && !this._mouseInEditor && this._isEditorContent(ev.target)) {
            this._mouseInEditor = true;
        }
    }
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseLeave () {
        if (this._isFocused && this._mouseInEditor) {
            this._mouseInEditor = null;
        }
    }
    /**
     * @private
     * @param {jQueryEvent} ev
     */
    _onMouseMove (ev) {
        if (this._mouseInEditor === null) {
            this._mouseInEditor = !!this._isEditorContent(ev.target);
        }
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onPaste (ev) {
        ev.preventDefault();
    }
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSetValue (ev) {
        this.setValue(ev.data.value);
    }
};

})();
