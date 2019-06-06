(function () {
'use strict';

//--------------------------------------------------------------------------
// Font (colorpicker & font-size)
//--------------------------------------------------------------------------

var TextPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Range'];
    }
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get (archNode) {
        return (archNode.isText() || archNode.isBR()) && archNode;
    }
    /**
     * Applies the given styles (fore- or backcolor, font size) to the selection.
     * If no text is selected, apply to the current text node, if any.
     *
     * @param {string} color (hexadecimal or class name)
     * @param {string} bgcolor (hexadecimal or class name)
     * @param {integer} size
     * @param {WrappedRange} range
     */
    applyFont (color, bgcolor, size, archNode) {
        if (archNode.isVoidoid()) {
            if (color != null) {
                archNode.style.add('color', color);
            }
            if (bgcolor != null) {
                archNode.style.add('background-color', bgcolor);
            }
            if (size != null) {
                archNode.style.add('font-size', size);
            }
            this.dependencies.Arch.importUpdate(archNode.toJSON());
            return;
        }
        var range = this.dependencies.Range.getRange();
        if (!range || !this.editable.contains(range.sc) || !this.editable.contains(range.ec)) {
            return;
        }
        if (range.isCollapsed() && this.utils.isText(range.sc)) {
            this._applyFontCollapsed(color, bgcolor, size, range);
        } else {
            this._applyFontToSelection(color, bgcolor, size, range);
        }
        this.dependencies.Arch.setRange(range);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Applies the given styles (fore- or backcolor, font size) at collapsed range.
     *
     * @private
     * @param {String} [color]
     * @param {String} [bgcolor]
     * @param {Number} [size]
     * @param {WrappedRange} range
     */
    _applyFontCollapsed (color, bgcolor, size, range) {
        this._splitBeforeApplyFont(range);
        var zwcNode = document.createTextNode(this.utils.char('zeroWidth'));
        range.sc.parentNode.insertBefore(zwcNode, range.sc);
        var font = this._applyStylesToNode(zwcNode, color, bgcolor, size);
        range.replace({
            sc: font,
            so: 1,
        });
    }
    /**
     * Applies the given styles (fore- or backcolor, font size) to the selection.
     *
     * @private
     * @param {String} [color]
     * @param {String} [bgcolor]
     * @param {Number} [size]
     * @param {WrappedRange} range
     */
    _applyFontToSelection (color, bgcolor, size, range) {
        var self = this;
        this._splitBeforeApplyFont(range);
        range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Arch.isVoidoid(node);
        }).forEach(function (node) {
            // Can we safely get rid of this ? Why was it there ?
            //
            // var reStartAndEndSpaceG = self.utils.getRegex('startAndEndSpace', 'g');
            // var nbsp = self.utils.char('nbsp');
            // node.textContent = node.textContent.replace(reStartAndEndSpaceG, nbsp); // TODO: MOVE!
            this._applyStylesToNode(node, color, bgcolor, size);
        }, this);
        this._cleanRangeAfterStyle(range);
    }
    /**
     * Applies the given styles (fore- or backcolor, font size)
     * to a given <font> node.
     *
     * @private
     * @param {Node} node
     * @param {string} color (hexadecimal or class name)
     * @param {string} bgcolor (hexadecimal or class name)
     * @param {integer} size
     * @returns {Node} the <font> node
     */
    _applyStylesToFontNode (node, color, bgcolor, size) {
        var className = node.className.split(this.utils.getRegex('space'));
        var k;
        if (color) {
            for (k = 0; k < className.length; k++) {
                if (className[k].length && className[k].slice(0, 5) === "text-") {
                    className.splice(k, 1);
                    k--;
                }
            }
            if (color === 'text-undefined') {
                node.className = className.join(" ");
                node.style.color = "inherit";
            } else if (color.indexOf('text-') !== -1) {
                node.className = className.join(" ") + " " + color;
                node.style.color = "inherit";
            } else {
                node.className = className.join(" ");
                node.style.color = color;
            }
        }
        if (bgcolor) {
            for (k = 0; k < className.length; k++) {
                if (className[k].length && className[k].slice(0, 3) === "bg-") {
                    className.splice(k, 1);
                    k--;
                }
            }

            if (bgcolor === 'bg-undefined') {
                node.className = className.join(" ");
                node.style.backgroundColor = "inherit";
            } else if (bgcolor.indexOf('bg-') !== -1) {
                node.className = className.join(" ") + " " + bgcolor;
                node.style.backgroundColor = "inherit";
            } else {
                node.className = className.join(" ");
                node.style.backgroundColor = bgcolor;
            }
        }
        if (size) {
            node.style.fontSize = "inherit";
            if (!isNaN(size) && Math.abs(parseInt(this.window.getComputedStyle(node).fontSize, 10) - size) / size > 0.05) {
                node.style.fontSize = size + "px";
            }
        }
        return node;
    }
    /**
     * Apply the given styles to a node's parent font node or wrap it in a new
     * font node with the given styles. Return the font node.
     *
     * @private
     * @param {Node} node
     * @param {String} color
     * @param {String} bgcolor 
     * @param {Number} size
     * @returns {Node}
     */
    _applyStylesToNode (node, color, bgcolor, size) {
        var font = this._getFormattableAncestor(node) || this._wrapInFontNode(node);
        this._applyStylesToFontNode(font, color, bgcolor, size);
        this._removeEmptyStyles(font);
        return font;
    }
    /**
     * Remove node without attributes (move content), and merge the same nodes
     *
     * @private
     * @param {WrappedRange} range
     */
    _cleanRangeAfterStyle (range) {
        var self = this;
        this._moveRangeToDeepUntil(range, function (n) {
            return self.dependencies.Arch.isEditableNode(n) && !self.dependencies.Arch.isVoidoid(n);
        });
        range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Arch.isVoidoid(node);
        }).forEach(function (node) {
            self._cleanNodeAfterStyle(node, range);
        });
        range.normalize();
    }
    /**
     * Clean a node after applying styles:
     * - Remove it if it has no attributes
     * - Merge adjacent nodes with the same tagName
     * and adapt the range according to changes.
     *
     * @private
     * @param {Node} node
     * @param {WrappedRange} range
     */
    _cleanNodeAfterStyle (node, range) {
        if (this.utils.isInvisibleText(node)) {
            return;
        }
        node = this._getFormattableAncestor(node) || this.utils.ancestor(node, this.utils.isSpan);
        return !node || this._moveNodeWithoutAttr(node, range) ||
            this._mergeFontAncestorsIfSimilar(node, range);
    }
    /**
     * Get the deepest start/end point at range until predicate hit.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Function (Node) => Boolean} pred
     * @param {Boolean} isEndPoint
     * @returns {BoundaryPoint}
     */
    _getDeepPointUntil (range, pred, isEndPoint) {
        pred = pred.bind(this);
        var point = range[isEndPoint ? 'getEndPoint' : 'getStartPoint']().enter();
        var isOnEdge = isEndPoint ? point.offset === this.utils.nodeLength(point.node) : !point.offset;
        if (!this.utils.isText(point.node) && isOnEdge) {
            point.node = this.utils.firstLeafUntil(point.node.childNodes[point.offset] || point.node, pred);
            point.offset = isEndPoint ? this.utils.nodeLength(point.node) : 0;
        }
        return point;
    }
    /**
     * Return the last ancestor that is a FONT node.
     *
     * @private
     * @param {Node} node
     * @returns {Node}
     */
    _getFormattableAncestor (node) {
        var self = this;
        return this.utils.lastAncestor(node, function (n) {
            return n.tagName && self.utils.formatTags.indexOf(n.tagName.toLowerCase()) !== -1;
        });
    }
    /**
     * Get `node`'s previous sibling that is visible text or element, if any.
     *
     * @private
     * @param {Node} node
     * @returns {Node|undefined}
     */
    _getPreviousVisibleNode (node) {
        var prev = node && node.previousSibling;
        while (prev && this.utils.isInvisibleText(prev)) {
            prev = prev.previousSibling;
        }
        return prev;
    }
    /**
     * Merge `node`'s last <font> ancestor with its sibling
     * if they have the same classes, styles and tagNames.
     * Then adapt the range according to changes.
     * Return true if the nodes were merged.
     *
     * @private
     * @param {Node} node
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _mergeFontAncestorsIfSimilar (node, range) {
        var endPoint = range.getEndPoint();
        var font = this._getFormattableAncestor(node);
        var prev = this._getPreviousVisibleNode(font);
        var className = this.utils.orderClass(node);
        var style = this.utils.orderStyle(node);
        if (!prev ||
            font.tagName !== prev.tagName ||
            className !== this.utils.orderClass(prev) ||
            style !== this.utils.orderStyle(prev)) {
            return false;
        }
        $(prev).append($(font).contents());
        if (range.ec === font) {
            endPoint.prevUntil(function (point) {
                return point.node !== font;
            });
            range.ec = endPoint.node;
            range.eo = endPoint.offset;
        }
        $(font).remove();
        return true;
    }
    /**
     * If `node` has no class or style, move its contents before itself,
     * then remove the node. Adapt the range accord to changes.
     * Return true if the node was indeed removed.
     *
     * @private
     * @param {Node} node
     * @param {WrappedRange} range
     * @returns {Boolean}
     */
    _moveNodeWithoutAttr (node, range) {
        var endPoint = range.getEndPoint();
        var className = this.utils.orderClass(node);
        var style = this.utils.orderStyle(node);
        if (className || style) {
            return false;
        }
        $(node).before($(node).contents());
        if (range.ec === node) {
            endPoint.prevUntil(function (point) {
                return point.node !== node;
            });
            range.ec = endPoint.node;
            range.eo = endPoint.offset;
        }
        $(node).remove();
        return true;
    }
    /**
     * Move the range to its deepest start/end points until predicate hit.
     *
     * @private
     * @param {WrappedRange} range
     * @param {Function (Node) => Boolean} pred
     */
    _moveRangeToDeepUntil (range, pred) {
        var startPoint = this._getDeepPointUntil(range, pred);
        var endPoint = this._getDeepPointUntil(range, pred, true);
        range.replace({
            sc: startPoint.node,
            so: startPoint.offset,
            ec: endPoint.node,
            eo: endPoint.offset,
        });
    }
    /**
     * Remove a node's empty styles.
     * Note: We have to remove the value in 2 steps (apply inherit then remove)
     * because of behavior differences between browsers.
     *
     * @private
     * @param {Node} node
     */
    _removeEmptyStyles (node) {
        ['color', 'backgroundColor', 'fontSize'].forEach(function (styleName) {
            if (node.style[styleName] === 'inherit') {
                node.style[styleName] = '';
            }
        });
        if (node.style.color === '' && node.style.backgroundColor === '' && node.style.fontSize === '') {
            node.removeAttribute("style");
        }
        if (!node.className.length) {
            node.removeAttribute("class");
        }
    }
    /**
     * Split the DOM tree if necessary in order to apply a font on a selection,
     * then adapt the range.
     *
     * @private
     * @param {WrappedRange} range
     */
    _splitBeforeApplyFont (range) {
        var ancestor;
        var node;
        if (!range.isCollapsed()) {
            if (range.eo !== this.utils.nodeLength(range.ec)) {
                ancestor = this._getFormattableAncestor(range.ec) || range.ec;
                this.dom.splitTree(ancestor, range.getEndPoint().enter());
            }
            if (range.so) {
                ancestor = this._getFormattableAncestor(range.sc) || range.sc;
                node = this.dom.splitTree(ancestor, range.getStartPoint().enter());
                if (range.ec === range.sc) {
                    range.ec = node;
                    range.eo = this.utils.nodeLength(node);
                }
                range.sc = node;
                range.so = 0;
            }
        } else {
            ancestor = this._getFormattableAncestor(range.sc);
            if (ancestor) {
                node = this.dom.splitTree(ancestor, range.getStartPoint(), {
                    isSkipPaddingBlankNode: this.dependencies.Arch.isVoidoid(ancestor),
                });
            } else {
                node = range.sc.splitText(range.so);
            }
            range.replace({
                sc: node,
                so: 0,
            });
        }
    }
    /**
     * Create a FONT node and wrap `node` in it, then return the font node.
     *
     * @private
     * @param {Node} node
     * @returns {Node}
     */
    _wrapInFontNode (node) {
        var font = document.createElement('font');
        node.parentNode.insertBefore(font, node);
        font.appendChild(node);
        return font;
    }
};

var FontSizePlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Text', 'Range'];
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_format_text.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.fontsize',
            active: '_active',
            enabled: '_enabled',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the selection's font size.
     *
     * @param {integer} fontsize
     */
    update (fontsize, range) {
        this.dependencies.Text.applyFont(null, null, fontsize || 'inherit', range);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {DOM} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        if (focusNode.isText()) {
            focusNode = focusNode.parent;
        }
        var cssSize = focusNode.style['font-size'];
        var size = buttonName.split('-')[1];
        return size === 'default' && (!cssSize || cssSize === 'inherit') ||
            parseInt(size) === parseInt(cssSize);
    }
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return !!this.dependencies.Range.getRange().scArch.ancestor('isFormatNode');
    }
};

we3.addPlugin('Text', TextPlugin);
we3.addPlugin('FontSize', FontSizePlugin);

})();
