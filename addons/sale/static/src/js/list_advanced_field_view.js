odoo.define('sale.AdvancedFieldView', function (require) {
"use strict";

/**
 * Advanced Fields List renderer
 *
 */
var core = require('web.core');
var dialogs = require('web.view_dialogs');
var ListRenderer = require('web.ListRenderer');
var SectionAndNoteFieldOne2Many = require("account.section_and_note_backend");

var _t = core._t;
ListRenderer.include({

    events: _.extend({}, ListRenderer.prototype.events, {
        'click tr .o_list_record_open': '_onAdvancedFieldClick',
    }),

    _getNumberOfCols: function () {
        return this._super() + 1;
    },

    _renderRow: function (record, index) {
        var $row = this._super.apply(this, arguments);
        if (this.state.model === 'sale.order.line') {
            var $icon = $('<button>', {class: 'fa fa-external-link', name: 'open', 'aria-label': _t('Open ') + (index + 1)});
            var $td = $('<td>', {class: 'o_list_record_open text-center'}).append($icon);
            $row.append($td);
        }
        return $row;
    },

    _onAdvancedFieldClick: function (ev) {
        ev.stopPropagation();
        var $row = $(ev.target).closest('tr');
        var id = $row.data('id');
        if (id) {
            this.trigger_up('open_advanced_fields_form', {id: id});
        }
    },

    _onRowClicked: function (ev) {
        if (this.editable === false && this.state.model === 'sale.order.line') {
            return;
        }
        return this._super.apply(this, arguments);
    },
});

SectionAndNoteFieldOne2Many.include({

    custom_events: {
        open_advanced_fields_form: '_openAdvancedFieldsForm',
    },

    _openAdvancedFieldsForm: function (ev) {
        var self = this;
        var id = ev.data.id;

        var context = this.record.getContext(_.extend({},
            this.recordParams,
            { form_view_ref: "sale.sale_order_line_advanced_field_view_form" }
        ));
        var views = [[false, 'form']];
        this.loadViews(this.field.relation, context, views).then(function (view) {
            self.trigger_up('open_one2many_record', {
                id: id,
                on_saved: function (record) {
                    self._setValue({ operation: 'UPDATE', id: record.id});
                },
                on_remove: function () {
                    self._setValue({operation: 'DELETE', ids: [id]});
                },
                deletable: self.activeActions.delete,
                readonly: self.mode === 'readonly',
                domain: self.record.getDomain(self.recordParams),
                context: self.record.context,
                field: self.field,
                fields_view: view && view.form,
                parentID: self.value.id,
                viewInfo: self.view,
            });
        });
    },

});

});

