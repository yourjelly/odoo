odoo.define('web_editor.wysiwyg.plugin.bullet', function (require) {
'use strict';

var core = require('web.core');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var wysiwygOptions = require('web_editor.wysiwyg.options');
var registry = require('web_editor.wysiwyg.plugin.registry');
var wysiwygTranslation = require('web_editor.wysiwyg.translation');

var _t = core._t;
var dom = $.summernote.dom;

wysiwygOptions.icons.checklist = 'fa fa-check-square';
wysiwygOptions.keyMap.pc['CTRL+SHIFT+NUM9'] = 'insertCheckList';
wysiwygOptions.keyMap.mac['CMD+SHIFT+NUM9'] = 'insertCheckList';
wysiwygTranslation.lists.checklist = _t('Checklist');
wysiwygTranslation.help.checklist = _t('Toggle checkbox list');


var BulletPlugin = AbstractPlugin.extend({
    events: {
        'summernote.mousedown': '_onMouseDown',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Insert an ordered list, an unordered list or a checklist.
     *
     * @param {string('ol'|'ul'|'checklist')} type the type of list to insert
     * @returns {false|Node[]} contents of the ul/ol or content of the removed list
     */
    insertList: function (type) {
        var range = this.context.invoke('editor.createRange');
        var nodes;
        if (!range) {
            return;
        }

        // existing list

        var ol = dom.ancestor(range.sc, dom.isList);
        if (ol) {
            var start = range.getStartPoint();
            var end = range.getEndPoint();
            nodes = [];
            this._convertList(false, nodes, start, end, type);
            range.sc = start.node;
            range.so = start.offset;
            range.ec = end.node;
            range.eo = end.offset;
            range.select();
            this.context.invoke('editor.saveRange');
            return nodes;
        }

        // create list

        nodes = this.context.invoke('HelperPlugin.getSelectedNodes');
        var formatNodes = this.context.invoke('HelperPlugin.filterFormatAncestors', nodes);

        formatNodes = _.compact(_.map(formatNodes, function (node) {
            var ancestor = (!node.tagName || node.tagName === 'BR') && dom.ancestor(node, dom.isCell);
            if (ancestor && this.options.isEditableNode(ancestor)) {
                if (!ancestor.childNodes.length) {
                    var br = this.document.createElement('br');
                    ancestor.appendChild(br);
                }
                var p = this.document.createElement('p');
                $(p).append(ancestor.childNodes);
                ancestor.appendChild(p);
                return p;
            }
            return this.options.isEditableNode(node) && node || null;
        }.bind(this)));

        if (!formatNodes.length) {
            return;
        }

        var ul = this.document.createElement(type === "ol" ? "ol" : "ul");
        if (type === 'checklist') {
            ul.className = 'o_checklist';
        }
        $(formatNodes[0][0] || formatNodes[0]).before(ul);

        _.each(formatNodes, function (node) {
            var li = this.document.createElement('li');
            $(li).append(node);
            ul.appendChild(li);
        }.bind(this));

        this.context.invoke('HelperPlugin.deleteEdge', ul, 'next');
        this.context.invoke('HelperPlugin.deleteEdge', ul, 'prev');
        this.document.normalize();

        if (range.sc.firstChild) {
            range.sc = this.context.invoke('HelperPlugin.firstLeaf', range.sc);
            range.so = 0;
        }
        if (range.ec.firstChild) {
            range.ec = this.context.invoke('HelperPlugin.lastLeaf', range.ec);
            range.eo = dom.nodeLength(range.ec);
        }
        range.select();
        this.context.invoke('editor.saveRange');
        return [].slice.call(ul.children);
    },
    /**
     * Indent a node (list or format node).
     *
     * @returns {false|Node[]} contents of list/indented item
     */
    indent: function () {
        return this._indent();
    },
    /**
     * Outdent a node (list or format node).
     *
     * @returns {false|Node[]} contents of list/outdented item
     */
    outdent: function () {
        return this._indent(true);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Add checklist buttons.
     */
    _addButtons: function () {
        this._super();
        this.context.memo('help.checklist', this.lang.help.checklist);
        this._createButton('checklist', this.options.icons.checklist, this.lang.lists.checklist, function (e) {
            e.preventDefault();
            this.context.invoke('editor.insertCheckList');
        }.bind(this));
    },
    /**
     * Convert ul<->ol or remove ul/ol.
     *
     * @param {boolean} isWithinElem true if selection already inside the LI
     * @param {DOM[]} nodes selected nodes
     * @param {Object} startPoint
     * @param {Object} endPoint
     * @param {boolean} sorted
     * @returns {boolean} isWithinElem
     */
    _convertList: function (isWithinElem, nodes, startPoint, endPoint, sorted) {
        var ol = dom.ancestor(startPoint.node, dom.isList);
        var parent = ol.parentNode;

        // get selected lis

        var lis = [];
        var lisBefore = [];
        var lisAfter = [];
        _.each(ol.children, function (li) {
            if (!isWithinElem && (li === startPoint.node || $.contains(li, startPoint.node))) {
                isWithinElem = true;
            }
            if (isWithinElem) {
                lis.push(li);
            } else if (lis.length) {
                lisAfter.push(li);
            } else {
                lisBefore.push(li);
            }
            if (isWithinElem && (li === endPoint.node || $.contains(li, endPoint.node))) {
                isWithinElem = false;
            }
        });

        var res = lis;

        if (lisBefore.length) {
            var ulBefore = this.document.createElement(ol.tagName);
            ulBefore.className = ol.className;
            $(ulBefore).insertBefore(ol).append(lisBefore);
        }
        if (lisAfter.length) {
            var ulAfter = this.document.createElement(ol.tagName);
            ulAfter.className = ol.className;
            $(ulAfter).insertAfter(ol).append(lisAfter);
        }

        // convert ul<->ol or remove list
        var current = ol.tagName === 'UL' && ol.className.indexOf('o_checklist') !== -1 ? 'checklist' : ol.tagName.toLowerCase();
        if (current !== sorted) {
            // convert ul <-> ol

            var ul;
            if (sorted === 'checklist' && current === "ul") {
                ul = ol;
            } else if (sorted === 'ul' && current === 'checklist') {
                $(ol).removeClass('o_checklist');
                ul = ol;
            } else {
                ul = this.document.createElement(sorted === "ol" ? "ol" : "ul");
                ul.className = ol.className;
                $(ul).insertBefore(ol).append(lis);
                parent.removeChild(ol);
            }
            if (sorted === 'checklist') {
                $(ul).addClass('o_checklist');
            }

            this.context.invoke('HelperPlugin.deleteEdge', ul, 'next');
            this.context.invoke('HelperPlugin.deleteEdge', ul, 'prev');

        } else {
            // remove ol/ul

            if (dom.isLi(parent) || dom.isList(parent)) {
                if (dom.isLi(parent)) {
                    ol = parent;
                    parent = ol.parentNode;
                }
                $(lis).insertBefore(ol);
            } else {
                res = [];
                _.each(lis, function (li) {
                    res.push.apply(res, li.childNodes);
                    $(li.childNodes).insertBefore(ol);
                });

                // wrap in p

                var hasNode = _.find(res, function (node) {
                    return node.tagName && node.tagName !== "BR" && !dom.isMedia(node);
                }.bind(this));
                if (!hasNode) {
                    var p = this.document.createElement('p');
                    $(p).insertBefore(ol).append(res);
                    res = [p];
                }
            }
            parent.removeChild(ol);

        }

        nodes.push.apply(nodes, res);

        return isWithinElem;
    },
    /**
     * Indent or outdent a format node.
     *
     * @param {bool} outdent true to outdent, false to indent
     */
    _indent: function (outdent) {
        var range = this.context.invoke('editor.createRange');
        if (!range) return;

        var self = this;
        var nodes = [];
        var isWithinElem;
        var ancestor = range.commonAncestor();
        var $dom = $(ancestor);

        if (!dom.isList(ancestor)) {
            // to indent a selection, we indent the child nodes of the common
            // ancestor that contains this selection
            $dom = $(ancestor.tagName ? ancestor : ancestor.parentNode).children();
        }

        // if selection is inside indented contents and outdent is true, we can outdent this node
        var indentedContent = outdent && dom.ancestor(ancestor, function (node) {
            var style = dom.isCell(node) ? 'paddingLeft' : 'marginLeft';
            return node.tagName && !!parseFloat(node.style[style] || 0);
        });

        if (indentedContent) {
            $dom = $(indentedContent);
        } else {
            // if selection is inside a list, we indent its list items
            $dom = $(dom.ancestor(ancestor, dom.isList));
            if (!$dom.length) {
                // if the selection is contained in a single HTML node, we indent
                // the first ancestor 'content block' (P, H1, PRE, ...) or TD
                $dom = $(range.sc).closest(this.options.styleTags.join(',')+',td');
            }
        }

        // if select tr, take the first td
        $dom = $dom.map(function () { return this.tagName === "TR" ? this.firstElementChild : this; });

        $dom.each(function () {
            if (isWithinElem || $.contains(this, range.sc)) {
                if (dom.isList(this)) {
                    if (outdent) {
                        var type = this.tagName === 'OL' ? 'ol' : (this.className && this.className.indexOf('o_checklist') !== -1 ? 'checklist' : 'ul');
                        isWithinElem = self._convertList(isWithinElem, nodes, range.getStartPoint(), range.getEndPoint(), type);
                    } else {
                        isWithinElem = self._indentUL(isWithinElem, nodes, this, range.sc, range.ec);
                    }
                } else if (self.context.invoke('HelperPlugin.isFormatNode', this) || dom.ancestor(this, dom.isCell)) {
                    isWithinElem = self._indentFormatNode(outdent, isWithinElem, nodes, this, range.sc, range.ec);
                }
            }
        });

        if ($dom.parent().length) {
            var $parent = $dom.parent();

            // remove text nodes between lists
            var $ul = $parent.find('ul, ol');
            if (!$ul.length) {
                $ul = $(dom.ancestor(range.sc, dom.isList));
            }
            $ul.each(function () {
                var notWhitespace = /\S/;
                if (this.previousSibling &&
                    this.previousSibling !== this.previousElementSibling &&
                    !this.previousSibling.textContent.match(notWhitespace)) {
                    this.parentNode.removeChild(this.previousSibling);
                }
                if (this.nextSibling &&
                    this.nextSibling !== this.nextElementSibling &&
                    !this.nextSibling.textContent.match(notWhitespace)) {
                    this.parentNode.removeChild(this.nextSibling);
                }
            });

            // merge same ul or ol
            $ul.prev('ul, ol').each(function () {
                self.context.invoke('HelperPlugin.deleteEdge', this, 'next');
            });

        }

        range.normalize().select();
        this.context.invoke('editor.saveRange');

        return !!nodes.length && nodes;
    },
    /**
     * Indent several LIs in a list.
     *
     * @param {bool} isWithinElem true if selection already inside the LI
     * @param {Node[]} nodes
     * @param {Node} UL
     * @param {Node} start
     * @param {Node} end
     */
    _indentUL: function (isWithinElem, nodes, UL, start, end) {
        var next;
        var tagName = UL.tagName;
        var node = UL.firstChild;
        var ul = document.createElement(tagName);
        ul.className = UL.className;

        if (isWithinElem) {
            isWithinElem = 1;
        }

        // create and fill ul into a li
        while (node) {
            if (isWithinElem === 1 || node === start || $.contains(node, start)) {
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
        if (prev && prev.tagName === "LI" && (temp = prev.firstElementChild) && temp.tagName === tagName && ((prev.firstElementChild || prev.firstChild) !== ul)) {
            $(prev.firstElementChild || prev.firstChild).append($(ul).contents());
            $(ul).remove();
            ul = prev;
            ul.parentNode.removeChild(ul.nextElementSibling);
        }
        next = ul.nextElementSibling;
        if (next && next.tagName === "LI" && (temp = next.firstElementChild) && temp.tagName === tagName && (ul.firstElementChild !== next.firstElementChild)) {
            $(ul.firstElementChild).append($(next.firstElementChild).contents());
            $(next.firstElementChild).remove();
            ul.parentNode.removeChild(ul.nextElementSibling);
        }
        return isWithinElem;
    },
    /**
     * Outdent a container node.
     *
     * @param {Node} node
     * @returns {float} margin
     */
    _outdentContainer: function (node) {
        var style = dom.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0)-1.5;
        node.style[style] = margin > 0 ? margin + "em" : "";
        return margin;
    },
    /**
     * Indent a container node.
     *
     * @param {Node} node
     * @returns {float} margin
     */
    _indentContainer: function (node) {
        var style = dom.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0)+1.5;
        node.style[style] = margin + "em";
        return margin;
    },
    /**
     * Indent/outdent a format node.
     *
     * @param {bool} outdent true to outdent, false to indent
     * @param {bool} isWithinElem true if selection already inside the element
     * @param {DOM[]} nodes
     * @param {DOM} p
     * @param {DOM} start
     * @param {DOM} end
     */
    _indentFormatNode: function(outdent, isWithinElem, nodes, p, start, end) {
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
    },

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /**
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     */
    _onMouseDown: function (se, e) {
        if (!dom.isLi(e.target) || !$(e.target).parent('ul.o_checklist').length || e.offsetX > 0) {
            return;
        }
        e.preventDefault();
        var checked = $(e.target).hasClass('o_checked');
        $(e.target).toggleClass('o_checked', !checked);
        if (checked) {
            $(e.target).next('ul.o_checklist').find('> li, ul.o_checklist > li').removeClass('o_checked');
            $(e.target).parents('ul.o_checklist').prev('ul.o_checklist li').removeClass('o_checked');
        } else {
            $(e.target).next('ul.o_checklist').find('> li, ul.o_checklist > li').addClass('o_checked');
            var $lis;
            do {
                $lis = $(e.target).parents('ul.o_checklist:not(:has(li:not(.o_checked)))').prev('ul.o_checklist li:not(.o_checked)');
                $lis.addClass('o_checked');
            } while ($lis.length);
        }
    },
});

registry.add('BulletPlugin', BulletPlugin);

return BulletPlugin;

});
