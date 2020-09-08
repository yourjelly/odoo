odoo.define('poc.PivotView', function (require) {
    "use strict";

    const OwlAbstractRenderer = require('web.AbstractRendererOwl');
    const field_utils = require('web.field_utils');
    const patchMixin = require('web.patchMixin');

    const { useModel } = require("web/static/src/js/model.js");

    const { useExternalListener, useState, onMounted, onPatched } = owl.hooks;

    /**
     * Here is a basic example of the structure of the Pivot Table:
     *
     * ┌─────────────────────────┬─────────────────────────────────────────────┬─────────────────┐
     * │                         │ - web.PivotHeader                           │                 │
     * │                         ├──────────────────────┬──────────────────────┤                 │
     * │                         │ + web.PivotHeader    │ + web.PivotHeader    │                 │
     * ├─────────────────────────┼──────────────────────┼──────────────────────┼─────────────────┤
     * │                         │ web.PivotMeasure     │ web.PivotMeasure     │                 │
     * ├─────────────────────────┼──────────────────────┼──────────────────────┼─────────────────┤
     * │ ─ web.PivotHeader       │                      │                      │                 │
     * ├─────────────────────────┼──────────────────────┼──────────────────────┼─────────────────┤
     * │    + web.PivotHeader    │                      │                      │                 │
     * ├─────────────────────────┼──────────────────────┼──────────────────────┼─────────────────┤
     * │    + web.PivotHeader    │                      │                      │                 │
     * └─────────────────────────┴──────────────────────┴──────────────────────┴─────────────────┘
     *
     */

    class PivotView extends OwlAbstractRenderer {
        /**
         * @override
         * @param {boolean} props.disableLinking Disallow opening records by clicking on a cell
         * @param {Object} props.widgets Widgets defined in the arch
         */
        constructor() {
            super(...arguments);

            this.sampleDataTargets = ['table'];
            this.state = useState({
                activeNodeHeader: {
                    groupId: false,
                    isXAxis: false,
                    click: false
                },
            });

            this.model = useModel("model");

            onMounted(() => this._updateTooltip());

            onPatched(() => this._updateTooltip());

            if (!this.env.device.isMobile) {
                useExternalListener(window, 'click', this._resetState);
            }
        }

        get modelState() {
            return this.model.get("state");
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * Get the formatted value of the cell
         *
         * @private
         * @param {Object} cell
         * @returns {string} Formatted value
         */
        _getFormattedValue(cell) {
            const type = this.props.widgets[cell.measure] ||
                (this.modelState.fields[cell.measure].type === 'many2one' ? 'integer' : this.modelState.fields[cell.measure].type);
            const formatter = field_utils.format[type];
            return formatter(cell.value, this.modelState.fields[cell.measure]);
        }

        /**
         * Get the formatted variation of a cell
         *
         * @private
         * @param {Object} cell
         * @returns {string} Formatted variation
         */
        _getFormattedVariation(cell) {
            const value = cell.value;
            return isNaN(value) ? '-' : field_utils.format.percentage(value, this.modelState.fields[cell.measure]);
        }

        /**
         * Retrieves the padding of a left header
         *
         * @private
         * @param {Object} cell
         * @returns {Number} Padding
         */
        _getPadding(cell) {
            return 5 + cell.indent * 30;
        }

        /**
         * Compute if a cell is active (with its groupId)
         *
         * @private
         * @param {Array} groupId GroupId of a cell
         * @param {Boolean} isXAxis true if the cell is on the x axis
         * @returns {Boolean} true if the cell is active
         */
        _isClicked(groupId, isXAxis) {
            return _.isEqual(groupId, this.state.activeNodeHeader.groupId) && this.state.activeNodeHeader.isXAxis === isXAxis;
        }

        /**
         * Reset the state of the node.
         *
         * @private
         */
        _resetState() {
            // This check is used to avoid the destruction of the dropdown.
            // The click on the header bubbles to window in order to hide
            // all the other dropdowns (in this component or other components).
            // So we need isHeaderClicked to cancel this behaviour.
            if (this.isHeaderClicked) {
                this.isHeaderClicked = false;
                return;
            }
            this.state.activeNodeHeader = {
                groupId: false,
                isXAxis: false,
                click: false
            };
        }

        /**
         * Configure the tooltips on the headers.
         *
         * @private
         */
        _updateTooltip() {
            $(this.el).find('.o_pivot_header_cell_opened, .o_pivot_header_cell_closed').tooltip();
        }

        //----------------------------------------------------------------------
        // Handlers
        //----------------------------------------------------------------------


        _onCellClick(cell) {
            if (cell.value === undefined || this.props.disableLinking) {
                return;
            }

            const context = Object.assign({}, this.modelState.context);
            Object.keys(context).forEach(x => {
                if (x === 'group_by' || x.startsWith('search_default_')) {
                    delete context[x];
                }
            });

            const group = {
                rowValues: cell.groupId[0],
                colValues: cell.groupId[1],
                originIndex: cell.originIndexes[0]
            };

            const domain = this.model.get('groupDomain', group);
            this.env.bus.trigger('do-action', {
                action: {
                    type: 'ir.actions.act_window',
                    name: this.props.title,
                    res_model: this.props.modelName,
                    views: this.props.views,
                    view_mode: 'list',
                    target: 'current',
                    context: context,
                    domain: domain,
                },
            });
        }

        /**
         * Handles a click on a menu item in the dropdown to select a groupby.
         *
         * @private
         * @param {Object} field
         * @param {string} interval
         */
        _onClickMenuGroupBy(field, interval) {
            let groupBy = field.name;
            if (interval) {
                groupBy = groupBy + ':' + interval;
            }
            this.model.dispatch('addGroupBy', groupBy, this.selectedGroup);
        }


        /**
         * Handles a click on a header node
         *
         * @private
         * @param {Object} cell
         * @param {string} type col or row
         */
        _onHeaderClick(cell, type) {
            const state = this.modelState;
            const groupValues = cell.groupId[type === 'col' ? 1 : 0];
            const groupByLength = type === 'col' ? state.colGroupBys.length : state.rowGroupBys.length;
            if (cell.isLeaf && groupValues.length >= groupByLength) {
                this.isHeaderClicked = true;
                this.state.activeNodeHeader = {
                    groupId: cell.groupId,
                    isXAxis: type === 'col',
                    click: 'leftClick'
                };
            }

            if (cell.isLeaf) {
                const group = {
                    rowValues: cell.groupId[0],
                    colValues: cell.groupId[1],
                    type
                };

                const groupValues = type === 'row' ? cell.groupId[0] : cell.groupId[1];
                const groupBys = type === 'row' ? state.rowGroupBys : state.colGroupBys;
                this.selectedGroup = group;
                if (groupValues.length < groupBys.length) {
                    const groupBy = groupBys[groupValues.length];
                    this.model.dispatch('expandGroup', this.selectedGroup, groupBy);
                }
            } else {
                this.model.dispatch('closeGroup', cell.groupId, type);
            }
        }

        _onMeasureClick(cell) {
            this.model.dispatch('sortRows', {
                groupId: cell.groupId,
                measure: cell.measure,
                order: (cell.order || 'desc') === 'asc' ? 'desc' : 'asc',
                originIndexes: cell.originIndexes,
            });
        }

        /**
         * Hover the column in which the mouse is.
         *
         * @private
         * @param {MouseEvent} ev
         */
        _onMouseEnter(ev) {
            var index = [...ev.currentTarget.parentNode.children].indexOf(ev.currentTarget);
            if (ev.currentTarget.tagName === 'TH') {
                index += 1;
            }
            this.el.querySelectorAll('td:nth-child(' + (index + 1) + ')').forEach(elt => elt.classList.add('o_cell_hover'));
        }

        /**
         * Remove the hover on the columns.
         *
         * @private
         */
        _onMouseLeave() {
            this.el.querySelectorAll('.o_cell_hover').forEach(elt => elt.classList.remove('o_cell_hover'));
        }
    }

    PivotView.template = 'poc.PivotView';

    return patchMixin(PivotView);

});
