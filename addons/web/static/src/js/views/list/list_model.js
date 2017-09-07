odoo.define('web.ListModel', function (require) {
"use strict";

var BasicModel = require('web.BasicModel');

var ListModel = BasicModel.extend({
	/**
     * Load more records in a group.
     *
     * @param {string} groupID localID of the group
     * @returns {Deferred<string>} resolves to the localID of the group
     */
    loadMore: function (groupID) {
        var group = this.localData[groupID];
        var offset = group.loadMoreOffset + group.limit;
        return this.reload(group.id, {
            loadMoreOffset: offset,
        });
    },
    /**
     * @override
     */
    reload: function (id, options) {
        // if the groupBy is given in the options and if it is an empty array,
        // fallback on the default groupBy
        if (options && options.groupBy && !options.groupBy.length) {
            options.groupBy = this.defaultGroupedBy;
        }
        return this._super(id, options);
    },
});

return ListModel;
});
