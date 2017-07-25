odoo.define('sale.sales_team_dashboard', function (require) {
"use strict";

var core = require('web.core');
var field_registry = require('web.field_registry');
var KanbanRecord = require('web.KanbanRecord');
var relational_fields = require('web.relational_fields');
var session = require('web.session');
var _t = core._t;

KanbanRecord.include({
    events: _.defaults({
        'click .sales_team_target_definition': '_onSalesTeamTargetClick',
    }, KanbanRecord.prototype.events),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @param {MouseEvent} ev
     */
    _onSalesTeamTargetClick: function (ev) {
        ev.preventDefault();

        this.$target_input = $('<input>');
        this.$('.o_kanban_primary_bottom').html(this.$target_input);
        this.$('.o_kanban_primary_bottom').prepend(_t("Set an invoicing target: "));
        this.$target_input.focus();

        var self = this;
        this.$target_input.blur(function() {
            var value = Number(self.$target_input.val());
            if (isNaN(value)) {
                self.do_warn(_t("Wrong value entered!"), _t("Only Integer Value should be valid."));
            } else {
                self._rpc({
                        model: 'crm.team',
                        method: 'write',
                        args: [[self.id], { 'invoiced_target': value }],
                    })
                    .done(function() {
                        self.trigger_up('kanban_record_update', {id: self.id});
                    });
            }
        });
    },
});

relational_fields.FieldRadioType.include({
    supportedFieldTypes: ['selection', 'many2one'],
    /**
     * @override
     * @private
     */

    willStart: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function(){
            return session.user_has_group('sale.group_delivery_invoice_address').then(function(has_group){
                self.has_group = has_group;
                self._setValues();
            });
        });
    },
    _filterValues: function(){
        var self = this;
        var vals = this._super.apply(this, arguments);
        return _.filter(vals, function(data, index){
            // logic to filter selection
            if (!self.has_group && _.indexOf(['invoice','delivery'], data[0]) !== -1) {
                return false;
            }
            return true;
        });
    },

    _setValues: function () {
        this.values = this._filterValues();
    },
});

});
