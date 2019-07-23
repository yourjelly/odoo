(function () {
'use strict';

var OVERLAY_OFFSET = 10000; // The same value is used in CSS

var OverlayPlugin = class extends we3.AbstractPlugin {
    /**
     * @constructor
     * @param {Object} parent
     * @param {Object} params
     * @param {Object} options
     **/
    constructor(parent, params, options) {
        super(...arguments);

        this.dependencies = ['Renderer'];

        this.editableDomEvents = {
            'mousemove': '_onMouseMove',
        };

        this._overlay = document.createElement('we3-overlay');
        params.insertAfterEditable(this._overlay);

        this._uiElements = [];
        this._uiNodeIDs = [];
        this._uiAllData = [];

        this._isActive = true;
    }
    /**
     * @override
     */
    start() {
        var prom = super.start(...arguments);
        this.__onWindowResize = this._onWindowResize.bind(this);
        window.addEventListener('resize', this.__onWindowResize);

        this.on('reposition_demand', this, this.reposition);

        return prom;
    }
    /**
     * @override
     */
    destroy() {
        super.destroy(...arguments);
        window.removeEventListener('resize', this.__onWindowResize);
    }

    //--------------------------------------------------------------------------
    // Editor methods
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    changeEditorValue() {
        this._adaptToDOMChanges(); // FIXME this does not seem to work
    }
    /**
     * @override
     */
    setEditorValue() {
        this._adaptToDOMChanges();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {HTMLElement} uiElement
     * @param {number} nodeID
     * @param {object} [data]
     * @param {string} [extraClass]
     * @returns {HTMLElement}
     */
    addUIElement(uiElement, nodeID, data, extraClass) {
        var node = this.dependencies.Renderer.getElement(nodeID);
        node.classList.add('we3-overlay-enabled');
        if (extraClass) {
            node.classList.add(extraClass);
        }

        this._uiElements.push(uiElement);
        this._uiNodeIDs.push(nodeID);
        this._uiAllData.push(data);

        this._overlay.appendChild(uiElement);

        return uiElement;
    }
    /**
     * Disables the overlay behaviors.
     */
    block() {
        this._hideUIElements(true);
        this._isActive = false;
    }
    /**
     * @param {DOMElement|number} id
     *      The ui element itself or the related node id
     */
    getUIElementData(id) {
        var index;
        if (typeof id === 'number') {
            index = this._uiNodeIDs.indexOf(id);
        } else {
            index = this._uiElements.indexOf(id);
        }
        return this._uiAllData[index];
    }
    /**
     * @param {DOMElement} uiElement
     */
    getUIElementNodeID(uiElement) {
        var index = this._uiElements.indexOf(uiElement);
        return this._uiNodeIDs[index];
    }
    /**
     * @param {number} [nodeID]
     * @param {string} [color]
     */
    makeUIStickyFor(nodeID, color) {
        var self = this;
        this._uiElements.forEach(nodeID ? function (ui, index) {
            if (self._uiNodeIDs[index] !== nodeID) {
                return;
            }
            ui.classList.add('we3-overlay-ui-sticky');
            ui.style.borderColor = color;
        } : function (ui) {
            ui.classList.remove('we3-overlay-ui-sticky');
            ui.style.borderColor = '';
        });
    }
    /**
     * @param {object} self
     * @param {object} events
     */
    registerUIEvents(self, events) {
        self._bindDOMEvents(this._overlay, events);
    }
    /**
     * Repositions the UI elements according to potential DOM changes.
     */
    reposition() {
        var self = this;
        var Renderer = this.dependencies.Renderer;

        var originBox = this._overlay.getBoundingClientRect();

        this._uiElements.forEach(function (ui, index) {
            if (!ui.classList.contains('we3-overlay-ui-visible')
                    && !ui.classList.contains('we3-overlay-ui-sticky')) {
                return;
            }
            var node = Renderer.getElement(self._uiNodeIDs[index]);
            var nodeBox = node.getBoundingClientRect();
            var style = window.getComputedStyle(node);
            var marginTop = parseFloat(style.marginTop);
            var marginRight = parseFloat(style.marginRight);
            var marginBottom = parseFloat(style.marginBottom);
            var marginLeft = parseFloat(style.marginLeft);

            ui.style.left = (nodeBox.left - originBox.left - marginLeft) + 'px';
            ui.style.top = (nodeBox.top - originBox.top - OVERLAY_OFFSET - marginTop) + 'px';
            ui.style.width = (nodeBox.width + marginLeft + marginRight) + 'px';
            ui.style.height = (nodeBox.height + marginTop + marginBottom) + 'px';
        });
    }
    /**
     * Enables the overlay behaviors.
     */
    unblock() {
        this._isActive = true;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _adaptToDOMChanges() {
        // Destroy all UI elements
        this._uiElements.forEach(function (el) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        this._uiElements = [];
        this._uiNodeIDs = [];
        this._uiAllData = [];

        // Unmark all DOM elements which were marked as "overlay-enabled"
        this.editable.querySelectorAll('.we3-overlay-enabled').forEach(function (el) {
            el.classList.remove('we3-overlay-enabled');
        });

        // Notify that the overlay elements were destroyed
        this.trigger('overlay_refresh');
    }
    /**
     * @private
     * @param {boolean} [stickyToo=false]
     */
    _hideUIElements(stickyToo) {
        this._uiElements.forEach(function (ui) {
            ui.classList.remove('we3-overlay-ui-visible');
            if (stickyToo) {
                ui.classList.remove('we3-overlay-ui-sticky');
            }
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Checks if the user is moving over an overlay-enabled element and if so
     * enabled its related overlay. Note: this is done on mousemove instead on
     * mouseover/mouseout/mouseenter/mouseleave for simplicity.
     *
     * @private
     */
    _onMouseMove(ev) {
        var self = this;
        if (!this._isActive) {
            return;
        }

        this._hideUIElements(false);

        var node = ev.target;
        while (node && node.classList) {
            if (node.classList.contains('we3-overlay-enabled')) {
                break;
            }
            node = node.parentNode;
        }
        if (!node || !node.classList) {
            return;
        }

        var nodeID = this.dependencies.Renderer.getID(node);
        this._uiElements.forEach(function (ui, index) {
            if (self._uiNodeIDs[index] !== nodeID) {
                return;
            }
            ui.classList.add('we3-overlay-ui-visible');
        });
        this.reposition();
    }
    /**
     * @private
     */
    _onWindowResize() {
        this.reposition();
    }
};

we3.addPlugin('Overlay', OverlayPlugin);
})();
