(function () {
'use strict';

// var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');

var ForeColorPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'];
        this.dependencies = ['Text'];
        this.buttons = {
            template: 'wysiwyg.buttons.forecolor',
            active: '_active',
            enabled: '_enabled',
        };

        var self = this;
        this._colors = this.options.colors;
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
     * Method called on custom color button click :
     * opens the color picker dialog and saves the chosen color on save.
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
    /**
     * Change the selection's fore color.
     *
     * @param {string} color (hexadecimal or class name)
     * @param {ArchNode} focusNode
     */
    update (color, focusNode) {
        if (!color || color.startsWith('#')) {
            color = color || '';
            $(range.sc).css('color', color);
        } else {
            $(range.sc).addClass('text-' + color);
        }
        this.dependencies.Text.applyFont(color || 'text-undefined', null, null, range);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        var colorName = buttonName.split('-')[1];
        if (colorName[0] === '#') {
            colorName = $('<div>').css('color', colorName).css('color'); // TODO: use a js converter xml => rgb
            while (this.editable !== focusNode && document !== focusNode) {
                if (focusNode.style && focusNode.style.color !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return document !== focusNode && colorName === $(focusNode).css('color');
        } else {
            return $(focusNode).closest('text-' + colorName).length;
        }
    }
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return !!focusNode.ancestor('isFormatNode');
    }
    /**
     * Create a color button.
     *
     * @param {string} color
     * @returns {Node}
     */
    _createColorButton (color) {
        var button = document.createElement('we3-button');
        if (color.startsWith('#')) {
            button.setAttribute('style', 'background-color: ' + color + ';')
        } else {
            button.setAttribute('class', 'bg-' + color);
        }
        button.setAttribute('data-method', 'update');
        button.setAttribute('data-value', color);
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
     * Insert the colors grid declared in the editor options into the colors dropdown.
     *
     * @private
     * @see options.colors
     */
    _insertColors () {
        var target = this.buttons.elements[0].querySelector('we3-palettes');
        this._insertGrid(this.options.colors, target, true);
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
};

var BgColorPlugin = class extends ForeColorPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_colorpicker.xml'];
        this.dependencies = ['Text'];
        this.buttons = {
            template: 'wysiwyg.buttons.bgcolor',
            active: '_active',
            enabled: '_enabled',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Change the selection's background color.
     *
     * @param {String} color (hexadecimal or class name)
     * @param {Node} [range]
     */
    update (color, range) {
        if (!color || color.startsWith('#')) {
            color = color || '';
            $(range.sc).css('background-color', color);
        } else {
            $(range.sc).addClass('bg-' + color);
        }
        this.dependencies.Text.applyFont(null, color || 'bg-undefined', null, range);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {String} buttonName
     * @param {WrappedRange} range
     * @returns {Boolean} true if the given button should be active
     */
    _active (buttonName, focusNode) {
        var colorName = buttonName.split('-')[1];
        if (colorName[0] === '#') {
            colorName = $('<div>').css('color', colorName).css('color'); // TODO: use a js converter xml => rgb
            while (this.editable !== focusNode && document !== focusNode) {
                if (focusNode.style && focusNode.style.backgroundColor !== '') {
                    break;
                }
                focusNode = focusNode.parentNode;
            }
            return document !== focusNode && colorName === $(focusNode).css('background-color');
        } else {
            return $(focusNode).closest('bg-' + colorName).length;
        }
    }
    /**
     * @param {String} buttonName
     * @param {Node} focusNode
     * @returns {Boolean} true if the given button should be enabled
     */
    _enabled (buttonName, focusNode) {
        return !!focusNode.ancestor('isFormatNode');
    }
};

we3.addPlugin('ForeColor', ForeColorPlugin);
we3.addPlugin('BgColor', BgColorPlugin);

})();
