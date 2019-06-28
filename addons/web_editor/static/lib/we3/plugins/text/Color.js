(function () {
'use strict';

// var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');

var ColorPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'];
        this.dependencies = ['Arch', 'Range', 'Text'];

        var self = this;
        this._colors = this.options.color.colors;
        this._classPrefixes = this.options.color.classPrefix;
        this._classPrefix = this._classPrefixes && this._classPrefixes.text || 'color-';
        this._styleName = 'color';
        if (this.options.getColor) {
                console.log('COLOR to load');
            this._initializePromise = this.options.getColors().then(function (colors) {
                console.log('COLOR');
                self._colors = colors;
            });
        }
    }
    /**
     * @returns {Promise}
     */
    isInitialized () {
        return $.when(super.isInitialized(), this._initializePromise);
    }
    start () {
        this._insertColors();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Reset all colors on the selection.
     */
    reset () {
        var self = this;
        this.dependencies.Arch.splitRangeUntil(node => node.isFont(), {doNotBreakBlocks: true});
        var rangeToPreserve = this.dependencies.Range.getRange();
        var selection = this.dependencies.Range.getSelectedNodes();
        var styled = selection.filter(function (node) {
            return node.style && node.style.length || self._colorClasses(node).length;
        });
        // remove colors on every styled node in the selection
        var json = styled.map(function (node) {
            var parentID = node.parent.id;
            self._removeColorClasses(node);
            self._removeColorStyles(node);
            self._removeEmptyFont(node); // remove the node if it has not attributes
            return self.dependencies.Arch.getNode(parentID).toJSON();
        });
        this.dependencies.Arch.importUpdate(json);
        this.dependencies.Range.setRange(rangeToPreserve);
    }
    /**
     * Change the selection's fore color.
     *
     * @param {string} color (hexadecimal or class name)
     */
    update (color) {
        var self = this;
        var json = [];
        var range = this.dependencies.Range.getRange();
        var wrapperIDs = this.dependencies.Arch.wrapRange('font');
        var wrappers = wrapperIDs.map(id => self.dependencies.Arch.getNode(id))
            .filter(node => node);
        wrappers.forEach(function (node) {
            self._applyColor(node, color);
            json.push(node.parent.toJSON({keepVirtual: true}));
        });
        this.dependencies.Arch.importUpdate(json);
        if (wrappers.length === 1) {
            range = {scID: wrappers[0].id};
        }
        this.dependencies.Range.setRange(range);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _active (buttonName, focusNode) {
        var self = this;
        var colorName = buttonName.split('-')[1];
        var nodeColor;
        if (colorName[0] === '#') {
            var styledAncestor = focusNode.ancestor(node => node.style && node.style[self._styleName]);
            nodeColor = styledAncestor ? styledAncestor.style[self._styleName] : '';
        } else {
            colorName = this._classPrefix + colorName;
            var classedAncestor = focusNode.ancestor(node => node.className && self._colorClasses(node));
            nodeColor = classedAncestor ? this._colorClasses(classedAncestor)[0] : '';
        }
        return colorName === nodeColor;
    }
    /**
     * Apply a color to an ArchNode
     *
     * @private
     * @param {ArchNode} node
     * @param {string} color
     */
    _applyColor (node, color) {
        node = node.isText() ? node.parent : node;
        if (!color || color.startsWith('#')) {
            this._applyColorStyle(node, color || '');
        } else {
            this._applyColorClass(node, color);
        }
    }
    /**
     * Apply a color class to a node.
     *
     * @private
     * @param {ArchNode} node
     * @param {string} colorClass
     */
    _applyColorClass (node, colorClass) {
        this._colorClasses(node).forEach(className => node.className.remove(className));
        node.className.add(this._classPrefix + colorClass);
        this._removeColorStyles(node);
    }
    /**
     * Apply a color style to a node.
     *
     * @private
     * @param {ArchNode} node
     * @param {string} colorHex
     */
    _applyColorStyle (node, colorHex) {
        node.style.add(this._styleName, colorHex);
        this._removeColorClasses(node);
    }
    /**
     * Return a list of color classes present in the node.
     *
     * @private
     * @param {ArchNode} node
     * @returns {string []}
     */
    _colorClasses (node) {
        var classPrefix = this._classPrefix;
        var classes = node.className && node.className.value || [];
        return classes.filter(className => className.startsWith(classPrefix));
    }
    /**
     * Create a color button.
     *
     * @private
     * @param {string} color
     * @returns {Node}
     */
    _createColorButton (color) {
        var button = document.createElement('we3-button');
        if (color.startsWith('#')) {
            button.setAttribute('style', 'background-color: ' + color + ';')
        } else {
            var bgClassPrefix = this._classPrefixes && this._classPrefixes.background || 'bg-';
            button.setAttribute('class', bgClassPrefix + color);
        }
        button.setAttribute('data-plugin', this.pluginName);
        button.setAttribute('data-method', 'update');
        button.setAttribute('data-value', color);
        button.setAttribute('name', 'color-' + color);
        return button;
    }
    /**
     * Create a color grid.
     * 
     * @private
     * @param {(String []|string) []} rows
     * @returns {DocumentFragment}
     */
    _createGrid (rows) {
        var self = this;
        var grid = document.createDocumentFragment();
        var currentPalette = document.createElement('we3-palette');
        rows.forEach(function (row) {
            if (typeof row === 'string') {
                // Add a title, then the incoming palette
                var title = document.createElement('we3-title');
                title.appendChild(document.createTextNode(row));
                grid.appendChild(title);
                currentPalette = document.createElement('we3-palette');
                grid.appendChild(currentPalette);
            } else {
                // Add a row to the palette
                var rowNode = document.createElement('we3-row');
                row.forEach(function (color) {
                    var button = self._createColorButton(color);
                    rowNode.appendChild(button);
                });
                currentPalette.appendChild(rowNode);
            }
        });
        grid.appendChild(currentPalette);
        return grid;
    }
    /**
     * @override
     */
    _enabled (buttonName, focusNode) {
        return !!focusNode.ancestor('isFormatNode');
    }
    /**
     * Insert the colors grid declared in the editor options into the colors dropdown.
     *
     * @private
     * @see options.colors
     */
    _insertColors () {
        var target = this.buttons.elements[0].querySelector('we3-palettes');
        this._insertGrid(this._colors, target, true);
    }
    /**
     * Insert a color grid at target.
     *
     * @private
     * @param {(String []|string) []} rows
     * @param {Node} target
     * @param {boolean} prepend true to prepend to target, false to append to it
     */
    _insertGrid (rows, target, prepend) {
        var grid = this._createGrid(rows);
        if (prepend && target.firstChild) {
            target.insertBefore(grid, target.firstChild);
        } else {
            target.appendChild(grid);
        }
    }
    /**
     * Remove color classes from a node.
     *
     * @private
     * @param {ArchNode} node
     */
    _removeColorClasses (node) {
        node.className.remove(this._colorClasses(node).join(' '));
    }
    /**
     * Remove color styles from a node.
     *
     * @private
     * @param {ArchNode} node
     */
    _removeColorStyles (node) {
        node.style.add(this._styleName, '');
    }
    /**
     * Remove a `font` node if it has no attributes. Keep its children.
     *
     * @private
     * @param {ArchNode} node
     */
    _removeEmptyFont (node) {
        var self = this;
        if (!node.isFont() || node.attributes.toString()) {
            return;
        }
        if (node.childNodes.length) {
            node.childNodes.slice().forEach(function (child) {
                self.dependencies.Arch.unwrapFrom(child.id, 'font');
            });
        } else {
            node.remove();
        }
    }
};

var ForeColorPlugin = class extends ColorPlugin {
    constructor () {
        super(...arguments);
        this.buttons = {
            template: 'wysiwyg.buttons.forecolor',
            active: '_active',
            enabled: '_enabled',
        };
        this._classPrefix = this._classPrefixes && this._classPrefixes.text || 'color-';
        this._styleName = 'color';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Method called on custom color button click :
     * opens the color picker dialog and saves the chosen color on save.
     *
     * @todo
     */
    custom (value, range) {
        var self = this;
        var $button = $(range.sc).next('button');
        var colorPickerDialog = new ColorpickerDialog(this, {});

        colorPickerDialog.on('colorpicker:saved', this, this._wrapCommand(function (ev) {
            self.update(ev.data.cssColor);

            $button = $button.clone().appendTo($button.parent());
            $button.show();
            $button.css('background-color', ev.data.cssColor);
            $button.attr('data-value', ev.data.cssColor);
            $button.data('value', ev.data.cssColor);
            $button.attr('title', ev.data.cssColor);
            $button.mousedown();
        }));
        colorPickerDialog.open();
    }
};

var BgColorPlugin = class extends ColorPlugin {
    constructor () {
        super(...arguments);
        this.buttons = {
            template: 'wysiwyg.buttons.bgcolor',
            active: '_active',
            enabled: '_enabled',
        };
        this._classPrefix = this._classPrefixes && this._classPrefixes.background || 'color-';
        this._styleName = 'background-color';
    }
};

we3.addPlugin('Color', ColorPlugin);
we3.addPlugin('ForeColor', ForeColorPlugin);
we3.addPlugin('BgColor', BgColorPlugin);

})();
