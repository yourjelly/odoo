odoo.define('website.s_sponsors_options', function (require) {
'use strict';

var core = require('web.core');
var weWidgets = require('wysiwyg.widgets');
var options = require('web_editor.snippets.options');

var _t = core._t;
var qweb = core.qweb;
debugger;
options.registry.sponsors = options.Class.extend({
    xmlDependencies: ['/website_event_track/static/src/xml/website_event_track_our_sponsors.xml'],

    /**
     * @override
     */
    start: function () {
        // The snippet should not be editable
        // this.$target.addClass('o_fake_not_editable').attr('contentEditable', false);
        debugger;
        // Make sure image previews are updated if images are changed
        this.$target.on('save', 'img', function (ev) {
            debugger;
        });

        // When the snippet is empty, an edition button is the default content
        // TODO find a nicer way to do that to have editor style
        this.$target.on('click', '.o_add_images', function (e) {
            debugger;
        });

        this.$target.on('dropped', 'img', function (ev) {
           debugger;
        });
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    onBuilt: function () {
        debugger;
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------


    // addImages: function (previewMode) {
    //     var $container = this.$('> div:first-child');
    //     var dialog = new weWidgets.MediaDialog(this, {multiImages: true, onlyImages: true, mediaWidth: 1920});
    //     var lastImage = _.last(this._getImages());
    //     var index = lastImage ? this._getIndex(lastImage) : -1;
    //     return new Promise(resolve => {
    //         dialog.on('save', this, function (attachments) {
    //             for (var i = 0; i < attachments.length; i++) {
    //                 $('<img/>', {
    //                     class: 'img img-fluid',
    //                     src: attachments[i].image_src,
    //                     'data-index': ++index,
    //                     alt: attachments[i].description || '',
    //                 }).appendTo($container);
    //             }
    //             this.mode('reset', this.getMode());
    //             this.trigger_up('cover_update');
    //         });
    //         dialog.on('closed', this, () => resolve());
    //         dialog.open();
    //     });
    // },
   
});

});
