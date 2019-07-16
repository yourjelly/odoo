(function () {
'use strict';

we3.addPlugin('Keyboard', class extends we3.AbstractPlugin {
    static get autoInstall () {
        return [];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Range', 'Renderer'];
        this.editableDomEvents = {
            'keydown': '_onKeyDown',
            'keypress': '_onKeyPress',
            'keyup': '_onKeyUp',
        };
        this.tab = '\u00A0\u00A0\u00A0\u00A0';
        this._keypressUpdatedTargets = null;
    }
    start () {
        var self = this;
        this._observer = new MutationObserver(function onMutation (mutationsList, observer) {
            if (!self._keypressUpdatedTargets) {
                return;
            }
            mutationsList.forEach(function (mutation) {
                if (mutation.type == 'characterData' && self._keypressUpdatedTargets.indexOf(mutation.target) === -1) {
                    self._keypressUpdatedTargets.push(mutation.target);
                }
                if (mutation.type == 'childList') {
                    mutation.addedNodes.forEach(function (target) {
                        if (self._keypressUpdatedTargets.indexOf(target) === -1) {
                            self._keypressUpdatedTargets.push(target);
                        }
                    });
                    mutation.removedNodes.forEach(function (target) {
                        if (self._keypressUpdatedTargets.indexOf(target) === -1) {
                            self._keypressUpdatedTargets.push(target);
                        }
                    });
                }
            });
        });
        this._observer.observe(this.editable, {
            characterData: true,
            childList: true,
            subtree: true
        });
        return super.start();
    }
    destroy () {
        this._observer.disconnect();
        super.destroy();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Handle deletion (BACKSPACE / DELETE).
     *
     * @private
     * @param {Boolean} isPrev true to delete BEFORE the carret
     * @returns {Boolean} true if case handled
     */
    _handleDeletion (isPrev) {
        this.dependencies.Arch[isPrev ? 'removeLeft' : 'removeRight']();
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
        this.dependencies.Range.setRange({
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
        this.dependencies.Arch.insert(this.tab);
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
    _skipVirtual (pointArch) {
        if (pointArch.archNode.isVirtual()) {
            pointArch.archNode = pointArch.archNode.nextUntil(pointArch.archNode.isNotVirtual);
            pointArch.offset = 0;
        }
        return pointArch;
    }
    /**
     * Patch for Google Chrome's contenteditable SPAN bug.
     *
     * @private
     * @param {jQueryEvent} e
     */
    /* _removeGarbageSpans (e) {
        if (e.target.className === "" && e.target.tagName == "SPAN" &&
            e.target.style.fontStyle === "inherit" &&
            e.target.style.fontVariantLigatures === "inherit" &&
            e.target.style.fontVariantCaps === "inherit") {
            var $span = $(e.target);
            $span.after($span.contents()).remove();
        }
    } */
    /**
     * Select all the contents of the current unbreakable ancestor.
     */
    _selectAll () {
        var self = this;
        var range = this.dependencies.Range.getRange();
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
            range = this.dependencies.Arch.setRange(range.getPoints());
            this.dependencies.Arch.setRange(range);
        }
    }
    _updateKeyLongPress () {
        var e = this._currentKey;

        this._keypressEvents = this._keypressEvents || [];
        this._keypressUpdatedTargets = this._keypressUpdatedTargets || [];

        if (e.key === ' ' || e.key === 'Space') {
            this._keypressEvents.push([this.utils.char('nbsp'), e]);
        } else if (e.key.charCodeAt(0) === 10) {
            this._keypressEvents.push(['<br/>', e]);
        } else {
            this._keypressEvents.push([e.key, e]);
        }

        this._currentKey = null;
    }

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /**
     * Handle BACKSPACE keydown event.
     *
     * @private
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onBackspace () {
        var range = this.dependencies.Range.getRange();
        if (!this._isOnLeftEdgeOf('isCell', range)) { // Do nothing if on left edge of a table cell
            this._handleDeletion(true)
        }
        return true;
    }
    /**
     * Handle DELETE keydown event.
     *
     * @private
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onDelete () {
        var range = this.dependencies.Range.getRange();

        // Special case
        if (range.isCollapsed()) {
            // Do nothing if on left edge of a table cell
            if (false && range.getStartPoint().isRightEdgeOfTag('TD')) {
                return true;
            }
        }

        this._handleDeletion(false);
        return true;
    }
    /**
     * Handle ENTER keydown event.
     *
     * @private
     * @param {KeyboardEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onEnter (e) {
        if (e.shiftKey) {
            this.dependencies.Arch.insert('<br/>');
        } else if (e.ctrlKey) {
            this.dependencies.Arch.insert('<hr/>');
        } else {
            var range = this.dependencies.Range.getRange();
            var liAncestor = range.scArch.ancestor('isLi');
            var isInEmptyLi = range.isCollapsed() && liAncestor && liAncestor.isDeepEmpty();
            if (isInEmptyLi) {
                this.dependencies.Arch.outdent();
            } else {
                this.dependencies.Arch.addLine();
            }
        }
        return true;
    }
    _onKeyDown (e) {
        if (e.defaultPrevented) {
            return;
        }
        if (e.keyCode >= 33 && e.keyCode <= 40) {
            return;
        }
        if (this._currentKey) {
            this._updateKeyLongPress();
        }
        if (e.defaultPrevented) {
            return;
        }
        this._currentKey = e;
    }
    _onKeyPress (e) {
        if (e.defaultPrevented) {
            return;
        }
        if (e.keyCode >= 33 && e.keyCode <= 40) {
            return;
        }
        this._currentKey = e;
        this._updateKeyLongPress();
    }
    _onKeyUp (e) {
        var self = this;

        if (this._currentKey) {
            this._updateKeyLongPress();
        }
        if (!this._keypressEvents) {
            return;
        }

        if (this._keypressUpdatedTargets) {
            this._keypressUpdatedTargets.forEach(function (target) {
                var id = self.dependencies.Renderer.getID(target);
                if (id) {
                    self.dependencies.Renderer.markAsDirty(id, {childNodes: true, nodeValue: true});

                    if (self._keypressUpdatedTargets.length > 1) {
                        var archNode = self.dependencies.Arch.getClonedArchNode(id);
                        if (archNode.isText()) {
                            self.dependencies.Renderer.markAsDirty(archNode.parent.id, {childNodes: true});
                        }
                    }
                }
            });
            this._keypressUpdatedTargets = null;
        }

        this.dependencies.Arch.do(function () {
            self._keypressEvents.forEach(function (ev) {
                var data = ev[0];
                var e = ev[1];
                if (data.length === 1 || data === '<br/>') {
                    self.dependencies.Arch.insert(data);
                } else {
                    data = data.toUpperCase();
                    if (data === 'BACKSPACE') {
                        self._onBackspace(e);
                    } else if (data === 'TAB') {
                        self._onTab(e);
                    } else if (data === 'ENTER') {
                        self._onEnter(e);
                    } else if (data === 'DELETE') {
                        self._onDelete(e);
                    }
                }
            });
        }, {
            applyRulesForPublicMethod: true,
        });
        this._keypressEvents = null;
    }
    /**
     * Handle TAB keydown event.
     *
     * @private
     * @param {KeyboardEvent} e
     * @returns {Boolean} true if case is handled and event default must be prevented
     */
    _onTab (e) {
        var handled = true;
        var untab = !!e.shiftKey;
        var range = this.dependencies.Range.getRange();
        if (range.scArch.isInCell()) {
            this._handleTabInCell(range.scArch, untab);
        } else if (!untab) {
            this._insertTab();
        } else {
            handled = false;
        }
        return handled;
    }
});

})();
