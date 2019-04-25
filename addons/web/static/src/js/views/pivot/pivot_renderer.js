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
        this.state.headers.forEach(function (row) {
            var $tr = $('<tr>');
            row.forEach(function (cell) {
                var $cell = $('<th>').text(cell.title)
                                     .attr('colspan', cell.width)
                                     .attr('rowspan', cell.height)
                                     .data('groupId', cell.groupId)
                                     .data('type', 'col');

                var className;
                if (cell.measure) {
                    className = 'o_pivot_measure_row text-muted';
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
        var $row;
        var $cell;
        var $variation;
        var previousValue;
        var value;
        var variation;

        var groupbyLabels = _.map(this.state.rowGroupBys, function (gb) {
            return self.state.fields[gb.split(':')[0]].string;
        });

        var measureTypes = this.state.measures.reduce(
            function (acc, measureName) {
                var type = self.state.fields[measureName].type;
                acc[measureName] = type === 'many2one' ? 'integer' : type;
                return acc;
            },
            {}
        );

        this._traverseTree(this.state.rowGroupTree, function (subTree) {
            $row = $('<tr>');

            var root = subTree.root;
            var rowGroupId = [root.value, []];
            var title = root.label[root.label.length - 1] || _t('Total');
            var indent = root.label.length;
            var paddingLeft =  (5 +  indent * self.paddingLeftHeaderTabWidth) + 'px';
            var isLeaf = _.isEmpty(subTree.directSubTrees);

            var $header = $('<td>')
                .text(title)
                .data('id', JSON.stringify(rowGroupId))
                .data('type', 'row')
                .css('padding-left', paddingLeft)
                .addClass('o_pivot_header_cell_' +  (isLeaf ? 'closed': 'opened'));
            if (indent > 0) {
                $header.attr('title', groupbyLabels[indent - 1]);
            }
            $row.append($header);

            self.state.headers[self.state.headers.length - 1].forEach(
                function (row) {
                    var colGroupId = JSON.parse(row.groupId);
                    self.state.measures.forEach(function (measure) {
                        self.state.origins.forEach(function (origin, originIndex) {
                            var groupIntersectionId  = [rowGroupId[0], colGroupId[1]];
                            var key = JSON.stringify(groupIntersectionId);
                            $cell = $('<td>')
                                        .data('id', key)
                                        .data('originIndex', originIndex)
                                        .addClass('o_pivot_cell_value text-right');

                            var groupIntersectionMeasurements = self.state.measurements[key];
                            if (groupIntersectionMeasurements) {
                                var formatter = field_utils.format[self.fieldWidgets[measure] || measureTypes[measure]];
                                var measureField = self.state.fields[measure];
                                value = groupIntersectionMeasurements[originIndex][measure];
                                $cell.append($('<div>', {class: 'o_value'}).html(formatter(value, measureField)));
                                if (!groupIntersectionId[0].length || !groupIntersectionId[1].length) {
                                    $cell.css('font-weight', 'bold');
                                }
                            } else {
                                $cell.toggleClass('o_empty');
                            }
                            $row.append($cell);

                            if (originIndex > 0) {
                                $variation = $('<td>')
                                        .addClass('o_pivot_cell_value text-right');
                                if (groupIntersectionMeasurements) {
                                    variation = computeVariation(previousValue, value);
                                    var $div = $('<div>')
                                        .addClass('o_variation' + variation.signClass)
                                        .html(field_utils.format.percentage(variation.magnitude, measure));
                                    $variation.append($div);
                                }
                                else {
                                    $variation.toggleClass('o_empty');
                                }
                                $row.append($variation);
                            }
                            previousValue = value;
                        });
                    });
                }
            );
            $tbody.append($row);
        });
    },

// to remove
    /**
     * @private @static
     * @param {any} root
     * @param {any} f
     * @param {any} arg1
     * @param {any} arg2
     * @param {any} arg3
     * @returns
     */
    _traverseTree: function (tree, f, arg1, arg2, arg3) {
        var self = this;
        f(tree, arg1, arg2, arg3);

        var subTreeKeys = tree.sortedKeys || Object.keys(tree.directSubTrees);

        subTreeKeys.forEach(function (subTreeKey) {
            var subTree = tree.directSubTrees[subTreeKey];
            self._traverseTree(subTree, f, arg1, arg2, arg3);
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
