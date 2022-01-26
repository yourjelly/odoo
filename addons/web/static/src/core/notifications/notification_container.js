/** @odoo-module **/

import { Notification } from "./notification";
import { Transition } from "@web/core/transition";

const { Component, xml } = owl;

export class NotificationContainer extends Component {
    setup() {
        // this works, but then this component cannot be unmounted, then
        // remounted. would need a destroyed hook different from willunmount
        this.props.bus.addEventListener("UPDATE", this.render.bind(this));
    }
}
NotificationContainer.template = xml`
    <div class="o_notification_manager">
        <t t-foreach="props.notifications" t-as="notification" t-key="notification.id">
            <!-- There is a transition when the notification appears but not when it disappears -->
            <Transition name="'o_notification_fade'" isVisible="true">
                <Notification t-props="notification.props"/>
            </Transition>
        </t>
    </div>`;
NotificationContainer.components = { Notification, Transition };
