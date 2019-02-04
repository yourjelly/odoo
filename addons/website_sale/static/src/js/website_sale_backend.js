odoo.define('website_sale.backend', function (require) {
"use strict";

var WebsiteBackend = require('website.backend.dashboard');

WebsiteBackend.include({
    events: _.defaults({
        'click tr.o_product_template': 'on_product_template',
        'click .js_utm_selector': '_onClickUtmButton',
    }, WebsiteBackend.prototype.events),

    init: function (parent, context) {
        this._super(parent, context);

        this.graphs.push({'name': 'sales', 'group': 'sale_salesman'});
    },
    /**
     * @override method from website backendDashboard
     * @private
     */
    render_graphs: function() {
        this._super();
        this.utmGraphData = this.dashboards_data.sales.utm_graph;
        this._renderUtmGraph();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Method used to generate Pie chart, depending on user selected UTM option(campaign, medium, source)
     *
     * @private
     */
    _renderUtmGraph: function() {
        var self = this;
        this.$(".utm_button_name").html(this.btnName); // change drop-down button name
        var utmDataType = this.utmType || 'campaign_id';
        var graphData = this.utmGraphData[utmDataType];
        if (graphData.length) {
            this.$(".o_utm_no_data_img").hide();
            this.$(".o_utm_data_graph").show();

            this.$(".o_utm_data_graph").empty();
            nv.addGraph(function() {
                var utmChart = nv.models.pieChart()
                    .x(function(d) {return d.utm_type; })
                    .y(function(d) {return d.amount_total; })
                    .showLabels(true)
                    .labelThreshold(0.1)
                    .labelType("percent")
                    .showLegend(false)
                    .margin({ "left": 0, "right": 0, "top": 0, "bottom": 0 })
                    .color(['#875a7b', '#21b799', '#E4A900', '#D5653E', '#5B899E', '#E46F78', '#8F8F8F']);

                utmChart.tooltip.valueFormatter(function(value, i) {
                    return self.render_monetary_field(value, self.data.currency);
                });

                var svg = d3.select(".o_utm_data_graph").append("svg");

                svg
                    .attr("height", "15em")
                    .datum(graphData)
                    .call(utmChart);

                nv.utils.windowResize(utmChart.update);
                return utmChart;
            });
        } else {
            this.$(".o_utm_no_data_img").show();
            this.$(".o_utm_data_graph").hide();
        }
    }, 

    on_product_template: function (ev) {
        ev.preventDefault();

        var product_tmpl_id = $(ev.currentTarget).data('productId');
        this.do_action({
            type: 'ir.actions.act_window',
            res_model: 'product.template',
            res_id: product_tmpl_id,
            views: [[false, 'form']],
            target: 'current',
        }, {
            on_reverse_breadcrumb: this.on_reverse_breadcrumb,
        });
    },
    
    _onClickUtmButton: function(ev) {
        this.utmType = $(ev.currentTarget).attr('name');
        this.btnName = $(ev.currentTarget).text();
        this._renderUtmGraph();
    },

});
return WebsiteBackend;

});
