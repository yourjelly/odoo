odoo.define('sale.AdvancedFieldWidget', function (require) {
"use strict";

/**
 * Advanced Fields List renderer
 *
 */
var core = require('web.core');
var ListRenderer = require('web.ListRenderer');
var SectionAndNoteFieldOne2Many = require("account.section_and_note_backend");
var Widget = require('web.Widget');
var widgetRegistry = require('web.widget_registry');

var _t = core._t;
ListRenderer.include({

    _onRowClicked: function (ev) {
        if (this.editable === false && this.state.model === 'sale.order.line') {
            return;
        }
        return this._super.apply(this, arguments);
    },
});

var AdvancedFieldWidget = Widget.extend({
    template: 'AdvancedFields',
    events: {
        'click': '_onAdvancedFieldClick',
    },

    init: function(parent, state){
        this._super.apply(this, arguments)
        this.state = state;
    },

    _onAdvancedFieldClick: function (ev) {
        ev.stopPropagation();
        var id = this.state.id;
        if (id) {
            this.trigger_up('open_advanced_form', {id: id});
        }
    },

});

SectionAndNoteFieldOne2Many.include({

    custom_events: {
        open_advanced_form: '_openAdvancedFieldsForm',
    },

    _openAdvancedFieldsForm: function (ev) {
        var self = this;

        var id = ev.data.id;
        var context = this.record.getContext(_.extend({},
            this.recordParams,
            { form_view_ref: "sale.sale_order_line_advanced_field_view_form" }
        ));
        var views = [[false, 'form']];
        this.loadViews(this.field.relation, context, views).then(function (viewsInfo) {
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
                context: context,
                field: self.field,
                fields_view: viewsInfo && viewsInfo.form,
                parentID: self.value.id,
                viewInfo: self.view,
            });
        });
    },

});

widgetRegistry.add('advanced_form', AdvancedFieldWidget);
});
