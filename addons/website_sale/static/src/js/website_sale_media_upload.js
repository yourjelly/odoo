odoo.define('website_sale.productMedia',function(require){
var publicWidget = require('web.public.widget');
var weWidgets = require('wysiwyg.widgets');
var rpc = require('web.rpc');
var utils = require('web.utils');
var core = require('web.core');
var _t = core._t;
publicWidget.registry.productsUpload = publicWidget.Widget.extend({
    selector: '#o-carousel-product-media',
    events:{
        'click #product_media_upload':'_addProductMedia',
    },
    init: function () {
        return this._super.apply(this, arguments);
    },
    start: function () {
        return this._super.apply(this, arguments);
    },
    _addProductMedia: function(ev)
    {
        var $image = $('<img/>');
        var mediaDialog = new weWidgets.MediaDialog(this, {
            noIcons: true,
            noDocuments: true,
            res_model: 'ir.ui.view',
        }, $image[0]);
        mediaDialog.open();
        mediaDialog.on('save', this, function (media) {
            var product_tmpl_id = $('#o-carousel-product-media').attr('product-temp-id');
            var product_name = $('#o-carousel-product-media').attr('product-name');
            var video_link = media.dataset.oeExpression
            var image_link = media.src
            this._rpc({
                route: '/sale/product_media_website',
                params: {
                    product_template_id:product_tmpl_id,
                    img_src:image_link,
                    video_url:video_link,
                },
            });
        });
    },
});

});

