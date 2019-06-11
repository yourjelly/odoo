odoo.define('web_editor.we3.plugin.media', function (require) {
'use strict';

var weWidgets = require('wysiwyg.widgets');

we3.addPlugin('CropImage', class extends we3.AbstractPlugin {
    constructor() {
        super(...arguments);
        this.templatesDependencies = ['xml/media.xml'];
        this.dependencies = ['Arch'];
        this.buttons = {
            template: 'we3.buttons.image.crop',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    crop(value, archNode) {
        var cropImageDialog = new weWidgets.CropImageDialog(this, {}, archNode);

        cropImageDialog.on('save', this, function (img) {
            this.dependencies.Arch.importUpdate(img.toJSON());
        });

        cropImageDialog.open();
    }
});

});
