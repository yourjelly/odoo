odoo.define('website.s_sponsors_options', function (require) {
'use strict';

var core = require('web.core');
var weWidgets = require('wysiwyg.widgets');
var options = require('web_editor.snippets.options');

var _t = core._t;
var qweb = core.qweb;

options.registry.sponsors = options.Class.extend({
    xmlDependencies: ['/website_event_track/static/src/xml/website_event_track_our_sponsors.xml'],

    /**
     * @override
     */
    start: function () {
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    onBuilt: function () {
        // debugger;
        // _.each(_.range(1,4), function () {
        //     debugger;
        //     this.addPartner();
        // })
        this._rpc({
            model: 'res.partner',
            method: 'create',
            args: [{
                'name': 'new sponsor'
            }],
        });
    },

    addPartner: function () {
        this._rpc({
            model: 'res.partner',
            method: 'create',
            args: [{
                'name': 'new sponsor'
            }],
        });

    },
});

});
