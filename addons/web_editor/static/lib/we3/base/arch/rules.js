(function () {
'use strict';

we3.ArchNode = class extends we3.ArchNode {
    //--------------------------------------------------------------------------
    // Static
    //--------------------------------------------------------------------------

    /**
     *
     * @param {JSON} json
     * @returns {false|JSON}
     */
    static parse (json) {
        return false;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    applyRules () {
        if (!this.isAllowUpdate()) {
            return;
        }
        if (this.isRoot()) {
            this._applyRulesPropagation();
            return;
        }
        this._applyRulesParser();
        if (!this.__removed) {
            this._applyRulesArchNode();
        }
        if (!this.__removed) {
            this._applyRulesOrder();
        }
        if (!this.__removed) {
            this._applyRulesCheckParents();
        }
        if (!this.__removed) {
            this._applyRulesPropagation();
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _allMethodsPass = function (methods) {
        var self = this;
        return methods.every((methodName) => self[methodName] && self[methodName]());
    };
    _applyRulesArchNode () {
    }
    _applyRulesCheckParents () {
        if (this.isRoot()) {
            return;
        }
        this._testParentedRules(this, this._applyRulesCheckParentsTest.bind(this));
    }
    _applyRulesCheckParentsTest (allowNodes, allowMethods, defaultParents, forbidNodes, forbidMethods) {
        if (!this.parent) {
            return true;
        }
        var self = this;
        if (forbidNodes.length) {
            this.ancestor(function (ancestor) {
                if (ancestor.id !== self.id && forbidNodes.indexOf(ancestor.nodeName) !== -1 && ancestor._allMethodsPass(forbidMethods)) {
                    self._applyRulesUnwrapFrom(ancestor);
                }
            });
        } else if (forbidMethods.length) {
            this.ancestor(function (ancestor) {
                if (ancestor.id !== self.id && ancestor._allMethodsPass(forbidMethods)) {
                    self._applyRulesUnwrapFrom(ancestor);
                }
            });
        }
        if (!this.parent) {
            return true;
        }
        if (this._mustGenerateParent(allowNodes, allowMethods, this.parent)) {
            var availableCandidates = !!allowNodes.length && allowNodes || defaultParents;
            this._applyRulesGenerateAncestors(availableCandidates);
        }
    }
    _applyRulesFilterRules (rules, node) {
        var self = this;
        var selectedRules = [];
        rules.forEach(function (rule) {
            var nodeNames = rule.nodes.nodeNames || [];
            var methods = rule.nodes.methods || [];
            if (nodeNames.length) {
                nodeNames.some(function (nodeName) {
                    if (node === nodeName || typeof node !== 'string' && (node.nodeName === nodeName || node.type === nodeName)) {
                        if (self._allMethodsPass(methods)) {
                            selectedRules.push(rule);
                        }
                        return true;
                    }
                });
            } else if (self._allMethodsPass(methods)) {
                selectedRules.push(rule);
            }
        });
        return selectedRules;
    }
    _applyRulesGenerateAncestors (availableCandidates) {
        var path = this._getParentGenerationPath(availableCandidates);
        if (!path.length || path[0] === 'EDITABLE') {
            return;
        }
        var newAncestor = this.params.create(path.pop(), []);
        var lastParent = newAncestor;
        while (path.length) {
            var node = this.params.create(path.pop(), []);
            lastParent.append(node);
            lastParent = node;
        }
        this.parent.insertBefore(newAncestor, this);
        lastParent.append(this);
        newAncestor.__applyRulesCheckParentsFlag = this.params.currentRuleID;
        // merge generated parents if needed
        var prev = newAncestor.previousSibling();
        if (prev && prev.__applyRulesCheckParentsFlag === this.params.currentRuleID) {
            if (this.isPlaceholderBR()) {
                this.after(this.params.create('br'));
            }
            newAncestor.deleteEdge(true, {
                doNotRemoveEmpty: true,
                mergeOnlyIfSameType: true,
            });
        }
        newAncestor.applyRules();
    }
    _applyRulesMergeExcessStructure (newParents) {
        for (var k = 0; k < newParents.length; k++) {
            var item = newParents[k];

            function visibleNode (n) {
                return !(n.isText() && n.isVirtual()) && !n.isArchitecturalSpace();
            }

            var prev = item.previousSibling(visibleNode);
            if (prev && prev.nodeName === item.nodeName && newParents.indexOf(prev) !== -1 && item.attributes.toString() === prev.attributes.toString()) {
                item.childNodes.slice().forEach(function (node) {
                    prev.append(node);
                });
                item.remove();
                continue;
            }

            var next = item.previousSibling(visibleNode);
            if (next && next.nodeName === item.nodeName && newParents.indexOf(next) !== -1 && item.attributes.toString() === next.attributes.toString()) {
                item.childNodes.slice().forEach(function (node) {
                    next.append(node);
                });
                item.remove();
                continue;
            }
        }
    }
    _applyRulesOrder () {
        var rules = this.params.orderRules.flat();
        var pos = rules.indexOf(this.nodeName);
        if (pos === -1 || !this.isEditable() || this.isUnbreakable()) {
            return;
        }
        var disorderedAncestors = [];
        var node = this;
        while (node && node.parent && !node.isRoot()) {
            var parentPos = rules.indexOf(node.parent.nodeName);
            if (parentPos > pos && node.parent.isEditable() && !node.parent.isUnbreakable()) {
                disorderedAncestors.push(node);
            }
            node = node.parent;
        }
        disorderedAncestors.forEach((ancestor) => ancestor._swapWithParent());
    }
    _applyRulesParser () {
        var self = this;
        var rules = this._getParserRules();
        var ruleMethod;
        var rep = this.toJSON({keepVirtual: true});
        while (ruleMethod = rules.pop()) {
            var json = ruleMethod(rep, self.params.options);
            if (!json || JSON.stringify(rep) === JSON.stringify(json)) {
                continue;
            }
            var archNode = this.params.import(json);
            if (archNode.isFragment()) {
                var childNodes = archNode.childNodes.slice();
                this.parent.insertBefore(archNode, this);
                this.remove();
                childNodes.forEach(function (archNode) {
                    archNode.applyRules();
                });
            } else {
                this.parent.insertBefore(archNode, this);
                this.remove();
                archNode.applyRules();
            }
            break;
        }
    }
    _applyRulesPropagation () {
        var childNodes = this.childNodes.slice();
        childNodes.forEach(function (archNode) {
            archNode.applyRules();
        });
        var newParents = [];
        this.childNodes.forEach(function (archNode) {
            if (childNodes.indexOf(archNode) === -1 && archNode.__applyRulesCheckParentsFlag) {
                archNode.__applyRulesCheckParentsFlag = false;
                newParents.push(archNode);
            }
        });
        this._applyRulesMergeExcessStructure(newParents);
    }
    _applyRulesUnwrapFrom (ancestor) {
        if (ancestor.isUnbreakable()) {
            return;
        }
        this._splitAncestorAtEdgeOf(this, ancestor, true);
        this._splitAncestorAtEdgeOf(this, this.parent, false);
        this.unwrap();
    }
    _getParentCandidates (nodeName, parent) {
        var self = this;
        var availableCandidates;
        this._testParentedRules(nodeName, function (allowNodes, allowMethods, defaultParents) {
            if (self._mustGenerateParent(allowNodes, allowMethods, parent)) {
                availableCandidates = allowNodes.length && allowNodes || defaultParents;
                return true;
            }
        });
        return availableCandidates || [];
    }
    _getParentGenerationPath (availableCandidates) {
        return this._getParentGenerationPathRecursive(availableCandidates, [], null, {}) || [];
    }
    _getParentGenerationPathRecursive (candidates, startPath, bestPath, tested) {
        for (var i = 0; i < candidates.length; i++) {
            if (bestPath && (startPath.length >= bestPath.length || bestPath.length <= 1)) {
                return bestPath;
            }
            var candidate = candidates[i];
            if ((candidate in tested) && tested[candidate] <= startPath.length) {
                continue;
            }
            tested[candidate] = startPath.length;
            if (startPath.indexOf(candidate) !== -1) {
                continue;
            }
            if (candidate === this.parent.nodeName || candidate === this.parent.type) {
                return startPath;
            }
            if (candidate === 'EDITABLE') {
                continue;
            }

            var next = this._getParentCandidates(candidate, this.parent);
            if (next.length) {
                bestPath = this._getParentGenerationPathRecursive(next, startPath.concat([candidate]), bestPath, tested);
                continue;
            }

            if (!bestPath || (startPath.length + 1) < bestPath.length) {
                bestPath = startPath.concat([candidate]);
            }
        }
        return bestPath;
    }
    _getParserRules () {
        return this.params.parserRules.slice();
    }
    _getParentedRules () {
        return this.params.parentedRules.slice();
    }
    _mustGenerateParent (allowNodes, allowMethods, parent) {
        var isParentOK = true;
        var parentName = parent.isRoot() || parent.nodeName === 'FRAGMENT' ? 'EDITABLE' : parent.nodeName;
        if (allowNodes.length) {
            isParentOK = allowNodes.indexOf(parentName) !== -1 && (!allowMethods.length || parent._allMethodsPass(allowMethods));
        } else if (allowMethods.length) {
            isParentOK = parent._allMethodsPass(allowMethods);
        }
        return !isParentOK;
    }
    /**
     * Split a `node`'s `ancestor` at the edges of its first direct child that is an
     * ancestor of `node`, then clean up (remove empty nodes, delete edge).
     *
     * @param {ArchNode} node
     * @param {ArchNode} ancestor
     * @param {Boolean} isLeftEdge true to split at left edge, false for right edge
     */
    _splitAncestorAtEdgeOf (node, ancestor, isLeftEdge) {
        var offset = node.ancestor((a) => a.parent && a.parent.id === ancestor.id).index();
        offset = isLeftEdge ? offset : offset + 1;
        var next = ancestor.split(offset);
        var toClean = isLeftEdge ? next.previousSibling() : next;
        if (!toClean) {
            return;
        }
        if (toClean.isEmpty()) {
            toClean.remove();
        } else {
            toClean.deleteEdge(!isLeftEdge, {
                doNotBreakBlocks: true,
                mergeOnlyIfSameType: true,
            });
        }
    }
    /**
     * Swap a node with its parent
     * eg: <i><b>text</b></i> and this == b => <b><i>text</i></b>
     */
    _swapWithParent () {
        var parent = this.parent;
        var next = parent.split(this.index());
        var nextNext = next.split(1);
        next.before(this);
        next.append(this.childNodes);
        this.append(next);
        parent.removeIfEmpty();
        next.removeIfEmpty();
        nextNext.removeIfEmpty();
    }
    _testParentedRules (node, callback) {
        var rules = this._getParentedRules();
        var parentedRules = this._applyRulesFilterRules(rules, node);
        if (!parentedRules) {
            return;
        }
        for (var i = 0; i < parentedRules.length; i++) {
            var rule = parentedRules[i];
            var allowNodes = rule.permittedParents && rule.permittedParents.nodeNames || [];
            var allowMethods = rule.permittedParents && rule.permittedParents.methods || [];
            var defaultParents = rule.permittedParents && rule.permittedParents.defaultParentsToGenerate || [];
            var forbidNodes = rule.forbiddenAncestors && rule.forbiddenAncestors.nodeNames || [];
            var forbidMethods = rule.forbiddenAncestors && rule.forbiddenAncestors.methods || [];
            if (callback(allowNodes, allowMethods, defaultParents, forbidNodes, forbidMethods)) {
                return;
            }
        }
    }
};

})();
