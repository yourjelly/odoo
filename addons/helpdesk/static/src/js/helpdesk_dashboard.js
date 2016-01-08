odoo.define('helpdesk.dashboard', function (require) {
"use strict";

var core = require('web.core');
var formats = require('web.formats');
var Model = require('web.Model');
var session = require('web.session');
var KanbanView = require('web_kanban.KanbanView');

var QWeb = core.qweb;

var _t = core._t;
var _lt = core._lt;

var HelpdeskTeamDashboardView = KanbanView.extend({
    display_name: _lt('Dashboard'),
    icon: 'fa-dashboard',
    view_type: "helpdesk_dashboard",
    searchview_hidden: true,
    events: {
        'click .o_dashboard_action': 'on_dashboard_action_clicked',
    },

    fetch_data: function() {
        return new Model('helpdesk.team')
            .call('retrieve_dashboard', []);
    },

    render: function() {
        var super_render = this._super;
        var self = this;

        return this.fetch_data().then(function(result){
            self.show_demo = result && result['show_demo'];

            var helpdesk_dashboard = QWeb.render('helpdesk.HelpdeskDashboard', {
                widget: self,
                show_demo: self.show_demo,
                values: result,
            });
            super_render.call(self);
            $(helpdesk_dashboard).prependTo(self.$el);
        });
    },

    on_dashboard_action_clicked: function(ev){
        ev.preventDefault();

        var self = this;
        var $action = $(ev.currentTarget);
        var action_name = $action.attr('name');
        var action_extra = $action.data('extra');
        var additional_context = {}

        // TODO: find a better way to add defaults to search view
        if (action_name === 'calendar.action_calendar_event') {
            additional_context['search_default_mymeetings'] = 1;
        } else if (action_name === 'crm.crm_lead_action_activities') {
            if (action_extra === 'today') {
                additional_context['search_default_today'] = 1;
            } else if (action_extra === 'this_week') {
                additional_context['search_default_this_week'] = 1;
            } else if (action_extra === 'overdue') {
                additional_context['search_default_overdue'] = 1;
            }
        } else if (action_name === 'crm.crm_opportunity_report_action_graph') {
            additional_context['search_default_won'] = 1;
        }

        new Model("ir.model.data")
            .call("xmlid_to_res_id", [action_name])
            .then(function(data) {
                if (data){
                   self.do_action(data, {additional_context: additional_context});
                }
            });
    },

});

core.view_registry.add('helpdesk_dashboard', HelpdeskTeamDashboardView);

return HelpdeskTeamDashboardView

});
