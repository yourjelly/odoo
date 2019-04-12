odoo.define('website_forum.website_forum_suggest_favorite', function (require) {
'use strict';

require('web.dom_ready');

var core = require('web.core');
// var Wysiwyg = require('web_editor.wysiwyg.root');
var publicWidget = require('web.public.widget');
// var session = require('web.session');
// var qweb = core.qweb;
// var WebsiteProfile = require('website_profile.website_profile');

var _t = core._t;

publicWidget.registry.websiteForum.include({

    /**
     * @override
     */
    start: function () {
        var self = this;

        var $select = $('input[name="suggest_user_ids"]');

        var data = [];
        var datas = $select.data('init-value')
        _.each(datas, function (item) {
            data.push(item);
        });

        $select.select2({
            tags: true,
            // tokenSeparators: [',', ' ', '_'],
            // maximumInputLength: 35,
            minimumInputLength: 1,
            // maximumSelectionSize: 25,
            // lastsearch: [],
            formatResult: function (term) {
                return _.escape(term.text);
            },
            data: data,
        });

        return this._super.apply(this, arguments);
    }
});
});
