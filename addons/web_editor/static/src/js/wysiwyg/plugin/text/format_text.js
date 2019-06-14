(function () {
'use strict';

// var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');

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

var ForeColorPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'];
        this.dependencies = ['Text'];
        this.buttons = {
            template: 'wysiwyg.buttons.forecolor',
            active: '_active',
            enabled: '_enabled',
        };

        var self = this;
        this._colors = this.options.colors;
        if (this.options.getColor) {
                console.log('COLOR to load');
            this._initializePromise = this.options.getColors().then(function (colors) {
                console.log('COLOR');
                self._colors = colors;
            });
        }
    }
    /**
     * @returns {Promise}
     */
    isInitialized () {
        return $.when(super.isInitialized(), this._initializePromise);
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Method called on custom color button click :
     * opens the color picker dialog and saves the chosen color on save.
     */
    custom (value, range) {
        var self = this;
        var $button = $(range.sc).next('button');
        var colorPickerDialog = new ColorpickerDialog(this, {});

        colorPickerDialog.on('colorpicker:saved', this, this._wrapCommand(function (ev) {
            self.update(ev.data.cssColor);

            $button = $button.clone().appendTo($button.parent());
            $button.show();
            $button.css('background-color', ev.data.cssColor);
            $button.attr('data-value', ev.data.cssColor);
            $button.data('value', ev.data.cssColor);
            $button.attr('title', ev.data.cssColor);
            $button.mousedown();
        }));
        colorPickerDialog.open();
    }
    /**
     * Change the selection's fore color.
     *
     * @param {string} color (hexadecimal or class name)
     */
    update (color, range) {
        if (!color || color.startsWith('#')) {
            color = color || '';
            $(range.sc).css('color', color);
        } else {
            $(range.sc).addClass('text-' + color);
        }
        this.dependencies.Text.applyFont(color || 'text-undefined', null, null, range);
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
        var colorName = buttonName.split('-')[1];
        if (colorName[0] === '#') {
            colorName = $('<div>').css('color', colorName).css('color'); // TODO: use a js converter xml => rgb
            while (this.editable !== focusNode && document !== focusNode) {
                if (focusNode.style && focusNode.style.color !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return document !== focusNode && colorName === $(focusNode).css('color');
        } else {
            return $(focusNode).closest('text-' + colorName).length;
        }
    }
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return !!focusNode.ancestor('isFormatNode');
    }
};

var BgColorPlugin = class extends ForeColorPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'];
        this.dependencies = ['Text'];
        this.buttons = {
            template: 'wysiwyg.buttons.bgcolor',
            active: '_active',
            enabled: '_enabled',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the selection's background color.
     *
     * @param {String} color (hexadecimal or class name)
     * @param {Node} [range]
     */
    update (color, range) {
        if (!color || color.startsWith('#')) {
            color = color || '';
            $(range.sc).css('background-color', color);
        } else {
            $(range.sc).addClass('bg-' + color);
        }
        this.dependencies.Text.applyFont(null, color || 'bg-undefined', null, range);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        var colorName = buttonName.split('-')[1];
        if (colorName[0] === '#') {
            colorName = $('<div>').css('color', colorName).css('color'); // TODO: use a js converter xml => rgb
            while (this.editable !== focusNode && document !== focusNode) {
                if (focusNode.style && focusNode.style.backgroundColor !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return document !== focusNode && colorName === $(focusNode).css('background-color');
        } else {
            return $(focusNode).closest('bg-' + colorName).length;
        }
    }
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return !!focusNode.ancestor('isFormatNode');
    }
};

var FontSizePlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Text'];
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
        return !!focusNode.ancestor('isFormatNode');
    }
};

var FontStylePlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Media', 'Range', 'Text'];
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_format_text.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.fontstyle',
            active: '_active',
            enabled: '_enabled',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Get the "format" ancestors list of nodes.
     * In this context, a "format" node is understood as
     * an editable block or an editable element expecting text
     * (eg.: p, h1, span).
     *
     * @param {Node[]} nodes
     * @returns {Node[]}
     */
    filterFormatAncestors (nodes) {
        var self = this;
        var selectedNodes = [];
        _.each(this.utils.filterLeafChildren(nodes), function (node) {
            var ancestor = self.utils.ancestor(node, function (node) {
                return self.utils.isCell(node) || (
                    !self.dependencies.Arch.isUnbreakableNode(node) &&
                    (self.utils.isFormatNode(node, self.options.styleTags) || self.utils.isNodeBlockType(node))
                ) && !self.utils.isEditable(node);
            });
            if (!ancestor) {
                ancestor = node;
            }
            if (self.utils.isCell(ancestor)) {
                ancestor = node;
            }
            if (ancestor && selectedNodes.indexOf(ancestor) === -1) {
                selectedNodes.push(ancestor);
            }
        });
        return selectedNodes;
    }
    /**
     * Format a 'format' block: change its tagName (eg: p -> h1).
     *
     * @param {string} nodeName
     *       P, H1, H2, H3, H4, H5, H6, BLOCKQUOTE, PRE
     */
    formatBlock (nodeName) {
        var self = this;
        var selection = this.dependencies.Range.getSelectedNodes();
        var styleAncestors = [];
        selection.map(function (node) {
            var ancestor = node.ancestor((a) => self.options.styleTags.indexOf(a.nodeName) !== -1);
            if (ancestor) {
                styleAncestors.push(ancestor.id);
            }
        });
        this.dependencies.Arch.wrap(this.utils.uniq(styleAncestors), nodeName);
    }
    /**
     * (Un-)format text: make it bold, italic, ...
     *
     * @param {string} nodeName
     *       B, I, U, S, SUP, SUB
     */
    formatText (nodeName) {
        var range = this.dependencies.Range.getRange();
        var selectedTextNodes = this.dependencies.Range.getSelectedNodes((node) => node.isText() || node.isVoidoid());
        if (selectedTextNodes.length && selectedTextNodes.every((node) => node.ancestor((a) => a.nodeName === nodeName))) {
            this.dependencies.Arch.unwrapRangeFrom(nodeName);
        } else {
            this.dependencies.Arch.wrapRange(nodeName);
        }
        if (range.scID !== range.ecID) {
            this.dependencies.Range.setRange(range);
        }
    }
    /**
     * Remove format on the current range.
     *
     * @see utils.formatTags the list of removeFormat candidates as defined by W3C
     */
    removeFormat (focusNode) {
        var range = this.dependencies.Range.getRange();
        if (this.dependencies.Range.isCollapsed()) {
            this.dependencies.Arch.unwrapFrom(focusNode.id, we3.tags.format);
        } else {
            this.dependencies.Arch.unwrapRangeFrom(we3.tags.format);
        }
        if (range.scID !== range.ecID) {
            this.dependencies.Range.setRange(range);
        }
        range = this.dependencies.Range.getRange();
        var cleanedStyles = []
        this.dependencies.Range.getSelectedNodes().forEach(function (node) {
            if (!node.style || !node.style.length) {
                return;
            }
            node.style.clear();
            cleanedStyles.push(node.parent);
        });
        if (!cleanedStyles.length) {
            return;
        }
        var json = [];
        we3.utils.uniq(cleanedStyles).forEach(node => json.push(node.toJSON()))
        this.dependencies.Arch.importUpdate(json);
        this.dependencies.Range.setRange(range);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        var formatName = buttonName.split('-')[1].toLowerCase();
        switch (buttonName.split('-', 1)[0]) {
            case 'formatBlock':
                var formatBlockAncestor = focusNode.ancestor(function (n) {
                    return n.isFormatNode();
                });
                if (!formatBlockAncestor) {
                    return buttonName === 'formatBlock-p';
                }
                return formatBlockAncestor.nodeName === formatName ||
                    formatBlockAncestor.className.contains(formatName);
            case 'formatText':
                if (formatName === 'remove') {
                    return false;
                }
                return !!focusNode.isInTag(formatName);
        }
        return false;
    }
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return !!focusNode.ancestor('isFormatNode');
    }
};

var ParagraphPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['FontStyle', 'List'];
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_format_text.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.paragraph',
            active: '_active',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the paragraph alignment of a 'format' block.
     *
     * @param {string} align
     *       left, center, right, justify
     */
    align (align, range) {
        var self = this;
        if (!range.isCollapsed()) {
            range.replace(this.dom.splitTextAtSelection(range));
        }
        var nodes = range.getSelectedNodes(function (node) {
            return self.utils.isVisibleText(node) || self.dependencies.Arch.isVoidoid(node);
        });
        nodes = this.dependencies.FontStyle.filterFormatAncestors(nodes);
        _.each(nodes, function (node) {
            if (self.utils.isText(node)) {
                return;
            }
            var textAlign = self.window.getComputedStyle(node).textAlign;
            if (align !== textAlign) {
                if (align !== self.window.getComputedStyle(node.parentNode).textAlign) {
                    $(node).css('text-align', align);
                } else {
                    $(node).css('text-align', '');
                }
            }
        });
        this.editable.normalize();
    }
    /**
     * Indent a node (list or format node).
     *
     * @returns {false|Node[]} contents of list/indented item
     */
    indent (value, range) {
        return this.dependencies.Arch.indent();
    }
    /**
     * Outdent a node (list or format node).
     *
     * @returns {false|Node[]} contents of list/outdented item
     */
    outdent (value, range) {
        return this.dependencies.Arch.outdent();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        var alignName = buttonName.split('-')[1];
        var alignedAncestor = focusNode.isText() ? focusNode.parent : focusNode;
        var cssAlign = alignedAncestor.style.textAlign;
        while (alignedAncestor && !alignedAncestor.isRoot() && !cssAlign) {
            cssAlign = alignedAncestor.style['text-align'];
            alignedAncestor = alignedAncestor.parent;
        }
        if (alignName == 'left' && !cssAlign) {
            return true;
        }
        return alignName === cssAlign;
    }
    /**
     * Indent or outdent a format node.
     *
     * @param {bool} outdent true to outdent, false to indent
     * @returns {false|[]Node} indented nodes
     */
    _indent (outdent, range) {
        if (!range) {
            return;
        }

        var self = this;
        var nodes = [];
        var isWithinElem;
        var ancestor = range.commonAncestor();
        var $dom = $(ancestor);

        if (!this.utils.isList(ancestor)) {
            // to indent a selection, we indent the child nodes of the common
            // ancestor that contains this selection
            $dom = $(ancestor.tagName ? ancestor : ancestor.parentNode).children();
        }

        // if selection is inside indented contents and outdent is true, we can outdent this node
        var indentedContent = outdent && this.utils.ancestor(ancestor, function (node) {
            var style = self.utils.isCell(node) ? 'paddingLeft' : 'marginLeft';
            return node.tagName && !!parseFloat(node.style[style] || 0);
        });

        if (indentedContent) {
            $dom = $(indentedContent);
        } else {
            // if selection is inside a list, we indent its list items
            $dom = $(this.utils.ancestor(ancestor, this.utils.isList));
            if (!$dom.length) {
                // if the selection is contained in a single HTML node, we indent
                // the first ancestor 'content block' (P, H1, PRE, ...) or TD
                $dom = $(range.sc).closest(this.options.styleTags.join(',') + ',td');
            }
        }

        // if select tr, take the first td
        $dom = $dom.map(function () {
            return this.tagName === "TR" ? this.firstElementChild : this;
        });

        var newNode;
        $dom.each(function () {
            if (isWithinElem || $.contains(this, range.sc)) {
                if (self.utils.isList(this)) {
                    if (outdent) {
                        var type = this.tagName === 'OL' ? 'ol' : (this.className && this.className.contains('o_checklist') ? 'checklist' : 'ul');
                        newNode = (self.dependencies.List.convertList(isWithinElem, nodes, range.getStartPoint(), range.getEndPoint(), type) || [])[0];
                        isWithinElem = !!newNode;
                    } else {
                        isWithinElem = self._indentUL(isWithinElem, nodes, this, range.sc, range.ec);
                    }
                } else if (self.utils.isFormatNode(this, self.options.styleTags) || self.utils.ancestor(this, self.utils.isCell)) {
                    isWithinElem = self._indentFormatNode(outdent, isWithinElem, nodes, this, range.sc, range.ec);
                }
            }
        });

        if (newNode) {
            var firstLeaf = this.utils.firstLeaf(newNode);
            range.replace({
                sc: firstLeaf,
                so: this.utils.isText(firstLeaf) ? range.so : 0,
            });
        }

        if ($dom.parent().length) {
            var $parent = $dom.parent();

            // remove text nodes between lists
            var $ul = $parent.find('ul, ol');
            if (!$ul.length) {
                $ul = $(range.scArch.isList());
            }
            $ul.each(function () {
                var notWhitespace = /\S/;
                if (
                    this.previousSibling &&
                    this.previousSibling !== this.previousElementSibling &&
                    !this.previousSibling.textContent.match(notWhitespace)
                ) {
                    this.parentNode.removeChild(this.previousSibling);
                }
                if (
                    this.nextSibling &&
                    this.nextSibling !== this.nextElementSibling &&
                    !this.nextSibling.textContent.match(notWhitespace)
                ) {
                    this.parentNode.removeChild(this.nextSibling);
                }
            });

            // merge same ul or ol
            $ul.prev('ul, ol').each(function () {
                self.dom.deleteEdge(this, false);
            });

        }

        range = this.dependencies.Arch.setRange(range.getPoints()).normalize();
        this.dependencies.Arch.setRange(range);

        return !!nodes.length && nodes;
    }
    /**
     * Indent several LIs in a list.
     *
     * @param {bool} isWithinElem true if selection already inside the LI
     * @param {Node[]} nodes
     * @param {Node} UL
     * @param {Node} start
     * @param {Node} end
     * @returns {bool} isWithinElem
     */
    _indentUL (isWithinElem, nodes, UL, start, end) {
        var next;
        var tagName = UL.tagName;
        var node = UL.firstChild;
        var ul = document.createElement(tagName);
        ul.className = UL.className;
        var flag;

        if (isWithinElem) {
            flag = true;
        }

        // create and fill ul into a li
        while (node) {
            if (flag || node === start || $.contains(node, start)) {
                isWithinElem = true;
                node.parentNode.insertBefore(ul, node);
            }
            next = node.nextElementSibling;
            if (isWithinElem) {
                ul.appendChild(node);
                nodes.push(node);
            }
            if (node === end || $.contains(node, end)) {
                isWithinElem = false;
                break;
            }
            node = next;
        }

        var temp;
        var prev = ul.previousElementSibling;
        if (
            prev && prev.tagName === "LI" &&
            (temp = prev.firstElementChild) && temp.tagName === tagName &&
            ((prev.firstElementChild || prev.firstChild) !== ul)
        ) {
            $(prev.firstElementChild || prev.firstChild).append($(ul).contents());
            $(ul).remove();
            ul = prev;
            ul.parentNode.removeChild(ul.nextElementSibling);
        }
        next = ul.nextElementSibling;
        if (
            next && next.tagName === "LI" &&
            (temp = next.firstElementChild) && temp.tagName === tagName &&
            (ul.firstElementChild !== next.firstElementChild)
        ) {
            $(ul.firstElementChild).append($(next.firstElementChild).contents());
            $(next.firstElementChild).remove();
            ul.parentNode.removeChild(ul.nextElementSibling);
        }

        // wrap in li
        var li = document.createElement('li');
        li.className = 'o_indent';
        $(ul).before(li);
        li.appendChild(ul);

        return isWithinElem;
    }
    /**
     * Outdent a container node.
     *
     * @param {Node} node
     * @returns {float} margin
     */
    _outdentContainer (node) {
        var style = this.utils.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0) - 1.5;
        node.style[style] = margin > 0 ? margin + "em" : "";
        return margin;
    }
    /**
     * Indent a container node.
     *
     * @param {Node} node
     * @returns {float} margin
     */
    _indentContainer (node) {
        var style = this.utils.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0) + 1.5;
        node.style[style] = margin + "em";
        return margin;
    }
    /**
     * Indent/outdent a format node.
     *
     * @param {bool} outdent true to outdent, false to indent
     * @param {bool} isWithinElem true if selection already inside the element
     * @param {DOM[]} nodes
     * @param {DOM} p
     * @param {DOM} start
     * @param {DOM} end
     * @returns {bool} isWithinElem
     */
    _indentFormatNode (outdent, isWithinElem, nodes, p, start, end) {
        if (p === start || $.contains(p, start) || $.contains(start, p)) {
            isWithinElem = true;
        }
        if (isWithinElem) {
            nodes.push(p);
            if (outdent) {
                this._outdentContainer(p);
            } else {
                this._indentContainer(p);
            }
        }
        if (p === end || $.contains(p, end) || $.contains(end, p)) {
            isWithinElem = false;
        }
        return isWithinElem;
    }
};

we3.addPlugin('Text', TextPlugin);
we3.addPlugin('ForeColor', ForeColorPlugin);
we3.addPlugin('BgColor', BgColorPlugin);
we3.addPlugin('FontSize', FontSizePlugin);
we3.addPlugin('FontStyle', FontStylePlugin);
we3.addPlugin('Paragraph', ParagraphPlugin);

})();
