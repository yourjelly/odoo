import { kanbanView } from '@web/views/kanban/kanban_view';
import { ControlPanel } from "@web/search/control_panel/control_panel";


export class ProjectSharingControlPanel extends ControlPanel {
    setup() {
        super.setup();
        this.breadcrumbs.unshift({
            name: 'project',
            url: '/my/projects',
            onSelected: () => {
                window.location.href = '/my/projects';
            },
        });
    }
}

kanbanView.ControlPanel = ProjectSharingControlPanel;
