odoo.define('web_editor.plugins.color_picker', function (require) {
'use strict';

var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');

/**
 * Method called on custom color button click :
 * opens the color picker dialog and saves the chosen color on save.
 *
 * @todo
 */
var custom = function (value, archNode) {
    var self = this;
    var range = this.dependencies.Range.getRange();
    var colorPickerDialog = new ColorpickerDialog(this, {
        archNode: archNode,
    });

    colorPickerDialog.on('save', this, function (colorData) {
        var cssColor = colorData.cssColor;
        var $button = $('<we3-button>')
        $button.show();
        $button.css('background-color', cssColor);
        $button.attr('data-plugin', self.pluginName);
        $button.attr('data-method', 'update');
        $button.attr('data-value', cssColor);
        $button.attr('title', cssColor);
        var $customPalette = $('we3-dropdown[data-plugin="' + self.pluginName + '"] we3-palette.wysiwyg-palette-custom we3-row');
        $button = $button.appendTo($customPalette);

        // Reset range to where it was before fiddling with the colorpicker dialog
        self.dependencies.Range.setRange(range);
        self.update(cssColor);
    });
    colorPickerDialog.open();
}

we3.addPlugin('ForeColor', class extends (we3.getPlugin('ForeColor')) {
    /**
     * @override
     */
    constructor() {
        super(...arguments);
        this.custom = custom.bind(this);
    }

});

we3.addPlugin('BgColor', class extends (we3.getPlugin('BgColor')) {
    /**
     * @override
     */
    constructor() {
        super(...arguments);
        this.custom = custom.bind(this);
    }

});

});