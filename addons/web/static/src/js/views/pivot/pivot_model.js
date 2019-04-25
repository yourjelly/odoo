odoo.define('web.PivotModel', function (require) {
"use strict";

/**
 * Pivot Model
 *
 * The pivot model keeps an in-memory representation of the pivot table that is
 * displayed on the screen.  The exact layout of this representation is not so
 * simple, because a pivot table is at its core a 2-dimensional object, but
 * with a 'tree' component: some rows/cols can be expanded so we zoom into the
 * structure.
 *
 * However, we need to be able to manipulate the data in a somewhat efficient
 * way, and to transform it into a list of lines to be displayed by the renderer
 *
 * @todo add a full description/specification of the data layout
 */

var AbstractModel = require('web.AbstractModel');
var concurrency = require('web.concurrency');
var dataComparisonUtils = require('web.dataComparisonUtils');
var core = require('web.core');
var session = require('web.session');
var mathUtils = require('web.mathUtils');

var cartesian = mathUtils.cartesian;
var computeVariation = dataComparisonUtils.computeVariation;
var sections = mathUtils.sections;
var _t = core._t;

var PivotModel = AbstractModel.extend({
    /**
     * @override
     * @param {Object} params
     */
    init: function () {
        this._super.apply(this, arguments);
        this.numbering = {};
        this.data = null;
        this._loadDataDropPrevious = new concurrency.DropPrevious();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    addGroupBy: function (groupBy, type) {
        if (type === 'row') {
            this.data.rowGroupBys.push(groupBy);
        } else {
            this.data.colGroupBys.push(groupBy);
        }
    },
    /**
     * Close a group. This method is actually synchronous, but returns a
     * promise.
     *
     * @param {any} headerID
     * @returns {Promise}
     */
    closeGroup: function (groupId, type) {
        var groupBys;
        var group;
        var tree;
        if (type === 'row') {
            groupBys = this.data.rowGroupBys;
            tree = this.rowGroupTree;
            group = this._findGroup(this.rowGroupTree, groupId[0]);
        } else {
            groupBys = this.data.colGroupBys;
            tree = this.colGroupTree;
            group = this._findGroup(this.colGroupTree, groupId[1]);
        }
        group.directSubTrees = {};
        delete group.sortedKeys;
        var newGroupBysLength = this._getTreeHeight(tree) - 1;
        groupBys.splice(newGroupBysLength);
    },
    /**
     * @returns {Promise}
     */
    expandAll: function () {
        return this._loadData();
    },
    exportData: function () {
        var measureCount = this.data.measures.length;
        var originCount = this.data.origins.length;

        var headers = this.data.headers;

        // process headers
        var colGroupHeaderRows;
        var measureRow = [];
        var originRow = [];

        function processHeader (header) {
            var inTotalColumn = JSON.parse(header.groupId)[1].length === 0;
            var simplifiedHeader = _.pick(header, ['title', 'width', 'height']);
            simplifiedHeader.is_bold = !!header.measure && inTotalColumn;
            return simplifiedHeader;
        }

        if (originCount > 1) {
            colGroupHeaderRows = headers.slice(0, headers.length - 2);
            measureRow = headers[headers.length - 2].map(processHeader);
            originRow = headers[headers.length - 1].map(processHeader);
        } else {
            colGroupHeaderRows = headers.slice(0, headers.length - 1);
            if (measureCount > 1) {
                measureRow = headers[headers.length - 1].map(processHeader);
            }
        }

        // remove the empty headers on left side
        colGroupHeaderRows[0].splice(0,1);

        colGroupHeaderRows = colGroupHeaderRows.map(function (headerRow) {
            return headerRow.map(processHeader);
        });

        var rows = this.data.rows;

        // process rows
        var tableRows = rows.map(function (row) {
            return {
                title: row.title,
                indent: row.indent,
                values: row.subGroupMeasurements.map(function (measurement) {
                    var value = measurement.value;
                    if (value === undefined) {
                        value = "";
                    } else if (measurement.originIndexes.length > 1) {
                        // in that case the value is a variation and a
                        // number between 0 and 1
                        value = value * 100;
                    }
                    return {
                        is_bold: measurement.isBold,
                        value: value,
                    };
                }),
            };
        });

        return {
            col_group_headers: colGroupHeaderRows,
            measure_headers: measureRow,
            origin_headers: originRow,
            rows: tableRows,
            measure_count: measureCount,
            origin_count: originCount,
            row_groupbys: this.data.rowGroupBys,
            col_groupbys: this.data.colGroupBys,
        };
    },
    /**
     * Swap the columns and the rows.  It is a synchronous operation.
     */
    flip: function () {
        // swap the data: the main column and the main row
        var temp = this.rowGroupTree;
        this.rowGroupTree = this.colGroupTree;
        this.colGroupTree = temp;

        // we need to update the record metadata: row and col groupBys
        temp = this.data.rowGroupBys;
        this.data.rowGroupBys = this.data.colGroupBys;
        this.data.colGroupBys = temp;


        var self = this;
        function twistKey (key) {
            return JSON.stringify(JSON.parse(key).reverse());
        }

        var measurements = {};
        Object.keys(this.measurements).forEach(function (key) {
            var value = self.measurements[key];
            measurements[twistKey(key)] = value;
        });
        this.measurements = measurements;

        var counts = {};
        Object.keys(this.counts).forEach(function (key) {
            var value = self.counts[key];
            counts[twistKey(key)] = value;
        });
        this.counts = counts;

    },
    /**
     * @override
     * @param {Object} [options]
     * @param {boolean} [options.raw=false]
     * @returns {Object}
     */
    get: function (options) {
        options = options || {};
        var raw = options.raw || false;
        var state = {
            hasData: this.hasData,
            colGroupBys: this.data.colGroupBys,
            rowGroupBys:  this.data.rowGroupBys,
            measures: this.data.measures,
        };
        if (this.hasData) {
            state = _.extend(state, {
                domain: this.data.domain,
                context: this.data.context,
                fields: this.fields,
                rowGroupTree: this.rowGroupTree,
                colGroupTree: this.colGroupTree,
                measurements: this.measurements,
                origins: this.data.origins,
                sortedColumn: this.data.sortedColumn,
            });
        }
        if (!raw) {
            this._computeColHeaders();
            // need to be after _computeColHeaders
            this._computeRows();
            state.headers= this.data.headers;
            state.rows = this.data.rows;
        }

        return state;
    },
    /**
     * @override
     * @param {Object} params
     * @param {string[]} [params.groupedBy]
     * @param {string[]} [params.colGroupBys]
     * @param {string[]} params.domain
     * @param {string[]} params.rowGroupBys
     * @param {string[]} params.colGroupBys
     * @param {string[]} params.measures
     * @param {string[]} params.timeRange
     * @param {string[]} params.comparisonTimeRange
     * @param {string[]} params.timeRangeDescription
     * @param {string[]} params.comparisonTimeRangeDescription
     * @param {string[]} params.compare
     * @param {Object} params.fields
     * @param {string} params.default_order
     * @returns {Promise}
     */
    load: function (params) {
        this.initialDomain = params.domain;
        this.initialRowGroupBys = params.context.pivot_row_groupby || params.rowGroupBys;
        this.defaultGroupedBy = params.groupedBy;

        this.fields = params.fields;
        this.modelName = params.modelName;
        this.data = {
            domain: this.initialDomain,
            timeRange: params.timeRange || [],
            timeRangeDescription: params.timeRangeDescription || "",
            comparisonTimeRange: params.comparisonTimeRange || [],
            comparisonTimeRangeDescription: params.comparisonTimeRangeDescription || "",
            compare: params.compare || false,
            context: _.extend({}, session.user_context, params.context),
            groupedBy: params.context.pivot_row_groupby || params.groupedBy,
            colGroupBys: params.context.pivot_column_groupby || params.colGroupBys,
            measures: this._processMeasures(params.context.pivot_measures) || params.measures,
        };

        this.data.domains = this._getDomains();
        this.data.origins = this._getOrigins();
        this.data.rowGroupBys =  !_.isEmpty(this.data.groupedBy) ? this.data.groupedBy : this.initialRowGroupBys;

        var defaultOrder = params.default_order && params.default_order.split(' ');

        if (defaultOrder) {
            this.data.sortedColumn = {
                groupId: JSON.stringify([[],[]]),
                measure: defaultOrder[0],
                order: defaultOrder[1] ? defaultOrder [1] : 'asc',
            };
        }
        return this._loadData();
    },
    /**
     * @override
     * @param {any} handle this parameter is ignored
     * @param {Object} params
     * @returns {Promise}
     */
    reload: function (handle, params) {
        var self = this;
        if ('context' in params) {
            this.data.context = params.context;
            this.data.colGroupBys = params.context.pivot_column_groupby || this.data.colGroupBys;
            this.data.groupedBy = params.context.pivot_row_groupby || this.data.groupedBy;
            this.data.measures = this._processMeasures(params.context.pivot_measures) || this.data.measures;
            this.defaultGroupedBy = this.data.groupedBy.length ? this.data.groupedBy : this.defaultGroupedBy;
            var timeRangeMenuData = params.context.timeRangeMenuData;
            if (timeRangeMenuData) {
                this.data.timeRange = timeRangeMenuData.timeRange || [];
                this.data.timeRangeDescription = timeRangeMenuData.timeRangeDescription || "";
                this.data.comparisonTimeRange = timeRangeMenuData.comparisonTimeRange || [];
                this.data.comparisonTimeRangeDescription = timeRangeMenuData.comparisonTimeRangeDescription || "";
                this.data.compare = this.data.comparisonTimeRange.length > 0;
            } else {
                this.data.timeRange = [];
                this.data.timeRangeDescription = "";
                this.data.comparisonTimeRange = [];
                this.data.comparisonTimeRangeDescription = "";
                this.data.compare = false;
                this.data.context = _.omit(this.data.context, 'timeRangeMenuData');
            }
        }
        if ('domain' in params) {
            this.data.domain = params.domain;
        } else {
            this.data.domain = this.initialDomain;
        }
        if ('groupBy' in params) {
            this.data.groupedBy = params.groupBy.length ? params.groupBy : this.defaultGroupedBy;
        }

        this.data.domains = this._getDomains();
        this.data.origins = this._getOrigins();
        this.data.rowGroupBys =  !_.isEmpty(this.data.groupedBy) ? this.data.groupedBy : this.initialRowGroupBys;

        if (!this.data.hasData) {
            return this._loadData();
        }

        var oldRowGroupTree = this.rowGroupTree;
        var oldColGroupTree = this.colGroupTree;
        return this._loadData().then(function () {
            if (!('groupBy' in params) && !('pivot_row_groupby' in (params.context || {}))) {
                // we only update the row groupbys according to the old groupbys
                // if we don't have the key 'groupBy' in params.  In that case,
                // we want to have the full open state for the groupbys.
                self._pruneTree(self.rowGroupTree, oldRowGroupTree);
            }

            if (!('pivot_column_groupby' in (params.context || {}))) {
                self._pruneTree(self.colGroupTree, oldColGroupTree);
            }
        });
    },
    /**
     * Sort the rows, depending on the values of a given column.  This is an
     * in-memory sort.
     *
     * @param {any} col_id
     * @param {any} measure
     * @param {any} descending
     * @param {'data'|'comparisonData'|'variation'} [dataType]
     */
    sortTree: function (sortedColumn, tree) {
        var self = this;

        tree = tree || this.rowGroupTree;
        sortedColumn.originIndexes = sortedColumn.originIndexes || [0];

        var colGroupId = JSON.parse(sortedColumn.groupId);

        var sortFunction = function (tree) {
            return function (subTreeKey) {
                var subTree = tree.directSubTrees[subTreeKey];
                var groupIntersectionId = [subTree.root.value, colGroupId[1]];
                var value = self._getCellValue(
                    groupIntersectionId,
                    sortedColumn.measure,
                    sortedColumn.originIndexes
                ) || 0;
                return sortedColumn.order === 'asc' ? value : -value;
            };
        };

        this._sortTree(sortFunction, tree);

        this.data.sortedColumn = sortedColumn;
    },
    /**
     * Expand (open up) a given group, be it a row or a column.
     *
     * @todo: add discussion on the number of read_group that it will generate,
     * which is (r+1) or (c+1) I think
     *
     * @param {any} group
     * @param {any} divisors
     * @returns
     */
    subdivideGroup: function (group, divisors) {
        var self = this;

        var key = JSON.stringify([group.rowValue, group.colValue]);

        var proms = this.data.origins.reduce(
            function (acc, origin, originIndex) {
                // if no information on group content is available, we fetch data.
                // if group is known to be empty for the given origin,
                // we don't need to fetch data fot that origin.
                if (!self.counts[key] || self.counts[key][originIndex] > 0) {
                    var subGroup = {rowValue: group.rowValue, colValue: group.colValue, originIndex: originIndex};
                    divisors.forEach(function (divisor) {
                        acc.push(self._getGroupSubdivision(subGroup, divisor[0], divisor[1]));
                    });
                }
                return acc;
            },
            []
        );
        return this._loadDataDropPrevious.add(Promise.all(proms)).then(function (groupSubdivisions) {
            if (groupSubdivisions.length) {
                self._prepareData(group, groupSubdivisions);
            }
        });
    },
    /**
     * Toggle the active state for a given measure, then reload the data.
     *
     * @param {string} field
     * @returns {Promise}
     */
    toggleMeasure: function (field) {
        if (_.contains(this.data.measures, field)) {
            this.data.measures = _.without(this.data.measures, field);
            // in this case, we already have all data in memory, no need to
            // actually reload a lesser amount of information
            return Promise.resolve();
        } else {
            this.data.measures.push(field);
        }
        return this._loadData();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _addColGroupHeaders: function (tree, measureCount, originCount) {
        var self = this;

        var group = tree.root;
        var rowIndex = group.value.length;
        var row  = self.data.headers[rowIndex];

        var groupId = [[], group.value];
        var key = JSON.stringify(groupId);

        var isLeaf = _.isEmpty(tree.directSubTrees);
        var title = group.label[group.label.length - 1] || _t('Total');
        var width = tree.leafCount * measureCount * (2 * originCount - 1);
        var height = !isLeaf ? 1 : self.colGroupTree.height - rowIndex;

        var header = {
            title: title,
            width: width,
            height: height,
            groupId: key,
            isLeaf: isLeaf,
        };

        row.push(header);

        if (isLeaf) {
            self._addMeasureHeaders(key);
        }

        _.values(tree.directSubTrees).forEach(function (subTree) {
            self._addColGroupHeaders(subTree, measureCount, originCount);
        });
    },
    _addGroup: function (groupTree, label, value) {
        // this seems necessary. Else groupTree would be modified in the forEach!
        var tree = groupTree;
        // we assume here that the group with value value.slice(value.length - 2) has already been added.
        value.slice(0, value.length - 1).forEach(function (key) {
            tree = tree.directSubTrees[key];
        });
        tree.directSubTrees[value[value.length - 1]] = {
            root: {
                label: label,
                value: value,
            },
            directSubTrees: {},
        };
    },
    _addMeasureHeaders: function (groupId) {
        var self = this;
        var originCount = this.data.origins.length;
        var sortedColumn = this.data.sortedColumn || {};
        var measureRowIndex = self.data.headers.length - 1 - (originCount > 1 ? 1 : 0);
        var measureRow = self.data.headers[measureRowIndex];

        self.data.measures.forEach(function (measure) {
            var measureHeader = {
                title: self.fields[measure].string,
                measure: measure,
                groupId: groupId,
                width: 2 * originCount - 1,
                height: 1,
            };
            if (sortedColumn.groupId === groupId &&
                sortedColumn.measure === measure) {

                measureHeader.order = sortedColumn.order;
            }
            measureRow.push(measureHeader);
            if (originCount > 1) {
                self._addOriginHeaders(groupId, measure);
            }
        });
    },
    _addOriginHeaders: function (groupId, measure) {
        var self = this;
        var sortedColumn = this.data.sortedColumn || {};
        var originRowIndex = self.data.headers.length - 1;
        var originRow = self.data.headers[originRowIndex];

        this.data.origins.forEach(function (origin, originIndex) {
            var originHeader = {
                title: origin,
                originIndexes: [originIndex],
                groupId: groupId,
                measure: measure,
                width: 1,
                height: 1
            };
            if (sortedColumn.measure === measure &&
                sortedColumn.groupId === groupId &&
                !sortedColumn.originIndexes[1] &&
                sortedColumn.originIndexes[0] === originIndex) {

                originHeader.order = sortedColumn.order;
            }
            originRow.push(originHeader);

            if (originIndex > 0) {
                var variationHeader = {
                    title: _t('Variation'),
                    originIndexes: [originIndex - 1, originIndex],
                    groupId: groupId,
                    measure: measure,
                    width: 1,
                    height: 1,
                };
                if (sortedColumn.groupId === groupId &&
                    sortedColumn.measure === measure &&
                    sortedColumn.originIndexes[1] &&
                    sortedColumn.originIndexes[1] === originIndex) {

                    variationHeader.order = sortedColumn.order;
                }
                originRow.push(variationHeader);
            }
        });
    },
    _addRowGroupRows: function (tree) {
        var self = this;

        var group = tree.root;

        var rowGroupId = [group.value, []];
        var title = group.label[group.label.length - 1] || _t('Total');
        var indent = group.label.length;
        var isLeaf = _.isEmpty(tree.directSubTrees);

        var columnHeaders = this.data.headers[this.data.headers.length - 1];

        var subGroupMeasurements = columnHeaders.map(function (header) {
            var colGroupId = JSON.parse(header.groupId);
            var groupIntersectionId  = [rowGroupId[0], colGroupId[1]];
            var measure = header.measure;
            var originIndexes = header.originIndexes || [0];

            var value = self._getCellValue(
                groupIntersectionId,
                measure,
                originIndexes
            );

            var measurement = {
                groupId: JSON.stringify(groupIntersectionId),
                originIndexes: originIndexes,
                measure: measure,
                value: value,
                isBold: !groupIntersectionId[0].length || !groupIntersectionId[1].length,
            };
            return measurement;
        });

        var header = {
            title: title,
            groupId: JSON.stringify(rowGroupId),
            indent: indent,
            isLeaf: isLeaf,
            subGroupMeasurements: subGroupMeasurements
        };
        this.data.rows.push(header);

        var subTreeKeys = tree.sortedKeys || Object.keys(tree.directSubTrees);
        subTreeKeys.forEach(function (subTreeKey) {
            var subTree = tree.directSubTrees[subTreeKey];
            self._addRowGroupRows(subTree);
        });
    },
    _computeColHeaders: function () {

        this._computeTreeDimension(this.colGroupTree);

        var height = this.colGroupTree.height;
        var leafCount = this.colGroupTree.leafCount;
        var measureCount = this.data.measures.length;
        var originCount = this.data.origins.length;
        var rowCount = height + 1 + (originCount > 1 ? 1 : 0);

        // index heigth corresponds to the measures headers.
        // index heigth + 1 corresponds to origins/variation headers.
        this.data.headers = (new Array(rowCount)).fill(0).map(function () {
            return [];
        });

        this.data.headers[0].push({
            title: "",
            width: 1,
            height: rowCount,
        });

        this._addColGroupHeaders(this.colGroupTree, measureCount, originCount);

        // We want to represent the group 'Total' if there is more that one leaf.
        if (leafCount > 1) {
            var key = JSON.stringify([[],[]]);

            this.data.headers[0].push({
                title: "",
                groupId: key,
                width: measureCount * (2 * originCount - 1),
                height: height,
            });

            this._addMeasureHeaders(key);
        }

        return this.data.headers;
    },
    _computeRows: function () {
        this.data.rows = [];
        this._addRowGroupRows(this.rowGroupTree);
    },
    _computeTreeDimension: function (tree) {
        if (_.isEmpty(tree.directSubTrees)) {
            tree.height = 1;
            tree.leafCount = 1;
            return;
        }

        var self = this;
        var dimension = _.values(tree.directSubTrees).reduce(
            function (acc, subTree) {
                self._computeTreeDimension(subTree);
                return {
                    height: Math.max(acc.height, subTree.height),
                    leafCount: acc.leafCount + subTree.leafCount,
                };
            },
            {
                height: 1,
                leafCount: 0
            }
        );
        tree.height = dimension.height + 1;
        tree.leafCount = dimension.leafCount;
    },
    _findGroup: function (groupTree, value) {
        var tree = groupTree;
        value.slice(0, value.length).forEach(function (key) {
            tree = tree.directSubTrees[key];
        });
        return tree;
    },
    _getCellValue: function (groupId, measure, originIndexes) {
        var self = this;
        var key = JSON.stringify(groupId);
        if (!self.measurements[key]) {
            return;
        }
        var values = originIndexes.map(function (originIndex) {
            return self.measurements[key][originIndex][measure];
        });
        if (originIndexes.length > 1) {
            var variation =  computeVariation(values[0], values[1]);
            return variation.magnitude;
        } else {
            return values[0];
        }
    },
    /**
     * @private
     * @returns {Array[]}
     */
    _getDomains: function () {
        var domains = [this.data.domain.concat(this.data.timeRange)];
        if (this.data.compare) {
            domains.push(this.data.domain.concat(this.data.comparisonTimeRange));
        }
        return domains;
    },
    _getGroupDomain: function (group) {
        var self = this;
        function constructDomain (fieldName, val) {
            var type = self.fields[fieldName].type;
            if (_.contains(['date' , 'datetime'], type)) {
                var intervalBounds = val.split('/');
                return ['&', [fieldName, '>=', intervalBounds[0]], [fieldName, '<', intervalBounds[1]]];
            }
            return [[fieldName, '=', val]];
        }
        function domain (value, groupBys) {
            return value.reduce(
                function (acc, val, index) {
                    var fieldName = groupBys[index].split(':')[0];
                    acc = acc.concat(constructDomain(fieldName, val));
                    return acc;
                },
                []
            );
        }
        var rowDomain = domain(group.rowValue, this.data.rowGroupBys);
        var colDomain = domain(group.colValue, this.data.colGroupBys);
        var originDomain = this.data.domains[group.originIndex];
        return [].concat(rowDomain, colDomain, originDomain);
    },
    _getGroupSubdivision: function (group, rowGroupBy, colGroupBy) {
        var self = this;
        var groupDomain = this._getGroupDomain(group);
        var measures = this.data.measures.reduce(
            function(acc, measure) {
                if (measure === '__count') {
                    acc.push(measure);
                    return acc;
                }
                var type = self.fields[measure].type;
                var groupOperator = self.fields[measure].group_operator;
                if (type === 'many2one') {
                    groupOperator = 'count_distinct';
                }
                if (groupOperator === undefined) {
                    throw new Error("No aggregate function has been provided for the measure '" + measure + "'");
                }
                acc.push(measure + ':' + groupOperator);
                return acc;
            },
            []
        );
        var groupBy = rowGroupBy.concat(colGroupBy);
        return this._rpc({
            model: this.modelName,
            method: 'read_group',
            context: this.data.context,
            domain: groupDomain,
            fields: measures,
            groupBy: groupBy,
            lazy: false,
        }).then(function (subGroups) {
            return {
                group: group,
                subGroups: subGroups,
                rowGroupBy: rowGroupBy,
                colGroupBy: colGroupBy};
        });
    },
    _getLabel: function (group, fields) {
        var self = this;
        return fields.map(function (field) {
            return self._sanitizeLabel(group[field],field);
        });
    },
    _getMeasurements: function (group, fieldNames) {
        return fieldNames.reduce(
            function (measurements, fieldName) {
                var measurement = group[fieldName];
                if (measurement instanceof Array) {
                    // case field is many2one and used as measure and groupBy simultaneously
                    measurement = 1;
                }
                if (measurement instanceof Boolean) {
                    measurement = measurement ? 1 : 0;
                }
                if (!measurement) {
                    measurement = 0;
                }
                measurements[fieldName] = measurement;
                return measurements;
            },
            {}
        );
    },
    /**
     * @param {any} value
     * @param {any} field
     * @returns {string}
     */
    _getNumberedValue: function (value, field) {
        var id = value[0];
        var name = value[1];
        this.numbering[field] = this.numbering[field] || {};
        this.numbering[field][name] = this.numbering[field][name] || {};
        var numbers = this.numbering[field][name];
        numbers[id] = numbers[id] || _.size(numbers) + 1;
        return name + (numbers[id] > 1 ? "  (" + numbers[id] + ")" : "");
    },
    _getOrigins: function () {
        var origins = [this.data.timeRangeDescription || ""];
        if (this.data.compare) {
            origins.push(this.data.comparisonTimeRangeDescription);
        }
        return origins;
    },
    _getTreeHeight: function (tree) {
        var subTreeHeights = _.values(tree.directSubTrees).map(this._getTreeHeight.bind(this));
        return Math.max(0, Math.max.apply(null, subTreeHeights)) + 1;
    },
    _getGroupValue: function (group, fields) {
        var self = this;
        return fields.map(function (field) {
            return self._sanitizeValue(group[field],field);
        });
    },
    _loadData: function () {
        var self = this;

        this.rowGroupTree = {root: {label: [], value: []}, directSubTrees: {}};
        this.colGroupTree = {root: {label: [], value: []}, directSubTrees: {}};
        this.measurements = {};
        this.counts = {};

        var group = {rowValue: [], colValue: []};
        var leftDivisors = sections(this.data.rowGroupBys);
        var rightDivisors = sections(this.data.colGroupBys);
        var divisors = cartesian(leftDivisors, rightDivisors);

        return this.subdivideGroup(group, divisors.slice(0, 1)).then(function () {
            return self.subdivideGroup(group, divisors.slice(1)).then(function () {
                self.hasData = self.counts[JSON.stringify([[],[]])].some(function (count) {
                    return count > 0;
                });
            });
        });
    },
    _prepareData: function (group, groupSubdivisions) {
        var self = this;

        var groupRowValue = group.rowValue;
        var groupRowLabel = [];
        var rowSubTree = this.rowGroupTree;
        var root;
        if (groupRowValue.length) {
            rowSubTree = this._findGroup(this.rowGroupTree, groupRowValue);
            root = rowSubTree.root;
            groupRowLabel = root.label;
        }

        var groupColValue = group.colValue;
        var groupColLabel = [];
        if (groupColValue.length) {
            root = this._findGroup(this.colGroupTree, groupColValue).root;
            groupColLabel = root.label;
        }

        groupSubdivisions.forEach(function (groupSubdivision) {
            groupSubdivision.subGroups.forEach(function (subGroup) {

                var rowValue = groupRowValue.concat(self._getGroupValue(subGroup, groupSubdivision.rowGroupBy));
                var rowLabel = groupRowLabel.concat(self._getLabel(subGroup, groupSubdivision.rowGroupBy));

                var colValue = groupColValue.concat(self._getGroupValue(subGroup, groupSubdivision.colGroupBy));
                var colLabel = groupColLabel.concat(self._getLabel(subGroup, groupSubdivision.colGroupBy));

                if (!colValue.length && rowValue.length) {
                    self._addGroup(self.rowGroupTree, rowLabel, rowValue);
                }
                if (colValue.length && !rowValue.length) {
                    self._addGroup(self.colGroupTree, colLabel, colValue);
                }

                var key = JSON.stringify([rowValue, colValue]);
                var originIndex = groupSubdivision.group.originIndex;

                if (!(key in self.measurements)) {
                    self.measurements[key] = self.data.origins.map(function () {
                        return self._getMeasurements({}, self.data.measures);
                    });
                }
                self.measurements[key][originIndex] = self._getMeasurements(subGroup, self.data.measures);

                if (!(key in self.counts)) {
                    self.counts[key] = self.data.origins.map(function () {
                        return 0;
                    });
                }
                self.counts[key][originIndex] = subGroup.__count;
            });
        });

        if (this.data.sortedColumn) {
            this.sortTree(this.data.sortedColumn, rowSubTree);
        }
    },
    /**
     * In the preview implementation of the pivot view (a.k.a. version 2),
     * the virtual field used to display the number of records was named
     * __count__, whereas __count is actually the one used in xml. So
     * basically, activating a filter specifying __count as measures crashed.
     * Unfortunately, as __count__ was used in the JS, all filters saved as
     * favorite at that time were saved with __count__, and not __count.
     * So in order the make them still work with the new implementation, we
     * handle both __count__ and __count.
     *
     * This function replaces in the given array of measures occurences of
     * '__count__' by '__count'.
     *
     * @param {Array[string] || undefined} measures
     * @return {Array[string] || undefined}
     */
    _processMeasures: function (measures) {
        if (measures) {
            return _.map(measures, function (measure) {
                return measure === '__count__' ? '__count' : measure;
            });
        }
    },
    /**
     * @param {Object} tree
     * @param {Object} oldTree
     */
    _pruneTree: function (tree, oldTree) {
        if (_.isEmpty(oldTree.directSubTrees)) {
            tree.directSubTrees = {};
            return;
        }
        var self = this;
        Object.keys(tree.directSubTrees).forEach(function (subTreeKey) {
            var index = Object.keys(oldTree.directSubTrees).indexOf(subTreeKey);
            var subTree = tree.directSubTrees[subTreeKey];
            if (index === -1) {
                subTree.directSubTrees = {};
            } else {
                var oldSubTree = oldTree.directSubTrees[subTreeKey];
                self._pruneTree(subTree, oldSubTree);
            }
        });
    },
    _sanitizeLabel: function (value, field) {
        if (value === false) {
            return _t("Undefined");
        }
        if (value instanceof Array) {
            if (_.contains(['date', 'datetime'], this.fields[field.split(':')[0]].type)) {
                return value[1];
            } else {
                return this._getNumberedValue(value, field);
            }
        }
        if (field && this.fields[field] && (this.fields[field].type === 'selection')) {
            var selected = _.where(this.fields[field].selection, {0: value})[0];
            return selected ? selected[1] : value;
        }
        return value;
    },
    _sanitizeValue: function (value) {
        if (value instanceof Array) {
            return value[0];
        }
        return value;
    },
    _sortTree: function (sortFunction, tree) {
        var self = this;
        tree.sortedKeys = _.sortBy(Object.keys(tree.directSubTrees), sortFunction(tree));
        _.values(tree.directSubTrees).forEach(function (subTree) {
            self._sortTree(sortFunction, subTree);
        });
    },
});

return PivotModel;

});
