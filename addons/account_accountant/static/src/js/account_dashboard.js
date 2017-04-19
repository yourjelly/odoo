odoo.define('account_accountant.dashboard', function (require) {
"use strict";

var core = require('web.core');
var formats = require('web.formats');
var Model = require('web.Model');
var session = require('web.session');
var KanbanView = require('web_kanban.KanbanView');
var data = require('web.data');
var web_client = require('web.web_client');

var QWeb = core.qweb;

var _t = core._t;
var _lt = core._lt;

var AccountDashboardView = KanbanView.extend({
    display_name: _lt('Dashboard'),
    icon: 'fa-dashboard',
    searchview_hidden: true,
    events: {
        'click .o_dashboard_action': 'on_dashboard_action_clicked', //TODO OCO supprimer
        'click .account_company_setting_action': 'account_company_setting_action_clicked',
    },

    account_company_setting_action_clicked: function(ev) {
        new Model('res.company').call('setting_init_company_action', []).then(function(rslt_action){
            web_client.action_manager.do_action(rslt_action);
        });
    },

    fetch_data: function() {
        return new Model('account.journal')
            .call('retrieve_account_dashboard', []);
    },

    render: function() {
        var super_render = this._super;
        var self = this;

        return this.fetch_data().then(function(result){
            var account_dashboard = QWeb.render('account_accountant.AccountDashboard', {
                widget: self,
                values: result,
            });
            super_render.call(self);
            $(account_dashboard).prependTo(self.$el);
        });
    },

    on_dashboard_action_clicked: function(ev) { //TODO OCO supprimer
        ev.preventDefault();
        var $action = $(ev.currentTarget);
        var action_name = $action.attr('name');
        var action_context = $action.data('context');
        this.do_action(action_name, {
            additional_context: action_context
        });
    },

});

core.view_registry.add('account_accountant_dashboard', AccountDashboardView);

return AccountDashboardView;

});
