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

    //--------------------------------------------------------------------------
    // Lifecycle
    //--------------------------------------------------------------------------

    saveEditor () {
        var self = this;
        var defs = [];
        this.dependencies.Arch.getNode(1).nextUntil(function (node) {
            if (!node.isMedia || !node.isMedia() || !node.className.contains('o_cropped_img_to_save')) {
                return;
            }
            node.className.remove('o_cropped_img_to_save');
            var resModel = node.attributes['data-crop:resModel'];
            var resID = node.attributes['data-crop:resID'];
            var cropID = node.attributes['data-crop:id'];
            var mimetype = node.attributes['data-crop:mimetype'];
            var originalSrc = node.attributes['data-crop:originalSrc'];
            var datas = node.attributes['src'].split(',')[1];
            if (!cropID) {
                var name = originalSrc + '.crop';
                defs.push(self.options.getXHR(
                    self.pluginName,
                    self.options.upload.add,
                    {
                        res_model: resModel,
                        res_id: parseInt(resID),
                        name: name,
                        datas: datas,
                        mimetype: mimetype,
                        url: originalSrc, // To save the original image that was cropped
                    },
                ).then(function (attachmentID) {
                    return self.options.getXHR(
                        self.pluginName,
                        '/web/dataset/call_kw/ir.attachment/generate_access_token',
                        [attachmentID],
                    ).then(function (access_token) {
                        node.attributes.set('src', '/web/image/' + attachmentID + '?access_token=' + access_token[0]);
                    });
                }));
            } else {
                defs.push(self.options.getXHR(
                    self.pluginName,
                    '/web/dataset/call_kw/ir.attachment/write',
                    {
                        cropID: cropID,
                        datas: datas,
                    },
                ));
            }
        });
        return Promise.all(defs);
    }
});

});
