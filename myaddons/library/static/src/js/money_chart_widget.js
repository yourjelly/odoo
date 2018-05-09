odoo.define('library.MoneyChartWidget', function (require) {
    "use strict";
    
    var ajax = require('web.ajax');
    var Widget = require('web.Widget');
    
    // var QWeb = core.qweb;
    // var _t = core._t;
    
    
    var MoneyChartWidget = Widget.extend({
        tagName: 'canvas',
        jsLibs: ['/library/static/lib/chart.js/Chart.js'],
    
        /**
         * @override
         */
        init: function (parent, data) {
            this._super.apply(this, arguments);
            this.data = data;
        },
        /**
         * @override
         */
        willStart: function () {
            return $.when(ajax.loadLibs(this), this._super.apply(this, arguments));
        },
        /**
         * @override
         */
        start: function () {
            this._renderChart();
            return this._super.apply(this, arguments);
        },
    
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
    
        /**
         * Renders the chart
         *
         * @private
         */
        _renderChart: function () {
            var self = this;
            new Chart(this.el, {
                type: 'bar',
                data: {
                    labels: ["Benefit", "Income", "Money Lost"],
                    datasets: [{
                        label: 'Library Finance',
                        data: [
                            this.data.benefit,
                            this.data.income,
                            this.data.money_lost,
                        ],
                        backgroundColor: [
                            'rgba(75, 192, 192, 0.2)',
                            'rgba(54, 162, 235, 0.2)',
                            'rgba(255, 99, 132, 0.2)',
                        ],
                        borderColor: [
                            'rgba(75, 192, 192, 1)',
                            'rgba(54, 162, 235, 1)',
                            'rgba(255,99,132,1)',
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero:true
                            }
                        }]
                    }
                }
            });
        },
    });
    
    return MoneyChartWidget;
    
    });