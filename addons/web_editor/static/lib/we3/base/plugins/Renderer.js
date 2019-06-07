(function () {
'use strict';

var BaseRenderer = class extends we3.AbstractPlugin {
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Get a rendered node from its ID in the Arch.
     *
     * @param {int} id
     * @returns {Node}
     */
    getElement (id) {
        return this.elements[id];
    }
    /**
     * Get the ID in the Arch of a rendered Node.
     *
     * @param {Node} element
     */
    getID (element) {
        var index = this.elements.indexOf(element);
        return index === -1 ? null : index;
    }
    /**
     * Render the changes.
     */
    redraw () {
        this._redraw({
            forceDirty: true,
        });
    }
    /**
     * Reset the DOM, with a starting DOM if `json` is passed.
     *
     * @param {JSON} [json]
     */
    reset (json) {
        this.changes = {};
        this.jsonById = [null, {
            id: 1,
            childNodes: [],
        }];
        this.elements = [null, this.editable];

        if (json) {
            this.update(json);
        }
    }
    /**
     * Update the DOM with the changes specified in `newJSON`.
     *
     * @param {JSON} newJSON
     */
    update (newJSON) {
        if (newJSON.forEach) {
            newJSON.forEach(this._makeDiff.bind(this));
        } else {
            this._makeDiff(newJSON);
        }
        this._clean();
        this._redraw();
        this._cleanElements();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Return the IDs of the node corresponding to the given `id`,
     * and all its descendents.
     *
     * @private
     * @param {int} id
     * @param {int []} [ids]
     * @returns {int []}
     */
    _allIds (id, ids) {
        var json = this.jsonById[id];
        ids = ids || [];
        ids[id] = id;
        if (json.childNodes) {
            for (var k = 0; k < json.childNodes.length; k++) {
                this._allIds(json.childNodes[k], ids);
            }
        }
        return ids;
    }
    /**
     * Remove all DOM references.
     *
     * @private
     */
    _clean () {
        var self = this;
        var ids = this._allIds(1);
        this.jsonById.forEach(function (json, id) {
            if (!ids[id] && self.jsonById[id]) {
                delete self.jsonById[id];
                delete self.elements[id];
            }
        });
    }
    /**
     * Remove all nodes that are not in the Arch from the DOM.
     *
     * @private
     */
    _cleanElements () {
        var els = [];
        (function _getAll(el) {
            if (el.tagName && el.tagName.indexOf('WE3-') === 0) {
                return;
            }
            els.push(el);
            el.childNodes.forEach(_getAll);
        })(this.editable);

        var inArch = this.elements;
        els.forEach(function (el) {
            if (inArch.indexOf(el) === -1) {
                el.parentNode.removeChild(el);
            }
        });
    }
    /**
     * Get a Node by the ID of its corresponding ArchNode.
     *
     * @private
     * @param {int} id
     * @param {Node} [target]
     * @returns {Node}
     */
    _getElement (id, target) {
        var json = this.jsonById[id];
        var el = this.elements[id];
        var freeElement = target && target !== el && !this.getID(target) ? target : null;

        if (el && freeElement) {
            freeElement.parentNode.removeChild(freeElement);
        }
        if (!el && freeElement) {
            el = freeElement;
        }

        if (!el) {
            if (json.nodeValue) {
                el = document.createTextNode(json.nodeValue);
            } else if (json.nodeName) {
                el = document.createElement(json.nodeName);
            }
        } else { // virtual node can mutate or try to use a free element
            var isText = 'nodeValue' in json;
            if (el.tagName && isText) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
                el = document.createTextNode(json.nodeValue);
            } else if (!isText && json.nodeName && (!el.tagName || el.tagName.toLowerCase() !== json.nodeName)) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
                el = document.createElement(json.nodeName);
            }
        }
        this.elements[id] = el;
        return el;
    }
    /**
     * Update the `changes` with a JSON containing the differences between the previous state
     * and the new one.
     *
     * @private
     * @param {JSON} newJSON
     */
    _makeDiff (newJSON) {
        var oldJSON = this.jsonById[newJSON.id] = (this.jsonById[newJSON.id] || {id: newJSON.id});

        if (newJSON.nodeName && !oldJSON.nodeName) {
            oldJSON.nodeName = newJSON.nodeName;
        }

        var changes = {};
        if (oldJSON.nodeValue !== newJSON.nodeValue) {
            changes.nodeValue = newJSON.nodeValue;
            oldJSON.nodeValue = newJSON.nodeValue;
        }
        if (newJSON.attributes || oldJSON.attributes) {
            if (!oldJSON.attributes) {
                changes.attributes = newJSON.attributes.slice();
            } else {
                var attributes = [];
                newJSON.attributes = newJSON.attributes || [[]];
                oldJSON.attributes.forEach(function (attribute) {
                    for (var k = 0; k < newJSON.attributes.length; k++) {
                        if (newJSON.attributes[k][0] === attribute[0]) {
                            return;
                        }
                    }
                    attributes.push([attribute[0], false]);
                });
                (newJSON.attributes || []).slice().forEach(function (attribute) {
                    for (var k = 0; k < oldJSON.attributes.length; k++) {
                        if (oldJSON.attributes[k][0] === attribute[0]) {
                            if (oldJSON.attributes[k][1] === attribute[1]) {
                                return;
                            }
                            break;
                        }
                    }
                    attributes.push(attribute);
                });
                if (attributes.length) {
                    changes.attributes = attributes;
                }
            }
            oldJSON.attributes = newJSON.attributes.slice();
        }
        if (newJSON.childNodes || oldJSON.childNodes) {
            newJSON.childNodes = newJSON.childNodes || [];
            var childNodesIds = newJSON.childNodes.map(function (json) { return json.id; });

            if (!oldJSON.childNodes) {
                changes.childNodes = childNodesIds;
            } else if (oldJSON.childNodes.length !== newJSON.childNodes.length) {
                changes.childNodes = childNodesIds;
            } else {
                for (var k = 0; k < childNodesIds.length; k++) {
                    if (oldJSON.childNodes[k] !== childNodesIds[k]) {
                        changes.childNodes = childNodesIds;
                        break;
                    }
                }
            }
            newJSON.childNodes.forEach(this._makeDiff.bind(this));
            oldJSON.childNodes = childNodesIds;
        }

        if (Object.keys(changes).length) {
            this.changes[newJSON.id] = changes;
        }
    }
    /**
     * Mark all changed nodes as dirty.
     *
     * @private
     */
    _markAllDirty () {
        this.jsonById.forEach(function (json, id) {
            var json = Object.assign({}, json);
            self.changes[id] = json;
            if (json.childNodes) {
                json.childNodes = json.childNodes.map(function (json) {
                    return json.id;
                });
            }
        });
    }
    /**
     * Render the changes.
     *
     * @private
     * @param {Object} [options]
     * @param {Boolean} [options.forceDirty]
     */
    _redraw (options) {
        var self = this;
        options = options || {};

        if (options.forceDirty) {
            this._markAllDirty();
        }

        Object.keys(this.changes).forEach(function (id) {
            var changes = self.changes[id];
            delete self.changes[id];
            if (self.jsonById[id]) {
                self._redrawOne(self.jsonById[id], changes, options);
            }
        });
    }
    /**
     * Render one node from changes.
     *
     * @private
     * @param {JSON} json
     * @param {JSON} changes
     * @param {Object} [options]
     * @returns {Node}
     */
    _redrawOne (json, changes, options) {
        var self = this;
        options = options || {};
        var node;
        if (json.isVirtual && !options.keepVirtual) {
            node = document.createDocumentFragment();
        } else {
            node = self._getElement(json.id);

            if (changes.attributes) {
                changes.attributes.forEach(function (attribute) {
                    if (!attribute[1] || !attribute[1].length || self.options.renderingAttributeBlacklist.indexOf(attribute[0]) !== -1) {
                        node.removeAttribute(attribute[0]);
                    } else {
                        node.setAttribute(attribute[0], attribute[1]);
                    }
                });
            }

            if (options.displayId) {
                node.setAttribute('data-archnode-id', json.id);
            }
        }

        if ('nodeValue' in changes) {
            node.textContent = changes.nodeValue;
        }

        if (changes.childNodes) {
            // sort nodes and add new nodes
            changes.childNodes.forEach(function (id, index) {
                id = +id;
                var childNode = self._getElement(id, node.childNodes[index]);
                var childIndex = [].indexOf.call(node.childNodes, childNode);
                if (childIndex !== index) {
                    if (!node.childNodes[index]) {
                        node.appendChild(childNode);
                    } else {
                        node.insertBefore(childNode, node.childNodes[index]);
                    }
                }
            });
        }

        return node;
    }
};

var Renderer = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseRenderer'];
    }
    /**
     * Get a rendered node from its ID in the Arch.
     *
     * @param {int} id
     * @returns {Node}
     */
    getElement (id) {
        return this.dependencies.BaseRenderer.getElement(id);
    }
    /**
     * Get the ID in the Arch of a rendered Node.
     *
     * @param {Node} element
     */
    getID (element) {
        return this.dependencies.BaseRenderer.getID(element);
    }
    /**
     * Render the changes.
     */
    redraw () {
        return this.dependencies.BaseRenderer.redraw();
    }
};

we3.pluginsRegistry.BaseRenderer = BaseRenderer;
we3.pluginsRegistry.Renderer = Renderer;

})();
