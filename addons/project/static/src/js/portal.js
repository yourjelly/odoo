import { PortalGroupBy } from "@portal/js/portal";


PortalGroupBy.include({
    /**
     * @override
     */
    getModuleVals: function (ev) {
        if (this.model !== "task") {
            return this._super(...arguments);
        }
        return {
            route: "/my/grouptasks",
            template: "project.portal_task_list",
            multipleProject: ev.currentTarget.dataset.multipleProjects,
            getStatusClass: (state) => {
                return this.getStatusClass(state);
            },
        };
    },
    // classes to get style of status
    getStatusClass: function (state) {
        let status = "";
        if (["1_done", "1_canceled", "04_waiting_normal"].includes(state)) {
            status = "fa";
        } else {
            status = "o_status rounded-circle";
        }
        status += " ";
        if (state == "1_done") {
            status += "fa-check-circle text-success";
        } else if (state == "1_canceled") {
            status += "fa-times-circle text-danger";
        } else if (state == "02_changes_requested") {
            status += "bg-warning";
        } else if (state == "03_approved") {
            status += "bg-success";
        } else if (state == "04_waiting_normal") {
            status += "fa-hourglass-o";
        }
        return status;
    },
});
