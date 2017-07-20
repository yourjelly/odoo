odoo.define('project.kanban', function (require) {
"use strict";

var core = require('web.core');
var field_utils = require('web.field_utils');
var KanbanView = require('web.KanbanView');
var KanbanModel = require('web.KanbanModel');
var KanbanRenderer = require('web.KanbanRenderer');
var KanbanController = require('web.KanbanController');
var session = require('web.session');
var view_registry = require('web.view_registry');

var QWeb = core.qweb;
var _t = core._t;
var _lt = core._lt;

var ProjectKanbanRenderer = KanbanRenderer.extend({
    events: _.extend({}, KanbanRenderer.prototype.events, {}),

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     * @returns {Deferred}
     */
    _render: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            var $ProgressBar = QWeb.render('project.KanbanProgressBar', {
                widget: self,
            });
            console.log($ProgressBar);
            jQuery($ProgressBar).insertAfter(self.$el.find('.o_kanban_header'));
        });
    },
});


// var ProjectKanbanController = KanbanController.extend({
//     // custom_events: _.extend({}, KanbanController.prototype.custom_events, {
//     // }),
// });

var ProjectKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Model: KanbanModel,
        Renderer: ProjectKanbanRenderer,
        Controller: KanbanController,
    }),
});

view_registry.add('project_kanban', ProjectKanbanView);

return {
    Model: KanbanModel,
    Renderer: ProjectKanbanRenderer,
    Controller: KanbanController,
};

});