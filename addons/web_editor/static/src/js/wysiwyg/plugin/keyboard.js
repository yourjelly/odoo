odoo.define('web_editor.wysiwyg.plugin.keyboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;
dom.isAnchor = function (node) {
    return (node.tagName === 'A' || node.tagName === 'BUTTON' || $(node).hasClass('btn')) &&
        !$(node).hasClass('fa') && !$(node).hasClass('o_image');
};

var KeyboardPlugin = AbstractPlugin.extend({
    events: {
        'summernote.keydown': '_onKeydown',
        'DOMNodeInserted .note-editable': '_removeGarbageSpans',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------



    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Perform operations that are necessary after the insertion of a visible character:
     * adapt range for the presence of zero-width characters, move out of media, rerange.
     *
     * @private
     */
    _afterVisibleChar: function () {
        var range = this.context.invoke('editor.createRange');
        if (range.sc.tagName || dom.ancestor(range.sc, dom.isAnchor)) {
            return true;
        }
        var needReselect = false;
        var fake = range.sc.parentNode;
        if ((fake.className || '').indexOf('o_fake_editable') !== -1 && dom.isMedia(fake)) {
            var $media = $(fake.parentNode);
            $media[fake.previousElementSibling ? 'after' : 'before'](fake.firstChild);
            needReselect = true;
        }
        if (range.sc.textContent.slice(range.so - 2, range.so - 1) === '\u200B') {
            range.sc.textContent = range.sc.textContent.slice(0, range.so - 2) + range.sc.textContent.slice(range.so - 1);
            range.so = range.eo = range.so - 1;
            needReselect = true;
        }
        if (range.sc.textContent.slice(range.so, range.so + 1) === '\u200B') {
            range.sc.textContent = range.sc.textContent.slice(0, range.so) + range.sc.textContent.slice(range.so + 1);
            needReselect = true;
        }
        if (needReselect) {
            range.normalize().select();
        }
    },
    /**
     * Handle deletion (BACKSPACE / DELETE).
     *
     * @private
     * @param {String('prev'|'next')} direction 'prev' to delete BEFORE the carret
     * @returns {Boolean} true if case handled
     */
    _handleDeletion: function (direction) {
        var self = this;
        var deleteNodes = this.context.invoke('HelperPlugin.deleteSelection');
        var range = this.context.invoke('editor.createRange');
        var prevBR = direction === 'prev' && !range.so && range.sc.tagName === 'BR';

        if (range.sc.childNodes[range.so]) {
            if (direction === 'prev' && range.so > 0) {
                range.sc = range.ec = range.sc.childNodes[range.so - 1];
                range.so = range.eo = dom.nodeLength(range.sc);
            } else {
                range.sc = range.ec = range.sc.childNodes[range.so];
                range.so = range.eo = 0;
            }
        }

        if (
            !range.sc.tagName && range.so === 1 && range.sc.textContent[0] === '\u200B' &&
            !(range.sc.previousSibling && range.sc.previousSibling.previousSibling &&
                range.sc.previousSibling.tagName === 'BR' && range.sc.previousSibling.previousSibling.tagName === 'BR')
        ) {
            range.sc.textContent = range.sc.textContent.slice(1);
            range.so = 0;
        }
        if (
            !range.sc.tagName && range.so === dom.nodeLength(range.sc) - 1 && range.sc.textContent.slice(range.so) === '\u200B' &&
            !(range.sc.previousSibling && range.sc.previousSibling.tagName === 'BR')
        ) {
            range.sc.textContent = range.sc.textContent.slice(0, range.so);
        }
        if (
            direction === 'prev' &&
            (range.so === 1 && range.sc.childElementCount === 1 && range.sc.firstChild.tagName === 'BR' ||
                range.sc.childElementCount && range.so === dom.nodeLength(range.sc) && range.sc.lastChild.tagName === 'BR' &&
                _.all(range.sc.childNodes, function (n) {
                    return dom.isText(n) || n === range.sc.lastChild;
                })
            )
        ) {
            // If we're after a BR in an element that has only a BR (or text and a BR), and moving in direction prev: move before the BR
            range.so -= 1;
        }

        if (dom.isMedia(range.sc)) {
            range.so = range.eo = 0;
            var span = this.document.createElement('span');
            var media = dom.ancestor(range.sc, function (n) {
                return !n.parentNode || !dom.isMedia(n.parentNode);
            });
            $(media).replaceWith(span);
            range.sc = range.ec = span;
            deleteNodes = true;
        } else if (deleteNodes) {
            direction = 'next';
        } else {
            while (
                !range.sc.tagName && direction === 'prev' &&
                range.so && range.sc.textContent[range.so - 1] === '\u200B'
            ) {
                var text = range.sc.textContent;
                range.sc.textContent = text.slice(0, range.so - 1) + text.slice(range.so, text.length);
                range.so -= 1;
            }
            // If everything is just space before/after the range, skip it all
            if (!range.sc.tagName && !dom.ancestor(range.sc, dom.isPre)) {
                var changed = this.context.invoke('HelperPlugin.removeExtremeBreakableSpace', range.sc);
                range.so = range.eo = range.so > changed.start ? range.so - changed.start : 0;
                range.so = range.eo = range.so > dom.nodeLength(range.sc) ? dom.nodeLength(range.sc) : range.so;
                range.select();
                this.context.invoke('editor.saveRange');
            }
            if (
                (range.sc.tagName !== 'BR' || range.sc.parentNode.innerHTML.trim() === "<br>") &&
                (direction === 'next' && range.so === dom.nodeLength(range.sc) ||
                    direction === 'prev' && range.so === 0)
            ) {
                var rest = this.context.invoke('HelperPlugin.deleteEdge', range.sc, direction);
                deleteNodes = !!rest;
                if (deleteNodes) {
                    range.sc = range.ec = rest.node;
                    range.so = range.eo = rest.offset;
                }
            }
        }

        if (!deleteNodes) {
            // delete next char

            var method = direction === 'prev' ? 'prevPointUntil' : 'nextPointUntil';
            var hasBlock = false;
            var blockToRemove = false;

            var pt = dom[method]({
                node: range.sc,
                offset: range.so,
            }, function (point) {
                if (!point.offset && self.context.invoke('HelperPlugin.isNodeBlockType', point.node)) {
                    hasBlock = true;
                    if (blockToRemove) {
                        return true;
                    }
                }
                if (
                    !blockToRemove &&
                    (!point.offset && dom.isMedia(point.node) ||
                        ((point.node.tagName === 'BR' || point.node.tagName === 'HR') && (!prevBR || point.node !== range.sc)))
                ) {
                    blockToRemove = point.node;
                    return false;
                }
                if (range.ec === point.node && range.eo === point.offset) {
                    return false;
                }

                return (
                    self.context.invoke('HelperPlugin.isVisibleText', point.node) ||
                    dom.isMedia(point.node) ||
                    point.node.tagName === 'BR'
                ) && self.options.isEditableNode(point.node);
            });

            if (pt) {
                var hasChanged;
                if (blockToRemove) {
                    if (blockToRemove.tagName !== "BR" || blockToRemove.parentNode.childNodes.length !== 1) { // keep the last br
                        $(blockToRemove).remove();
                        if (blockToRemove.tagName === "HR") {
                            pt = this.context.invoke('HelperPlugin.deleteEdge', range.sc, direction);
                        }
                        hasChanged = true;
                    }
                } else if (!hasBlock) {
                    if (pt.offset && direction === 'next' || !pt.node.tagName && pt.offset === dom.nodeLength(pt.node)) {
                        pt.offset -= 1;
                    }

                    pt.node.textContent = pt.node.textContent.slice(0, pt.offset) + pt.node.textContent.slice(pt.offset + 1);
                    if (!dom.ancestor(range.sc, dom.isPre)) {
                        this.context.invoke('HelperPlugin.secureExtremeSingleSpace', pt.node);
                    }
                    if (!pt.offset && direction === 'prev' && (!pt.node.previousSibling || pt.node.previousSibling.tagName === "BR")) {
                        var startSpace = this.context.invoke('HelperPlugin.getRegex', 'startSpace');
                        pt.node.textContent = pt.node.textContent.replace(startSpace, '\u00A0');
                    }
                    hasChanged = true;
                }

                if (hasChanged) {
                    range.sc = range.ec = pt.node;
                    range.so = range.eo = pt.offset;
                }
            }
        }

        // Carret after \w<br> with no text after br should insert a zero-width character after br, to make the br visible on screen
        if (
            direction === 'prev' && !range.so && dom.isText(range.sc) &&
            !this.context.invoke('HelperPlugin.isVisibleText', range.sc) &&
            range.sc.previousSibling && range.sc.previousSibling.tagName === 'BR' &&
            range.sc.previousSibling.previousSibling && range.sc.previousSibling.previousSibling.tagName !== 'BR'
        ) {
            var invisibleChar = this.document.createTextNode('\u200B');
            $(range.sc.previousSibling).after(invisibleChar);
            range.sc = range.ec = invisibleChar;
            range.so = range.eo = 1;
        }

        while (range.sc.firstElementChild && range.sc.firstElementChild.tagName !== 'BR') {
            range.sc = range.sc.firstElementChild;
            range.so = 0;
        }

        var point = {
            node: range.sc,
            offset: range.so,
        };
        point = dom[direction === 'prev' ? 'nextPointUntil' : 'prevPointUntil'](point, function (pt) {
            return pt.node.tagName !== 'BR';
        });
        point = this.context.invoke('HelperPlugin.removeEmptyInlineNodes', point);
        point = this.context.invoke('HelperPlugin.fillEmptyNode', point);
        range.ec = range.sc = point.node;
        range.eo = range.so = point.offset;

        range = range.collapse(direction === 'prev').select();

        this.editable.normalize();
        return _.isArray(deleteNodes) ? !!deleteNodes.length : deleteNodes;
    },
    /**
     * Handle ENTER.
     *
     * @private
     * @returns {Boolean} true if case handled
     */
    _handleEnter: function () {
        var self = this;
        var range = this.context.invoke('editor.createRange');

        var ancestor = dom.ancestor(range.sc, function (node) {
            return dom.isLi(node) || self.options.isUnbreakableNode(node.parentNode) && node.parentNode !== self.editable ||
                self.context.invoke('HelperPlugin.isNodeBlockType', node) && !dom.ancestor(node, dom.isLi);
        });

        if (
            dom.isLi(ancestor) && !$(ancestor.parentNode).hasClass('list-group') &&
            this.context.invoke('HelperPlugin.getRegexBlank', {
                space: true,
                newline: true,
            }).test(ancestor.textContent) &&
            $(ancestor).find('br').length <= 1 &&
            !$(ancestor).find('.fa, img').length
        ) {
            // double enter in a list make oudent
            this.context.invoke('BulletPlugin.outdent');
            return true;
        }

        var btn = dom.ancestor(range.sc, function (n) {
            return $(n).hasClass('btn');
        });

        var point = {
            node: range.sc,
            offset: range.so,
        };

        if (!point.node.tagName && this.options.isUnbreakableNode(point.node.parentNode)) {
            return this._handleShiftEnter();
        }

        if (point.node.tagName && point.node.childNodes[point.offset] && point.node.childNodes[point.offset].tagName === "BR") {
            point = dom.nextPoint(point);
        }
        if (point.node.tagName === "BR") {
            point = dom.nextPoint(point);
        }

        var next = this.context.invoke('HelperPlugin.splitTree', ancestor, point, {
            isSkipPaddingBlankHTML: !this.context.invoke('HelperPlugin.isNodeBlockType', point.node.parentNode) && !!point.node.parentNode.nextSibling
        });
        while (next.firstChild) {
            next = next.firstChild;
        }

        // if there is no block in the split parents, then we add a br between the two node
        var hasSplitBlock = false;
        var node = next;
        var lastChecked = node;
        while (node && node !== ancestor && node !== this.editable) {
            if (this.context.invoke('HelperPlugin.isNodeBlockType', node)) {
                hasSplitBlock = true;
                break;
            }
            lastChecked = node;
            node = node.parentNode;
        }
        if (!hasSplitBlock && lastChecked.tagName) {
            $(lastChecked).before(this.document.createElement('br'));
        }

        if (!next.tagName) {
            this.context.invoke('HelperPlugin.secureExtremeSingleSpace', next);
        }
        if (next.tagName !== "BR" && next.innerHTML === "") {
            next.innerHTML = '\u200B';
        }
        if (ancestor) {
            var firstChild = this.context.invoke('HelperPlugin.firstLeaf', ancestor);
            var lastChild = this.context.invoke('HelperPlugin.lastLeaf', ancestor);
            if (this.context.invoke('HelperPlugin.isBlankNode', ancestor)) {
                firstChild = dom.isText(firstChild) ? firstChild.parentNode : firstChild;
                $(firstChild).contents().remove();
                $(firstChild).append(this.document.createElement('br'));
            }
            if (lastChild.tagName === 'BR' && lastChild.previousSibling) {
                $(lastChild).after(this.document.createTextNode('\u200B'));
            }
        }

        // move to next editable area
        point = {
            node: next,
            offset: 0,
        };
        if (
            (point.node.tagName && point.node.tagName !== 'BR') ||
            !this.context.invoke('HelperPlugin.isVisibleText', point.node.textContent)
        ) {
            point = dom.nextPointUntil(point, function (pt) {
                if (pt.node === point.node) {
                    return;
                }
                return (
                        pt.node.tagName === "BR" ||
                        self.context.invoke('HelperPlugin.isVisibleText', pt.node)
                    ) &&
                    self.options.isEditableNode(pt.node);
            });
            point = point || {
                node: next,
                offset: 0,
            };
            if (point.node.tagName === "BR") {
                point = dom.nextPoint(point);
            }
        }

        if (!hasSplitBlock && !point.node.tagName) {
            point.node.textContent = '\u200B' + point.node.textContent;
            point.offset = 1;
        }

        // if the left part of the split node ends with a space, replace that space with nbsp
        if (range.sc.textContent) {
            var endSpace = this.context.invoke('HelperPlugin.getRegex', 'endSpace');
            range.sc.textContent = range.sc.textContent.replace(endSpace,
                function (trailingSpaces) {
                    return Array(trailingSpaces.length + 1).join('\u00A0');
                }
            );
        }

        // On buttons, we want to split the button and move to the beginning of it
        if (btn) {
            next = dom.ancestor(point.node, function (n) {
                return $(n).hasClass('btn');
            });

            // Move carret to the new button
            range.sc = range.ec = next.firstChild;
            range.so = range.eo = 0;
            range.select();

            // Force content in empty buttons, the carret can be moved there
            this.context.invoke('LinkPopover.hide');
            this.context.invoke('LinkPopover.fillEmptyLink', next, true);
            this.context.invoke('LinkPopover.fillEmptyLink', btn, true);
        } else {
            range.sc = range.ec = point.node;
            range.so = range.eo = point.offset;
            range.normalize().select();
        }

        return true;
    },
    /**
     * Handle SHIFT+ENTER.
     * 
     * @private
     * @returns {Boolean} true if case handled
     */
    _handleShiftEnter: function () {
        var range = this.context.invoke('editor.createRange');
        var target = range.sc.childNodes[range.so] || range.sc;
        var before;
        if (target.tagName) {
            if (target.tagName === "BR") {
                before = target;
            } else if (target === range.sc) {
                if (range.so) {
                    before = range.sc.childNodes[range.so - 1];
                } else {
                    before = this.document.createTextNode('');
                    $(range.sc).append(before);
                }
            }
        } else {
            before = target;
            var after = target.splitText(target === range.sc ? range.so : 0);
            if (
                !after.nextSibling && after.textContent === '' &&
                this.context.invoke('HelperPlugin.isNodeBlockType', after.parentNode)
            ) {
                after.textContent = '\u200B';
            }
            if (!after.tagName && (!after.previousSibling || after.previousSibling.tagName === "BR")) {
                after.textContent = after.textContent.replace(startSpace, '\u00A0');
            }
        }

        if (!before) {
            return true;
        }

        var br = this.document.createElement('br');
        $(before).after(br);
        var next = {
            node: br,
            offset: 0,
        };
        var startSpace = this.context.invoke('HelperPlugin.getRegex', 'startSpace');

        if (!before.tagName) {
            next = dom.nextPoint(next);
            var nextNode = this.context.invoke('HelperPlugin.firstLeaf', next.node.childNodes[next.offset] || next.node);
            if (!nextNode.tagName) {
                next.node = nextNode;
                next.offset = 0;
            }
        }

        if (
            next.node.tagName === "BR" && next.node.nextSibling &&
            !next.node.nextSibling.tagName && !dom.ancestor(next.node, dom.isPre)
        ) {
            next.node.nextSibling.textContent = next.node.nextSibling.textContent.replace(startSpace, '\u00A0');
        }
        if (
            !next.node.tagName &&
            (!next.node.previousSibling || next.node.previousSibling.tagName === "BR") &&
            !dom.ancestor(next.node, dom.isPre)
        ) {
            next.node.textContent = next.node.textContent.replace(startSpace, '\u00A0');
        }

        range.sc = range.ec = next.node;
        range.so = range.eo = next.offset;
        range.select();

        return true;
    },
    /**
     * Prevent the appearance of a text node with the editable DIV as direct parent:
     * wrap it in a p element.
     *
     * @private
     */
    _preventTextInEditableDiv: function () {
        var range = this.context.invoke('editor.createRange');
        while (
            dom.isText(this.editable.firstChild) &&
            !this.context.invoke('HelperPlugin.isVisibleText', this.editable.firstChild)
        ) {
            var node = this.editable.firstChild;
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
        var editableIsEmpty = !this.editable.childNodes.length;
        if (editableIsEmpty) {
            var p = this.document.createElement('p');
            p.innerHTML = '<br>';
            this.editable.appendChild(p);
            range.sc = range.ec = p;
            range.so = range.eo = 0;
        } else if (this.context.invoke('HelperPlugin.isBlankNode', this.editable.firstChild) && !range.sc.parentNode) {
            this.editable.firstChild.innerHTML = '<br/>';
            range.sc = range.ec = this.editable.firstChild;
            range.so = range.eo = 0;
        }

        range.select();
    },
    /**
     * Patch for Google Chrome's contenteditable SPAN bug.
     *
     * @private
     * @param {jQueryEvent} e
     */
    _removeGarbageSpans: function (e) {
        if (e.target.className === "" && e.target.tagName == "SPAN" &&
            e.target.style.fontStyle === "inherit" &&
            e.target.style.fontVariantLigatures === "inherit" &&
            e.target.style.fontVariantCaps === "inherit") {
            var $span = $(e.target);
            $span.after($span.contents()).remove();
        }
    },


    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /** 
     * Customize handling of certain keydown events.
     *
     * @private
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case handled
     */
    _onKeydown: function (se, e) {
        var self = this;
        var handled = false;

        if (e.key &&
            (e.key.length === 1 || e.key === "Dead" || e.key === "Unidentified") &&
            !e.ctrlKey && !e.altKey && !e.metaKey) {

            if (e.key === "Dead" || e.key === "Unidentified") {
                this._accented = true;
            }

            clearTimeout(this.lastCharIsVisibleTime);
            this.lastCharIsVisibleTime = setTimeout(function () {
                self.lastCharIsVisible = false;
            }, 500);
            if (!this.lastCharIsVisible) {
                this.lastCharIsVisible = true;
                this.context.invoke('HistoryPlugin.recordUndo');
            }
            if (e.key !== "Dead") {
                this._onVisibleChar(e, this._accented);
            }
        } else {
            this.lastCharIsVisible = false;
            this.context.invoke('editor.clearTarget');
            this.context.invoke('MediaPlugin.hidePopovers');
            this.context.invoke('editor.beforeCommand');
            switch (e.keyCode) {
                case 8: // BACKSPACE
                    handled = this._onBackspace(e);
                    break;
                case 9: // TAB
                    handled = this._onTab(e);
                    break;
                case 13: // ENTER
                    handled = this._onEnter(e);
                    break;
                case 46: // DELETE
                    handled = this._onDelete(e);
                    break;
            }
            if (handled) {
                this._preventTextInEditableDiv();
                this.context.invoke('editor.saveRange');
                e.preventDefault();
                this.context.invoke('editor.afterCommand');
            }
        }
        if (e.key !== "Dead") {
            this._accented = false;
        }
    },
    /**
     * Handle BACKSPACE keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onBackspace: function (e) {
        var range = this.context.invoke('editor.createRange');
        var needOutdent = false;

        // Special cases
        if (range.isCollapsed()) {

            // Do nothing if on left edge of a table cell
            var point = range.getStartPoint();
            if (point.node.childNodes[point.offset]) {
                point.node = point.node.childNodes[point.offset];
                point.offset = dom.nodeLength(point.node);
            }
            if (this.context.invoke('HelperPlugin.isLeftEdgeOfTag', point, 'TD')) {
                return true;
            }

            // Outdent if on left edge of an indented block
            point = {
                node: range.sc,
                offset: range.so,
            };
            var isIndented = !!dom.ancestor(point.node, function (n) {
                var style = dom.isCell(n) ? 'paddingLeft' : 'marginLeft';
                return n.tagName && !!parseFloat(n.style[style] || 0);
            });
            if (this.context.invoke('HelperPlugin.isLeftEdgeOfBlock', point)) {
                if (isIndented) {
                    this.context.invoke('BulletPlugin.outdent');
                    return true;
                }
                if (dom.ancestor(range.sc, dom.isLi)) {
                    needOutdent = true;
                }
            }
        }

        var flag = this._handleDeletion('prev');

        if (!flag && needOutdent) {
            range.select();
            this.context.invoke('BulletPlugin.outdent');
        }

        return true;
    },
    /**
     * Handle DELETE keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onDelete: function (e) {
        var range = this.context.invoke('editor.createRange');

        // Special case
        if (range.isCollapsed()) {
            // Do nothing if on left edge of a table cell
            if (this.context.invoke('HelperPlugin.isRightEdgeOfTag', {
                    node: range.sc,
                    offset: range.so,
                }, 'TD')) {
                return true;
            }
        }

        this._handleDeletion('next');
        return true;
    },
    /**
     * Handle ENTER keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onEnter: function (e) {
        this.context.invoke('HelperPlugin.deleteSelection');
        if (e.shiftKey) {
            this._handleShiftEnter();
        } else if (e.ctrlKey) {
            this.context.invoke('TextPlugin.insertHR');
        } else {
            this._handleEnter();
        }
        return true;
    },
    /**
     * Handle TAB keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onTab: function (e) {
        // If TAB not handled, prevent default and do nothing
        if (!this.options.keyMap.pc.TAB) {
            this.trigger_up('wysiwyg_blur', {
                key: 'TAB',
                keyCode: 9,
                shiftKey: e.shiftKey,
            });
            return true;
        }
        var range = this.context.invoke('editor.createRange');
        var point = {
            node: range.sc,
            offset: range.so,
        };
        var startSpace = this.context.invoke('HelperPlugin.getRegex', 'startSpace');

        if (!range.isOnCell()) {
            // If on left edge point: indent/outdent
            if (!point.node.tagName) { // Clean up start spaces on textNode
                point.node.textContent.replace(startSpace, function (startSpaces) {
                    point.offset = startSpaces.length === point.offset ? 0 : point.offset;
                    return '';
                });
            }
            if (this.context.invoke('HelperPlugin.isLeftEdgeOfBlock', point) || dom.isEmpty(point.node)) {
                if (e.shiftKey) {
                    this.context.invoke('BulletPlugin.outdent');
                } else {
                    this.context.invoke('BulletPlugin.indent');
                }
                this.context.invoke('HelperPlugin.normalize');
                return true;
            }
            // Otherwise insert a tab or do nothing
            if (!e.shiftKey) {
                this.context.invoke('TextPlugin.insertTab');
                this.context.invoke('HelperPlugin.normalize');
            }
            return true;
        }
        // In table, on tab switch to next cell
        return false;
    },
    /**
     * Handle visible char keydown event.
     *
     * @private
     * @param {jQueryEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onVisibleChar: function (e, accented) {
        var self = this;
        e.preventDefault();
        this.context.invoke('HelperPlugin.deleteSelection');
        var baseRange = this.context.invoke('editor.createRange');

        var to;
        baseRange = this.context.invoke('editor.fixRange');
        if (baseRange.sc.childNodes[baseRange.so]) {
            baseRange.sc = baseRange.ec = baseRange.sc.childNodes[baseRange.so];
            baseRange.so = baseRange.eo = 0;
        }
        if (baseRange.sc.tagName === 'IMG') {
            to = this.document.createTextNode('\u200B');
            $(baseRange.sc).before(to);
            baseRange.sc = baseRange.ec = to;
            baseRange.so = baseRange.eo = 0;
            baseRange.select();
            this.editable.normalize();
        } else if (!baseRange.sc.tagName && baseRange.so >= dom.nodeLength(baseRange.sc)) {
            to = this.document.createTextNode('\u200B');
            $(baseRange.sc).after(to);
            baseRange.sc = baseRange.ec = to;
            baseRange.so = baseRange.eo = 0;
            baseRange.select();
            this.editable.normalize();
        }

        if (!baseRange.sc.tagName && baseRange.sc.textContent.match(/\S/)) {
            var before = baseRange.sc.textContent.slice(0, baseRange.so);
            var after = baseRange.sc.textContent.slice(baseRange.so);

            if (
                (before.length || after.length) &&
                (!before.length || before[before.length - 1] === ' ') &&
                (!after.length || after[0] === ' ')
            ) {
                var startSpace = this.context.invoke('HelperPlugin.getRegex', 'startSpace');
                var endSpace = this.context.invoke('HelperPlugin.getRegex', 'endSpace');
                before = before.replace(endSpace, '\u00A0');
                after = after.replace(startSpace, '\u00A0');
                baseRange.sc.textContent = before + after;
                if (baseRange.so > before.length) {
                    baseRange.so = baseRange.eo = before.length;
                }
                baseRange.select();
            }
        }

        if (accented) {
            baseRange = this.context.invoke('editor.createRange');
            var $node = $(baseRange.sc).closest('*')
                .not('.note-editable, .o_editable, .o_fake_editable, .o_fake_not_editable')
                .attr('contenteditable', 'true');
            setTimeout(function () {
                $node.removeAttr('contenteditable', 'true');
                self._afterVisibleChar();
            });
        } else {
            this.context.invoke('HelperPlugin.insertTextInline', e.key);
            this._afterVisibleChar();
        }
        return true;
    },
});

registry.add('KeyboardPlugin', KeyboardPlugin);

return KeyboardPlugin;
});
