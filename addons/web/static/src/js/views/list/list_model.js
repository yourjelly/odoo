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
            if (dp) {
                if (dp.groupData) {
                    result.groupData = $.extend(true, {}, dp.groupData);
                    result.evalModifiers = dp.evalModifiers;
                }
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
         * Overriden to consider `groupData` in `<groupby><button>` modifiers.
         *
         * @override
         * @private
         */
        _getEvalContext: function (element) {
            var result = this._super.apply(this, arguments);
            if (element.type === 'list' && element.groupData) {
                result = _.extend({}, result, element.groupData);
            }
            return result;
        },
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
            if (groupIds.length && groupFields.length) {
                return this._rpc({
                    model: groupedByField.relation,
                    method: 'read',
                    args: [groupIds, groupFields],
                    context: list.context,
                }).then(function (result) {
                    _.each(list.data, function (id) {
                        var dp = self.localData[id];
                        dp.groupData = _.findWhere(result, { id: dp.res_id });
                    });
                });
            }
            return Promise.resolve();
        },
    });
    return ListModel;
});
