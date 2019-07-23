(function () {
'use strict';

var BaseInput = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return [];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseArch', 'BaseRange', 'BaseRenderer', 'Input'];
        this.editableDomEvents = {
            'keydown': '_onKeyDown',
            'keypress': '_onKeyDown',
            'input': '_onInput',
            // 'textInput': '_onInput',
            'compositionend': '_onCompositionEnd',
        };
    }
    willStart () {
        var self = this;
        this._observer = new MutationObserver(function onMutation (mutationsList, observer) {
            if (self._currentEvent) {
                self._currentEvent.mutationsList = self._currentEvent.mutationsList.concat(mutationsList);
            }
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
    _eventsNormalization (param) {
        var ev = {
            preventDefault: function () {
                param.defaultPrevented = true;
            },
            get defaultPrevented () {
                return param.defaultPrevented;
            }
        };

        if (param.defaultPrevented) {
            // nothing
        } else if (param.type === 'composition') {
            ev.data = param.data;
            ev.replacement = param.replacement;
            ev.name = 'composition';
            return ev;
        } else {
            ev.shiftKey = param.shiftKey;
            ev.ctrlKey = param.ctrlKey;
            ev.altKey = param.altKey;
            if (param.key === 'Backspace') {
                ev.name = 'Backspace';
                return ev;
            } else if (param.key === 'Delete') {
                ev.name = 'Delete';
                return ev;
            } else if (param.key === 'Tab') {
                ev.name = 'Tab';
                return ev;
            } else if (param.key === 'Enter') {
                ev.name = 'Enter';
                return ev;
            } else if ((!param.ctrlKey && !param.altKey || param.inputType === 'insertText') &&
                    (param.data && param.data.length === 1 || param.key && param.key.length === 1 || param.key === 'Space')) {
                ev.data = param.data && param.data.length === 1 ? param.data : param.key;
                if (param.data === 'Space') {
                    param.data = ' ';
                }
                ev.name = 'char';
                return ev;
            }
        }

        ev = Object.assign({
            preventDefault: ev.preventDefault,
        }, param);
        ev.name = 'default';
        return ev;
    }
    _eventsdDspatcher (ev, param) {
        if (ev.name === 'composition') {
            this._pressInsertComposition(ev);
        } else if (ev.name === 'Backspace') {
            this._removeSide(true);
        } else if (ev.name === 'Delete') {
            this._removeSide(false);
        } else if (ev.name === 'Tab') {
            this._pressInsertTab(ev);
        } else if (ev.name === 'Enter') {
            this._pressInsertEnter(ev);
        } else if (ev.name === 'char') {
            this._pressInsertChar(ev);
        }
    }
    _findOffsetInsertion (text, offset, insert) {
        var prevIndex = offset;
        var globalIndex = 0;
        do {
            var index = text.substring(globalIndex).indexOf(insert);
            if (index === -1) {
                break;
            }
            index += globalIndex;
            globalIndex = index + 1;

            if (prevIndex >= index && prevIndex <= index + insert.length) {
                return index + insert.length;
            }
        } while (globalIndex < text.length);

        return -1;
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
        if (param.data === ' ') {
            return this.dependencies.BaseArch.insert(this.utils.char('nbsp'));
        } else if (param.data.charCodeAt(0) === 10) {
            return this.dependencies.BaseArch.insert('<br/>');
        } else {
            return this.dependencies.BaseArch.insert(param.data);
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

        return BaseArch.do(function () {
            var range = BaseRange.getRange();
            var arch = BaseArch.getArchNode(range.scID).ancestor('isFormatNode');
            var formatNode = BaseRenderer.getElement(arch.id);

            if (!formatNode) {
                return;
            }

            var lastTextNodeID;
            var lastTextNodeOldValue;
            var newArch = BaseArch.parse(formatNode);
            newArch.nextUntil(function (archNode) {
                if (!archNode.isText()) {
                    return;
                }
                var target = arch.applyPath(archNode.path(newArch));
                if (target.isText()) {
                    lastTextNodeOldValue = target.nodeValue;
                    lastTextNodeID = target.id;
                    var nodeValue = archNode.nodeValue.replace(/\u00A0/g, ' ');

                    if (param.replacement) {
                        // eg: 'paaa' from replacement of 'a' in 'aa' ==> must be 'paa'
                        var add = nodeValue.indexOf(lastTextNodeOldValue.replace(/\u00A0/g, ' ')) === 0 ?
                                nodeValue.slice(lastTextNodeOldValue.length) : '';
                        var rest = nodeValue.slice(0, add.length);
                        var lastIndex = add.length;
                        while (lastIndex > 0) {
                            if (rest.slice(-lastIndex) === add.slice(0, lastIndex)) {
                                archNode.nodeValue = rest.slice(0, -lastIndex) + add;
                                break;
                            }
                            lastIndex--;
                        }
                    }

                    target.setNodeValue(archNode.nodeValue);
                } else if (target.isBR()) {
                    var res = target.insert(archNode.params.create(null, null, archNode.nodeValue));
                    lastTextNodeOldValue = archNode.nodeValue;
                    lastTextNodeID = res[0] && res[0].id;
                }
            }, {doNotLeaveNode: true});

            if (lastTextNodeID) {
                var archNode = BaseArch.getArchNode(lastTextNodeID);
                var lastTextNodeNewValue = archNode.nodeValue.replace(/\u00A0/g, ' ');
                var newOffset = lastTextNodeNewValue.length;

                param.data = param.data.replace(/\u00A0/g, ' ');
                if (lastTextNodeID === range.scID) {
                    var offset = 0;
                    if (lastTextNodeID === range.scID) {
                        offset = range.so;
                        if (lastTextNodeOldValue.length > lastTextNodeNewValue.length) {
                            offset -= lastTextNodeOldValue.length - lastTextNodeNewValue.length;
                            if (offset < 0) {
                                offset = 0;
                            }
                        }
                    }

                    var newOffset = self._findOffsetInsertion(lastTextNodeNewValue, offset, param.data);
                    newOffset = newOffset !== -1 ? newOffset : offset;

                    if (lastTextNodeNewValue[newOffset] === ' ') {
                        newOffset++;
                    }
                }
                return {
                    scID: lastTextNodeID,
                    so: newOffset,
                };
            }

            var lastLeaf = formatNode.lastLeaf();
            return {
                scID: lastLeaf.id,
                so: lastLeaf.length(),
            }
        });
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertEnter (param) {
        var BaseArch = this.dependencies.BaseArch;
        var BaseRange = this.dependencies.BaseRange;

        if (param.shiftKey) {
            return BaseArch.insert('<br/>');
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
     * Insert a TAB (4 non-breakable spaces).
     *
     * @private
     * @param {object} param
     */
    _pressInsertTab (param) {
        if (this.options.tab && !this.options.tab.enabled) {
            return;
        }
        if (param.shiftKey || param.ctrlKey || param.altKey) {
            return;
        }
        var tabSize = this.options.tab && this.options.tab.size || 0;
        var tab = new Array(tabSize).fill(this.utils.char('nbsp')).join('');
        return this.dependencies.BaseArch.insert(tab);
    }
    _redrawToRemoveArtefact (mutationsList) {
        var BaseRenderer = this.dependencies.BaseRenderer;
        var BaseRange = this.dependencies.BaseRange;

        // mark as dirty the new nodes to re-render it
        // because the browser can split other than our arch and we must fix the errors
        var targets = [];
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

        targets.forEach(function (target) {
            var id = BaseRenderer.getID(target);
            if (id) {
                BaseRenderer.markAsDirty(id, {childNodes: true, nodeValue: true});
            } else if (target.parentNode) {
                target.parentNode.removeChild(target);
            }
        });

        if (targets.length) {
            BaseRenderer.redraw({forceDirty: false});
            BaseRange.restore();
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
        if (e.type === 'keydown' && e.key === 'Dead') {
            return;
        }
        if (e.key === 'End' || e.key === 'Home' || e.key === 'PageUp' || e.key === 'PageDown' || e.key.indexOf('Arrow') === 0) {
            return;
        }
        var param = this._onKeyDownNextTick(e);
        param.defaultPrevented = param.defaultPrevented || e.defaultPrevented;
        param.type = param.type || e.type;
        param.shiftKey = e.shiftKey;
        param.ctrlKey = e.ctrlKey;
        param.altKey = e.altKey;
        param.key = e.key;
    }
    _onInput (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        var param = this._onKeyDownNextTick(e);

        if (!param.type) {
            param.type = e.type;
            param.data = e.data;
        }

        // todo: delete word <=> composition

        if (e.inputType === 'insertCompositionText' || e.inputType === 'insertReplacementText') {
            param.type = 'composition';
            param.replacement = true;
            param.data = e.data;
        } else if (e.inputType === 'insertParagraph' && param.key === 'Unidentified') {
            param.key = 'Enter';
        } else if (e.inputType === 'deleteContentBackward' && param.key === 'Unidentified') {
            param.key = 'Backspace';
        } else if (e.inputType === 'deleteContentForward' && param.key === 'Unidentified') {
            param.key = 'Delete';
        } else if (!param.data) {
            param.data = e.data;
        } else if (e.inputType === "insertText") {
            if (param.type.indexOf('key') === 0 && param.key.length === 1 && e.data.length === 1) {
                param.key = e.data; // keep accent
            } else if(e.data && e.data.length === 1 && e.data !== param.data && param.type === 'composition') {
                // swiftKey add automatically a space after the composition, without this line the arch is correct but not the range
                param.data += e.data;
            } else if (param.key === 'Unidentified') {
                param.key = e.data;
            }
        }
    }
    _onCompositionEnd (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        var param = this._onKeyDownNextTick(e);
        param.type = 'composition';
        param.data = e.data;
    }
    _onKeyDownNextTick (e) {
        if (this._currentEvent) {
            this._currentEvent.events.push(e);
            return this._currentEvent;
        }
        this._currentEvent = {
            type: null,
            key: 'Unidentified',
            data: '',
            shiftKey: false,
            ctrlKey: false,
            mutationsList: [],
            defaultPrevented: false,
            events: [e],
        };
        setTimeout(this.__onKeyDownNextTick.bind(this));
        return this._currentEvent;
    }
    __onKeyDownNextTick () {
        var Input = this.dependencies.Input;
        var param = this._currentEvent;
        this._currentEvent = null;

        var ev = this._eventsNormalization(param);
        if (!ev.defaultPrevented) {
            Input.trigger(ev.name, ev);
        }
        if (!ev.defaultPrevented) {
            this._eventsdDspatcher(ev, param);
        }

        this._redrawToRemoveArtefact(param.mutationsList);
    }
};

var Input = class extends we3.AbstractPlugin {};

we3.pluginsRegistry.BaseInput = BaseInput;
we3.pluginsRegistry.Input = Input;

})();
