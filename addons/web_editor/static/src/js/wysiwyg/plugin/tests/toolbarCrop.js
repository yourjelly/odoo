(function () {
'use strict';

var TestToolbarCrop = class extends we3.AbstractPlugin {
    constructor() {
        super(...arguments);
        this.dependencies = ['Test', 'TestToolbar'];

        // range collapsed: ◆
        // range start: ▶
        // range end: ◀

        var self = this;
        var _clickMedia = async function (callbackInit) {
            var $btnLink = $('we3-toolbar we3-button[name="image-dialog"]');
            await self.dependencies.Test.triggerNativeEvents($btnLink[0], ['mousedown', 'click']);
            await callbackInit();
        };

        this.toolbarTests = [
            {
                name: "Click CROP 16:9 + ZOOM IN in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        await new Promise((resolve) => setTimeout(resolve, 500)); // TODO: remove and add wait to load pictures on website
                        document.querySelector('[data-plugin="UploadImage"] we3-document').dispatchEvent(new Event('mousedown', { bubbles: true }));
                        await self.dependencies.Test.triggerNativeEvents($('we3-modal we3-footer we3-button.we3-primary')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="crop"]')[0], ['mousedown', 'click']);
                        await new Promise((resolve) => setTimeout(resolve, 0)); // next tick (crop dialog)
                        await new Promise((resolve) => setTimeout(resolve, 0)); // next tick (cropper.js lib )
                        await self.dependencies.Test.triggerNativeEvents($('.o_crop_image_dialog .o_crop_options .btn:contains("16:9")')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('.o_crop_image_dialog .o_crop_options .btn:has(.fa-search-plus)')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="image" alt="image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAE0lEQVQYV2P8z8DwnwEJMKILAABb+QP/rppjrwAAAABJRU5ErkJggg==" class="img-fluid o_cropped_img_to_save o_we_custom_image" data-crop:resModel="note.note" data-crop:mimetype="image/png" data-crop:originalSrc="/web_editor/static/src/img/transparent.png" data-aspect-ratio="16/9" data-x="0.22727272727272724" data-y="1.2215909090909092" data-width="4.545454545454545" data-height="2.556818181818181" data-rotate="0" data-scale-x="1" data-scale-y="1"/>◀</p>',
            },
            {
                name: "Click CROP ROTATE LEFT + FLIP HORIZONTAL in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        document.querySelector('[data-plugin="UploadImage"] we3-document').dispatchEvent(new Event('mousedown', { bubbles: true }));
                        await self.dependencies.Test.triggerNativeEvents($('we3-modal we3-footer we3-button.we3-primary')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="crop"]')[0], ['mousedown', 'click']);
                        await new Promise((resolve) => setTimeout(resolve, 0)); // next tick (crop dialog)
                        await new Promise((resolve) => setTimeout(resolve, 0)); // next tick (cropper.js lib )
                        await new Promise((resolve) => setTimeout(resolve, 300)); // next tick (load image preview in cropper.js lib )
                        await self.dependencies.Test.triggerNativeEvents($('.o_crop_image_dialog .o_crop_options .btn:contains("16:9")')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('.o_crop_image_dialog .o_crop_options .btn:has(.fa-rotate-left)')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('.o_crop_image_dialog .o_crop_options .btn:has(.fa-arrows-h)')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="image" alt="image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAACCAYAAACQahZdAAAAHklEQVQYV2P8z8Bwh4GBQZkBAZ4z/mdg+I8kAGYCAIdDBOa0DmvZAAAAAElFTkSuQmCC" class="img-fluid o_cropped_img_to_save o_we_custom_image" data-crop:resModel="note.note" data-crop:mimetype="image/png" data-crop:originalSrc="/web_editor/static/src/img/transparent.png" data-aspect-ratio="16/9" data-x="1.0355339059327378" data-y="2.1292839059327378" data-width="5" data-height="2.8125" data-rotate="-45" data-scale-x="-1" data-scale-y="1"/>◀</p>',
            },
            {
                name: "Click CROP FREE in popover after adding image in empty p",
                async: true,
                content: '<p>◆</p>',
                do: async function () {
                    await _clickMedia(async function () {
                        var cropFactor = 10;
                        document.querySelector('[data-plugin="UploadImage"] we3-document').dispatchEvent(new Event('mousedown', { bubbles: true }));
                        await self.dependencies.Test.triggerNativeEvents($('we3-modal we3-footer we3-button.we3-primary')[0], ['mousedown', 'click']);
                        await self.dependencies.Test.triggerNativeEvents($('we3-popover[name="Image"] we3-button[name="crop"]')[0], ['mousedown', 'click']);
                        await new Promise((resolve) => setTimeout(resolve, 0)); // next tick (crop dialog)
                        await new Promise((resolve) => setTimeout(resolve, 0)); // next tick (cropper.js lib )
                        var $cropperPoints = $('.modal-dialog .cropper-crop-box .cropper-point');
                        var $pointW = $cropperPoints.filter('.point-w');
                        var pos1 = $pointW.offset();
                        var cropperWidth = $cropperPoints.filter('.point-e').offset().left - pos1.left;
                        $pointW.trigger($.Event("pointerdown", {
                            pageX: pos1.left,
                            pageY: pos1.top,
                        }));
                        $pointW.trigger($.Event("pointermove", {
                            pageX: pos1.left + (cropperWidth / cropFactor),
                            pageY: pos1.top,
                        }));
                        $pointW.trigger('pointerup');
                        await self.dependencies.Test.triggerNativeEvents($('.modal-dialog .modal-footer .btn.btn-primary:contains("Save")')[0], ['mousedown', 'click']);
                    });
                },
                test: '<p>▶<img title="image" alt="image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAYAAABirU3bAAAAGElEQVQYV2NkYGBg+A9GEMCIzCFSAN0MANSOCfzhvVcxAAAAAElFTkSuQmCC" class="img-fluid o_cropped_img_to_save o_we_custom_image" data-crop:resModel="note.note" data-crop:mimetype="image/png" data-crop:originalSrc="/web_editor/static/src/img/transparent.png" data-aspect-ratio="0/0" data-x="0.5050000000000011" data-y="0" data-width="4.494999999999999" data-height="5" data-rotate="0" data-scale-x="1" data-scale-y="1"/>◀</p>'
            },
        ];
    }

    start() {
        this.dependencies.Test.add(this);
        return super.start();
    }

    test(assert) {
        return this.dependencies.TestToolbar.test(assert, this.toolbarTests);
    }
};

    we3.addPlugin('TestToolbarCrop', TestToolbarCrop);

})();
