(function () {
'use strict';

var PARENTED_COLORS = ['lightgreen', 'lightblue', 'lightpink', 'lightsalmon'];
var MAX_LEVELS = PARENTED_COLORS.length;

var optionPlugIns = [];

var CustomizeBlock = class extends we3.AbstractPlugin {
    /**
     * @constructor
     * @param {Object} parent
     * @param {Object} params
     * @param {Object} options
     **/
    constructor(parent, params, options) {
        super(...arguments);

        this.dependencies = ['Arch', 'Overlay', 'Range', 'Renderer', 'Selector', 'Sidebar']
            .concat(optionPlugIns);

        this.customizeOptionsEvents = {
            // FIXME event delegation ?
            'click we3-collapse-area > we3-toggler': '_onCollapseTogglerClick',
        };

        this._nodeOptionsContainers = {};
        this._nodeOptionsElements = {};
        this._nodeOverlayElements = {};
    }
    /**
     * @override
     */
    start() {
        var promise = super.start(...arguments);
        var self = this;

        var Overlay = this.dependencies.Overlay;
        var Range = this.dependencies.Range;
        var Sidebar = this.dependencies.Sidebar;

        // Initialize dependencies
        Overlay.on('overlay_refresh', this, this._onOverlayRefresh);
        this._createUIElements();

        Range.on('focus', this, this._onRangeFocus);

        Sidebar.registerEvents(this, this.customizeOptionsEvents);

        // FIXME performance !!
        optionPlugIns.forEach(function (optionName) {
            var PlugIn = self.dependencies[optionName];
            PlugIn.on('snippet-option-preview', self, function (data) {
                optionPlugIns.forEach(function (optionName) {
                    var PlugIn = self.dependencies[optionName];
                    var ui = PlugIn.getUIFromTarget(data.target);
                    if (ui) {
                        PlugIn.onForeignOptionPreview(ui, data.target);
                    }
                });
            });
            PlugIn.on('snippet-option-change', self, function (data) {
                optionPlugIns.forEach(function (optionName) {
                    var PlugIn = self.dependencies[optionName];
                    var ui = PlugIn.getUIFromTarget(data.target);
                    if (ui) {
                        PlugIn.onForeignOptionChange(ui, data.target);
                    }
                });
            });
        });

        return promise;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Registers an option plug-in.
     *
     * @param {string} optionName
     */
    static registerOptionPlugIn(optionName, OptionPlugIn) {
        var plugInName = 'BlockOption:' + optionName;
        optionPlugIns.push(plugInName);
        we3.addPlugin(plugInName, OptionPlugIn);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {DOMElement} element
     * @param {boolean} [forClone=False]
     * @param {object} [cloneData]
     */
    _createOptionElements(element, forClone, cloneData) {
        var nodeID = this.dependencies.Renderer.getID(element);
        var optElements = this._nodeOptionsElements[nodeID];
        if (optElements !== undefined) {
            return optElements;
        }

        var self = this;
        var data = this.dependencies.Overlay.getUIElementData(nodeID);
        if (!data) {
            console.warn('Overlay was being recreated while creating option elements ?'); // FIXME
            return [];
        }

        optElements = this._nodeOptionsElements[nodeID] = [];
        var hasMoveOption = false;

        // Title
        var title = document.createElement('we3-title');
        title.textContent = this._getElementName(element);
        optElements.push(title);

        // Block options
        var overlayElement = this._nodeOverlayElements[nodeID];
        data.optionsData.forEach(function (optionData) {
            var blockOption = optionData.blockOption;
            var optionName = blockOption.customizeBlockOptionName;

            if (blockOption.dropIn || blockOption.dropNear) {
                hasMoveOption = true;
            }

            if (!optionName) {
                return;
            }

            var opt = document.createElement('we3-customizeblock-option');
            blockOption.customizeUIElements.forEach(function (el) {
                opt.appendChild(el.cloneNode(true));
            });
            optElements.push(opt);

            var optionPlugIn = self.dependencies['BlockOption:' + optionName];
            if (!optionPlugIn) {
                console.warn('The block option "' + optionName + '" is missing.'); // FIXME should crash not warn
                return;
            }
            optionPlugIn.registerUIAndTarget(opt, optionData.target, overlayElement);
            if (forClone) {
                optionPlugIn.onClone(optionData.target, cloneData);
            }
        });

        // Specific buttons (duplicate and delete)
        if (hasMoveOption) {
            // Check that the parent is editable
            var archNode = this.dependencies.Arch.getClonedArchNode(nodeID);
            var parentArchNode = archNode && archNode.parent;
            if (parentArchNode.isEditable()) {
                var buttonArea = document.createElement('we3-button-group');

                var duplicateButton = document.createElement('we3-button');
                duplicateButton.classList.add('we3-customizeblock-duplicate');
                duplicateButton.dataset.nodeId = nodeID;
                var duplicateIcon = document.createElement('i');
                duplicateIcon.classList.add('fa', 'fa-clone');
                duplicateButton.appendChild(duplicateIcon);
                buttonArea.appendChild(duplicateButton);

                var deleteButton = document.createElement('we3-button');
                deleteButton.classList.add('we3-customizeblock-delete');
                deleteButton.dataset.nodeId = nodeID;
                var deleteIcon = document.createElement('i');
                deleteIcon.classList.add('fa', 'fa-trash');
                deleteButton.appendChild(deleteIcon);
                buttonArea.appendChild(deleteButton);

                title.appendChild(buttonArea);

                // FIXME event delegation ?
                self._bindDOMEvents(duplicateButton, {'click': '_onCloneClick'});
                self._bindDOMEvents(deleteButton, {'click': '_onDeleteClick'});
            }
        }

        return optElements;
    }
    /**
     * @private
     */
    _createUIElements() {
        var self = this;
        var Overlay = this.dependencies.Overlay;

        var items = this._fetchCustomizableNodesData();
        items.forEach(function (item) {
            var ui = self._nodeOverlayElements[item.target];
            if (!ui) {
                ui = document.createElement('we3-customizeblock-ui');
            }
            self._nodeOverlayElements[item.target] = Overlay.addUIElement(ui, item.target, {
                optionsData: item.optionsData,
            }, 'we3-customizeblock-enabled');
        });
    }
    /**
     * @private
     * @param {Array} [items]
     */
    _fetchCustomizableNodesData(items) {
        var self = this;
        var Arch = this.dependencies.Arch;
        var Renderer = this.dependencies.Renderer;
        var Selector = this.dependencies.Selector;

        // If no specific target is asked by a predefined series of items,
        // consider all of them.
        items = items || [];
        if (!items.length) {
            var ids = this.options.blockOptions.map(function (zone) {
                return Selector.search(zone.selector);
            });
            we3.utils.uniq(we3.utils.flatten(ids)).forEach(function (id) {
                items.push({target: id});
            });
        }

        // For each defined target, associate the related arch node and a dropIn
        // and a dropNear function if any.
        items.forEach(function (item) {
            if (typeof item.target === 'number') {
                item.arch = Arch.getClonedArchNode(item.target);
            } else {
                item.arch = Arch.parse(item.target).firstChild();
            }

            item.optionsData = [];

            var isEditable = item.arch.isEditable();

            var archNodeElement = undefined;
            self.options.blockOptions.forEach(function (blockOption) {
                if (!isEditable && !blockOption.customizeAllowNotEditable) {
                    return;
                }

                // FIXME selector does not allow searching outside the wrapwrap
                if (Selector.is(item.arch, blockOption.selector)
                        && (!blockOption.exclude || !Selector.is(item.arch, blockOption.exclude))) {
                    var targetNodeElement;
                    if (blockOption.customizeTarget) {
                        var targetNodes = Selector.search(item.arch, blockOption.customizeTarget, {returnArchNodes: true});
                        if (!targetNodes.length) {
                            return;
                        }
                        targetNodeElement = Renderer.getElement(targetNodes[0].id);
                    } else if (!archNodeElement) {
                        archNodeElement = Renderer.getElement(item.arch.id);
                    }
                    item.optionsData.push({
                        target: targetNodeElement || archNodeElement,
                        blockOption: blockOption,
                    });
                }
            });
        });

        return items;
    }
    /**
     * DOMElements have a default name which may appear in the editor when they
     * are being edited. This method retrieves this name; it can be defined
     * directly in the DOM thanks to the `data-name` attribute.
     *
     * @private
     * @param {DOMElement} element
     */
    _getElementName(element) {
        if (element.dataset.name !== undefined) {
            return element.dataset.name;
        }
        if (element.parentNode && element.parentNode.classList.contains('row')) {
            return "Column"; // FIXME translate
        }
        return "Block"; // FIXME translate
    }
    /**
     * @private
     */
    _hideOptionsElements() {
        if (this._currentOptionsElements) {
            this.dependencies.Sidebar.close(this._currentOptionsElements);
        }
        this._currentOptionsElements = null;
    }
    /**
     * Opens/closes the options menu.
     *
     * @private
     * @param {boolean} [open]
     */
    _showOptionsElements(optionElements) {
        this._hideOptionsElements();
        if (optionElements.length) {
            var title = document.createElement('we3-title');
            title.textContent = "Customize"; // FIXME to translate
            this._currentOptionsElements = [title].concat(optionElements);
            this.dependencies.Sidebar.toggle(this._currentOptionsElements, true);
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onCloneClick(ev) {
        var self = this;
        var nodeID = parseInt(ev.currentTarget.dataset.nodeId);
        var element = this.dependencies.Renderer.getElement(nodeID);
        var clone = element.cloneNode(true);
        this.dependencies.Arch.insertAfter(clone, nodeID);

        this.dependencies.Overlay.setEditorValue(); // FIXME

        clone = element.nextElementSibling; // FIXME ugly hack
        this._createOptionElements(clone, true, {isCurrent: true});
        clone.querySelectorAll('.we3-customizeblock-enabled').forEach(function (el) {
            self._createOptionElements(el, true, {isCurrent: false});
        });
    }
    /**
     * @private
     */
    _onCollapseTogglerClick(ev) {
        ev.target.classList.toggle('active');
    }
    /**
     * TODO more complex than that ! (remove empty parents, call onRemove, ...)
     *
     * @private
     */
    _onDeleteClick(ev) {
        var nodeID = parseInt(ev.currentTarget.dataset.nodeId);
        this.dependencies.Arch.remove(nodeID);
    }
    /**
     * @private
     */
    _onOverlayRefresh() {
        this._createUIElements();
    }
    /**
     * @private
     */
    _onRangeFocus(node) {
        var Overlay = this.dependencies.Overlay;
        var Renderer = this.dependencies.Renderer;

        Overlay.makeUIStickyFor();

        var colorIndex = 0;
        var level = 1;

        var elements = [];
        while (node) {
            var element = Renderer.getElement(node.id);
            if (element.classList && element.classList.contains('we3-customizeblock-enabled')) {
                var color = PARENTED_COLORS[colorIndex++];
                Overlay.makeUIStickyFor(node.id, color);

                var nodeOptionsContainer = this._nodeOptionsContainers[node.id];
                if (!nodeOptionsContainer) {
                    nodeOptionsContainer = document.createElement('we3-customizeblock-options');
                    this._nodeOptionsContainers[node.id] = nodeOptionsContainer;
                }
                this._createOptionElements(element).forEach(function (el) {
                    nodeOptionsContainer.appendChild(el);
                });
                nodeOptionsContainer.style.borderColor = color;
                nodeOptionsContainer.style.color = color;
                elements.push(nodeOptionsContainer);

                if (++level > MAX_LEVELS) {
                    break;
                }
            }
            node = node.parent;
        }
        this._showOptionsElements(elements);
    }
};

we3.addPlugin('CustomizeBlock', CustomizeBlock);
})();
