import { kanbanView } from '@web/views/kanban/kanban_view';
import { ControlPanel } from "@web/search/control_panel/control_panel";

export class ProjectSharingControlPanel extends ControlPanel {}

ProjectSharingControlPanel.template  = "project.project_sharing_control_panel"

kanbanView.ControlPanel = ProjectSharingControlPanel;
