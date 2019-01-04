odoo.define('web_editor.wysiwyg.plugin.text', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;
dom.isAnchor = function (node) {
    return (node.tagName === 'A' || node.tagName === 'BUTTON' || $(node).hasClass('btn')) &&
        !$(node).hasClass('fa') && !$(node).hasClass('o_image');
};


var TextPlugin = AbstractPlugin.extend({
    events: {
        'summernote.paste': '_onPaste',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Insert a Horizontal Rule element (hr).
     */
    insertHR: function () {
        var self = this;
        var hr = this.document.createElement('hr');
        this.context.invoke('HelperPlugin.insertBlockNode', hr);
        var point = {
            node: hr,
            offset: 0,
        };
        point = dom.nextPointUntil(point, function (pt) {
            return pt.node !== hr && !self.options.isUnbreakableNode(pt.node);
        }) || point;
        var range = $.summernote.range.create(point.node, point.offset);
        range.select();
    },
    /**
     * Insert a TAB (4 non-breakable spaces).
     */
    insertTab: function () {
        var tab = '\u00A0\u00A0\u00A0\u00A0';
        this.context.invoke('HelperPlugin.insertTextInline', tab);
    },
    /**
     * Paste nodes or their text content into the editor.
     *
     * @param {Node[]} nodes
     * @param {Boolean} textOnly true to allow only dropping plain text
     */
    pasteNodes: function (nodes, textOnly) {
        var self = this;
        if (!nodes.length) {
            return;
        }
        if (textOnly) {
            nodes = this.document.createTextNode($(nodes).text());
        }
        var range = this.context.invoke('editor.createRange');

        // Respect the rules of unbreakable nodes
        var point;
        if (range.sc.childNodes[range.so]) {
            point = {
                node: range.sc.childNodes[range.so],
                offset: 0,
            };
        } else {
            point = {
                node: range.sc,
                offset: range.so,
            };
        }

        point = dom.nextPointUntil(point, function (pt) {
            var isTextWithParent = !pt.node.tagName && pt.parentNode;
            return !(self.options.isUnbreakableNode(pt.node) ||
                isTextWithParent && (
                    pt.node.parentNode.tagName === 'BR' ||
                    $(pt.node.parentNode).filter('.fa').length));
        });

        // Prevent pasting HTML within a link
        if (!textOnly) {
            point = dom.nextPointUntil(point, function (pt) {
                var ancestor = dom.ancestor(pt.node, dom.isAnchor);
                return !ancestor || ancestor === self.editable;
            });
        }

        nodes = this._mergeAdjacentULs(nodes);

        // Insert the nodes
        var isInsertInline = dom.isInline(nodes[0]) &&
            (!point.node.tagName ||
                point.node.tagName === 'BR' ||
                dom.isMedia(point.node));
        var fakeParent = this.document.createElement('div');
        $(fakeParent).append(nodes);
        if (isInsertInline) {
            point.node = point.node.tagName ? point.node : point.node.splitText(point.offset);
            $(point.node).before($(fakeParent).contents());
        } else {
            this.context.invoke('HelperPlugin.insertBlockNode', fakeParent);
        }
        $(fakeParent).contents().unwrap();

        // Move the carret
        range.sc = range.ec = nodes[nodes.length - 1];
        range.so = range.eo = dom.nodeLength(range.sc);
        range.normalize().select();
    },
    /**
     * Prepare clipboard data for safe pasting into the editor.
     *
     * @param {DOMString} clipboardData
     * @returns {Node[]}
     */
    prepareClipboardData: function (clipboardData) {
        var self = this;
        var whiteList = this._clipboardWhitelist();
        var blackList = this._clipboardBlacklist();

        // 1. Remove unapproved elements
        var $clipboardData = $(clipboardData).not('meta').not('style').not('script');
        var $badNodes, $fakeParent;
        var root = true;
        do {
            // Clean the root
            if (root) {
                root = false;
                $fakeParent = $(this.document.createElement('div'));
                for (var i = 0; i < $clipboardData.length; i++) {
                    var node = $clipboardData[i];
                    if (
                        node.tagName && !$(node).filter(whiteList.join(',')).length ||
                        $(node).filter(blackList.join(',')).length
                    ) {
                        $fakeParent.append(node.childNodes);
                        root = true;
                    } else {
                        $fakeParent.append(node);
                    }
                }
                $clipboardData = $fakeParent.contents();
                // Clean the rest of the tree
            } else {
                var $contents = $badNodes.contents();
                if ($contents.length) {
                    $contents.unwrap();
                } else {
                    $badNodes.remove();
                }
            }

            $badNodes = $clipboardData.find('*').addBack()
                .not(whiteList.join(','))
                .addBack(blackList.join(','))
                .filter(function () {
                    return !!this.tagName;
                });
        } while ($badNodes.length);

        var $all = $clipboardData.find('*').addBack();

        // 2. Remove all styles
        $all.removeAttr('style');

        // 3. Add custom classes
        $all.filter('table').addClass('table table-bordered');

        // 4. Prevent inlines directly within TD's
        var $inlinesInTD = $all.filter('td').contents().filter(function (i, n) {
            return !self.context.invoke('HelperPlugin.isNodeBlockType', n);
        });
        var parentsOfInlinesInTD = [];
        _.each($inlinesInTD, function (n) {
            parentsOfInlinesInTD.push(self.context.invoke('HelperPlugin.firstBlockAncestor', n));
        });
        $($.unique(parentsOfInlinesInTD)).wrapInner(this.document.createElement('p'));

        // 5. Fill up empty blocks
        var emptyP = this.document.createElement('p');
        $(emptyP).append(this.document.createElement('br'));

        $all.filter(function (i, n) {
            return self.context.invoke('HelperPlugin.isNodeBlockType', n) && !n.childNodes;
        }).append(this.document.createElement('br'));

        // 6. remove non-whitelisted attributes
        $all.each(function () {
            var $node = $(this);
            _.each(_.pluck(this.attributes, 'name'), function (attribute) {
                if (self._clipboardWhitelistAttr().indexOf(attribute) === -1) {
                    $node.removeAttr(attribute);
                }
            });
        }).removeClass('o_editable o_not_editable');

        // 7. remove all classes on 'a' tags
        $all.filter('a').removeClass();

        // 8. make images max 100% width
        $all.filter('img').css('max-width', '100%');

        return $clipboardData.toArray();
    },
    /**
     * Format a 'format' block: change its tagName (eg: p -> h1).
     *
     * @param {string} tagName
     *       P, H1, H2, H3, H4, H5, H6, BLOCKQUOTE, PRE
     */
    formatBlock: function (tagName) {
        var self = this;
        var r = this.context.invoke('editor.createRange');
        if (
            !r ||
            !this.$editable.has(r.sc).length ||
            !this.$editable.has(r.ec).length ||
            this.options.isUnbreakableNode(r.sc)
        ) {
            return;
        }
        var nodes = this.context.invoke('HelperPlugin.getSelectedNodes');
        nodes = this.context.invoke('HelperPlugin.filterFormatAncestors', nodes);
        if (!nodes.length) {
            var node = this.context.invoke('editor.createRange').sc;
            if (node.tagName === 'BR' || dom.isText(node)) {
                node = node.parentNode;
            }
            nodes = [node];
        }
        var changedNodes = [];
        _.each(nodes, function (node) {
            var newNode = self.document.createElement(tagName);
            $(newNode).append($(node).contents());
            var attributes = $(node).prop("attributes");
            _.each(attributes, function (attr) {
                $(newNode).attr(attr.name, attr.value);
            });
            $(node).replaceWith(newNode);
            changedNodes.push(newNode);
        });

        // Select all formatted nodes
        if (changedNodes.length) {
            var lastNode = changedNodes[changedNodes.length - 1];
            var range = this.context.invoke('editor.createRange');
            range.sc = changedNodes[0].firstChild || changedNodes[0];
            range.so = 0;
            range.ec = lastNode.lastChild || lastNode;
            range.eo = dom.nodeLength(lastNode.lastChild || lastNode);
            range.select();
        }
    },
    /**
     * Change the paragraph alignment of a 'format' block.
     *
     * @param {string} style
     *       justifyLeft, justifyCenter, justifyRight, justifyFull
     */
    formatBlockStyle: function (style) {
        var self = this;
        var nodes = this.context.invoke('HelperPlugin.getSelectedNodes');
        nodes = this.context.invoke('HelperPlugin.filterFormatAncestors', nodes);
        var align = style === 'justifyLeft' ? 'left' :
            style === 'justifyCenter' ? 'center' :
            style === 'justifyRight' ? 'right' : 'justify';
        _.each(nodes, function (node) {
            if (dom.isText(node)) {
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
    },
    /**
     * (Un-)format text: make it bold, italic, ...
     *
     * @param {string} tagName
     *       bold, italic, underline, strikethrough, superscript, subscript
     */
    formatText: function (tagName) {
        var self = this;
        var tag = {
            bold: 'B',
            italic: 'I',
            underline: 'U',
            strikethrough: 'S',
            superscript: 'SUP',
            subscript: 'SUB',
        } [tagName];
        if (!tag) {
            throw new Error(tagName);
        }

        var range = this.context.invoke('editor.createRange');
        if (!range || !this.$editable.has(range.sc).length || !this.$editable.has(range.ec).length) {
            return;
        }
        if (range.isCollapsed()) {
            var br;
            if (range.sc.tagName === 'BR') {
                br = range.sc;
            } else if (range.sc.firstChild && range.sc.firstChild.tagName === 'BR') {
                br = range.sc.firstChild;
            }
            if (br) {
                var emptyText = this.document.createTextNode('\u200B');
                $(br).before(emptyText).remove();
                range.sc = range.ec = emptyText;
                range.so = 0;
                range.eo = 1;
            } else {
                this.document.execCommand('insertText', 0, '\u200B');
                range.eo += 1;
            }
            range.select();
        }

        var nodes = this.context.invoke('HelperPlugin.getSelectedNodes');
        var texts = this.context.invoke('HelperPlugin.filterLeafChildren', nodes);
        var formatted = this.context.invoke('HelperPlugin.filterFormatAncestors', nodes);

        var start = this.context.invoke('HelperPlugin.firstLeaf', nodes[0]);
        var end = this.context.invoke('HelperPlugin.lastLeaf', nodes[nodes.length - 1]);

        function containsOnlySelectedText(node) {
            return _.all(node.childNodes, function (n) {
                return _.any(texts, function (t) {
                    return n === t && !(dom.isText(n) && n.textContent === '');
                }) && containsOnlySelectedText(n);
            });
        }

        function containsAllSelectedText(node) {
            return _.all(texts, function (t) {
                return _.any(node.childNodes, function (n) {
                    return n === t && !(dom.isText(n) && n.textContent === '') || containsAllSelectedText(n);
                });
            });
        }

        var nodeAlreadyStyled = [];
        var toStyled = [];
        var notStyled = _.filter(texts, function (text, index) {
            if (toStyled.indexOf(text) !== -1 || nodeAlreadyStyled.indexOf(text) !== -1) {
                return;
            }
            nodeAlreadyStyled.push(text);

            end = text;

            var styled = dom.ancestor(text, function (node) {
                return node.tagName === tag;
            });
            if (styled) {
                if (
                    !/^\u200B$/.test(text.textContent) &&
                    containsAllSelectedText(styled) &&
                    containsOnlySelectedText(styled)
                ) {
                    // Unwrap all contents
                    nodes = $(styled).contents();
                    $(styled).before(nodes).remove();
                    nodeAlreadyStyled.push.apply(nodeAlreadyStyled, nodes);
                    end = _.last(nodeAlreadyStyled);
                } else {
                    var options = {
                        isSkipPaddingBlankHTML: true,
                        isNotSplitEdgePoint: true,
                    };

                    if (
                        nodeAlreadyStyled.indexOf(text.nextSibling) === -1 &&
                        !dom.isRightEdgeOf(text, styled)
                    ) {
                        options.nextText = false;
                        var point = {
                            node: text,
                            offset: dom.nodeLength(text),
                        };
                        if (dom.isMedia(text)) {
                            point = dom.nextPoint(point);
                        }
                        var next = self.context.invoke('HelperPlugin.splitTree', styled, point, options);
                        nodeAlreadyStyled.push(next);
                    }
                    if (
                        nodeAlreadyStyled.indexOf(text.previousSibling) === -1 &&
                        !dom.isLeftEdgeOf(text, styled)
                    ) {
                        options.nextText = true;
                        text = self.context.invoke('HelperPlugin.splitTree', styled, {
                            node: text,
                            offset: 0,
                        }, options);
                        nodeAlreadyStyled.push(text);
                        if (index === 0) {
                            start = text;
                        }
                        end = text;
                    }

                    var toRemove = dom.ancestor(text, function (n) {
                        return n.tagName === tag;
                    });
                    if (toRemove) {
                        // Remove generated empty elements
                        if (
                            toRemove.nextSibling &&
                            self.context.invoke('HelperPlugin.isBlankNode', toRemove.nextSibling)
                        ) {
                            $(toRemove.nextSibling).remove();
                        }
                        if (
                            toRemove.previousSibling &&
                            self.context.invoke('HelperPlugin.isBlankNode', toRemove.previousSibling)
                        ) {
                            $(toRemove.previousSibling).remove();
                        }

                        // Unwrap the element
                        nodes = $(toRemove).contents();
                        $(toRemove).before(nodes).remove();
                        nodeAlreadyStyled.push.apply(nodeAlreadyStyled, nodes);
                        end = _.last(nodeAlreadyStyled);
                    }
                }
            }

            if (dom.ancestor(text, function (node) {
                    return toStyled.indexOf(node) !== -1;
                })) {
                return;
            }

            var node = text;
            while (
                node && node.parentNode &&
                formatted.indexOf(node) === -1 &&
                formatted.indexOf(node.parentNode) === -1
            ) {
                node = node.parentNode;
            }
            if (node !== text) {
                if (containsAllSelectedText(node)) {
                    toStyled.push.apply(toStyled, texts);
                    node = text;
                } else if (!containsOnlySelectedText(node)) {

                    node = text;
                }
            }

            if (toStyled.indexOf(node) === -1) {
                toStyled.push(node);
            }
            return !styled;
        });

        toStyled = _.uniq(toStyled);

        if (notStyled.length) {
            nodes = [];
            var toMerge = [];
            _.each(toStyled, function (node) {
                var next = true;
                if (node.nextSibling && node.nextSibling.tagName === tag) {
                    $(node.nextSibling).prepend(node);
                    next = false;
                }
                if (node.previousSibling && node.previousSibling.tagName === tag) {
                    $(node.previousSibling).append(node);
                }
                if (node.parentNode && node.parentNode.tagName !== tag) {
                    var styled = self.document.createElement(tag);
                    if (node.tagName) {
                        $(styled).append(node.childNodes);
                        $(node).append(styled);
                    } else {
                        $(node).before(styled);
                        styled.appendChild(node);
                    }
                }
                // Add adjacent nodes with same tagName to list of nodes to merge
                if (
                    node.parentNode && node.parentNode[next ? 'nextSibling' : 'previousSibling'] &&
                    node.parentNode.tagName === node.parentNode[next ? 'nextSibling' : 'previousSibling'].tagName
                ) {
                    toMerge.push(next ? node.parentNode : node.parentNode.previousSibling);
                }
            });
            // Merge what needs merging
            while (toMerge.length) {
                this.context.invoke('HelperPlugin.deleteEdge', toMerge.pop(), 'next');
            }
        }

        range.sc = start;
        range.so = 0;
        range.ec = end;
        range.eo = dom.nodeLength(range.ec);

        if (range.sc === range.ec && range.sc.textContent === '\u200B') {
            range.so = range.eo = 1;
        }

        range.select();
        this.editable.normalize();
    },
    /**
     * Remove format on the current range.
     */
    removeFormat: function () {
        this.document.execCommand('removeFormat');
        // double because does not remove all font style in complex DOM
        this.document.execCommand('removeFormat');
        this.context.invoke('editor.fixRange');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Return a list of jQuery selectors for prohibited nodes on paste.
     *
     * @private
     * @returns {String[]}
     */
    _clipboardBlacklist: function () {
        return ['.Apple-interchange-newline'];
    },
    /**
     * Return a list of jQuery selectors for exclusively authorized nodes on paste.
     *
     * @private
     * @returns {String[]}
     */
    _clipboardWhitelist: function () {
        var listSels = ['ul', 'ol', 'li'];
        var styleSels = ['i', 'b', 'u', 'em', 'strong'];
        var tableSels = ['table', 'th', 'tbody', 'tr', 'td'];
        var miscSels = ['img', 'br', 'a', '.fa'];
        return this.options.styleTags.concat(listSels, styleSels, tableSels, miscSels);
    },
    /**
     * Return a list of attribute names that are exclusively authorized on paste.
     * 
     * @private
     * @returns {String[]}
     */
    _clipboardWhitelistAttr: function () {
        return ['class', 'href', 'src'];
    },
    /**
     * Check a list of nodes and merges all adjacent ULs together:
     * [ul, ul, p, ul, ul] will return [ul, p, ul], with the li's of
     * nodes[1] and nodes[4] appended to nodes[0] and nodes[3].
     *
     * @private
     * @param {Node[]} nodes
     * @return {Node[]} the remaining, merged nodes
     */
    _mergeAdjacentULs: function (nodes) {
        var res = [];
        var prevNode;
        _.each(nodes, function (node) {
            prevNode = res[res.length - 1];
            if (prevNode && node.tagName === 'UL' && prevNode.tagName === 'UL') {
                $(prevNode).append(node.childNodes);
            } else {
                res.push(node);
            }
        });
        return res;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handle paste events to permit cleaning/sorting of the data before pasting.
     *
     * @private
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     */
    _onPaste: function (se, e) {
        se.preventDefault();
        se.stopImmediatePropagation();
        e.preventDefault();
        e.stopImmediatePropagation();

        this.context.invoke('editor.beforeCommand');

        // Clean up
        var clipboardData = e.originalEvent.clipboardData.getData('text/html');
        if (clipboardData) {
            clipboardData = this.prepareClipboardData(clipboardData);
        } else {
            clipboardData = e.originalEvent.clipboardData.getData('text/plain');
            // get that text as an array of text nodes separated by <br> where needed
            var allNewlines = /\n/g;
            clipboardData = $('<p>' + clipboardData.replace(allNewlines, '<br>') + '</p>').contents().toArray();
        }

        // Delete selection
        this.context.invoke('HelperPlugin.deleteSelection');

        // Insert the nodes
        this.pasteNodes(clipboardData);
        this.context.invoke('HelperPlugin.normalize');
        this.context.invoke('editor.saveRange');

        this.context.invoke('editor.afterCommand');
    },
});

registry.add('TextPlugin', TextPlugin);

return TextPlugin;

});
