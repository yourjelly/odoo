odoo.define('web.AbstractAction', function (require) {
"use strict";

/**
 * We define here the AbstractAction widget, which implements the ActionMixin.
 * All client actions must extend this widget.
 *
 * @module web.AbstractAction
 */

var ActionMixin = require('web.ActionMixin');
var ControlPanelView = require('web.ControlPanelView');
var Widget = require('web.Widget');

var AbstractAction = Widget.extend(ActionMixin, {
    config: {
        ControlPanelView: ControlPanelView,
    },
    hasControlPanel: false,
    loadControlPanel: false,

    init: function (parent, action, options) {
        this._super(parent);
        this._title = action.display_name || action.name;
        this.controlPanelParams = {
            actionId: action.id,
            context: action.context,
            breadcrumbs: options && options.breadcrumbs || [],
            viewId: action.search_view_id && action.search_view_id[0],
        };
    },
    willStart: function () {
        var self = this;
        if (this.hasControlPanel) {
            var params = this.controlPanelParams;
            var def;
            if (this.loadControlPanel) {
                def = this
                    .loadFieldView(params.modelName, params.context || {}, params.viewId, 'search')
                    .then(function (fieldsView) {
                        params.viewInfo = {
                            arch: fieldsView.arch,
                            fields: fieldsView.fields,
                        };
                    });
            }
            return $.when(def).then(function () {
                var controlPanelView = new self.config.ControlPanelView(params);
                return controlPanelView.getController(self).then(function (controlPanel) {
                    self._controlPanel = controlPanel;
                    return self._controlPanel.appendTo(document.createDocumentFragment());
                });
            });
        }
        return $.when();
    },
    start: function () {
        if (this._controlPanel) {
            this._controlPanel.$el.prependTo(this.$el);
        }
        return this._super.apply(this, arguments);
    },
});

return AbstractAction;

});
