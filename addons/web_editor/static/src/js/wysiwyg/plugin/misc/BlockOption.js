(function () {
'use strict';

var BlockOptionHandler = class extends we3.EventDispatcher {
    /**
     * @abstract
     * @param {HTMLElement} target
     * @param {HTMLElement} ui
     * @param {HTMLElement} overlay
     */
    constructor(target, ui, overlay) {
        super(...arguments);
        this.target = target;
        this.ui = ui;
        this.overlay = overlay;

        this.__methodNames = [];

        // TODO event delegation
        this.ui.querySelectorAll('we3-button').forEach(button => {
            button.addEventListener('mouseenter', this._onButtonEnter.bind(this));
            button.addEventListener('click', this._onButtonClick.bind(this));
            button.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        });

        this._setActive();
    }
    /**
     * Called when the edition overlay is covering the associated snippet
     * (the first time, this follows the call to the @see start method).
     *
     * FIXME only the first time is called right now...
     *
     * @abstract
     */
    onFocus() {}
    /**
     * Called when a block is copied - @see CustomizeBlock
     * The method is in charge of updating the relevant target according to it.
     *
     * @abstract
     * @param {Object} options
     * @param {boolean} options.isCurrent
     *        true if the associated snippet is a clone of the main element that
     *        was cloned (so not a clone of a child of this main element that
     *        was cloned)
     */
    onClone(options) {}
    /**
     * @abstract
     */
    onForeignOptionChange() {}
    /**
     * @abstract
     */
    onForeignOptionPreview() {}

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Default option method which allows to select one and only one class in
     * the option classes set and set it on the associated snippet. The common
     * case is having a subset with each item having a `data-select-class`
     * value allowing to choose the associated class.
     *
     * @param {boolean|string} previewMode
     *        - truthy if the option is enabled for preview or if leaving it (in
     *          that second case, the value is 'reset')
     *        - false if the option should be activated for good
     * @param {*} value - the class to activate (opt.dataset.selectClass)
     * @param {DOMElement} opt
     */
    selectClass(previewMode, value, opt) {
        var group = this.ui;
        while (opt !== this.ui) {
            if (opt.tagName === 'we3-collapse-area') {
                group = opt;
            }
            opt = opt.parentNode;
        }

        group.querySelectorAll('[data-select-class]').forEach(el => {
            el.dataset.selectClass.split(' ').forEach(className => {
                this._removeClass(this.target, previewMode, className);
            });
        });
        if (value) {
            this._addClass(this.target, previewMode, value);
        }
    }
    /**
     * Default option method which allows to select one or multiple classes in
     * the option classes set and set it on the associated snippet. The common
     * case is having a subset with each item having a `data-toggle-class`
     * value allowing to toggle the associated class.
     *
     * @see this.selectClass
     */
    toggleClass(previewMode, value, opt) {
        this.ui.querySelectorAll('[data-toggle-class]').forEach(el => {
            el.dataset.toggleClass.split(' ').forEach(className => {
                this._toggleClass(this.target, previewMode, className, el.classList.contains('active'));
            });
        });
        if (value && previewMode !== 'reset') {
            this._toggleClass(this.target, previewMode, value);
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _notifyAll(previewMode) {
        this.triggerUp(previewMode ? 'snippet-option-preview' : 'snippet-option-change', {
            handler: this,
        });
    }
    /**
     * Reactivate the options that were activated before previews.
     *
     * @param {DOMElement} opt - an element from the option's UI
     */
    _reset(opt) {
        this.ui.querySelectorAll('.active').forEach(activeElement => {
            Object.keys(activeElement.dataset).forEach(methodName => {
                var index = this.__methodNames.indexOf(methodName);
                if (index >= 0) {
                    this.__methodNames.splice(index, 1);
                }
            });
            this._select('reset', activeElement);
        });
        this.__methodNames.forEach(methodName => {
            this[methodName]('reset', undefined, opt);
        });
        this.__methodNames = [];

        this.dependencies.Overlay.reposition(); // FIXME should be auto on DOM change ?
    }
    /**
     * Activates the option associated to the given DOM element.
     *
     * @private
     * @param {boolean|string} previewMode
     *        - truthy if the option is enabled for preview or if leaving it (in
     *          that second case, the value is 'reset')
     *        - false if the option should be activated for good
     * @param {DOMElement} opt - the related DOMElement option
     */
    _select(previewMode, opt) {
        // Options can say they respond to strong choice
        if (previewMode && (opt.dataset.noPreview || opt.parentNode.dataset.noPreview)) {
            return;
        }

        // If it is not preview mode, the user selected the option for good
        // (so record the action)
        if (!previewMode) {
            this._reset(opt);
            // this.$target.trigger('content_changed'); FIXME
        }

        // Search for methods (data-...) (i.e. data-toggle-class) on the
        // selected (sub)option and its parents
        var el = opt;
        var methods = [];
        do {
            methods.push([el, el.dataset]);
            el = el.parentNode;
        } while (el && el !== this.ui);

        // Call the found method in the right order (parents -> child)
        methods.reverse().forEach(data => {
            var el = data[0];
            var methods = data[1];

            Object.keys(methods).forEach(methodName => {
                if (!this[methodName]) {
                    return;
                }
                if (previewMode === true) {
                    this.__methodNames.push(methodName);
                }
                this[methodName](previewMode, methods[methodName], el);
            });
        });
        this.__methodNames = this.__methodNames.filter((item, index, array) => {
            return array.indexOf(item) === index;
        });

        if (!previewMode) {
            this._setActive();
        }

        this._notifyAll(previewMode);

        this.dependencies.Overlay.reposition(); // FIXME should be auto on DOM change ?
    }
    /**
     * Tweaks the option DOM elements to show the selected value according to
     * the state of the target the option customizes.
     *
     * @todo should be extendable in a more easy way
     * @private
     */
    _setActive() {
        this.ui.querySelectorAll('[data-toggle-class]').forEach(el => {
            var className = el.dataset.toggleClass;
            var active = !className || this.target.classList.contains(className);
            el.classList.toggle('active', active);
        });

        // Get submenus which are not inside submenus
        var submenus = [].slice.call(this.ui.querySelectorAll('we3-collapse-area'))
            .filter(el => {
                var node = el.parentNode;
                while (node !== this.ui) {
                    if (node.tagName === 'we3-collapse-area') {
                        return false;
                    }
                    node = node.parentNode;
                }
                return true;
            });

        // Add unique active class for each submenu active item
        submenus.forEach(submenu => {
            var elements = _getSelectClassElements.call(this, submenu);
            _processSelectClassElements.call(this, elements);
        });

        // Add unique active class for out-of-submenu active item
        var externalElements = _getSelectClassElements.call(this, this.ui);
        externalElements = externalElements.filter(el => {
            while (el !== this.ui) {
                if (el.tagName === 'we3-collapse-area') {
                    return false;
                }
                el = el.parentNode;
            }
            return true;
        });
        _processSelectClassElements.call(this, externalElements);

        function _getSelectClassElements(el) {
            return [].slice.call(el.querySelectorAll('[data-select-class]'));
        }
        function _processSelectClassElements(elements) {
            var maxNbClasses = -1;
            var activeElement;
            elements.forEach(function (el) {
                el.classList.remove('active');

                var className = el.dataset.selectClass;
                var nbClasses = className ? className.split(' ').length : 0;
                if (nbClasses >= maxNbClasses
                        && (!className || this.target.classList.contains(className))) {
                    maxNbClasses = nbClasses;
                    activeElement = el;
                }
            });
            if (activeElement) {
                activeElement.classList.add('active');
            }
        }
    }
    /**
     * @private
     * @param {boolean} [show]
     */
    _toggleUI(show) {
        this.ui.classList.toggle('we3-customizeblock-option-hidden', !show);
    }

    //--------------------------------------------------------------------------
    // Private Helpers For Option Methods
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {string[]|string} classes
     */
    _addClass(element, previewMode, classes) {
        if (typeof classes === 'string') {
            classes = classes.split(' ');
        }
        element.classList.add(...classes);
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {object|string} styles
     * @param {*} [styleValue]
     */
    _applyStyle(element, previewMode, styles, styleValue) {
        if (styleValue !== undefined) {
            var styleName = styles;
            styles = {};
            styles[styleName] = styleValue;
        }
        Object.keys(styles).forEach(propName => {
            element.style[propName] = styles[propName];
        });
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {DOMElement} positionElement
     */
    _insertAfter(element, previewMode, positionElement) {
        if (positionElement.nextSibling) {
            positionElement.parentNode.insertBefore(element, positionElement.nextSibling);
        } else {
            positionElement.parentNode.appendChild(element);
        }
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {string[]|string} classes
     */
    _removeClass(element, previewMode, classes) {
        if (typeof classes === 'string') {
            classes = classes.split(' ');
        }
        element.classList.remove(...classes);
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {string[]|string} dataNames
     */
    _removeAttr(element, previewMode, names) {
        if (typeof names === 'string') {
            names = names.split(' ');
        }
        names.forEach(name => {
            element.removeAttribute(name);
        });
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {string[]|string} dataNames
     */
    _removeDataAttr(element, previewMode, dataNames) {
        if (typeof dataNames === 'string') {
            dataNames = dataNames.split(' ');
        }
        dataNames.forEach(name => {
            delete element.dataset[name];
        });
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {string[]|string} propNames
     */
    _removeStyle(element, previewMode, propNames) {
        if (typeof propNames === 'string') {
            propNames = propNames.split(' ');
        }
        propNames.forEach(propName => {
            element.style.removeProperty(propName);
        });
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {object|string} attrs
     * @param {*} [value]
     */
    _setAttr(element, previewMode, attrs, value) {
        if (value !== undefined) {
            var name = attrs;
            attrs = {};
            attrs[name] = value;
        }
        Object.keys(attrs).forEach(name => {
            element.setAttribute(name, attrs[name]);
        });
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {object|string} dataAttrs
     * @param {*} [dataValue]
     */
    _setDataAttr(element, previewMode, dataAttrs, dataValue) {
        if (dataValue !== undefined) {
            var dataName = dataAttrs;
            dataAttrs = {};
            dataAttrs[dataName] = dataValue;
        }
        Object.keys(dataAttrs).forEach(name => {
            element.dataset[name] = dataAttrs[name];
        });
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }
    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean|string} previewMode
     * @param {string[]|string} classes
     * @param {boolean} [classes]
     */
    _toggleClass(element, previewMode, classes, add) {
        if (typeof classes === 'string') {
            classes = classes.split(' ');
        }
        classes.forEach(className => {
            element.classList.toggle(className, add);
        });
        if (!previewMode) {
            // TODO Write on the Arch here
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when something is entered -> activates the related option in
     * preview mode if any.
     *
     * @private
     * @param {Event} ev
     */
    _onButtonEnter(ev) {
        var button = ev.currentTarget;
        if (!Object.keys(button.dataset).length) {
            return;
        }
        this.__click = false;
        this._select(true, button);
    }
    /**
     * Called when something is clicked -> activates the related option if any.
     *
     * @private
     * @param {Event} ev
     */
    _onButtonClick(ev) {
        var button = ev.currentTarget;
        if (ev.defaultPrevented || !Object.keys(button.dataset).length) {
            return;
        }

        ev.preventDefault();
        this.__click = true;
        this._select(false, button);
    }
    /**
     * Called when something is left -> reactivate the options that
     * were activated before previews.
     *
     * @private
     * @param {Event} ev
     */
    _onMouseLeave(ev) {
        if (this.__click) {
            return;
        }
        this._reset(ev.currentTarget);
    }
};

var BlockOption = class extends we3.AbstractPlugin {
    /**
     * @constructor
     * @param {Object} parent
     * @param {Object} params
     * @param {Object} options
     */
    constructor(parent, params, options) {
        super(...arguments);

        this.dependencies = ['Arch', 'Overlay', 'Renderer'];
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Notify all foreign option handlers which have the same target.
     *
     * @param {BlockOptionHandler} handler
     */
    onForeignOptionChange(handler) {
        this._handlers.forEach(_handler => {
            if (_handler === handler || _handler.target !== handler.target) {
                return;
            }
            _handler.onForeignOptionChange();
        });
    }
    /**
     * Notify all foreign option handlers which have the same target.
     *
     * @param {BlockOptionHandler} handler
     */
    onForeignOptionPreview(handler) {
        this._handlers.forEach(_handler => {
            if (_handler === handler || _handler.target !== handler.target) {
                return;
            }
            _handler.onForeignOptionPreview();
        });
    }
    /**
     * TODO review the system (how to unregister ?)
     *
     * @param {HTMLElement} target
     * @param {HTMLElement} ui
     * @param {HTMLElement} overlay
     * @param {object} [cloneData]
     */
    registerTarget(target, ui, overlay, forClone, cloneData) {
        var handler = new this.constructor.Handler(target, ui, overlay);
        this._handlers.push(handler);

        handler.onStart();
        handler.onFocus();
        if (cloneData) {
            handler.onClone(cloneData);
        }
    }

    //--------------------------------------------------------------------------
    // Static
    //--------------------------------------------------------------------------

    /**
     * Static class in charge of handling a specific target and specific ui
     * for the same option plug-in.
     */
    static Handler = BlockOptionHandler;
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('default', BlockOption);
})();
