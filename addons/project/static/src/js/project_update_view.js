/** @odoo-module **/

import KanbanController from 'web.KanbanController';
import KanbanRenderer from 'web.KanbanRenderer';
import KanbanView from 'web.KanbanView';
import { ComponentWrapper } from 'web.OwlCompatibility';
import viewRegistry from 'web.view_registry';
import ProjectRightSidePanel from '@project/js/components/project_right_panel';

const ProjectUpdateKanbanRenderer = KanbanRenderer.extend({
    /**
     * The rendering is asynchronous. The start
     * method simply makes sure that we render the view.
     *
     * @returns {Promise}
     */
    async start() {
        this.$el.addClass('o_renderer_with_rightpanel');
        await Promise.all([this._render(), this._super()]);
    },
});

const ProjectUpdateKanbanController = KanbanController.extend({
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);
        this.rightSidePanel = params.rightSidePanel;
    },
    /**
     * @override
     */
    start: async function () {
        const promises = [this._super(...arguments)];
        this._rightPanelWrapper = new ComponentWrapper(this, this.rightSidePanel.Component, this.rightSidePanel.props);
        const content = this.el.querySelector(':scope .o_content');
        content.classList.add('o_controller_with_rightpanel');
        promises.push(this._rightPanelWrapper.mount(content, { position: 'last-child' }));
        await Promise.all(promises);
    },
    async _update() {
        this._rightPanelWrapper.update(this.rightSidePanel.props);
        await this._super.apply(this, arguments);
    }
});

export const ProjectUpdateKanbanView = KanbanView.extend({
    searchMenuTypes: ['filter', 'favorite'],
    config: _.extend({}, KanbanView.prototype.config, {
        Controller: ProjectUpdateKanbanController,
        Renderer: ProjectUpdateKanbanRenderer,
        RightSidePanel: ProjectRightSidePanel,
    }),
    _createSearchModel: function (params) {
        const result = this._super.apply(this, arguments);
        const props = {
            action: params.action,
        };
        this.controllerParams.rightSidePanel = {
            Component: this.config.RightSidePanel,
            props: props,
        };
        return result;
    }
});

viewRegistry.add('project_update_kanban', ProjectUpdateKanbanView);
