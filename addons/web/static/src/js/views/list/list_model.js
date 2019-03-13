odoo.define('web.ListModel', function (require) {
    "use strict";

    var BasicModel = require('web.BasicModel');

    var ListModel = BasicModel.extend({

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        /**
         * Overriden to add `groupData` when performing get on list datapoints.
         *
         * @override
         * @see _readGroupExtraFields
         */
        get: function () {
            var result = this._super.apply(this, arguments);
            var dp = result && this.localData[result.id];
            if (dp && dp.groupData) {
                // TODO: not sure I need to deep copy it, it's a datapoint
                result.groupData = $.extend(true, {}, dp.groupData);
            }
            return result;
        },
        /**
         * @override
         * @param {Object} params.groups
         */
        load: function (params) {
            this.groups = params.groups;
            return this._super.apply(this, arguments);
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         *
         * @override
         * @private
         */
        _readGroup: function (list) {
            var self = this;
            return this._super.apply(this, arguments).then(function (result) {
                return self._readGroupExtraFields(list).then(_.constant(result));
            });
        },
        /**
         * Fetches group specific fields on the group by relation and stores it
         * in the column datapoint in a special key `groupData`.
         * Data for the groups are fetched in batch for all groups, to avoid
         * doing multiple calls.
         * Note that the option is only for m2o fields.
         *
         * @private
         * @param {Object} list
         * @returns {Promise}
         */
        _readGroupExtraFields: function (list) {
            var self = this;
            var groupByFieldName = list.groupedBy[0].split(':')[0];
            var groupedByField = list.fields[groupByFieldName];
            if (groupedByField.type !== 'many2one' || !this.groups[groupByFieldName]) {
                return Promise.resolve();
            }
            var groupIds = _.reduce(list.data, function (groupIds, id) {
                var resId = self.get(id, { raw: true }).res_id;
                if (resId) { // the field might be undefined when grouping
                    groupIds.push(resId);
                }
                return groupIds;
            }, []);
            var groupFields = Object.keys(this.groups[groupByFieldName].viewFields);
            var prom;
            if (groupIds.length && groupFields.length) {
                prom = this._rpc({
                    model: groupedByField.relation,
                    method: 'read',
                    args: [groupIds, groupFields],
                    context: list.context,
                });
            }
            return Promise.resolve(prom).then(function (result) {
                var fvg = self.groups[groupByFieldName];
                _.each(list.data, function (id) {
                    var dp = self.localData[id];
                    var groupData = result && _.findWhere(result, {
                        id: dp.res_id,
                    });
                    dp.groupData = self._makeDataPoint({
                        context: dp.context,
                        data: groupData,
                        fields: fvg.fields,
                        fieldsInfo: fvg.fieldsInfo,
                        modelName: groupedByField.relation,
                        parentID: dp.id,
                        res_id: dp.res_id,
                        viewType: 'groupby',
                    });
                });
            });
        },
    });
    return ListModel;
});
