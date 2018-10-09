odoo.define('graph.whisker_widgets', function (require) {
"use strict";

var AbstractAction = require('web.AbstractAction');
var Widget=require('web.Widget');
var core = require('web.core');
var Dialog= require('web.Dialog');
var ajax=require('web.ajax');

var InputWidget = Widget.extend({

    template: 'graph.whisker_template',

    events: {
        'change #users': '_onSearch',
    },
    
    willStart: function () {
        var self = this;
        return this._rpc({
            route:  '/product/prefilldata'
        }).then(function (leaderlist){
            self.leaderlist = leaderlist;
        });
    },

    _onSearch: function(){
        this.trigger_up('show_graph',{
            input: this.$el.find('#users').val(),
        });
    }

});

var GraphWidget = AbstractAction.extend({

    template: 'graph.whisker_graph_template',

    jsLibs: [
        '/graph/static/src/js/d3.min.js',
        '/graph/static/src/js/nv.d3.js'
    ],

    cssLibs: [
        '/graph/static/src/css/nv_d3.css'
    ],

    custom_events: {
        show_graph: '_onShowGraph',
    },

    willStart: function(){
        return $.when(this._super.apply(this, arguments),ajax.loadLibs(this));
    },

    start: function(){
        var inputwidget= new InputWidget(this);
        inputwidget.prependTo(this.$el);
    },

    _onShowGraph: function (ev) {
        var self = this;
        this.$('.graphsvg').empty();
        this._rpc({
            route:  '/product/graphdata',
            params: {'channelleader': ev.data.input}
        }).then(function (data) {
            if (!data.length) {
                return Dialog.alert(self,("No records found for your given input!"), {
                    title: ('Please try again with different product or person name')
                })
            }
            nv.addGraph(function() {
                var chart = nv.models.boxPlotChart()
                        .x(function(d) {
                            return d.label
                        })
                        .y(function(d) {
                            return d.values.Q3
                        })
                        .staggerLabels(true)
                        .maxBoxWidth(75) // prevent boxes from being incredibly wide
                        .yDomain([0, 50000]);
                d3.select('svg')
                    .datum(data)
                    .call(chart);

                nv.utils.windowResize(function(){chart.update(); makeMarkOnMean();});
                makeMarkOnMean()
                function makeMarkOnMean(){
                    d3.selectAll(".mean").remove();
                    d3.selectAll(".nv-boxplot-box")[0].forEach(function(r){
                        window.setTimeout(function(){
                        var x = parseFloat(d3.select(r).attr("x")) + d3.select(r).attr("width")/2 - 3;
                        var y = parseFloat(d3.select(r).attr("y")) + parseFloat(d3.select(r).attr("height"))/2+12;
                        d3.select(r.parentNode).append("text").attr("class", "mean").style("font-size", "x-large").text("*").style("fill", "red").attr("x",x).attr("y", y);
                        },500)
                    });
                }
              return chart;
            });
        })
    },
});
core.action_registry.add("inputgraphtag", GraphWidget);
});
