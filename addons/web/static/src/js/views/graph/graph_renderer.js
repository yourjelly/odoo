odoo.define('web.GraphRenderer', function (require) {
"use strict";

/**
 * The graph renderer turns the data from the graph model into a nice looking
 * canevas chart.  This code uses the Chart.js library.
 */

var AbstractRenderer = require('web.AbstractRenderer');
var config = require('web.config');
var core = require('web.core');
var dataComparisonUtils = require('web.dataComparisonUtils');
var fieldUtils = require('web.field_utils');

var _t = core._t;
var DateClasses = dataComparisonUtils.DateClasses;
var qweb = core.qweb;

var CHART_TYPES = ['pie', 'bar', 'line'];
// The given colors are the same as those used by D3
var D3_COLORS = ["#1f77b4","#ff7f0e","#aec7e8","#ffbb78","#2ca02c","#98df8a","#d62728",
                    "#ff9896","#9467bd","#c5b0d5","#8c564b","#c49c94","#e377c2","#f7b6d2",
                    "#7f7f7f","#c7c7c7","#bcbd22","#dbdb8d","#17becf","#9edae5"];
// used to format values in tooltips and yAxes.
var FORMAT_OPTIONS = {
    // allow to decide if utils.human_number should be used
    humanReadable: function (value) {
        return Math.abs(value) >= 1000;
    },
    // with the choices below, 1236 is represented by 1.24k
    minDigits: 1,
    decimals: 2,
    // avoid comma separators for thousands in numbers when human_number is used
    formatterCallback: function (str) {
        return str;
    },
};
// hide top legend when too many items for device size
var MAX_LEGEND_LENGTH = 4 * (Math.max(1, config.device.size_class));
var MAX_TOOLTIPS_LENGTH = 4 * (Math.max(1, config.device.size_class));

return AbstractRenderer.extend({
    className: "o_graph_renderer",
    /**
     * @override
     * @param {Widget} parent
     * @param {Object} state
     * @param {Object} params
     * @param {boolean} [params.isEmbedded]
     * @param {Object} [params.fields]
     * @param {string} [params.title]
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.isEmbedded = params.isEmbedded || false;
        this.title = params.title || '';
        this.fields = params.fields || {};

        this.chart = null;
        this.chartId = _.uniqueId('chart');
    },
    /**
     * The graph view uses the Chart.js lib to render the graph. This lib requires
     * that the rendering is done directly into the DOM (so that it can correctly
     * compute positions). However, the views are always rendered in fragments,
     * and appended to the DOM once ready (to prevent them from flickering). We
     * here use the on_attach_callback hook, called when the widget is attached
     * to the DOM, to perform the rendering. This ensures that the rendering is
     * always done in the DOM.
     *
     * @override
     */
    on_attach_callback: function () {
        this._super.apply(this, arguments);
        this.isInDOM = true;
        this._render();
    },
    /**
     * @override
     */
    on_detach_callback: function () {
        this._super.apply(this, arguments);
        this.isInDOM = false;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Filter out some dataPoints because they would lead to bad graphics.
     * The filtering is done with respect to the graph view mode.
     * Note that the method does not alter this.state.dataPoints, since we
     * want to be able to change of mode without fetching data again:
     * we simply present the same data in a different way.
     *
     * @private
     * @returns {Object[]}
     */
    _filterDataPoints: function () {
        var dataPoints = [];
        if (_.contains(['bar', 'pie'], this.state.mode)) {
            dataPoints = this.state.dataPoints.filter(function (dataPt) {
                return dataPt.count > 0;
            });
        } else if (this.state.mode === 'line') {
            var counts = 0;
            this.state.dataPoints.forEach(function (dataPt) {
                if (dataPt.labels[0] !== _t("Undefined")) {
                    dataPoints.push(dataPt);
                }
                counts += dataPt.count;
            });
            // data points with zero count might have been created on purpose
            // we only remove them if there are no data point with positive count
            if (counts === 0) {
                dataPoints = [];
            }
        }
        return dataPoints;
    },
    /**
     * Used to avoid too long legend items
     *
     * @private
     * @param {string} label
     * @returns {string} shortened version of the input label
     */
    _formatLabel: function (label) {
        var groups = label.split("/");
        var shortLabel = groups.slice(0,3).join("/");
        if (groups.length > 3) {
            shortLabel = shortLabel + '/...';
        }
        return shortLabel;
    },
    /**
     * Used to format correctly the values in tooltips and yAxes
     *
     * @private
     * @param {number} value
     * @returns {string} The value formatted using fieldUtils.format.float
     */
    _formatValue: function (value) {
        var measureField = this.fields[this.state.measure];
        var formatter = fieldUtils.format.float;
        var formatedValue = formatter(value, measureField, FORMAT_OPTIONS);
        return formatedValue;
    },
    /**
     * Used any time we need a new color in our charts.
     *
     * @private
     * @param {number} index, dataset index
     * @returns {string} a color in HEX format
     */
    _getColor: function (index) {
        return D3_COLORS[index % 20];
    },
    /**
     * determines the initial section of the labels array
     * over a dataset has to be completed. The section only depend
     * on the datasets origins.
     *
     * @private
     * @param {number} originIndex
     * @returns {number}
     */
    _getDatasetDataLength: function (originIndex, defaultLength) {
        if (_.contains(['bar', 'line'], this.state.mode) && this.state.comparisonFieldIndex === 0) {
            return this.dateSets[originIndex].length;
        }
        return defaultLength;
    },
    /**
     * Determines to which dataset belong the data point
     *
     * @private
     * @param {Object} dataPt
     * @returns {string}
     */
    _getDatasetLabel:function (dataPt) {
        if (_.contains(['bar', 'line'], this.state.mode)) {
            // ([origin] + second to last groupBys) or measure
            var datasetLabel = dataPt.labels.slice(1).join("/");
            if (this.state.origins.length > 1) {
                datasetLabel = this.state.origins[dataPt.originIndex] +
                                (datasetLabel ? ('/' + datasetLabel) : '');
            }
            datasetLabel = datasetLabel || this.fields[this.state.measure].string;
            return datasetLabel;
        }
        return this.state.origins[dataPt.originIndex];
    },
    /**
     * Determines the values taken by for state.comparisonField
     * by origins.
     *
     * @private
     * @param {Array} dataPoints
     * @returns {Array[]}
     */
    _getDateSets: function (dataPoints) {
        var self = this;
        var dateSets = this.state.origins.map(function () {
            return [];
        });
        dataPoints.forEach(function (dataPt) {
            dateSets[dataPt.originIndex].push(dataPt.labels[self.state.comparisonFieldIndex]);
        });
        return dateSets.map(function (dateSet) {
            return _.uniq(dateSet);
        });
    },
    /**
     * Returns a DateClasses instance used to manage equivalence of dates.
     *
     * @private
     * @returns {DateClasses}
     */
    _getDateClasses: function () {
        var interval = this.state.groupBy[this.state.comparisonFieldIndex].split(":")[1] || 'month';
        return new DateClasses(this.dateSets, interval);
    },
    /**
     * Determines over which label is the data point
     *
     * @private
     * @param {Object} dataPt
     * @returns {string}
     */
    _getLabel: function (dataPt) {
        var i = this.state.comparisonFieldIndex;
        if (_.contains(['bar', 'line'], this.state.mode)) {
            if (i === 0) {
                return this.dateClasses.representative(dataPt.originIndex, dataPt.labels[i]);
            } else {
                return dataPt.labels.slice(0, 1).join("/") || _t('Total');
            }
        } else if (i >= 0) {
            return dataPt.labels.slice(0, i).join('/') +
                    _.uniq(_.compact(this.dateClasses.dateClass(dataPt.originIndex, dataPt.labels[i]))) +
                    dataPt.labels.slice(i+1).join('/');
        } else {
            return dataPt.labels.join('/') || _t('Total');
        }
    },
    /**
     * The labelMapping object is used in pie chart mode to determine how to relabel a label according to
     * a given origin. The idea is that the getLabel function is in general not invertible but it is
     * when restricted to the set of dataPoints comming from a same origin.
     *
     * @private
     * @param {Object} dataPt
     * @returns {string}
     */
    _getLabelMapping: function (dataPoints) {
        var self = this;
        var labelMapping = {};
        var i = this.state.comparisonFieldIndex;
        if (this.state.mode === 'pie' && i >= 0) {
            var getRepresentative = function (dataPt, originIndex) {
                return  dataPt.labels.slice(0, i).join('/') +
                        self.dateClasses.representative(dataPt.originIndex, dataPt.labels[i], originIndex) +
                        dataPt.labels.slice(i + 1).join('/');
            };
            dataPoints.forEach(function (dataPt) {
                var label = self._getLabel(dataPt);
                if (!(label in labelMapping)) {
                    labelMapping[label] = {};
                    self.state.origins.forEach(function (origin, originIndex) {
                        labelMapping[label][originIndex] = getRepresentative(dataPt, originIndex);
                    });
                }
            });
        }
        return labelMapping;
    },
    /**
     * Returns the options used to generate the chart legend.
     *
     * @private
     * @param {number} datasetsCount
     * @returns {Object}
     */
    _getLegendOptions: function (datasetsCount) {
        var legendOptions = {
            display: datasetsCount <= MAX_LEGEND_LENGTH,
            position: config.device.size_class > config.device.SIZES.VSM ? 'right' : 'top',
        };
        var self = this;
        if (_.contains(['bar', 'line'], this.state.mode)) {
            var referenceColor;
            if (this.state.mode === 'bar') {
                referenceColor = 'backgroundColor';
            } else {
                referenceColor = 'borderColor';
            }
            legendOptions.labels = {
                generateLabels: function(chart) {
                    var data = chart.data;
                    return data.datasets.map(function(dataset, i) {
                        return {
                            text: self._formatLabel(dataset.label),
                            fillStyle: dataset[referenceColor],
                            hidden: !chart.isDatasetVisible(i),
                            lineCap: dataset.borderCapStyle,
                            lineDash: dataset.borderDash,
                            lineDashOffset: dataset.borderDashOffset,
                            lineJoin: dataset.borderJoinStyle,
                            lineWidth: dataset.borderWidth,
                            strokeStyle: dataset[referenceColor],
                            pointStyle: dataset.pointStyle,
                            datasetIndex: i,
                        };
                    });
                },
            };
        } else {
            legendOptions.labels = {
                generateLabels: function(chart) {
                    var data = chart.data;
                    var metaData = data.datasets.map(function (dataset, index) {
                        return chart.getDatasetMeta(index).data;
                    });
                    return data.labels.map(function(label, i) {
                        var hidden = metaData.reduce(
                            function (hidden, data) {
                                if (data[i]) {
                                    hidden = hidden || data[i].hidden;
                                }
                                return hidden;
                            },
                            false
                        );
                        return {
                            text: self._formatLabel(label),
                            fillStyle: label === _t('No data') ? '#d3d3d3' : self._getColor(i),
                            hidden: hidden,
                            index: i,
                        };
                    });
                },
            };
        }
        return legendOptions;
    },
    /**
     * Returns the options used to generate the chart axes.
     *
     * @private
     * @returns {Object}
     */
    _getScaleOptions: function () {
        if (_.contains(['bar', 'line'], this.state.mode)) {
            var self = this;
            return {
                xAxes: [{
                    type: 'category',
                    scaleLabel: {
                        display: this.state.groupBy.length && !this.isEmbedded,
                        labelString: this.state.groupBy.length ?
                                        this.fields[this.state.groupBy[0].split(':')[0]].string : '',
                    },
                }],
                yAxes: [{
                    type: 'linear',
                    scaleLabel: {
                        display: !this.isEmbedded,
                        labelString: this.fields[this.state.measure].string,
                    },
                    stacked: this.state.mode === 'bar' && this.state.stacked,
                    ticks: {
                        callback: function(value) {
                            return self._formatValue(value);
                        }
                    }
                }],
            };
        }
        return {};
    },
    /**
     * Returns the options used to generate chart tooltips.
     *
     * @private
     * @param {number} datasetsCount
     * @returns {Object}
     */
    _getTooltipOptions: function (datasetsCount) {
        var self = this;
        var tooltipOptions = {
            bodyFontColor: 'rgba(0,0,0,1)',
            titleFontSize: 13,
            titleFontColor: 'rgba(0,0,0,1)',
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderColor: 'rgba(0,0,0,0.2)',
            borderWidth: 1,
            callbacks: {
                title: function () {
                    return self.fields[self.state.measure].string;
                },
            },
        };
        if (_.contains(['bar', 'line'], this.state.mode)) {
            var referenceColor;
            if (this.state.mode === 'bar') {
                referenceColor = 'backgroundColor';
            } else {
                referenceColor = 'borderColor';
                // avoid too long tooltips
                var adaptMode = datasetsCount > MAX_TOOLTIPS_LENGTH;
                tooltipOptions = _.extend(tooltipOptions, {
                    mode: adaptMode ? 'nearest' : 'index',
                    intersect: false,
                    toolitemSort: function (tooltipItem1, tooltipItem2) {
                        return tooltipItem2.yLabel - tooltipItem1.yLabel;
                    },
                });
            }
            tooltipOptions.callbacks = _.extend(tooltipOptions.callbacks, {
                label: function (tooltipItem, data) {
                    var dataset = data.datasets[tooltipItem.datasetIndex];
                    var label = self._relabelling(tooltipItem.xLabel, dataset.originIndex);
                    if (self.state.groupBy.length > 1 || self.state.origins.length > 1) {
                        label = label + "/" + dataset.label;
                    }
                    label = label + ': ' + self._formatValue(tooltipItem.yLabel);
                    return label;
                },
                labelColor: function (tooltipItem, chart) {
                    var dataset = chart.data.datasets[tooltipItem.datasetIndex];
                    var tooltipBackgroundColor = dataset[referenceColor];
                    var tooltipBorderColor = chart.tooltip._model.backgroundColor;
                    return {
                        borderColor: tooltipBorderColor,
                        backgroundColor: tooltipBackgroundColor,
                    };
                },
            });
        } else {
            tooltipOptions.callbacks = _.extend(tooltipOptions.callbacks, {
                label: function (tooltipItem, data) {
                    var dataset = data.datasets[tooltipItem.datasetIndex];
                    var label = data.labels[tooltipItem.index];
                    if (label === _t('No data')) {
                        return dataset.label + "/" + label + ': ' + self._formatValue(0);
                    } else {
                        label = self._relabelling(label, dataset.originIndex);
                    }
                    if (self.state.origins.length > 1) {
                        label = dataset.label + "/" + label;
                    }
                    label = label + ': ' + self._formatValue(dataset.data[tooltipItem.index]);
                    return label;
                },
                labelColor: function (tooltipItem, chart) {
                    var dataset = chart.data.datasets[tooltipItem.datasetIndex];
                    var tooltipBackgroundColor = dataset.backgroundColor[tooltipItem.index];
                    var tooltipBorderColor = chart.tooltip._model.backgroundColor;
                    return {
                        borderColor: tooltipBorderColor,
                        backgroundColor: tooltipBackgroundColor,
                    };
                },
            });
        }
        return tooltipOptions;
    },
    /**
     * @private
     */
    _prepareCanvas: function () {
        var $canevasContainer = $('<div/>', {class: 'o_graph_canvas_container'});
        var $canevas = $('<canvas/>').attr('id', this.chartId);
        $canevasContainer.append($canevas);
        this.$el.append($canevasContainer);
    },
    /**
     * Mainly separate dataPoints comming from the read_group(s) into different datasets.
     * this function returns the parameters data and labels used to produce the charts.
     *
     * @private
     * @param {Object[]} dataPoints
     * @param {function} getLabel,
     * @param {function} getDatasetLabel, determines to which dataset belong a given data point
     * @param {function} [getDatasetDataLength], determines the initial section of the labels array
     *                    over which the datasets have to be completed. These sections only depend
     *                    on the datasets origins. Default is the constant function _ => labels.length.
     * @returns {Object} the paramater data used to instatiate the chart.
     */
    _prepareData: function (dataPoints) {
        var self = this;
        var labels = _.uniq(dataPoints.map(function (dataPt) {
            var label = self._getLabel(dataPt);
            return label;
        }));

        var newDataset = function (datasetLabel, originIndex) {
            var data = new Array(self._getDatasetDataLength(originIndex, labels.length)).fill(0);
            return {
                label: datasetLabel,
                data: data,
                originIndex: originIndex,
            };
        };

        // dataPoints --> datasets
        var datasets = _.values(dataPoints.reduce(
            function (acc, dataPt) {
                var datasetLabel = self._getDatasetLabel(dataPt);
                if (!(datasetLabel in acc)) {
                    acc[datasetLabel] = newDataset(datasetLabel, dataPt.originIndex);
                }
                var label = self._getLabel(dataPt);
                var labelIndex = labels.indexOf(label);
                acc[datasetLabel].data[labelIndex] = dataPt.value;
                return acc;
            },
            {}
        ));

        return {
            datasets: datasets,
            labels: labels,
        };
    },
    /**
     * Prepare options for the chart according to the current mode (= chart type).
     * This function returns the parameter options used to instantiate the chart
     *
     * @private
     * @param {number} datasetsCount
     * @returns {Object} the chart options used for the current mode
     */
    _prepareOptions: function (datasetsCount) {
        return {
            maintainAspectRatio: false,
            scales: this._getScaleOptions(),
            legend: this._getLegendOptions(datasetsCount),
            tooltips: this._getTooltipOptions(datasetsCount),
        };
    },
    _relabelling: function (label, originIndex) {
        var i = this.state.comparisonFieldIndex;
        if (_.contains(['bar', 'line'], this.state.mode) && i === 0) {
            return this.dateClasses.representative(this.dateClasses.referenceIndex, label, originIndex);
        } else if (this.state.mode === 'pie' && i >= 0) {
            return this.labelMapping[label][originIndex];
        }
        return label;
    },
    /**
     * Render the chart or display a message error in case data is not good enough.
     *
     * Note that This method is synchronous, but the actual rendering is done
     * asynchronously.  The reason for that is that Chart.js needs to be in the
     * DOM to correctly render itself.  So, we trick Odoo by returning
     * immediately, then we render the chart when the widget is in the DOM.
     *
     * @override
     * @private
     * @returns {Promise} The _super promise is actually resolved immediately
     */
    _render: function () {
        if (!_.contains(CHART_TYPES, this.state.mode)) {
            this.$el.empty();
            this.trigger_up('warning', {
                title: _t('Invalid mode for chart'),
                message: _t('Cannot render chart with mode : ') + this.state.mode
            });
        }
        var dataPoints = this._filterDataPoints();
        if (!dataPoints.length && this.state.mode !== 'pie') {
            this.$el.empty();
            this.$el.append(qweb.render('GraphView.error', {
                title: _t("No data to display"),
                description: _t("Try to add some records, or make sure that " +
                    "there is no active filter in the search bar."),
            }));
        } else if (this.isInDOM) {
            // only render the graph if the widget is already in the DOM (this
            // happens typically after an update), otherwise, it will be
            // rendered when the widget will be attached to the DOM (see
            // 'on_attach_callback')
            this.$el.empty();
            this._prepareCanvas();
            var i = this.state.comparisonFieldIndex;
            if (i === 0 || (i > 0 && this.state.mode === 'pie')) {
                this.dateSets = this._getDateSets(dataPoints);
                this.dateClasses = this._getDateClasses();
                this.labelMapping = this._getLabelMapping(dataPoints);
            }
            // if (this.chart) {
            //     this.chart.destroy();
            //     // we allow colors to be reused
            // }
            if (this.state.mode === 'bar') {
                this._renderBarChart(dataPoints);
            } else if (this.state.mode === 'line') {
                this._renderLineChart(dataPoints);
            } else if (this.state.mode === 'pie') {
                this._renderPieChart(dataPoints);
            }
            this._renderTitle();
        }
        return this._super.apply(this, arguments);
    },
    /**
     * create bar chart.
     *
     * @private
     * @param {Object[]} dataPoints
     */
    _renderBarChart: function (dataPoints) {
        var self = this;

        // style rectangles
        Chart.defaults.global.elements.rectangle.borderWidth = 1;

        // prepare data
        var data = this._prepareData(dataPoints);
        data.datasets.forEach(function (dataset, index) {
            // used when stacked
            dataset.stack = self.state.stacked ? self.state.origins[dataset.originIndex] : undefined;
            // set dataset color
            var color = self._getColor(index);
            dataset.backgroundColor = color;
        });

        // prepare options
        var options = this._prepareOptions(data.datasets.length);

        // create chart
        var ctx = document.getElementById(this.chartId);
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: options,
        });
    },
    /**
     * create line chart.
     *
     * @private
     * @param {Object[]} dataPoints
     */
    _renderLineChart: function (dataPoints) {
        var self = this;

        // style lines
        Chart.defaults.global.elements.line.tension = 0;
        Chart.defaults.global.elements.line.fill = false;

        // prepare data
        var data = this._prepareData(dataPoints);
        data.datasets.forEach(function (dataset, index) {
            if (self.state.groupBy.length <= 1 && self.state.origins.length > 1) {
                if (dataset.originIndex === 0) {
                    dataset.fill = 'origin';
                    dataset.backgroundColor = 'rgb(31,119,180, 0.4)';
                    dataset.borderColor = 'rgb(31,119,180, 1)';
                } else if (dataset.originIndex === 1) {
                    dataset.borderColor = 'rgb(255,127,14, 1)';
                } else {
                    dataset.borderColor = self._getColor(index);
                }
            } else {
                dataset.borderColor = self._getColor(index);
            }
            if (data.labels.length === 1) {
                // decalage of the real value to right. This is done to center the points in the chart
                // See data.labels below in Chart parameters
                dataset.data.unshift(undefined);
            }
            dataset.pointBackgroundColor = dataset.borderColor;
            dataset.pointBorderColor = 'rgba(0,0,0,0.2)';
        });
        // center the points in the chart (whithout that code they are put on the left and the graph seems empty)
        data.labels = data.labels.length > 1 ?
                        data.labels :
                        Array.prototype.concat.apply([], [[''], data.labels ,['']]);

        // prepare options
        var options = this._prepareOptions(data.datasets.length);

        // create chart
        var ctx = document.getElementById(this.chartId);
        this.chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: options,
        });
    },
    /**
     * create pie chart
     *
     * @private
     * @param {Object[]} dataPoints
     */
    _renderPieChart: function (dataPoints) {
        var self = this;

        // try to see if some pathologies are still present after the filtering
        var allNegative = true;
        var someNegative = false;
        var allZero = true;
        dataPoints.forEach(function (datapt) {
            allNegative = allNegative && (datapt.value < 0);
            someNegative = someNegative || (datapt.value < 0);
            allZero = allZero && (datapt.value === 0);
        });
        if (someNegative && !allNegative) {
            this.$el.empty();
            this.$el.append(qweb.render('GraphView.error', {
                title: _t("Invalid data"),
                description: _t("Pie chart cannot mix positive and negative numbers. " +
                    "Try to change your domain to only display positive results"),
            }));
            return;
        }
        if (allZero && !this.isEmbedded && this.state.origins.length === 1) {
            this.$el.empty();
            this.$el.append(qweb.render('GraphView.error', {
                title: _t("Invalid data"),
                description: _t("Pie chart cannot display all zero numbers.. " +
                    "Try to change your domain to display positive results"),
            }));
            return;
        }

        // prepare data
        var data = {};
        var colors = [];
        if (allZero) {
            colors = ['#d3d3d3'];
            // add fake data to display a pie chart with a grey zone associated
            // with every origin
            data.labels = [_t('No data')];
            data.datasets = this.state.origins.map(function (origin) {
                return {
                    label: origin,
                    data: [1],
                    backgroundColor: ['#d3d3d3'],
                };
            });
        } else {
            data = this._prepareData(dataPoints);
            // give same color to same groups from different origins
            colors = data.labels.map(function (label, index) {
                return self._getColor(index);
            });
            data.datasets.forEach(function (dataset) {
                dataset.backgroundColor = colors;
                dataset.borderColor = 'rgba(255,255,255,0.6)';
            });
            // sort by origin
            data.datasets = data.datasets.sort(function (dataset1, dataset2) {
                return dataset1.originIndex - dataset2.originIndex;
            });
            // make sure there is a zone associated with every origin
            var representedOriginIndexes = data.datasets.map(function (dataset) {
                return dataset.originIndex;
            });
            var addNoDataToLegend = false;
            var fakeData = (new Array(data.labels.length)).concat([1]);
            this.state.origins.forEach(function (origin, originIndex) {
                if (!_.contains(representedOriginIndexes, originIndex)) {
                    data.datasets.splice(originIndex, 0, {
                        label: origin,
                        data: fakeData,
                        backgroundColor: colors.concat(['#d3d3d3']),
                    });
                    addNoDataToLegend = true;
                }
            });
            if (addNoDataToLegend) {
                data.labels.push(_t('No data'));
                colors.push('#d3d3d3');
            }
        }

        // prepare options
        var options = this._prepareOptions(data.datasets.length);

        // create chart
        var ctx = document.getElementById(this.chartId);
        this.chart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: options,
        });
    },
    /**
     * Add the graph title (if any) above the canvas
     *
     * @private
     */
    _renderTitle: function () {
        if (this.title) {
            this.$('.o_graph_canvas_container').last().prepend($('<label/>', {
                text: this.title,
            }));
        }
    },
});
});
