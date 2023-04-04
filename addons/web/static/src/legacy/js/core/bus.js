/** @odoo-module **/

import Class from "./class";
import mixins from "./mixins";

/**
 * Event Bus used to bind events scoped in the current instance
 *
 * @class Bus
 */
export default Class.extend(mixins.EventDispatcherMixin, {
    init: function (parent) {
        mixins.EventDispatcherMixin.init.call(this);
        this.setParent(parent);
    },
});
