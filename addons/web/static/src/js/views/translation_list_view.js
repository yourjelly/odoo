odoo.define('web.TranslationListView', function (require) {
"use strict";

/**
 * This file defines the TranslateListView, an extension of the ListView that
 * is used by the TranslateField in Form views.
 */
var ListRenderer = require('web.ListRenderer');
var ListView = require('web.ListView');
var core = require('web.core');

var _t = core._t;

var TranslateListRenderer = ListRenderer.extend({
    /**
     * @override
     * @private
     * @returns {jQueryElement} a jquery element <tbody>
     */
    _renderBody: function () {
        var $rows = this._renderRows();
        return $('<tbody>').append($rows);
    },
    /**
     * @override
     * @private
     * @returns {jQueryElement} a <td> element
     */
    _renderBodyCell: function (record, node, colIndex, options) {
        var $td = this._super.apply(this, arguments);
        if (options.mode  === 'readonly' && !record.data.value && node.attrs.name === "value"){
            $td.text(_t('No Translation'))
               .addClass('text-muted')
               .css({'font-style': 'italic'});
        }
        return $td;
    },
    /**
     * @override
     * @private
     * returns {Deferred} this deferred is resolved immediately
     */
    _renderView: function () {
        var def = this._super.apply(this, arguments);
        this.$el
            .removeClass('table-responsive')
            .empty();
        // destroy the previously instantiated pagers, if any
        _.invoke(this.pagers, 'destroy');
        var $table = $('<table>').addClass('o_list_view table table-hover table-striped');
        $table.css({'table-layout': 'fixed'});
        this.$el.append($table);
        var colspan = this._getNumberOfCols();
        while (colspan) {
            var $col = $('<col/>').attr('width', '220px');
            $table.append($col);
            colspan = colspan - 1;
        }
        $table.append(this._renderBody());
        return def;
    },
});

var TranslateListView = ListView.extend({
    withControlPanel: false,
    config: _.extend({}, ListView.prototype.config, {
        Renderer: TranslateListRenderer,
    }),
});

return TranslateListView;

});
