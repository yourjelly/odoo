/** @odoo-module **/

import ActivityView from '@mail/js/views/activity/activity_view';
import { ProjectControlPanel } from '@project/js/project_control_panel';
import viewRegistry from 'web.view_registry';

const ProjectActivityView = ActivityView.extend({
    config: _.extend({}, ActivityView.prototype.config, {
        ControlPanel: ProjectControlPanel,
    }),
});

viewRegistry.add('project_activity', ProjectActivityView);
