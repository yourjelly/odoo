(function () {
'use strict';

var tags = we3.tags;

// Note: all rules are applied except in pre

var parserRules = [
    // [function (json) { if (test) return newJson; },
];

/**
 * Rules concerning parenting
 * 
 * @property
 * @param {Object[]} parentedRules
 * @param {Object[]} parentedRules.nodes the nodes to consider
 * @param {String[]} [parentedRules.nodes.nodeNames] ... given as list of node names
 * @param {String[]} [parentedRules.nodes.methods] ... given as list of method names to apply on arch nodes
 *              note: if several methods are given, the node has to fill ALL conditions
 *              note: if both nodeNames and methods are given, the node has to fill BOTH conditions
 * @param {Object[]} parentedRules.permittedParents the allowed direct parents for the nodes to consider
 * @param {String[]} [parentedRules.permittedParents.nodeNames] ... given as list of node names
 * @param {String[]} [parentedRules.permittedParents.methods] ... given as list of method names to apply on arch nodes
 *              note: if several methods are given, the node has to fill ALL conditions
 *              note: if both nodeNames and methods are given, the node has to fill BOTH conditions
 * @param {String[]} [parentedRules.permittedParents.defaultParentsToGenerate] (default is permittedParents.nodeNames)
 *              list representing an order for nodes to try to generate as parents of the nodes to consider if needed
 * @param {Object[]} parentedRules.forbiddenAncestors the forbidden ancestors for the nodes to consider
 * @param {String[]} [parentedRules.forbiddenAncestors.nodeNames] ... given as list of node names
 * @param {String[]} [parentedRules.forbiddenAncestors.methods] ... given as list of method names to apply on arch nodes
 */
var parentedRules = [
    {
        nodes: {
            methods: ['isBlock'],
        },
        forbiddenAncestors: {
            methods: ['isInline'],
        },
    },
    {
        nodes: {
            methods: ['isBlock'],
        },
        forbiddenAncestors: {
            nodeNames: tags.style,
        },
    },
    {
        nodes: {
            nodeNames: ['div'],
        },
        permittedParents: {
            nodeNames: ['EDITABLE', 'div'],
        },
    },
    {
        nodes: {
            nodeNames: ['tbody', 'thead', 'tfoot'],
        },
        permittedParents: {
            nodeNames: ['table'],
        },
    },
    {
        nodes: {
            nodeNames: ['tr'],
        },
        permittedParents: {
            nodeNames: ['tbody', 'thead', 'tfoot'],
        },
    },
    {
        nodes: {
            nodeNames: ['td', 'th'],
        },
        permittedParents: {
            nodeNames: ['tr'],
        },
    },
    {
        nodes: {
            nodeNames: ['li'],
        },
        permittedParents: {
            nodeNames: ['ul', 'ol'],
        },
    },
    // editable > p
    {
        nodes: {
            nodeNames: ['ul', 'ol'],
        },
        permittedParents: {
            nodeNames: ['EDITABLE', 'div', 'td', 'th', 'li'],
        },
    },
    {
        nodes: {
            nodeNames: tags.style.filter((tag) => tag !== 'td' && tag !== 'th'),
        },
        permittedParents: {
            nodeNames: ['EDITABLE', 'div', 'td', 'th', 'li'],
        },
    },
    // H1 > i
    // b > i
    {
        nodes: {
            nodeNames: tags.format.concat(['TEXT', 'img']),
        },
        permittedParents: {
            nodeNames: tags.style.concat(tags.format).concat(['a', 'li']),
        },
    },
    {
        nodes: {
            nodeNames: tags.format.concat(['a']),
        },
        permittedParents: {
            nodeNames: tags.style.concat(tags.format),
        },
    },
    {
        nodes: {
            nodeNames: ['br'],
        },
        permittedParents: {
            nodeNames: tags.style.concat(tags.format).concat(['a', 'div', 'td', 'th', 'li']),
        },
    },
];

/**
 * Order of priority for nodes (in order to get 1:1 representation)
 * Eg: if ['i', 'b'], a 'b' node can be in an 'i' node but not otherwise
 */
var orderRules = [
    ['span', 'font'].concat(tags.format.filter((tag) => tag !== 'span' && tag !== 'font')),
];


var BaseRules = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseArch'];
        this.parserRuleList = parserRules.slice();
        this.parentedRulesList = parentedRules.slice();
        this.orderRulesList = orderRules.slice();

        this._isVoidoidList = [];
        this._isUnbreakableNodeList = [];
        this._isEditableNodeList = [];

        if (this.options.parserRules) {
            this.parserRuleList.push.apply(this.parserRuleList, this.options.parserRules);
        }
        if (this.options.parentedRules) {
            this.parentedRulesList.push.apply(this.parentedRulesList, this.options.parentedRules);
        }
        if (this.options.orderRules) {
            this.orderRulesList.push.apply(this.orderRulesList, this.options.orderRules);
        }
        if (this.options.isVoidoid) {
            this._isVoidoidList.push(this.options.isVoidoid);
        }
        if (this.options.isUnbreakableNode) {
            this._isUnbreakableNodeList.push(this.options.isUnbreakableNode);
        }
        if (this.options.isEditableNode) {
            this._isEditableNodeList.push(this.options.isEditableNode);
        }
        this.currentRuleID = 0;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    addParserRule (callback) {
        this.parserRuleList.push(callback);
    }
    addEditableNodeCheck (fn) {
        if (this._isEditableNodeList.indexOf(fn) === -1) {
            this._isEditableNodeList.push(fn);
        }
    }
    addStructureRule (rule) {
        this.parentedRulesList.push(rule);
    }
    addOrderedList (list) {
        this.orderRulesList.push(list);
    }
    addUnbreakableNodeCheck (fn) {
        if (this._isUnbreakableNodeList.indexOf(fn) === -1) {
            this._isUnbreakableNodeList.push(fn);
        }
    }
    /**
     * Add a method to the `_isVoidoid` array.
     *
     * @see _isVoidoid
     * @param {Function (ArchNode)} fn
     */
    addVoidoidCheck (fn) {
        if (this._isVoidoidList.indexOf(fn) === -1) {
            this._isVoidoidList.push(fn);
        }
    }
    applyRules (changes) {
        this.currentRuleID++;
        changes.forEach(function (c) {
            c.archNode.applyRules();
        });
    }
    /**
     * Return true if the current node is editable (for keypress and selection).
     *
     * @private
     * @param {ArchNode} archNode
     * @returns {Boolean}
     */
    isEditableNode (archNode) {
        var clone = archNode.id && this.dependencies.BaseArch.getClonedArchNode(archNode.id) || archNode;
        for (var i = 0; i < this._isEditableNodeList.length; i++) {
            var res = this._isEditableNodeList[i](clone, this.options);
            if (res) {
                return true;
            }
            if (res === false) {
                return false;
            }
        }
    }
    /**
     * Return true if the given ArchNode is unbreakable.
     * An unbreakable node can be removed or added but can't by split into
     * different nodes (for keypress and selection).
     * An unbreakable node can contain nodes that can be edited.
     *
     * @private
     * @param {ArchNode} archNode
     * @returns {Boolean}
     */
    isUnbreakableNode (archNode) {
        var clone = archNode.id && this.dependencies.BaseArch.getClonedArchNode(archNode.id) || archNode;
        for (var i = 0; i < this._isUnbreakableNodeList.length; i++) {
            var res = this._isUnbreakableNodeList[i](clone, this.options);
            if (res) {
                return true;
            }
            if (res === false) {
                return false;
            }
        }
    }
    /**
     * Return true if the node is a set to be treated like a void node, ie
     * the cursor can not be placed inside it.
     * The conditions can be extended by plugins by adding a method with
     * `addVoidoidCheck`. If any of the methods returns true, this will too.
     *
     * @see addVoidoidCheck
     * @private
     * @param {Node} node
     * @returns {Boolean}
     */
    isVoidoid (archNode) {
        var clone = archNode.id && this.dependencies.BaseArch.getClonedArchNode(archNode.id) || archNode;
        for (var i = 0; i < this._isVoidoidList.length; i++) {
            if (this._isVoidoidList[i](clone, this.options)) {
                return true;
            }
        }
        return false;
    }
};

var Rules = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseRules'];
    }
    addParserRule (callback, targets) {
        return this.dependencies.BaseRules.addParserRule(callback, targets);
    }
    addEditableNodeCheck (fn) {
        return this.dependencies.BaseRules.addEditableNodeCheck(fn);
    }
    addStructureRule (rule) {
        return this.dependencies.BaseRules.addStructureRule(rule);
    }
    addOrderedList (list) {
        return this.dependencies.BaseRules.addOrderedList(list);
    }
    addUnbreakableNodeCheck (fn) {
        return this.dependencies.BaseRules.addUnbreakableNodeCheck(fn);
    }
    addVoidoidCheck (fn) {
        return this.dependencies.BaseRules.addVoidoidCheck(fn);
    }
};

we3.pluginsRegistry.BaseRules = BaseRules;
we3.pluginsRegistry.Rules = Rules;

})();
