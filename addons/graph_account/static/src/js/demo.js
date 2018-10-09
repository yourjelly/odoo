odoo.define('cwidget', function (require) {
    "use strict";

    var core = require('web.core');
    var ajax = require('web.ajax');
    var Widget = require('web.Widget');
    var AbstractAction = require('web.AbstractAction');
    var QWeb = core.qweb;

    var balance = Widget.extend({

        template: 'inputTemplate',
        events: {
            'click .partner' : '_show',
            'click .journal' : '_show',
            'click .selected' : '_onSearch'
        },

        init: function (parent) {
            this.parent = parent;
            this._super.apply(this, arguments);
        },
        willStart: function () {
            var self = this;
            var arg = this._super.apply(this, arguments);
            var route = this._rpc({
                route:  '/list'
            }).then(function (c) {
                self.res = c;
            });
            return $.when(arg,route);
        },
        _show: function () {
            var search = this.$el.find("input[name='search']:checked").val() == 'journal';
            var values = search ? this.res['journal_list'] : this.res['partner_list'];
            this.journal = search ? false : true;
            this.$el.find('.dataTemplate').html(QWeb.render("dataof_dropdown", {values: values}));
        },
        _onSearch:function(){
            var self = this;
            this.trigger_up('showGraph',{input: this.$el.find('.selected').val(), selected_variable: this.journal});
        },  

    });

    var LineChart = AbstractAction.extend({
        template: 'line_chart_template',
        custom_events: {
            showGraph : '_onSearchGraph'
        },
        cssLibs: [
            '/web/static/lib/nvd3/nv.d3.css',
            '/graph_account/static/src/css/sttyle.css',
        ],
        jsLibs: [
            '/web/static/lib/nvd3/d3.v3.js',
            '/web/static/lib/nvd3/nv.d3.js',
        ],
        willStart: function(){
            return ajax.loadLibs(this);
        },
        start: function(){
            var temp = new balance(this);
            temp.prependTo(this.$el);            
        },
        _onSearchGraph: function(event){
            var self = this;
            self.$('svg').empty();
            self.$('.nvtooltip').remove(); 
            self._rpc({
                route: '/graph_search',
                params: {
                    'input': event.data.input,
                    'partner_search': event.data.selected_variable,
                },
            })
            .then(function (final_dict) {
                var check;
                for (var key in final_dict) {
                    for(var i = 1; i <Object.keys(final_dict[key]).length+1;i++)
                    {
                        if(final_dict[key][i] ==0){}
                        else{check = true;}
                    }   
                }
                if(check){
                    nv.addGraph(function() {
                        var chart = nv.models.lineChart()
                            .margin({"right": 50,"left":50})
                            .useInteractiveGuideline(true)
                            .showLegend(true)
                            .showYAxis(true)
                            .showXAxis(true)
                            .height(500);
                        
                        var Arr = [];
                        var obj = {"values":[]};
                        for (var i = 5; i > 0; i--) {
                            if(i==1){
                                obj["values"].push({jname: "Current Week"});    
                            }
                            else{
                            obj["values"].push({jname: "Previous Week "+(i-1)});
                            }
                        }
                        Arr.push(obj);

                        chart.xAxis
                            .axisLabel('Weeks')
                            .rotateLabels(0)
                            .tickFormat(function(d) {
                                var ret = Arr[0].values[d-1].jname;
                                    return ret;
                            });
                        chart.yAxis
                            .axisLabel('Balance')
                            .tickFormat(d3.format('.02f'));   
                        var myData = Balance();
                        d3.select('#line_chart svg')
                            .datum(myData)
                            .call(chart);
                        nv.utils.windowResize(function() { chart.update() });
                        return chart;
                    });
                    function Balance() {
                        var colors_arr = ["#003e66", "#5bffff", "#8dea2a", "#ff1800", "#660e0e", "#fff500", "#e98125", "#635222", "#6ada6a", "#0c6197", "#5d6058", "#207f33", "#44b9b0", "#bca44a", "#e4a14b", "#8cc3e9", "#69a6f9", "#5b388f", "#ba6b72", "#f65bff", "#5fff5b", "#cc1010", "#31383b", "#006391", "#c2643f", "#ffda49", "#a5a39c", "#22af8c", "#7fcecf", "#987ac6", "#3d3b87", "#ed9500", "#807ece", "#be66a2", "#00644b", "#005064", "#32fc36", "#9c73ab", "#00527c"];

                        var datas = [];
                        var k=0;
                        for (var key in final_dict) {
                            var li = [];
                            for(var i = Object.keys(final_dict[key]).length, j = 1; i >0; i--, j++)
                            {
                                li.push({x:j, y:final_dict[key][i]})
                            }
                            datas.push({
                                values: li,
                                key: key,
                                color: colors_arr[k]
                            })
                            k++;
                        };
                        return datas
                    }
                }
                else{
                    alert("No data found")
                }
            });
        },
    });
    core.action_registry.add('line_chart_template', LineChart);
});
