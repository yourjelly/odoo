(function () {
'use strict';

we3.options.keyMap.pc['CTRL+SHIFT+NUM9'] = 'List.toggle:checklist';
we3.options.keyMap.mac['CMD+SHIFT+NUM9'] = 'List.toggle:checklist';

// Custom node representing a list (ul, ol, checklist)
var LIST = class extends we3.ArchNode {
    /**
     * @override
     */
    static parse (archNode) {
        if (!archNode.isChecklist && (archNode.nodeName === 'ul' || archNode.nodeName === 'ol')) {
            var list = new LIST(archNode.params, archNode.nodeName, archNode.attributes.toJSON());
            list.append(archNode.childNodes);
            return list;
        }
    }
    /**
     * Return true if the list is in a checklist or if it is a checklist
     *
     * @returns {boolean}
     */
    isInChecklist () {
        return !!this.ancestor('isChecklist');
    }
    /**
     * Return true if the list is indented
     *
     * @returns {boolean}
     */
    isIndented () {
        return !!this.ancestor('isLi');
    }
    /**
     * @returns {boolean}
     */
    isList () {
        return true;
    }
    /**
     * Return true if the list is ordered
     *
     * @returns {boolean}
     */
    isOl () {
        return this.nodeName === 'ol';
    }
    /**
     * Return true if the list is unordered (note: checklists are undordered)
     *
     * @returns {boolean}
     */
    isUl () {
        return this.nodeName === 'ul';
    }
    /**
     * Return a list of list items (`li`) inside this list.
     * By default, return only the first level list item children.
     *
     * @param {boolean} [all] true to include contained indented lists
     * @returns {ArchNode []}
     */
    items (all) {
        return this.descendents(node => node.isLi(), all);
    }
    /**
     * Get the list's type (ol, ul, checklist)
     *
     * @returns {string}
     */
    get listType () {
        return this.nodeName;
    }
    /**
     * @override
     */
    get type () {
        return 'LIST';
    }
    /**
     * Remove the list, preserving its contents, unlisted.
     * If the list is preceded by another list, move the contents to
     * the previous list item and return that list item.
     * 
     * @returns {ArchNode|undefined}
     */
    unlist () {
        var beforeList = this.previousSibling();
        if (beforeList && beforeList.isList()) {
            return this._mergeContentsWithPreviousLi();
        }
        return this._unlist();
    }

    /**
     * After moving the contents of a list to another list,
     * call this to clean the new edges.
     *
     * @private
     * @param {ArchNode []} contents
     */
    _cleanEdgesAfterUnlistMerge (contents) {
        // merge two p's in a li, not two li's
        if (contents.length && !(contents[0].isText() && contents[0].parent.isLi())) {
            contents[0].deleteEdge(true, { doNotRemoveEmpty: true });
        }
        var prev = this.previousSibling();
        this.remove();
        if (prev) {
            prev.deleteEdge(false, { doNotRemoveEmpty: true });
        }
    }
    /**
     * Moving the contents of a list to its preceding list
     *
     * @private
     * @returns {ArchNode}
     */
    _mergeContentsWithPreviousLi () {
        var beforeList = this.previousSibling();
        var li = this.items()[0];
        var contents = li.childNodes.slice();

        /* do not move a trailing BR to the previous node
        or move nodes after a trailing BR */
        this._removeTrailingBR(beforeList);
        this._removeTrailingBR(contents);

        var previousLi = beforeList.items(true).pop();
        contents.slice().forEach(node => previousLi.append(node));
        previousLi.cleanTextVSFormat(false);
        this._cleanEdgesAfterUnlistMerge(contents);

        return previousLi;
    }
    /**
     * Remove the `node`'s last leaf (or the last element
     * in the  `node` array) it it's a `BR`.
     *
     * @private
     * @param {ArchNode|ArchNode []} node
     */
    _removeTrailingBR (node) {
        if (Array.isArray(node)) {
            if (node[node.length - 1].isBR()) {
                node.pop();
            }
        } else {
            var lastLeaf = node.lastLeaf();
            if (lastLeaf.isBR()) {
                lastLeaf.remove();
            }
        }
    }
    /**
     * Move the contents of the list out of the list and remove the list.
     *
     * @private
     */
    _unlist () {
        var self = this;
        var li = this.items()[0];
        var contents = li.childNodes.slice();
        /* if there is nothing before the list or it's not another list,
        just insert the new content before the list */
        contents.slice().forEach(node => self.before(node));
        this.remove();
    }
}
we3.addArchNode('LIST', LIST);

// Custom node representing a list item (li)
var li = class extends we3.ArchNode {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * In merging two list elements, we might end up with a list element
     * containing format node alongside plain text nodes. This merges them.
     */
    cleanTextVSFormat (isLeft) {
        var nodes = isLeft ? this.childNodes.reverse() : this.childNodes;
        var hasText = nodes.some(node => node.isText());
        var hasFormat = nodes.some(node => node.isFormatNode());
        if (!hasText || !hasFormat) {
            return;
        }
        var prev;
        nodes.slice().forEach(function (node) {
            if (prev && node.isFormatNode() && prev.isText()) {
                var last = node.lastChild();
                prev.after(node.childNodes);
                node.remove();
                prev = last;
            } else if (prev && node.isText() && prev.isFormatNode()) {
                prev.append(node);
            } else {
                prev = node;
            }
        });
    }
    /**
     * Indent this list item
     */
    indent () {
        var indentedList = this.wrap(this.listType);
        indentedList.wrap('li');
    }
    /**
     * Return true if the list is in a checklist or if it is a checklist
     *
     * @returns {boolean}
     */
    isInChecklist () {
        return !!this.ancestor('isChecklist');
    }
    /**
     * Return true if the list item is indented
     *
     * @returns {boolean}
     */
    isIndented () {
        return !!this.ancestor('isParentOfIndented');
    }
    /**
     * @returns {boolean}
     */
    isLi () {
        return true;
    }
    /**
     * Return true if the list item is the parent of an indented list
     *
     * @returns {boolean}
     */
    isParentOfIndented () {
        return this.childNodes.length === 1 && this.firstChild().isList();
    }
    /**
     * Get the list's type (ol, ul, checklist)
     *
     * @returns {string}
     */
    get listType () {
        return this.ancestor('isList').listType;
    }
    /**
     * Indent this list item
     */
    outdent () {
        if (this.isParentOfIndented()) {
            this.descendents(node => node.isLi() && !node.isParentOfIndented(), true).forEach(node => node.outdent());
            return;
        }
        if (this.isIndented()) {
            this.unwrap();
            this.unwrap();
        } else {
            this.unlist();
        }
    }
    unlist () {
        // isolate the li
        this.parent.split(this.index() + 1, true);
        var next = this.parent.split(this.index(), true);
        var prev = this.parent.previousSibling();
        if (prev) {
            prev.removeIfEmpty();
        }
        // remove its list parent, preserving its contents
        next.ancestor('isList').unlist();
    }
    /**
     * @override
     */
    get type () {
        return 'li';
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _applyRulesArchNode () {
        var indentClass = this.params.options.list && this.params.options.list.indentClass;
        if (this.isParentOfIndented() && indentClass) {
            this.className.add(indentClass);
        }
        super._applyRulesArchNode();
    }
}
we3.addArchNode('li', li);

// Custom node representing a checklist (default: ul.o_checklist)
var CHECKLIST = class extends LIST {
    /**
     * @override
     */
    static parse (archNode) {
        var checklistInfo = archNode.params.options.list && archNode.params.options.list.checklist;
        var checklistClass = checklistInfo && checklistInfo.className;
        var hasChecklistClass = checklistClass && archNode.className && archNode.className.contains(checklistClass);
        if (archNode.nodeName === 'checklist' || hasChecklistClass || archNode.isList() && archNode.isInChecklist && archNode.isInChecklist()) {
            if (checklistClass && !hasChecklistClass) {
                archNode.className.add(checklistClass);
            }
            var checklist = new CHECKLIST(archNode.params, 'ul', archNode.attributes.toJSON());
            checklist.append(archNode.childNodes);
            return checklist;
        }
    }
    /**
     * @returns {boolean}
     */
    isChecklist () {
        return true;
    }
    /**
     * Get the list's type (checklist)
     *
     * @returns {string}
     */
    get listType () {
        return 'checklist';
    }
    /**
     * @override
     */
    get type () {
        return 'CHECKLIST';
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Get the class to apply to checklists from the options, if any
     *
     * @private
     * @returns {string|undefined}
     */
    get _checklistClass () {
        var checklistInfo = this.params.options.list && !this.params.options.list.checklist;
        return checklistInfo && checklistInfo.className;
    }
}
we3.addArchNode('CHECKLIST', CHECKLIST);

// Custom node representing a checklist item (default: ul.o_checklist > li)
var CHECKLIST_ITEM = class extends li {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    static parse (archNode) {
        if (archNode.isLi() && archNode.isInChecklist && archNode.isInChecklist() &&
            (!archNode.isParentOfIndented || !archNode.isParentOfIndented())) {
            var checklistItem = new CHECKLIST_ITEM(archNode.params, archNode.nodeName, archNode.attributes.toJSON());
            checklistItem.append(archNode.childNodes);
            return checklistItem;
        }
    }
    /**
     * Check the checklist item and all its lower level checklist items.
     * If all its siblings are checked, also check its higher level checklist item.
     *
     * @see higherLevelChecklistItem
     * @see lowerLevelChecklistItems
     */
    check () {
        this.markAsChecked();
        this._checkHigherIfComplete();
        this._checkLower();
    }
    /**
     * Return the next higher level checklist item, if any,
     * considering this structure:
     * [ ] higher level
     *      [ ] this checklist item
     * which is equivalent to:
     *  <ul>
     *      <li>higher level</li>
     *      <li>
     *          <ul>
     *              <li>this checklist item</li>
     *          </ul>
     *      </li>
     *  </ul>
     *
     * @returns {ArchNode|undefined}
     */
    higherLevelChecklistItem () {
        var parentOfIndented = this.parent.ancestor(node => node.isParentOfIndented && node.isParentOfIndented());
        var higherLevel = parentOfIndented && parentOfIndented.previousSibling();
        if (higherLevel && higherLevel.isChecklistItem && higherLevel.isChecklistItem()) {
            return higherLevel;
        }
    }
    /**
     * Return true if the checklist item is checked
     *
     * @returns {boolean}
     */
    isChecked () {
        if (this._checkedClass) {
            this._isChecked = this.className.contains(this._checkedClass);
        }
        return this._isChecked || false;
    }
    isChecklistItem () {
        return true;
    }
    isInChecklist () {
        return true;
    }
    /**
     * Return true if all of this checklist item's lower level checklist items are checked
     *
     * @see lowerLevelChecklistItems
     * @returns {boolean}
     */
    isLowerLevelComplete () {
        return this.lowerLevelChecklistItems().every(node => node.isChecked());
    }
    /**
     * Return all of this checklist item's direct lower level checklist items,
     * considering this structure:
     * [ ] this checklist item
     *      [ ] direct lower level
     *          [ ] indirect lower level
     * which is equivalent to:
     *  <ul>
     *      <li>this checklist item</li>
     *      <li>
     *          <ul>
     *              <li>direct lower level</li>
     *              <li>
     *                  <ul>
     *                      <li>indirect lower level</li>
     *                  </ul>
     *              </li>
     *          </ul>
     *      </li>
     *  </ul>
     *
     * @returns {ArchNode []}
     */
    lowerLevelChecklistItems () {
        var next = this.nextSibling();
        return next && next.descendents(node => node.isChecklistItem && node.isChecklistItem()) || [];
    }
    /**
     * Mark this checklist item as checked
     */
    markAsChecked () {
        this._isChecked = true;
        if (this._checkedClass && !this.className.contains(this._checkedClass)) {
            this.className.add(this._checkedClass);
        }
    }
    /**
     * Mark this checklist item as unchecked.
     */
    markAsUnchecked () {
        this._isChecked = false;
        if (this._checkedClass && this.className.contains(this._checkedClass)) {
            this.className.remove(this._checkedClass);
        }
    }
    /**
     * Toggle this checklist item's `checked` quality, and update that of its
     * higher and lower levels
     *
     * @see check
     * @see uncheck
     * @see higherLevelChecklistItem
     * @see lowerLevelChecklistItems
     */
    toggleChecked () {
        if (this.isChecked()) {
            this.uncheck();
        } else {
            this.check();
        }
    }
    /**
     * @override
     */
    get type () {
        return 'CHECKLIST_ITEM';
    }
    /**
     * Uncheck the checklist item and all its lower and higher level checklist items.
     *
     * @see higherLevelChecklistItem
     * @see lowerLevelChecklistItems
     */
    uncheck () {
        this.markAsUnchecked();
        this._uncheckHigher();
        this._uncheckLower();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Get the class to apply to checked checklist items from the options, if any
     *
     * @private
     * @returns {string|undefined}
     */
    get _checkedClass () {
        var checklistInfo = this.params.options.list && this.params.options.list.checklist;
        return checklistInfo && checklistInfo.checkedClass;
    }
    /**
     * Check the higher level checklist element if there is one and all its lower level
     * checklist elements are checked.
     *
     * @private
     * @see check
     * @see higherLevelChecklistItem
     */
    _checkHigherIfComplete () {
        var higherLevel = this.higherLevelChecklistItem();
        if (higherLevel && !higherLevel.isChecked() && higherLevel.isLowerLevelComplete()) {
            higherLevel.check();
        }
    }
    /**
     * Check all of this checklist item's lower level checklist items
     *
     * @private
     * @see check
     * @see lowerLevelChecklistItems
     */
    _checkLower () {
        this.lowerLevelChecklistItems().forEach(function (node) {
            if (!node.isChecked()) {
                node.check();
            }
        });
    }
    /**
     * Uncheck this checklist item's higher level checklist items
     *
     * @private
     * @see markAsUnchecked
     * @see higherLevelChecklistItem
     */
    _uncheckHigher () {
        var higherLevel = this.higherLevelChecklistItem();
        while (higherLevel) {
            higherLevel.markAsUnchecked();
            higherLevel = higherLevel.higherLevelChecklistItem();
        }
    }
    /**
     * Uncheck all of this checklist item's lower level checklist items
     *
     * @private
     * @see uncheck
     * @see lowerLevelChecklistItems
     */
    _uncheckLower () {
        this.lowerLevelChecklistItems().forEach(function (node) {
            if (node.isChecked()) {
                node.uncheck();
            }
        });
    }
}
we3.addArchNode('CHECKLIST_ITEM', CHECKLIST_ITEM);

// Plugin to handle lists
var ListPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'Indent', 'Range'];
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_list.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.list',
            active: '_active',
        };
        this.editableDomEvents = {
            'mousedown': '_onMouseDown',
            'keydown': '_onKeyDown',
        };
        this.options.list = this.options.list || {
            checklist: {
                className: 'o_checklist',
                checkedClass: 'o_checked',
            },
            indentClass: 'o_indent',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Indent the list
     */
    indent () {
        this.dependencies.Arch.do(() => this.dependencies.Arch.indent());
    }
    /**
     * Outdent the list
     */
    outdent () {
        this.dependencies.Arch.do(() => this.dependencies.Arch.outdent());
    }
    /**
     * Insert an ordered list, an unordered list or a checklist.
     * If already in list, remove the list or convert it to the given type.
     *
     * @param {string('ol'|'ul'|'checklist')} type the type of list to insert
     */
    toggle (type) {
        this.dependencies.Arch.do(getArchNode => this._toggle(type, getArchNode));
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {String} buttonName
     * @param {ArchNode} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        if (!focusNode.isInList()) {
            return false;
        }
        var listType = buttonName.split('-')[1];
        var method = 'is' + listType.slice(0,1).toUpperCase() + listType.slice(1);
        return !!focusNode.ancestor(node => node[method] && node[method]());
    }
    /**
     * Convert ul<->ol, ul<->checklist, ol<->checklist.
     *
     * @private
     * @param {string('ol'|'ul'|'checklist')} type the type of list to insert
     * @param {function} getArchNode
     * @returns {ArchNode []} list of created lists
     */
    _convertList (type, getArchNode) {
        var idsToWrap = this._removeList(getArchNode);
        return this._insertList(type, getArchNode, idsToWrap);
    }
    /**
     * Insert a list at range or turn `nodeToWrap` into a list.
     *
     * @private
     * @param {string('ol'|'ul'|'checklist')} nodeName the type of list to insert
     * @param {function} getArchNode
     * @param {ArchNode|number []} [nodesToWrap] the node to wrap or its id
     * @returns {ArchNode []} list of created lists
     */
    _insertList (nodeName, getArchNode, nodesToWrap) {
        var idsToWrap = (nodesToWrap || []).map(function (nodeOrID) {
            return typeof nodeOrID === 'number' ? nodeOrID : nodeOrID.id;
        });
        var liIDs = [];
        // wrap each lowest level block at range into a li
        if (idsToWrap.length) {
            liIDs = this.dependencies.Arch.wrap(idsToWrap, 'li');
        } else {
            /* `wrapAncestorPred` ensures we wrap either the block parent or the
            child of a `td` */
            liIDs = this.dependencies.Arch.wrapRange('li', {
                doNotSplit: true,
                wrapAncestorPred: n => n.parent && n.parent.isTd() || n.isBlock(),
            });
        }
        // wrap the generated list items into a list of type `nodeName`
        return this.dependencies.Arch.wrap(liIDs, nodeName)
            .map(getArchNode).filter(node => node && node.isList());
    }
    /**
     * Return true if every node in the given array is in a list.
     * Note: return false if the array is empty.
     *
     * @private
     * @param {ArchNode []} nodes
     * @returns {boolean}
     */
    _isAllInList (nodes) {
        return !!nodes.length && nodes.every(node => node.isInList());
    }
    /**
     * Return true if every node in the given array is in a list of type `type`.
     * Note: return false if the array is empty.
     *
     * @private
     * @param {ArchNode []} nodes
     * @param {string} type
     * @returns {boolean}
     */
    _isAllInListType (nodes, type) {
        if (!this._isAllInList(nodes)) {
            return false;
        }
        var method;
        if (type === 'ul') {
            method = node => node.isUl && node.isUl() && (!node.isChecklist || !node.isChecklist());
        } else {
            var methodName = 'is' + type.slice(0,1).toUpperCase() + type.slice(1);
            method = node => node[methodName] && node[methodName]();
        }
        var firstListAncestors = nodes.map(node => node.ancestor('isList'));
        return !!firstListAncestors.length && firstListAncestors.every(method);
    }
    /**
     * Merge a list with its next and previous list if any,
     * and return a list of the remaining edges
     *
     * @private
     * @param {ArchNode} list
     */
    _mergeSiblingLists (list) {
        function __mergeNextList (list, isPrev) {
            var nextList = list[isPrev ? 'previousSibling' : 'nextSibling']();
            if (nextList && nextList.listType === list.listType) {
                var nextEdge = isPrev ? list : nextList;
                nextEdge.deleteEdge(true, { mergeOnlyIfSameType: true });
            }
        }
        __mergeNextList(list, false);
        __mergeNextList(list, true);
        var parentOfIndented = list.ancestor('isParentOfIndented');
        if (parentOfIndented) {
            parentOfIndented.deleteEdge(false, { mergeOnlyIfSameType: true });
        }
    }
    /**
     * Remove a list at range
     *
     * @private
     * @param {function} getArchNode
     * @returns {number []} the ids of the unwrapped contents
     */
    _removeList (getArchNode) {
        var nodeNamesToRemove = ['li', 'ol', 'ul'];
        var liAncestors = this._selectedListItems().map(getArchNode);
        var contentIDs = we3.utils.flatMap(liAncestors, li => li.childNodes)
            .map(node => node.id);
        if (liAncestors.length && liAncestors.every(li => li.isIndented())) {
            this.dependencies.Arch.outdent();
        } else if (this.dependencies.Range.isCollapsed()) {
            if (!contentIDs.length) { // li has no children => append a virtual
                var virtual = liAncestors[0].params.create();
                liAncestors[0].append(virtual);
                contentIDs.push(virtual.id);
            }
            this.dependencies.Arch.unwrapFrom(contentIDs, nodeNamesToRemove);
        } else {
            this.dependencies.Arch.unwrapRangeFrom(nodeNamesToRemove, {
                doNotSplit: true,
            });
        }
        return contentIDs;
    }
    /**
     * Return a list of ids of list items (`li`) at range
     *
     * @private
     * @returns {number []}
     */
    _selectedListItems () {
        var selectedLeaves = this.dependencies.Range.getSelectedLeaves();
        return selectedLeaves.map(function (node) {
            var liAncestor = node.ancestor('isLi');
            return liAncestor && liAncestor.id;
        }).filter(id => id);
    }
    /**
     * Return a list of lists (`ul`, `ol`, `checklist`) at range
     *
     * @private
     * @returns {ArchNode []}
     */
    _selectedLists () {
        var selectedLeaves = this.dependencies.Range.getSelectedLeaves();
        var listAncestors = selectedLeaves.map(node => node.ancestor('isList'));
        return we3.utils.uniq(listAncestors.filter(node => node));
    }
    /**
     * Insert an ordered list, an unordered list or a checklist.
     * If already in list, remove the list or convert it to the given type.
     *
     * @private
     * @param {string('ol'|'ul'|'checklist')} type the type of list to insert
     * @param {function} getArchNode
     */
    _toggle (type, getArchNode) {
        var range = this.dependencies.Range.getRange();
        var selectedLeaves = this.dependencies.Range.getSelectedLeaves();
        var newLists = [];
        if (this._isAllInList(selectedLeaves)) {
            if (this._isAllInListType(selectedLeaves, type)) {
                this._removeList(getArchNode); // [ REMOVE ]
            } else {
                newLists = this._convertList(type, getArchNode); // [ CONVERT ]
            }
        } else {
            newLists = this._insertList(type, getArchNode); // [ INSERT ]
        }
        newLists.slice().forEach(this._mergeSiblingLists); // Clean edges
        var start = getArchNode(selectedLeaves[0].id); // Restore range
        var end = getArchNode(selectedLeaves[selectedLeaves.length - 1].id);
        if (start && end) {
            return {
                scID: start.id,
                so: range.so,
                ecID: end.id,
                eo: range.eo,
            };
        }
    }

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /**
     * Handle special list behavior of `BACKSPACE` and `TAB` key presses
     *
     * @private
     * @param {KeyboardEvent} e
     */
    _onKeyDown (e) {
        if (e.defaultPrevented) {
            return;
        }
        var range = this.dependencies.Range.getRange();
        var isLeftEdgeOfLi = range.scArch.isLeftEdgeOfPred(node => node.isLi()) && range.so === 0;
        if (!range.isCollapsed() || !isLeftEdgeOfLi) {
            return;
        }
        switch (e.keyCode) {
            case 8: // BACKSPACE
                e.preventDefault();
                e.stopPropagation();
                this.outdent();
                break;
            case 9: // TAB
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) {
                    this.outdent();
                } else {
                    this.indent();
                }
                break;
        }
    }
    /**
     * Handle the clicking of a checklist item
     *
     * @private
     * @param {MouseEvent} e
     */
    _onMouseDown (e) {
        var archNode = this.dependencies.Arch.getClonedArchNode(e.target);
        var isChecklistItem = archNode && archNode.isChecklistItem && archNode.isChecklistItem();
        var isClickInCheckbox = isChecklistItem && e.offsetX <= 0;
        if (!isClickInCheckbox) {
            return;
        }
        e.preventDefault();
        archNode.toggleChecked();
        var highestChecklist = archNode.ancestor(node => node.isChecklist && node.isChecklist(), true);
        this.dependencies.Arch.importUpdate(highestChecklist.toJSON());
        this.dependencies.Range.setRange({
            scID: archNode.id,
            so: 0,
        });
    }
};

we3.addPlugin('List', ListPlugin);

})();
