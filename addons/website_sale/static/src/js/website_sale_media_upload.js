odoo.define('website_sale.productMedia',function(require){
var publicWidget = require('web.public.widget');
var weWidgets = require('wysiwyg.widgets');
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
        var self = this;
        var $image = $('<img/>');
        var mediaDialog = new weWidgets.MediaDialog(this, {
            noIcons: true,
            noDocuments: true,
            res_model: 'ir.ui.view',
        }, $image[0]);
        mediaDialog.open();
        mediaDialog.on('save', this, function (image) {
        });
    },
});

});

