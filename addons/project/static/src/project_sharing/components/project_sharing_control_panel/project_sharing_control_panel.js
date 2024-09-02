import { kanbanView } from '@web/views/kanban/kanban_view';
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { ProjectSharingBreadcrumbs } from '../breadcrumbs/project_sharing_breadcrumbs';


export class ProjectSharingControlPanel extends ControlPanel {
	static components = {
        ...ControlPanel.components,
        ProjectSharingBreadcrumbs,
    };
}

ProjectSharingControlPanel.template = "project.project_sharing_control_panel";

kanbanView.ControlPanel = ProjectSharingControlPanel;
