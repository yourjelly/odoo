(function () {
'use strict';

var BaseKeyboard = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return [];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseArch', 'BaseRange', 'BaseRenderer'];
        this.editableDomEvents = {
            'keydown': '_onKeyDown',
            'keypress': '_onKeyDown',
            'textInput': '_onTextInput',
            'compositionend': '_onCompositionEnd',
        };
    }
    willStart () {
        var self = this;
        this._observer = new MutationObserver(function onMutation (mutationsList, observer) {
            if (!self._currentEvent) {
                return;
            }
            var targets = self._currentEvent.targets;
            mutationsList.forEach(function (mutation) {
                if (mutation.type == 'characterData' && targets.indexOf(mutation.target) === -1) {
                    targets.push(mutation.target);
                }
                if (mutation.type == 'childList') {
                    mutation.addedNodes.forEach(function (target) {
                        if (targets.indexOf(target) === -1) {
                            targets.push(target);
                        }
                    });
                    mutation.removedNodes.forEach(function (target) {
                        if (targets.indexOf(target) === -1) {
                            targets.push(target);
                        }
                    });
                }
            });
        });
        this._observer.observe(this.editable, {
            characterData: true,
            childList: true,
            subtree: true,
        });
        return super.willStart();
    }
    destroy () {
        this._observer.disconnect();
        super.destroy();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Add a newline at range: split a paragraph if possible, after
     * removing the selection if needed.
     */
    _addLine () {
        var self = this;
        return this.dependencies.BaseArch.do(function () {
            var range = self.dependencies.BaseRange.getRange();
            var id, offset;
            if (range.isCollapsed()) {
                id = range.scID;
                offset = range.so;
            } else {
                id = self.dependencies.BaseArch.removeFromRange().id;
                offset = 0;
            }
            self.dependencies.BaseArch.nextChangeIsRange();
            self.dependencies.BaseArch.getArchNode(id).addLine(offset);
        });
    }
    /**
     * Move to next cell on tab in a cell
     *
     * @param {ArchNode} scArch
     * @param {Boolean} untab true to move left
     */
    _handleTabInCell (scArch, untab) {
        var cell = scArch.ancestor('isCell');
        var nextCell = cell[untab ? 'previousSibling' : 'nextSibling']();
        if (!nextCell) {
            return;
        }
        var leaf = nextCell[untab ? 'lastLeaf' : 'firstLeaf']();
        this.dependencies.BaseRange.setRange({
            scID: leaf.id,
            so: untab ? leaf.length() : 0,
        });
    }
    /**
     * Insert a TAB (4 non-breakable spaces).
     *
     * @private
     */
    _insertTab () {
        var tabSize = this.options.tab && this.options.tab.size || 0;
        var tab = new Array(tabSize).fill('\u00A0').join('');
        return this.dependencies.BaseArch.insert(tab);
    }
    _isOffsetLeftEdge (range) {
        var pointArch = this._skipVirtual({
            archNode: range.scArch,
            offset: range.so,
        });
        return !pointArch.offset && range.isCollapsed() && pointArch.archNode
    }
    _isOnLeftEdgeOf (ancestorOrMethodName, range) {
        var ancestor = typeof ancestorOrMethodName === 'string' ? range.scArch.ancestor(ancestorOrMethodName) : ancestorOrMethodName;
        return ancestor && range.scArch.isLeftEdgeOf(ancestor, true) && this._isOffsetLeftEdge(range);
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertChar (param) {
        var key = param.data || param.key;
        if (key === ' ' || key === 'Space') {
            return this.dependencies.BaseArch.insert(this.utils.char('nbsp'));
        } else if (key.charCodeAt(0) === 10) {
            return this.dependencies.BaseArch.insert('<br/>');
        } else {
            return this.dependencies.BaseArch.insert(key);
        }
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertComposition (param) {
        var self = this;
        var BaseArch = this.dependencies.BaseArch;
        var BaseRenderer = this.dependencies.BaseRenderer;
        var BaseRange = this.dependencies.BaseRange;

        return BaseArch.do(function (getArchNode) {
            var oldRange = BaseRange.getRange();
            var nodeValue = oldRange.scArch.nodeValue;
            var lastArchNode;

            param.targets.forEach(function (target) {
                if (target.tagName) {
                    return;
                }
                var id = BaseRenderer.getID(target);
                if (!id) {
                    console.warn("Try to update an unknown node");
                    return;
                }
                lastArchNode = getArchNode(id);
                lastArchNode.setNodeValue(target.nodeValue);
            });

            if (!lastArchNode || !param.data.length) {
                return oldRange;
            }

            var range;
            var prevIndex = lastArchNode.id === oldRange.scID ? oldRange.so : 0;
            var globalIndex = 0;
            do {
                var index = lastArchNode.nodeValue.substring(globalIndex).indexOf(param.data);
                if (index === -1) {
                    break;
                }
                index += globalIndex;
                globalIndex = index + 1;

                if (prevIndex >= index && prevIndex <= index + param.data.length) {
                    range = {
                        scID: lastArchNode.id,
                        so: index + param.data.length,
                    };
                    break;
                }
            } while (globalIndex < lastArchNode.nodeValue.length);

            return range;
        });
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertEnter (param) {
        var BaseArch = this.dependencies.BaseArch;
        var BaseRenderer = this.dependencies.BaseRenderer;
        var BaseRange = this.dependencies.BaseRange;

        // mark as dirty the new nodes to re-render it
        // because the browser can split other than our arch and we must fix the errors
        param.targets.forEach(function (target) {
            var id = BaseRenderer.getID(target);
            if (id) {
                BaseRenderer.markAsDirty(id, {childNodes: true, nodeValue: true});
            }
            if (!target.tagName && param.targets.length > 1) {
                var id = BaseRenderer.getID(target.parentNode);
                if (id) {
                    BaseRenderer.markAsDirty(id, {childNodes: true});
                }
            }
        });

        if (param.shiftKey) {
            return BaseArch.insert('<br/>');
        } else if (param.ctrlKey) {
            return BaseArch.insert('<hr/>');
        } else {
            var range = BaseRange.getRange();
            var liAncestor = range.scArch.ancestor('isLi');
            var isInEmptyLi = range.isCollapsed() && liAncestor && liAncestor.isDeepEmpty();
            if (isInEmptyLi) {
                return BaseArch.outdent();
            } else {
                return this._addLine();
            }
        }
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertTab (param) {
        if (this.options.tab && !this.options.tab.enabled) {
            return;
        }
        var untab = param.shiftKey;
        var range = this.dependencies.BaseRange.getRange();
        if (range.scArch.isInCell()) {
            return this._handleTabInCell(range.scArch, untab);
        } else if (!untab) {
            return this._insertTab();
        }
    }
    _skipVirtual (pointArch) {
        if (pointArch.archNode.isVirtual()) {
            pointArch.archNode = pointArch.archNode.nextUntil(pointArch.archNode.isNotVirtual);
            pointArch.offset = 0;
        }
        return pointArch;
    }
    /**
     * Select all the contents of the current unbreakable ancestor.
     */
    _selectAll () {
        var self = this;
        var range = this.dependencies.BaseRange.getRange();
        var unbreakable = range.scArch.ancestor('isUnbreakableNode');
        var $contents = $(unbreakable).contents();
        var startNode = $contents.length ? $contents[0] : unbreakable;
        var pointA = this.getPoint(startNode, 0);
        pointA = pointA.nextUntil(function (point) {
            return self.utils.isVisibleText(point.node);
        });
        var endNode = $contents.length ? $contents[$contents.length - 1] : unbreakable;
        var endOffset = $contents.length ? this.utils.nodeLength($contents[$contents.length - 1]) : 1;
        var pointB = this.getPoint(endNode, endOffset);
        pointB = pointB.prevUntil(function (point) {
            return self.utils.isVisibleText(point.node);
        });
        if (pointA && pointB) {
            range.replace({
                sc: pointA.node,
                so: pointA.offset,
                ec: pointB.node,
                eo: pointB.offset,
            }).normalize();
            range = this.dependencies.BaseArch.setRange(range.getPoints());
            this.dependencies.BaseArch.setRange(range);
        }
    }
    /**
     * Remove to the side of the current range.
     *
     * @private
     * @param {Boolean} isLeft true to remove to the left
     */
    _removeSide (isLeft) {
        var self = this;
        return this.dependencies.BaseArch.do(function () {
            var range = self.dependencies.BaseRange.getRange();
            if (range.isCollapsed()) {
                var offset = range.so;
                var node = self.dependencies.BaseArch.getArchNode(range.scID);
                var next = node[isLeft ? 'removeLeft' : 'removeRight'](offset);
                if (next) {
                    next.lastLeaf().deleteEdge(true, {
                        doNotBreakBlocks: true,
                    });
                }
             } else {
                var virtualText = self.dependencies.BaseArch.removeFromRange();
                virtualText.parent.deleteEdge(false,  {
                    keepRight: true,
                });
            }
        });
    }

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    _onKeyDown (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        this._currentEventIsDefaultPrevented = e.defaultPrevented;
        if (this._currentEventIsDefaultPrevented) {
            return;
        }
        if (e.key === 'Tab') {
            e.stopPropagation();
        }
        if (e.keyCode >= 33 && e.keyCode <= 40) {
            return;
        }
        var param = this._onKeyDownNextTick();
        param.defaultPrevented = param.defaultPrevented || e.defaultPrevented;
        param.type = param.type || e.type;
        param.shiftKey = e.shiftKey;
        param.ctrlKey = e.ctrlKey;
        param.key = e.key;
    }
    _onTextInput (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        var param = this._onKeyDownNextTick();
        if (!param.type) {
            param.type = e.type;
            param.data = e.data;
        } else if (e.data && (param.data === '' || param.type === 'keypress')) {
            param.data = e.data;
        } else if (e.data && e.data.length === 1 && e.data !== param.data && param.type === 'compositionend') {
            // swiftKey add automatically a space after the composition, without this line the arch is correct but not the range
            param.data += e.data;
        }
    }
    _onCompositionEnd (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        var param = this._onKeyDownNextTick();
        param.type = e.type;
        param.data = e.data;
    }
    _onKeyDownNextTick () {
        if (this._currentEvent) {
            return this._currentEvent;
        }
        this._currentEvent = {
            type: null,
            key: 'Unidentified',
            data: '',
            shiftKey: false,
            ctrlKey: false,
            targets: [],
            defaultPrevented: false,
        };
        setTimeout(this.__onKeyDownNextTick.bind(this));
        return this._currentEvent;
    }
    __onKeyDownNextTick () {
        var param = this._currentEvent;
        this._currentEvent = null;

        if (param.defaultPrevented) {
            return;
        }

        if (param.type === 'compositionend') {
            return this._pressInsertComposition(param);
        }else if (param.key === 'Backspace') {
            return this._removeSide(true);
        } else if (param.key === 'Delete') {
            return this._removeSide(false);
        } else if (param.key === 'Tab') {
            return this._pressInsertTab(param);
        } else if (param.key === 'Enter') {
            return this._pressInsertEnter(param);
        } else if (param.data.length === 1 || param.key.length === 1 || param.key === 'Space') {
            return this._pressInsertChar(param);
        } else { // default
            return this._pressInsertComposition(param);
        }
    }
};

we3.pluginsRegistry.BaseKeyboard = BaseKeyboard;

})();
