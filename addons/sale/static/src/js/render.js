
odoo.define('sale.render', function (require) {
"use strict";

var core = require('web.core');
var dom = require('web.dom');
var ListRenderer = require('web.ListRenderer');
var _t = core._t;


ListRenderer.include({
    custom_events: _.extend({}, ListRenderer.prototype.custom_events, {
        navigation_move: '_onNavigationMove',
    }),
    events: _.extend({}, ListRenderer.prototype.events, {
        'click .o_field_x2many_list_col_add a': '_onAddsection',
    }),

    _moveToPreviousLine: function () {
        if (this.currentRow > 0) {
            this._selectCell(this.currentRow - 1, this.columns.length - 1);
        } else {
            this.unselectRow().then(this.trigger_up.bind(this, 'add_section'));
        }
    },

    _moveToNextLine: function () {
        var record = this.state.data[this.currentRow];
        var fieldNames = this.canBeSaved(record.id);
        if (fieldNames.length) {
            return;
        }

        if (this.currentRow < this.state.data.length - 1) {
            this._selectCell(this.currentRow + 1, 0);
        } else {
            var self = this;
            this.unselectRow().then(function () {
                self.trigger_up('add_section', {
                    onFail: self._selectCell.bind(self, 0, 0, {}),
                });
            });
        }
    },
    _renderRows: function () {
        var $rows = this._super();
        if (this.addCreateLine) {
            var $ax = $('<a href="#">').text(_t("Add a Section"));
            var $td = $('<td>')
                        .attr('colspan', this._getNumberOfCols())
                        .addClass('o_field_x2many_list_col_add')
                        .append($ax);
            var $tr = $('<tr>').append($td);
            $rows.push($tr);
        }
        return $rows;
    },

    _onAddsection: function (event) {
        // we don't want the browser to navigate to a the # url
        event.preventDefault();

        // we don't want the click to cause other effects, such as unselecting
        // the row that we are creating, because it counts as a click on a tr
        event.stopPropagation();

        // but we do want to unselect current row
        var self = this;
        this.unselectRow().then(function () {
            self.trigger_up('add_section'); // TODO write a test, the deferred was not considered
        });
    },
    
});

});

