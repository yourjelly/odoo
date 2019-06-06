(function () {
'use strict';

function True () { return true; };

var regMultiSpace = /\s\s+/g;
var regSplitStyles = /\s*;\s*/;
var regSplitStyle = /\s*:\s*/;

//////////////////////////////////////////////////////////////

var ClassName = class {
    constructor (archNode, classNames) {
        this.archNode = archNode;
        this.value = classNames.replace(regMultiSpace, ' ').split(' ');
    }
    add (classNames) {
        if (!this.archNode.params.isBypassUpdateConstraintsActive()  && this.archNode.isInArch() && !this.archNode.isEditable()) {
            console.warn("cannot update class of a non editable node");
            return;
        }
        var self = this;
        classNames.replace(regMultiSpace, ' ').split(' ').forEach(function (className) {
            var index = self.value.indexOf(className);
            if (index === -1) {
                self.value.push(className);
                self.archNode._triggerChange();
            }
        });
    }
    contains (className) {
        return this.value.indexOf(className) !== -1;
    }
    isEqual (obj, options) {
        if (!obj) {
            return !this.value.length;
        }
        var self = this;
        var isEqual = true;
        this.value.concat(obj.value).forEach(function (className) {
            if (!isEqual || options && options.blackListClassNames && options.blackListClassNames.indexOf(className) !== -1) {
                return;
            }
            if (self.value.indexOf(className) === -1 || obj.value.indexOf(className) === -1) {
                isEqual = false;
            }
        });
        return isEqual;
    }
    remove (classNames) {
        if (!this.archNode.params.isBypassUpdateConstraintsActive()  && this.archNode.isInArch() && !this.archNode.isEditable()) {
            console.warn("cannot update class of a non editable node");
            return;
        }
        var self = this;
        classNames.replace(regMultiSpace, ' ').split(' ').forEach(function (className) {
            var index = self.value.indexOf(className);
            if (index !== -1) {
                self.value.splice(index, 1);
                self.archNode._triggerChange();
            }
        });
    }
    toggle (className) {
        if (this.contains(className)) {
            this.remove(className);
        } else {
            this.add(className);
        }
    }
    toString () {
        return this.value.sort().join(' ');
    }
    get length () {
        return this.toString().length;
    }
};

//////////////////////////////////////////////////////////////

var Attributes = class {
    constructor (archNode, attributes) {
        var self = this;
        this.archNode = archNode;
        this.__order__ = [];
        attributes.forEach(function (attribute) {
            self.add(attribute[0], attribute[1]);
        });
    }
    add (name, value) {
        if (!this.archNode.params.isBypassUpdateConstraintsActive()  && this.archNode.isInArch() && !this.archNode.isEditable()) {
            console.warn("cannot update style of a non editable node");
            return;
        }
        if (this.__order__.indexOf(name) === -1) {
            this.__order__.push(name);
        }
        if (name === 'class') {
            value = new ClassName(this.archNode, value + '');
        } else if (name === 'style') {
            value = new Style(this.archNode, value + '');
        } else if (value === null || value === '') {
            return this.remove(name);
        }
        if (this[name] !== value) {
            this[name] = value;
            this.archNode._triggerChange();
        }
    }
    clear () {
        if (!this.archNode.params.isBypassUpdateConstraintsActive()  && this.archNode.isInArch() && !this.archNode.isEditable()) {
            console.warn("cannot update attribute of a non editable node");
            return;
        }
        var self = this;
        this.__order__.forEach(function (name) {
            delete self[name];
        });
        this.__order__ = [];
    }
    isEqual (obj, options) {
        if (!obj) {
            return !this.__order__.length;
        }
        var self = this;
        var isEqual = true;
        var list = this.__order__.slice();
        obj.__order__.forEach(function (name) {
            if (list.indexOf(name) === -1) {
                list.push(name);
            }
        });
        list.forEach(function (name) {
            if (!name.indexOf('_') || !isEqual || options && options.blackList && options.blackList.indexOf(name) !== -1) {
                return;
            }
            if (name === 'class' || name === 'style') {
                isEqual = self[name].isEqual(obj[name], options);
            } else if (self[name] instanceof Array && obj[name] instanceof Array) {
                isEqual = self[name].every(function (item, index) {
                    return obj[name][index] && item === obj[name][index];
                });
            } else if (self[name] !== obj[name]) {
                isEqual = false;
            }
        });
        return isEqual;
    }
    forEach (fn) {
        this.__order__.forEach(fn.bind(this));
    }
    remove (name) {
        if (!this.archNode.params.isBypassUpdateConstraintsActive()  && this.archNode.isInArch() && !this.archNode.isEditable()) {
            console.warn("cannot update attribute of a non editable node");
            return;
        }
        var index = this.__order__.indexOf(name);
        if (index !== -1) {
            this.__order__.splice(index, 1);
            this.archNode._triggerChange();
        }
        delete this[name];
    }
    toJSON () {
        var self = this;
        var attributes = [];
        this.__order__.forEach(function (name) {
            var value = name in self ? self[name].toString() : '';
            if (value.length) {
                attributes.push([name, value]);
            }
        });
        return attributes;
    }
    toString () {
        var self = this;
        var string = '';
        this.__order__.forEach(function (name) {
            var value = name in self ? self[name].toString() : '';
            if (!value.length) {
                return;
            }
            if (string.length) {
                string += ' ';
            }
            string += name + '="' + value.replace('"', '\\"') + '"';
        });
        return string;
    }
};

//////////////////////////////////////////////////////////////

var Style = class extends Attributes {
    constructor (archNode, style) {
        super(archNode, []);
        var self = this;
        style.trim().split(regSplitStyles).forEach(function (style) {
            var split = style.split(regSplitStyle);
            if (split.length === 2) {
                self.add(split[0], split[1]);
            }
        });
    }
    add (name, value) {
        if (!this.archNode.params.isBypassUpdateConstraintsActive()  && this.archNode.isInArch() && !this.archNode.isEditable()) {
            console.warn("cannot update style of a non editable node");
            return;
        }
        if (value.trim() === '') {
            return this.remove(name);
        }
        if (this.__order__.indexOf(name) === -1) {
            this.__order__.push(name);
        }
        if (this[name] !== value) {
            this[name] = value;
            this.archNode._triggerChange();
        }
    }
    update (style) {
        var self = this;
        Object.keys(style).forEach (function (key) {
            self.add(key, style[key]);
        });
    }
    toString () {
        var self = this;
        var string = '';
        this.__order__.forEach(function (name) {
            var value = self[name].toString();
            if (!value.length) {
                return;
            }
            if (string.length) {
                string += '; ';
            }
            string += name + ':' + value.replace('"', '\\"');
        });
        return string;
    }
};

//////////////////////////////////////////////////////////////

we3.ArchNode = class {
    constructor (params, nodeName, attributes, nodeValue) {
        this.params = params;
        this.nodeName = nodeName && nodeName.toLowerCase();
        this.nodeValue = !nodeName && nodeValue;
        if (nodeName || !this.isText()) {
            this.attributes = new Attributes(this, attributes || []);
            if (!this.attributes.class) {
                this.attributes.add('class', '');
            }
            if (!this.attributes.style) {
                this.attributes.add('style', '');
            }
        }
        this.childNodes = [];
        this._triggerChange(this.length());
    }
    get className () {
        return this.attributes && this.attributes.class;
    }
    set className (className) {
        return this.attributes.add('class', className || '');
    }
    get style () {
        return this.attributes && this.attributes.style;
    }
    get type () {
        return 'ArchNode';
    }

    //--------------------------------------------------------------------------
    // Public: Export
    //--------------------------------------------------------------------------

    toJSON (options) {
        var data = {
            type: this.type,
        };
        if (this.id) {
            data.id = this.id;
        }

        if (this.childNodes) {
            var childNodes = [];
            this.childNodes.forEach(function (archNode) {
                var json = archNode.toJSON(options);
                if (json) {
                    if (json.type !== 'FRAGMENT' || json.nodeName || json.nodeValue) {
                        childNodes.push(json);
                    } else if (json.childNodes) {
                        childNodes = childNodes.concat(json.childNodes);
                    }
                }
            });
            if (childNodes.length) {
                data.childNodes = childNodes;
            }
        }

        if (this.isVirtual()) {
            data.isVirtual = true;
            if (!options || !options.keepVirtual) {
                return data;
            }
        }

        if (this.nodeName) {
            data.nodeName = this.nodeName;
        }
        if (this.nodeValue) {
            data.nodeValue = this.nodeValue;
        }
        if (this.attributes) {
            var attributes = this.attributes.toJSON();
            if (attributes.length) {
                data.attributes = attributes;
            }
        }

        return data;
    }
    toString (options) {
        options = options || {};
        var string = '';

        if (this.nodeName && (!this.isVirtual() || options.keepVirtual) && !options.onlyText) {
            string += '<' + this.nodeName;
            var attributes = this.attributes.toString(options);
            if (attributes.length) {
                string += ' ';
                string += attributes;
            }
            if (options.showIDs) {
                string += ' archID="' + this.id + '"';
            }
            if (this.isVoid() && !this.childNodes.length) {
                string += '/';
            }
            string += '>';
        }
        var i = 0;
        while (i < this.childNodes.length) {
            string += this.childNodes[i].toString(options);
            i++;
        }
        if (this.nodeName && (!this.isVirtual() || options.keepVirtual) && !options.onlyText && (!this.isVoid() || this.childNodes.length)) {
            string += '</' + this.nodeName + '>';
        }
        return string;
    }
    clone (options) {
        var clone = new this.constructor(this.params, this.nodeName, this.attributes && this.attributes.toJSON(), this.nodeValue);
        clone.isClone = True;
        clone.id = this.id;

        if (this.childNodes) {
            this.childNodes.forEach(function (child) {
                if (!child.isArchitecturalSpace() && (!child.isVirtual() || options && options.keepVirtual)) {
                    var clonedChild = child.clone(options);
                    clonedChild.parent = clone;
                    clone.childNodes.push(clonedChild);
                }
            });
        }
        return clone;
    }

    //--------------------------------------------------------------------------
    // Public: Update (to check if private ?)
    //--------------------------------------------------------------------------

    /**
     * Insert a(n) (list of) archNode(s) after the current archNode
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    after (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.after.bind(this));
        }
        return this.parent.insertAfter(archNode, this);
    }
    /**
     * Insert a(n) (list of) archNode(s) before the current archNode
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    before (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.before.bind(this));
        }
        return this.parent.insertBefore(archNode, this);
    }
    /**
     * Insert a(n) (list of) archNode(s) at the end of the current archNode's children
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    append (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.append.bind(this));
        }
        return this._changeParent(archNode, this.childNodes.length);
    }
    /**
     * Delete the edges between this node and its siblings of which it's at the
     * left or right edge (given the value of `isLeft`), from top to bottom.
     *
     * @param {Boolean} isLeft true to delete the left edge
     * @param {Object} [options]
     * @param {Boolean} [options.doNotBreakBlocks] true to prevent the merging of block-type nodes
     * @param {Boolean} [options.doNotRemoveEmpty] true to prevent the removal of empty nodes
     * @param {Boolean} [options.keepRight] true to always merge an empty node into its next node and not the other way around
     * @param {Boolean} [options.mergeOnlyIfSameType] true to prevent the merging of nodes of different types (eg p & h1)
     */
    deleteEdge (isLeft, options) {
        options = options || {};
        var node = this;
        var edges = [];
        while (node && !node.isRoot() && (!options.doNotBreakBlocks || !node.isBlock())) {
            if (!node.isText()) {
                edges.push(node);
            }
            if (!node.parent || !node[isLeft ? 'isLeftEdgeOf' : 'isRightEdgeOf'](node.parent)) {
                break;
            }
            node = node.parent;
        }
        edges.reverse().slice().forEach(function (node) {
            var next = node[isLeft ? 'previousSibling' : 'nextSibling'](null, true);
            if (!next) {
                return;
            }
            if (!options.doNotRemoveEmpty && node.isDeepEmpty() && !node.isVoid()) {
                if (next.isVoid() || next.isText()) {
                    node.unwrap();
                    return;
                }
                var goes = isLeft || options.keepRight ? node : next;
                var stays = isLeft || options.keepRight ? next : node;
                goes._mergeInto(stays, isLeft);
                return;
            }

            if (node.isFormatNode() && next.isList() || node.isList() && next.isFormatNode()) {
                if (node.isList() && next.isFormatNode()) {
                    next = [node, node = next][0]; // swap
                    isLeft = !isLeft;
                }
                next = next[isLeft ? 'lastChild' : 'firstChild'](function (descendent) {
                    return descendent.parent.isLi();
                });
                next = next.isText() ? next.wrap('p') : next;
                if (isLeft) {
                    next.after(node);
                } else {
                    var li = next.parent;
                    var parent = li.parent;
                    node.after(next);
                    li.remove();
                    while (parent && parent.isEmpty() && !parent.isRoot()) {
                        var ancestor = parent.parent;
                        parent.remove();
                        parent = ancestor;
                    }
                }
                options.mergeOnlyIfSameType = true;
            }
            var areMergeableDifferentTypes = !options.mergeOnlyIfSameType && node.isBlock() && next.isFormatNode();
            var isCrossUnbreakables = node.ancestor('isUnbreakable') !== next.ancestor('isUnbreakable');
            var hasBR = node.isBR() || next.isBR();
            if (!hasBR && !isCrossUnbreakables && (areMergeableDifferentTypes || node._isMergeableWith(next))) {
                if (areMergeableDifferentTypes && node.nextSibling() === next) {
                    next._mergeInto(node, true); // non-similar merging always happens from right to left
                } else {
                    node._mergeInto(next, isLeft);
                }
            }
        });
        return this;
    }
    _isMergeableWith (node) {
        var haveSameNodeNames = this.nodeName === node.nodeName;
        var haveSameAttributes = this.attributes.isEqual(node.attributes);
        var haveSameClasses = this.className.isEqual(node.className);
        return haveSameNodeNames && haveSameAttributes && haveSameClasses;
    }
    insertAfter (archNode, ref) {
        return this._changeParent(archNode, ref.index() + 1);
    }
    insertBefore (archNode, ref) {
        return this._changeParent(archNode, ref.index());
    }
    _mergeInto (next, isLeft) {
        var nextEdge = next[isLeft ? 'lastLeaf' : 'firstLeaf']();
        if (nextEdge.isBR()) {
            nextEdge.remove();
        } else {
            var edge = this[isLeft ? 'firstLeaf' : 'lastLeaf']();
            if (edge.isPlaceholderBR()) {
                edge[isLeft ? 'before' : 'after'](this.params.create());
                edge.remove();
            }
        }
        if (this._mergeMixedIndents(isLeft, next)) {
            return;
        }
        var childNodes = this.childNodes.slice();
        next[isLeft ? 'append' : 'prepend'](isLeft ? childNodes : childNodes.reverse());
        this.remove();
    }
    /**
     * Merge an indented list with a non-indented list item if needed.
     * Return false if this is irrelevant.
     *
     * @param {Boolean} isLeft
     * @param {ArchNode} next
     * @returns {Boolean} true if handled
     */
    _mergeMixedIndents (isLeft, next) {
        var node = isLeft ? next : this;
        next = isLeft ? this : next;
        if (node.isParentOfIndentedList() && !next.isParentOfIndentedList()) {
            node.lastChild(node.isLi).after(next);
            next.deleteEdge(true);
            return true;
        }
        if (next.isParentOfIndentedList() && !node.isParentOfIndentedList()) {
            var nextLi = next.firstChild(next.isLi);
            node.after(nextLi);
            next.remove();
            nextLi.deleteEdge(true);
            return true;
        }
        return false;
    }
    /**
     * Insert a(n) (list of) archNode(s) at the beginning of the current archNode's children
     *
     * @param {ArchNode|ArchNode []} archNode
     */
    prepend (archNode) {
        if (Array.isArray(archNode)) {
            return archNode.slice().forEach(this.prepend.bind(this));
        }
        return this._changeParent(archNode, 0);
    }
    empty () {
        if (!this.isAllowUpdate()) {
            console.warn("cannot empty a non editable node");
            return;
        }
        this.childNodes.slice().forEach(function (archNode) {
            archNode.remove();
        });
        this._triggerChange(0);
    }
    remove () {
        if (this.parent) {
            if (!this.parent.isAllowUpdate()) {
                console.warn("cannot remove a node in a non editable node");
                return;
            }
            var offset = this.index();
            this.parent.childNodes.splice(offset, 1);
            this.parent._triggerChange(offset);
        }
        this.params.remove(this);
        this.parent = null;
        this.__removed = true;
    }
    removeIfEmpty () {
        if (this.isEmpty()) {
            this.remove();
        }
    }
    removeLeft (offset) {
        return this._removeSide(offset, true);
    }
    removeRight (offset) {
        return this._removeSide(offset, false);
    }
    reverseSplitUntil (descendent, offset) {
        var self = this;
        if (this.isUnbreakable()) {
            return this;
        }
        var child = descendent.ancestor((ancestor) => ancestor.parent && ancestor.parent.id === self.id);
        var thisOffset = !child || this.id === descendent.id ? offset : child.index();
        this.split(thisOffset);
        return this.id === descendent.id || !child ? this : child.reverseSplitUntil(descendent, offset);
    }
    split (offset) {
        if (this.isUnbreakable()) {
            console.warn("cannot split an unbreakable node");
            return;
        }

        if (!this.isAllowUpdate()) {
            console.warn("cannot split a non editable node");
            return;
        }

        var Constructor = this.constructor;
        var archNode = new Constructor(this.params, this.nodeName, this.attributes ? this.attributes.toJSON() : []);
        archNode._triggerChange(0);

        if (this.childNodes) {
            var childNodes = this.childNodes.slice(offset);
            while (childNodes.length) {
                archNode.prepend(childNodes.pop());            
            }
        }

        this.after(archNode);
        return archNode;
    }
    splitUntil (ancestor, offset) {
        if (this.isUnbreakable()) {
            return this;
        }
        var right = this.split(offset) || this;
        return this === ancestor ? this : right.parent.splitUntil(ancestor, right.index());
    }
    unwrap () {
        this.before(this.childNodes);
        this.remove();
    }
    wrap (nodeName) {
        var wrapper = this.params.create(nodeName);
        this.before(wrapper);
        wrapper.append(this);
        return wrapper;
    }

    //--------------------------------------------------------------------------
    // Public: Update
    //--------------------------------------------------------------------------

    insert (archNode, offset) {
        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }
        if (this.isVoid()) {
            this.parent.insert(archNode, this.index());
            return;
        }
        archNode._triggerChange(archNode.length());
        var ref = this.childNodes[offset];
        if (ref) {
            this.insertBefore(archNode, ref);
        } else {
            this.append(archNode);
        }
    }
    addLine (offset) {
        if (!this.isInFlowBlock()) {
            return;
        }

        if (!this.isEditable()) {
            console.warn("can not split a not editable node");
            return;
        }

        var child = this.childNodes[offset];
        var isChildRightEdgeVirtual = child && child.isRightEdge() && child.isVirtual();
        if (isChildRightEdgeVirtual && !this.isUnbreakable() && (this.isFormatNode() || this.isPara())) {
            var virtual = this.childNodes[offset];
            this.after(virtual);
            if (this.isEmpty()) {
                this.append(this.params.create());
            }
            return virtual.parent.addLine(virtual.index());
        }
        var next = this.split(offset);
        if (!this.childNodes.length) {
            this.insert(this.params.create('br'), offset);
        }
        if (!next.childNodes.length) {
            next.insert(this.params.create('br'), offset);
        }

        if (!next.isFlowBlock() || next.isInLi() && !next.isLi()) {
            return next.parent.addLine(next.index());
        }
        return;
    }

    //--------------------------------------------------------------------------
    // Public: Browse
    //--------------------------------------------------------------------------

    childNodesIDs () {
        var ids = [];
        if (this.childNodes) {
            this.childNodes.forEach(function (node) {
                ids.push(node.id);
            });
        }
        return ids;
    }
    firstChild (fn) {
        var first = this.childNodes && this.childNodes.length ? this.childNodes[0] : null;
        if (!first || !fn || fn.call(first, first)) {
            return first;
        }
        return first.firstChild(fn);
    }
    firstLeaf () {
        return this.firstChild(function (child) {
            return !child.firstChild();
        }) || this;
    }
    index (options) {
        return this.parent.childNodes.indexOf(this);
    }
    lastChild (fn) {
        var last = this.childNodes && this.childNodes.length ? this.childNodes[this.childNodes.length - 1] : null;
        if (!last || !fn || fn.call(last, last)) {
            return last;
        }
        return last.lastChild(fn);
    }
    lastLeaf () {
        return this.lastChild(function (child) {
            return !child.lastChild();
        }) || this;
    }
    nextSibling (fn, doNotSkipNotEditables) {
        if (!this.parent) {
            return false;
        }
        var next = this.parent.childNodes[this.index() + 1];
        return next && next._nextSibling(fn, doNotSkipNotEditables);
    }
    /**
     * Return the (zero-indexed) nth child of the archNode or null.
     *
     * @param {Number} n
     * @returns {ArchNode}
     */
    nthChild (n) {
        return this.childNodes[n];
    }
    previousSibling (fn, doNotSkipNotEditables) {
        if (!this.parent) {
            return false;
        }
        var prev = this.parent.childNodes[this.index() - 1];
        return prev && prev._previousSibling(fn, doNotSkipNotEditables);
    }
    /**
     * Return a list of child nodes that are not architectural space.
     */
    visibleChildren () {
        if (!this.childNodes) {
            return;
        }
        var visibleChildren = [];
        this.childNodes.forEach(function (child) {
            if (!child.isArchitecturalSpace()) {
                visibleChildren.push(child);
            }
        });
        return visibleChildren;
    }
    ancestor (fn, findGreatest) {
        var match;
        var parent = this;
        while (parent) {
            if (typeof fn === 'string' ? parent[fn] && parent[fn](parent) : fn(parent)) {
                match = parent;
                if (!findGreatest) {
                    break;
                }
            }
            parent = parent.parent;
        }
        return match;
    }
    contains (archNode) {
        var parent = archNode.parent;
        while (parent && parent !== this) {
            parent = parent.parent;
        }
        return !!parent;
    }
    commonAncestor (otherArchNode) {
        var ancestors = this.listAncestor();
        for (var n = otherArchNode; n; n = n.parent) {
            if (ancestors.indexOf(n) > -1) {
                return n;
            }
        }
        return null; // difference document area
    }
    listAncestor (pred) {
        var ancestors = [];
        this.ancestor(function (el) {
            if (!el.isContentEditable()) {
                ancestors.push(el);
            }
            return pred ? pred(el) : false;
        });
        return ancestors;
    }
    next (options) {
        var unbreakableContainer = this.ancestor('isUnbreakable');
        return this._prevNextUntil(unbreakableContainer, false, null, options);
    }
    /**
     * @param {function} fn called on this and get the next point as param
     *          return true if the next node is available
     * @param {Object} [options]
     * @param {Boolean} [options.leafToLeaf]
     * @param {Boolean} [options.doNotLeaveNode]
     * @returns {ArchNode}
     **/
    nextUntil (fn, options) {
        var unbreakableContainer = options && options.doNotLeaveNode ? this : this.ancestor('isUnbreakable');
        return this._prevNextUntil(unbreakableContainer, false, fn, options);
    }
    prev (options) {
        var unbreakableContainer = options && options.doNotLeaveNode ? this : this.ancestor('isUnbreakable');
        return this._prevNextUntil(unbreakableContainer, true, null, options);
    }
    prevUntil (fn, options) {
        var unbreakableContainer = options && options.doNotLeaveNode ? this : this.ancestor('isUnbreakable');
        return this._prevNextUntil(unbreakableContainer, true, fn, options);
    }
    length () {
        return this.childNodes.length;
    }
    path (ancestor) {
        var path = [];
        var node = this;
        while (node.parent && node.parent !== ancestor) {
            path.unshift(node.index());
            node = node.parent;
        }
        return path;
    }
    applyPath (path) {
        var node = this;
        while (path.length) {
            node = node.childNodes[path.shift()];
        }
        return node;
    }
    /**
     * Get a representation of the Arch with architectural space, node IDs and virtual nodes
     */
    repr () {
        return this.parent && this.parent.repr();
    }
    getNode (id) {
        if (this.id === id) {
            return this;
        }
        if (this.childNodes) {
            for (var k = 0, len = this.childNodes.length; k < len; k++) {
                var archNode = this.childNodes[k].getNode(id);
                if (archNode) {
                    return archNode;
                }
            }
        }
    }
    /**
     * Return the next or previous node (if any), following a pre-order tree traversal.
     * Return null if no node was found.
     * If a function is provided, apply it to the node that was found, if any.
     *
     * @param {Boolean} isPrev true to get the previous node, false for the next node
     * @param {Function (ArchNode)} [fn] called on this and takes the previous/next node as argument
     */
    walk (isPrev, fn) {
        var next = this[isPrev ? '_walkPrev' : '_walkNext']();
        if (next && fn) {
            fn.call(this, next);
        }
        return next;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _changeParent (archNode, index) {
        var self = this;
        if (this.isVoid()) {
            throw new Error("You can't add a node into a void node");
        }

        if (!this.childNodes) {
            throw new Error("You can't add a child into this node");
        }

        if (!this.params.bypassUpdateConstraints) {
            if (this.isInArch() && !this.isEditable()) { // id is set only if the node is contains in the root
                console.warn("cannot add a node into a non editable node");
                return;
            }
            if (archNode.parent && archNode.parent.isInArch() && !archNode.parent.isEditable()) {
                console.warn("cannot remove a node from a non editable node");
                return;
            }
        }

        if (this.ancestor(function (node) { return node === archNode;})) {
            console.warn("cannot add a node into itself");
            return;
        }

        if (archNode.isFragment()) {
            var ids = [];
            archNode.childNodes.slice().forEach(function (archNode) {
                ids = ids.concat(self._changeParent(archNode, index++));
            });
            archNode.remove();
            return ids;
        }

        if (archNode.parent) {
            if (archNode.parent === this && archNode.index() < index) {
                index--;
            }
            var i = archNode.parent.childNodes.indexOf(archNode);
            archNode.parent._triggerChange(i);
            archNode.parent.childNodes.splice(i, 1);
        }

        archNode.parent = this;
        this.childNodes.splice(index, 0, archNode);
        if (archNode.__removed) {
            archNode._triggerChange(0);
            archNode.__removed = false;
        }

        this.params.add(archNode);

        this._triggerChange(index);
    }
    _nextSibling (fn, doNotSkipNotEditables) {
        if ((doNotSkipNotEditables || this.isEditable()) && (!fn || fn(this))) {
            return this;
        } else {
            return this.nextSibling(fn);
        }
    }
    _previousSibling (fn, doNotSkipNotEditables) {
        if ((doNotSkipNotEditables || this.isEditable()) && (!fn || fn(this))) {
            return this;
        } else {
            return this.previousSibling(fn);
        }
    }
    /**
     * Return the next or previous node until predicate hit or end of tree,
     * following a pre-order tree traversal.
     * This ignores architectural space and prevents getting out of an unbreakable node.
     * If no suitable previous/next node is found, a virtual text node will be inserted and
     * returned. If the insertion is not allowed, return null.
     * If no predicate function is provided, just give the previous/next node.
     *
     * @param {boolean} isPrev true to get the previous node, false for the next node
     * @param {function (ArchNode)} [pred] called on this and takes the previous/next node as argument
     *          return true if the requested node was found
     * @param {Object} [options]
     * @param {Boolean} [options.doCrossUnbreakables] true to ignore unbreakable rules and indeed cross unbreakables
     * @param {Boolean} [options.doNotInsertVirtual] true to prevent the insertion of virtual nodes
     * @param {Boolean} [options.leafToLeaf] true to only give leaf nodes and skip parents
     * @param {Boolean} [options.stopAtBlock] true to prevent passing through blocks
     * @returns {ArchNode|null}
     **/
    _prevNextUntil (unbreakableContainer, isPrev, pred, options) {
        options = options || {};
        var next = this.walk(isPrev);
        if (!next || !options.doCrossUnbreakables && !unbreakableContainer.contains(next)) {
            if (!options.doNotInsertVirtual && this.isEditable() && !this.isRoot() && !this.isClone()) {
                var virtualText = this.params.create();
                this[isPrev ? 'before' : 'after'](virtualText);
                return virtualText;
            }
            return null;
        }
        if (options.stopAtBlock && next.isBlock()) {
            return next;
        }
        if (options.leafToLeaf && next.childNodes && next.childNodes.length) {
            return next._prevNextUntil(unbreakableContainer, isPrev, pred, options);
        }
        if (!pred || pred.call(next, next)) {
            return next;
        }
        return next._prevNextUntil(unbreakableContainer, isPrev, pred, options);
    }
    _removeAtBlockEdge (isLeft) {
        var virtualText = this.params.create();
        this.parent[isLeft ? 'prepend' : 'append'](virtualText);
        var next = this.ancestor('isBlock')[isLeft ? 'previousSibling' : 'nextSibling']();
        if (next && next.isVoid()) {
            next.remove();
        }
        return virtualText.deleteEdge(isLeft);
    }
    _removeSide (offset, isLeft) {
        if (!this.childNodes.length) {
            return this._safeRemove();
        }
        if (isLeft && offset || !isLeft && offset < this.childNodes.length) {
            var child = this.childNodes[isLeft ? offset - 1 : offset];
            return child[isLeft ? 'removeLeft' : 'removeRight'](isLeft ? child.length() : 0);
        }
        var next = this[isLeft ? 'prev' : 'next']({
            leafToLeaf: true,
            stopAtBlock: true,
        });
        if (next && next.isBlock()) {
            return this._removeAtBlockEdge(true)
        }
        return next && next[isLeft ? 'removeLeft' : 'removeRight'](isLeft ? next.length() : 0);
    }
    /**
     * Safely remove a node:
     * - put a virtual text node instead if the parent is an empty block
     * - add an extra BR if the removal would otherwise make a visible BR invisible
     *      (ie it's at the end of a block whereas it didn't use to be)
     *
     * @returns {ArchNode|null} return a node to delete its edge (inline) after removal
     */
    _safeRemove () {
        var parent = this.parent;
        var options = {
            doNotInsertVirtual: true,
        };
        var next = this.next(options);
        var prev = this.prev(options);
        var wasPrevInvisibleBR = prev && prev.isInvisibleBR();
        this.remove();
        if (!wasPrevInvisibleBR && prev && prev.isInvisibleBR()) {
            prev.after(this.params.create('br'));
            return null;
        }
        if (parent.isBlock() && parent.isEmpty()) {
            var virtualText = this.params.create();
            parent.append(virtualText);
            return virtualText;
        }
        return next || prev || parent || null;
    }
    _triggerChange (offset) {
        this.params.change(this, offset);
    }
    /**
     * Return the next node (if any), following a pre-order tree traversal.
     * Return null if no node was found.
     *
     * @returns {ArchNode|null}
     */
    _walkNext () {
        if (this.childNodes && this.childNodes.length) {
            return this.firstChild();
        }
        var next = this;
        while (next.parent) {
            var parent = next.parent;
            var index = next.index();
            if (parent && parent.childNodes.length > index + 1) {
                return parent.childNodes[index + 1];
            }
            next = parent;
        }
        return null;
    }
    /**
     * Return the previous node (if any), following a pre-order tree traversal.
     * Return null if no node was found.
     *
     * @returns {ArchNode|null}
     */
    _walkPrev () {
        var prev = this;
        if (prev.parent) {
            var parent = prev.parent;
            var index = prev.index();
            if (parent && index - 1 >= 0) {
                prev = parent.childNodes[index - 1];
                while (prev.childNodes && prev.childNodes.length) {
                    prev = prev.lastChild();
                }
                return prev;
            }
            return parent;
        }
        return null;
    }
};

})();
