odoo.define('web.PivotRenderer', function (require) {
"use strict";

var AbstractRenderer = require('web.AbstractRenderer');
var config = require('web.config');
var core = require('web.core');
var dataComparisonUtils = require('web.dataComparisonUtils');
var field_utils = require('web.field_utils');

var _t = core._t;
var computeVariation = dataComparisonUtils.computeVariation;
var QWeb = core.qweb;

var PivotRenderer = AbstractRenderer.extend({
    tagName: 'table',
    className: 'table-hover table-sm table-bordered',
    events: _.extend({}, AbstractRenderer.prototype.events, {
        'hover td': '_onTdHover',
    }),

    /**
     * @overide
     *
     * @param {Widget} parent
     * @param {Object} state
     * @param {Object} params
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.fieldWidgets = params.widgets || {};
        this.paddingLeftHeaderTabWidth = config.device.isMobile ? 5 : 30;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------


    /**
     * Used to determine whether or not to display the no content helper.
     *
     * @private
     * @returns {boolean}
     */
    _hasContent: function () {
        return this.state.hasData && this.state.measures.length;
    },
    /**
     * @override
     * @private
     * @returns {Promise}
     */
    _render: function () {
        if (!this._hasContent()) {
            // display the nocontent helper
            this._replaceElement(QWeb.render('PivotView.nodata'));
            return this._super.apply(this, arguments);
        }

        var $fragment = $(document.createDocumentFragment());
        var $table = $('<table>').appendTo($fragment);
        var $thead = $('<thead>').appendTo($table);
        var $tbody = $('<tbody>').appendTo($table);

        this._renderHeaders($thead);
        this._renderRows($tbody);

        // todo: make sure the next line does something
        $table.find('.o_pivot_header_cell_opened,.o_pivot_header_cell_closed').tooltip();

        if (!this.$el.is('table')) {
            // coming from the no content helper, so the root element has to be
            // re-rendered before rendering and appending its content
            this.renderElement();
        }
        this.$el.html($table.contents());
        return this._super.apply(this, arguments);
    },
    /**
     * @private
     * @param {jQuery} $thead
     */
    _renderHeaders: function ($thead) {
        // FIXME: missing title on non-total non-measure non-origin header rows
        this.state.headers.forEach(function (row) {
            var $tr = $('<tr>');
            row.forEach(function (cell) {
                var $cell = $('<th>').text(cell.title)
                                     .attr('colspan', cell.width)
                                     .attr('rowspan', cell.height)
                                     .data('groupId', cell.groupId)
                                     .data('originIndexes', cell.originIndexes)
                                     .data('type', 'col');

                var className;
                if (cell.measure) {
                    if (cell.originIndexes) {
                        className = 'o_pivot_origin_row';
                    } else {
                        className = 'o_pivot_measure_row';
                    }
                    className += ' text-muted';
                    if (cell.order) {
                        className += ' o_pivot_sort_order_' + cell.order;
                        if (cell.order === 'asc') {
                            $cell.attr('aria-sorted', 'ascending');
                        } else {
                            $cell.attr('aria-sorted', 'descending');
                        }
                    }
                    $cell.data('measure', cell.measure);
                } else if (cell.title) {
                    className = 'o_pivot_header_cell_' + (cell.isLeaf ? 'closed' : 'opened');
                }
                $cell.addClass(className);

                $tr.append($cell);
            });
            $thead.append($tr);
        });
    },
    /**
     * @private
     * @param {jQueryElement} $thead
     * @param {jQueryElement} headers
     */
    _renderHeadersOld: function ($thead, headers) {
        // What is this class used for?
        // $cell.toggleClass('d-none d-md-table-cell', (cell.expanded !== undefined) || (cell.measure !== undefined && j < headers[i].length - this.state.measures.length));
    },
    _renderRows: function ($tbody) {
        var self = this;

        // measureTypes is a mapping from measure fields to their field type,
        // with a special case for many2one fields which are mapped to the
        // 'integer' type (as their group_operator is 'count_distinct')
        var measureTypes = this.state.measures.reduce(
            function (acc, measureName) {
                var type = self.state.fields[measureName].type;
                acc[measureName] = type === 'many2one' ? 'integer' : type;
                return acc;
            },
            {}
        );

        // groupbyLabels is the list of row groupby fields label
        var groupbyLabels = _.map(this.state.rowGroupBys, function (gb) {
            return self.state.fields[gb.split(':')[0]].string;
        });

        this.state.rows.forEach(function (row) {
            var $tr = $('<tr>');
            var paddingLeft = 5 + row.indent * self.paddingLeftHeaderTabWidth;
            $tr.append($('<td>')
                            .text(row.title)
                            .attr('title', row.indent > 0 ? groupbyLabels[row.indent - 1] : null)
                            .data('groupId', row.groupId)
                            .data('type', 'row')
                            .css('padding-left', paddingLeft + 'px')
                            .addClass('o_pivot_header_cell_' + (row.isLeaf ? 'closed' : 'opened')));
            row.subGroupMeasurements.forEach(function (measurement) {
                var $cell = $('<td>')
                                .data('groupId', measurement.groupId)
                                .data('originIndexes', measurement.originIndexes)
                                .addClass('o_pivot_cell_value text-right');

                if (measurement.isBold) {
                    $cell.css('font-weight', 'bold');
                }

                if (measurement.value !== undefined) {
                    var measure = measurement.measure;
                    var measureField = self.state.fields[measure];
                    var className;
                    var value;
                    if (measurement.originIndexes.length > 1) {
                        className = 'o_variation';
                        if (measurement.value > 0) {
                            className += ' o_positive';
                        } else if (measurement.value < 0) {
                            className += ' o_negative';
                        }
                        value = field_utils.format.percentage(measurement.value, measureField);
                    } else {
                        className = 'o_value';
                        var formatType = self.fieldWidgets[measure] || measureTypes[measure];
                        value = field_utils.format[formatType](measurement.value, measureField);
                    }
                    $cell.append($('<div>', {class: className}).html(value));
                } else {
                    $cell.addClass('o_empty');
                }

                $tr.append($cell);
            });
            $tbody.append($tr);
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    // Did not work. We should make it work again!
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onTdHover: function (ev) {
        var $td = $(event.target);
        $td.closest('table').find('col:eq(' + $td.index()+')').toggleClass('hover');
    },
});

return PivotRenderer;
});
