import { PortalGroupBy } from "@portal/js/portal";
import { registry } from "@web/core/registry";

PortalGroupBy.include({
    /**
     * @override
     */
    getModuleVals: function (ev) {
        const vals = this._super(...arguments);
        if (this.model !== "task") {
            return vals
        }
        const float_time = registry.category("formatters").get("float_time")
        vals.formatFloatTime = (data)=> float_time(data)
        return vals
    },
});
