odoo.define('project.state_selection', function(require) {
    'use strict';

    const { StateSelectionWidget } = require('web.basic_fields');
    const fieldRegistry = require('web.field_registry');

    // Widget used to display the label for the kanban_state field of project.task in list view.
    const ProjectStateSelectionWidget = StateSelectionWidget.extend({
        template: "project_state_selection",

        /**
         * @override
         */
        _render: function () {
            this._super.apply(this, arguments);
            const stateName = this.$('span.o_status').parent().attr('title');
            console.log(stateName);
            this.$('span.o_status_label').text(stateName);
        }
    });

    fieldRegistry.add('project_state_selection', ProjectStateSelectionWidget);

    return ProjectStateSelectionWidget;

});
