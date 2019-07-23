(function () {
'use strict';

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

        this._uiEvents = {
            'mouseenter': '_onButtonEnter',
            'click': '_onButtonClick',
            'mouseleave': '_onMouseLeave',
        };

        this._uiElements = [];
        this._targetElements = [];
        this._states = [];
    }
    /**
     * Called when a block is copied - @see CustomizeBlock
     * The method is in charge of updating the relevant target according to it.
     *
     * @abstract
     * @param {DOMElement} target - a registered target
     * @param {Object} options
     * @param {boolean} options.isCurrent
     *        true if the associated snippet is a clone of the main element that
     *        was cloned (so not a clone of a child of this main element that
     *        was cloned)
     */
    onClone(target, options) {}
    /**
     * Called when the edition overlay is covering the associated snippet
     * (the first time, this follows the call to the @see start method).
     *
     * FIXME only the first time is called right now...
     *
     * @abstract
     * @param {DOMElement} ui - a registered UI
     * @param {DOMElement} target - a registered target
     */
    onFocus(ui, target) {}
    /**
     * @abstract
     * @param {DOMElement} ui - a registered UI
     * @param {DOMElement} target - a registered target
     */
    onForeignOptionChange(ui, target) {}
    /**
     * @abstract
     * @param {DOMElement} ui - a registered UI
     * @param {DOMElement} target - a registered target
     */
    onForeignOptionPreview(ui, target) {}

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {DOMElement} target
     * @returns {HTMLElement|null}
     */
    getUIFromTarget(target) {
        var index = this._targetElements.indexOf(target);
        if (index >= 0) {
            return this._uiElements[index];
        }
        return null;
    }
    /**
     * TODO review the system (how to unregister ?)
     *
     * @param {DOMElement} ui
     * @param {DOMElement} target
     */
    registerUIAndTarget(ui, target, overlay) {
        var self = this;

        var state = {
            __methodNames: [],
        };

        this._uiElements.push(ui);
        this._targetElements.push(target);
        this._states.push(state);

        // FIXME event delegation ?
        ui.querySelectorAll('we3-button').forEach(function (el) {
            self._bindDOMEvents(el, self._uiEvents);
        });

        this._setActive(ui, target);
        this.onFocus(ui, target);

        return state;
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Default option method which allows to select one and only one class in
     * the option classes set and set it on the associated snippet. The common
     * case is having a subset with each item having a `data-select-class`
     * value allowing to choose the associated class.
     *
     * @param {DOMElement} target
     * @param {Object} state
     * @param {boolean|string} previewMode
     *        - truthy if the option is enabled for preview or if leaving it (in
     *          that second case, the value is 'reset')
     *        - false if the option should be activated for good
     * @param {*} value - the class to activate (opt.dataset.selectClass)
     * @param {DOMElement} ui
     * @param {DOMElement} opt
     */
    selectClass(target, state, previewMode, value, ui, opt) {
        var self = this;

        var group = ui;
        while (opt !== ui) {
            if (opt.tagName === 'we3-collapse-area') {
                group = opt;
            }
            opt = opt.parentNode;
        }

        group.querySelectorAll('[data-select-class]').forEach(function (el) {
            el.dataset.selectClass.split(' ').forEach(function (className) {
                self._removeClass(target, previewMode, className);
            });
        });
        if (value) {
            this._addClass(target, previewMode, value);
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
    toggleClass(target, state, previewMode, value, ui, opt) {
        var self = this;
        ui.querySelectorAll('[data-toggle-class]').forEach(function (el) {
            el.dataset.toggleClass.split(' ').forEach(function (className) {
                self._toggleClass(target, previewMode, className, el.classList.contains('active'));
            });
        });
        if (value && previewMode !== 'reset') {
            this._toggleClass(target, previewMode, value);
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {DOMElement} element
     * @returns {object}
     */
    _getUIAndTargetFromUIChild(element) {
        var index = -1;
        while (element) {
            if (element.tagName === 'WE3-CUSTOMIZEBLOCK-OPTION') {
                index = this._uiElements.indexOf(element);
                break;
            }
            element = element.parentNode;
        }
        if (index < 0) {
            return null;
        }
        return [element, this._targetElements[index], this._states[index]];
    }
    /**
     * @private
     */
    _notifyAll(previewMode, ui, target) {
        this.trigger(previewMode ? 'snippet-option-preview' : 'snippet-option-change', {
            target: target,
        });
    }
    /**
     * Reactivate the options that were activated before previews.
     *
     * @param {DOMElement} opt - an element from the option's UI
     * @param {DOMElement} [ui] - allow to not search for ui and targets
     * @param {DOMElement} [target] - allow to not search for ui and targets
     * @param {Object} [state] - allow to not search for ui and targets
     */
    _reset(opt, ui, target, state) {
        var self = this;
        if (!ui || !target) {
            var uiAndTarget = this._getUIAndTargetFromUIChild(opt);
            ui = uiAndTarget[0];
            target = uiAndTarget[1];
            state = uiAndTarget[2];
        }
        ui.querySelectorAll('.active').forEach(function (activeElement) {
            state.__methodNames = _.without.apply(_, [state.__methodNames].concat(Object.keys(activeElement.dataset)));
            self._select('reset', activeElement, ui, target, state);
        });
        state.__methodNames.forEach(function (methodName) {
            self[methodName](target, state, 'reset', undefined, ui, opt);
        });
        state.__methodNames = [];

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
     * @param {DOMElement} [ui] - allow to not search for ui and targets
     * @param {DOMElement} [target] - allow to not search for ui and targets
     * @param {Object} [state] - allow to not search for ui and targets
     */
    _select(previewMode, opt, ui, target, state) {
        var self = this;

        // Options can say they respond to strong choice
        if (previewMode && (opt.dataset.noPreview || opt.parentNode.dataset.noPreview)) {
            return;
        }

        if (!ui || !target) {
            var uiAndTarget = this._getUIAndTargetFromUIChild(opt);
            ui = uiAndTarget[0];
            target = uiAndTarget[1];
            state = uiAndTarget[2];
        }

        // If it is not preview mode, the user selected the option for good
        // (so record the action)
        if (!previewMode) {
            this._reset(opt, ui, target, state);
            // this.$target.trigger('content_changed'); FIXME
        }

        // Search for methods (data-...) (i.e. data-toggle-class) on the
        // selected (sub)option and its parents
        var el = opt;
        var methods = [];
        do {
            methods.push([el, el.dataset]);
            el = el.parentNode;
        } while (el && el !== ui);

        // Call the found method in the right order (parents -> child)
        methods.reverse().forEach(function (data) {
            var el = data[0];
            var methods = data[1];

            Object.keys(methods).forEach(function (methodName) {
                if (!self[methodName]) {
                    return;
                }
                if (previewMode === true) {
                    state.__methodNames.push(methodName);
                }
                self[methodName](target, state, previewMode, methods[methodName], ui, el);
            });
        });
        state.__methodNames = state.__methodNames.filter(function (item, index, array) {
            return array.indexOf(item) === index;
        });

        if (!previewMode) {
            this._setActive(ui, target);
        }

        this._notifyAll(previewMode, ui, target);

        this.dependencies.Overlay.reposition(); // FIXME should be auto on DOM change ?
    }
    /**
     * Tweaks the option DOM elements to show the selected value according to
     * the state of the target the option customizes.
     *
     * @todo should be extendable in a more easy way
     * @private
     * @param {DOMElement} ui
     * @param {DOMElement} target
     */
    _setActive(ui, target) {
        ui.querySelectorAll('[data-toggle-class]').forEach(function (el) {
            var className = el.dataset.toggleClass;
            el.classList.toggle('active', !className || target.classList.contains(className));
        });

        // Get submenus which are not inside submenus
        var submenus = [].slice.call(ui.querySelectorAll('we3-collapse-area'))
            .filter(function (el) {
                var node = el.parentNode;
                while (node !== ui) {
                    if (node.tagName === 'we3-collapse-area') {
                        return false;
                    }
                    node = node.parentNode;
                }
                return true;
            });

        // Add unique active class for each submenu active item
        submenus.forEach(function (submenu) {
            var elements = _getSelectClassElements(submenu);
            _processSelectClassElements(elements);
        });

        // Add unique active class for out-of-submenu active item
        var externalElements = _getSelectClassElements(ui)
            .filter(function (el) {
                while (el !== ui) {
                    if (el.tagName === 'we3-collapse-area') {
                        return false;
                    }
                    el = el.parentNode;
                }
                return true;
            });
        _processSelectClassElements(externalElements);

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
                        && (!className || target.classList.contains(className))) {
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
     * @param {DOMElement} ui
     * @param {boolean} [show]
     */
    _toggleUI(ui, show) {
        ui.classList.toggle('we3-customizeblock-option-hidden', !show);
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
        Object.keys(styles).forEach(function (propName) {
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
        names.forEach(function (name) {
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
        dataNames.forEach(function (name) {
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
        propNames.forEach(function (propName) {
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
        Object.keys(attrs).forEach(function (name) {
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
        Object.keys(dataAttrs).forEach(function (name) {
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
        classes.forEach(function (className) {
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

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('default', BlockOption);
})();
