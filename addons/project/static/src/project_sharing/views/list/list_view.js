/** @odoo-module */

import { listView } from "@web/views/list/list_view";

import { ProjectSharingListRenderer } from "./list_renderer";
import { ProjectSharingControlPanel } from '../../components/project_sharing_control_panel/project_sharing_control_panel';

const props = listView.props;
listView.props = function (genericProps, view) {
    const result = props(genericProps, view);
    return {
        ...result,
        allowSelectors: false,
    };
};
listView.Renderer = ProjectSharingListRenderer;
listView.ControlPanel = ProjectSharingControlPanel;
