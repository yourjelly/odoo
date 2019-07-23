(function () {
'use strict';

var OverlaySizingOption = class extends (we3.getPlugin('BlockOption:default')) {
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
            'mousedown we3-overlaysizing-handle': '_onHandleMouseDown',
        };
    }
    /**
     * @override
     */
    start() {
        var promise = super.start(...arguments);

        var Overlay = this.dependencies.Overlay;
        Overlay.registerUIEvents(this, this._uiEvents);

        return promise;
    }
    /**
     * @override
     */
    onFocus(ui, target) {
        // this._onResize(overlay, target, this._getSize(target)); FIXME
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    registerUIAndTarget(ui, target, overlay) {
        var state = super.registerUIAndTarget(...arguments);

        var resizeValues = this._getSize(target);
        Object.keys(resizeValues).forEach(function (key) {
            var handle = document.createElement('we3-overlaysizing-handle');
            handle.classList.add('o_handle', key); // FIXME class name
            overlay.appendChild(handle);
        });

        return state;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Returns an object mapping one or several cardinal direction (n, e, s, w)
     * to an Array containing:
     * 1) A list of classes to toggle when using this cardinal direction
     * 2) A list of values these classes are supposed to set on a given CSS prop
     * 3) The mentioned CSS prop
     *
     * @abstract
     * @private
     * @param {HTMLElement} target
     * @returns {Object}
     */
    _getSize(target) {}
    /**
     * Called when the snippet is being resized and its classes changes.
     *
     * @private
     * @param {HTMLElement} overlay
     * @param {HTMLElement} target
     * @param {*} grid
     * @param {string} [compass] - resize direction ('n', 's', 'e' or 'w')
     * @param {string} [beginClass] - attributes class at the beginning
     * @param {integer} [current] - current increment in grid of @see _getSize
     */
    _onResize(overlay, target, grid, compass, beginClass, current) {
        var targetStyle = window.getComputedStyle(target);

        // Adapt the resize handles according to the classes and dimensions
        Object.keys(grid).forEach(function (direction) {
            var resizeValue = grid[direction];
            var classes = resizeValue[0];
            var values = resizeValue[1];
            var cssProperty = resizeValue[2];

            var current = 0;
            var cssPropertyValue = parseInt(targetStyle[cssProperty]);
            classes.forEach(function (className, key) {
                if (target.classList.contains(className)) {
                    current = key;
                } else if (values[key] === cssPropertyValue) {
                    current = key;
                }
            });

            var handle = overlay.querySelector('.' + direction);
            handle.classList.toggle('o_handle_start', current === 0);
            handle.classList.toggle('o_handle_end', current === classes.length - 1);
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onHandleMouseDown(ev) {
        if (ev.button !== 0) {
            return;
        }
        ev.preventDefault();

        var Overlay = this.dependencies.Overlay;

        var self = this;
        var handle = ev.target; // FIXME event delegation
        var overlay = handle.parentNode;
        var nodeID = this.dependencies.Overlay.getUIElementNodeID(overlay);
        var target = this.dependencies.Renderer.getElement(nodeID);
        var resizeValues = this._getSize(target);
        if (!resizeValues) {
            return;
        }

        var compass = false;
        var XY = false;
        if (handle.classList.contains('n')) {
            compass = 'n';
            XY = 'Y';
        } else if (handle.classList.contains('s')) {
            compass = 's';
            XY = 'Y';
        } else if (handle.classList.contains('e')) {
            compass = 'e';
            XY = 'X';
        } else if (handle.classList.contains('w')) {
            compass = 'w';
            XY = 'X';
        }

        var resize = resizeValues[compass];
        if (!resize) {
            return;
        }

        var current = 0;
        var cssProperty = resize[2];
        var targetStyle = window.getComputedStyle(target);
        var cssPropertyValue = parseInt(targetStyle[cssProperty]);
        resize[0].forEach(function (value, index) {
            if (target.classList.contains(value)) {
                current = index;
            } else if (resize[1][index] === cssPropertyValue) {
                current = index;
            }
        });
        var begin = current;
        var beginClass = '' + target.className;
        var regClass = new RegExp('\\s*' + resize[0][begin].replace(/[-]*[0-9]+/, '[-]*[0-9]+'), 'g');

        var handleStyle = window.getComputedStyle(handle);
        var cursor = handleStyle.cursor + '-important';
        var body = document.body; // FIXME this.ownerDocument ??
        body.classList.add(cursor);

        var xy = ev['page' + XY];
        var bodyMouseMove = function (ev) {
            ev.preventDefault();

            var dd = ev['page' + XY] - xy + resize[1][begin];
            var next = current + (current + 1 === resize[1].length ? 0 : 1);
            var prev = current ? (current - 1) : 0;

            var change = false;
            if (dd > (2 * resize[1][next] + resize[1][current]) / 3) {
                self._setAttr(target, false, 'class', target.className.replace(regClass, ''));
                self._addClass(target, false, resize[0][next]);
                current = next;
                change = true;
            }
            if (prev !== current && dd < (2 * resize[1][prev] + resize[1][current]) / 3) {
                self._setAttr(target, false, 'class', target.className.replace(regClass, ''));
                self._addClass(target, false, resize[0][prev]);
                current = prev;
                change = true;
            }

            if (change) {
                self._onResize(overlay, target, resizeValues, compass, beginClass, current);
                Overlay.trigger('reposition_demand');
                handle.classList.add('o_active'); // FIXME class name ?
            }
        };
        var bodyMouseUp = function () {
            body.removeEventListener('mousemove', bodyMouseMove);
            body.removeEventListener('mouseup', bodyMouseUp);
            body.classList.remove(cursor);
            handle.classList.remove('o_active'); // FIXME

            // // Highlights the previews for a while FIXME
            // var $handlers = self.$overlay.find('.o_handle');
            // $handlers.addClass('o_active').delay(300).queue(function () {
            //     $handlers.removeClass('o_active').dequeue();
            // });
        };
        body.addEventListener('mousemove', bodyMouseMove);
        body.addEventListener('mouseup', bodyMouseUp);
    }
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('OverlaySizing', OverlaySizingOption);
})();
