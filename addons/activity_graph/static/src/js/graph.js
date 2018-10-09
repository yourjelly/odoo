odoo.define('graph', function (require) {
"use strict";

var AbstractAction = require('web.AbstractAction');
var core = require('web.core');
var widget = require('web.Widget');
var ajax = require('web.ajax');
var Dialog = require('web.Dialog');
var _t = core._t;
var QWeb = core.qweb;

var search_author = widget.extend({

    template: 'getinput_template',

    events: {
        'click .author': '_render',
        'click .type': '_render',
        'click .dropdown': '_OnSearch'
    },

    start : function(data){
        return this.$('.dropdown').html(QWeb.render('dropdown_template', { values : this.dropdown_data.author }));
    },

    willStart: function () {
        var self=this;
        return this._rpc({route:  '/author/select'}).then(function (dropdown_data) {
            self.dropdown_data = dropdown_data;
        });
    },

    _render: function(){
        var search_type = this.$("input[name='search_type']:checked").val();
        return (this.$(".dropdown").html(QWeb.render('dropdown_template', {
            values: (search_type =='Author') ? this.dropdown_data.author : this.dropdown_data.types
        })));
    },

    _OnSearch: function(){
        this.trigger_up('view_graph', {
            selected_value : this.$(".dropdown_menu").val(),
            choice_value : this.$("input[name='search_type']:checked").val()
        });
    }
});

var graph = AbstractAction.extend({

    template: 'graph_template',

    custom_events:{
        'view_graph': '_ViewGraph',
    },

    cssLibs: [
        '/activity_graph/static/src/css/graph.css',
    ],

    jsLibs: [
        '/web/static/lib/nvd3/d3.v3.js',
        '/activity_graph/static/src/js/libs/myd3.js',
        '/activity_graph/static/src/js/libs/newd3.js',
    ],

    willStart: function(){
        return $.when(ajax.loadLibs(this), this._super.apply(this, arguments));
    },

    start: function(){
        this._super.apply(this, arguments);
        var parent = new search_author(this);
        parent.prependTo(this.$el);
    },

    _ViewGraph: function(event){
        $('.disp-graph').find('svg').empty();
        if (!event.data.selected_value) {
            return Dialog.alert(this, _t("Please select option from dropdown"), {
                    title: _t('You have not selected any option')
            });
        }

        this._rpc({

            route: '/author/search',
            params: {
                'selected_value': event.data.selected_value,
                'search_type': event.data.choice_value
            },
        }).then(function (result){
            var tasks = result.data;

            for (var i=0; i<tasks.length; i++) {
                tasks[i].endDate = new Date(tasks[i].enddate)
                tasks[i].startDate = new Date(tasks[i].startdate)
            }
            var taskStatus = {
                "planned" : "bar-running",
                "overdue" : "bar-succeeded",
                "today" : "bar",
            };

            var gantt = d3.gantt().taskTypes(result.taskName).taskStatus(taskStatus).tickFormat("%b-%d").height(600).width(900);
            gantt(tasks);

        });
    }
});
core.action_registry.add('author_graph', graph);
});
