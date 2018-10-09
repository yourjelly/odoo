odoo.define('product_stockdata.graph', function (require) {
"use strict";

var abstractAction = require('web.AbstractAction');
var core = require('web.core');
var widget = require('web.Widget');
var QWeb = core.qweb;
var _t = core._t;

var search_by_graph  = widget.extend({

    template: 'product_graph',

    events: {
        'change .select_dropdown': '_onSelection',
        'click .city_radio' : '_onRadioCheck',
        'click .product_radio' : '_onRadioCheck'
    },

    _onSelection : function () {
        this.renderGraph();
    },
    
    _onRadioCheck: function (data) {
        var values;
        var product_city = this.$("input[name='select_type']:checked").val();
        this.$('.dropdown').html(QWeb.render('dropdown_temp', {
            values: product_city == 'Product' ? this.data.product_id : this.data.city_id }));
        this.renderGraph();
    },        

    start : function (data) {
        this.$('.dropdown').html(QWeb.render('dropdown_temp', { values : this.data.product }));
        this.renderGraph();
    },

    willStart: function () {
        var self=this;
        var def = this._rpc({
            route: '/dropdown_data',
        }).then(function(data) {
            self.data = data;
        });
        return def.then();
    },

    renderGraph: function () {
        this.trigger_up('generateGraph', {
            'input_select': this.$(".select_dropdown option:selected").attr('data-id'),
            'input_choice': this.$("input[name='select_type']:checked").val()
        });
    }

});

var showGraph = abstractAction.extend({

    template: 'product_showGraph',

    custom_events: {
        generateGraph : '_generateGraph'
    },

    start: function () {
        var data = new search_by_graph(this);
        data.prependTo(this.$el); 
    },

    _generateGraph: function (res) {
        var self = this;
        this._rpc({
            route: '/locations/search',
            params: {
                'select_value': res.data.input_select,
                'choice' : res.data.input_choice
            },
        }).then(function(res) {
                self.$el.find('svg').empty()
                self.$el.find('.o_nocontent_help').remove();
                if (!res) {
                    return self.$el.append(QWeb.render('GraphView.error', {
                        title: _t("No data to display"),
                        description: _t("Try to add some Quantity of the Products"),
                    }));
                }
                var root = res.data;
                var searchdata = res.qty;

                var diameter = 500,
                    format = d3.format(",d"),
                    color = d3.scale.category10();

                var bubble = d3.layout.pack().size([diameter, diameter]).padding(1.2); // .sort(null) -> sorts by the quantity

                var svg = d3.select("svg").attr("width", diameter).attr("height", diameter).attr("class", "bubble");

                var tooltip = d3.select("body").append("div")
                            .style("position", "absolute")
                            .style("z-index", "10")
                            .style("visibility", "hidden")
                            .style("color", "white")
                            .style("padding", "8px")
                            .style("background-color", "rgba(0, 0, 0, 0.75)")
                            .style("border-radius", "6px")
                            .style("font", "16px sans-serif")
                            .text("tooltip");

                var node = svg.selectAll(".node")
                            .data(bubble.nodes(classes(root))
                            .filter(function(d) { return !d.children; }))
                            .enter().append("g")
                            .attr("class", "node")
                            .attr("transform", function(d) {
                                return "translate(" + d.x + "," + d.y + ")" 
                            });

                node.append("circle").attr("r", function(d) { 
                    return d.r; 
                }).style("fill", function(d) { 
                    if (searchdata[0] == (String(searchdata[0]))){
                        return color(_.uniqueId('searchdata[0]'));
                    }
                }).on("mouseover", function(d) {
                    if (searchdata[0] == (String(searchdata[0]))){
                        for(var i=1; i<=res.qty.length; i++) {
                            tooltip.text(format(d.value) + " Products available");
                            tooltip.style("visibility", "visible");
                        }
                    }
                }).on("mousemove", function() {
                        return tooltip.style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");
                }).on("mouseout", function(){ 
                        return tooltip.style("visibility", "hidden");
                });

                node.append("text").attr("dy", ".1em").style("text-anchor", "middle").style("pointer-events", "none")
                    .text(function(d) {
                        return d.className.substring(0, d.r / 3); 
                    });

                function classes(root) {
                    var classes = [];
                    function recurse(name, node) {
                       if (node.children) { 
                            node.children.forEach(function(child) { 
                                recurse(node.Name, child); }); } else  { 
                                    classes.push({packageName: name, className: node.Name, value: node.Qty}); 
                                }
                    }
                    recurse(null, root);
                    return {children: classes};
                }
        });
    }

});

core.action_registry.add('graph', showGraph);

});
