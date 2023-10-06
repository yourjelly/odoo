/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { ShareBar } from "@social_share/share_post/share_post_share_button";
import { useService } from "@web/core/utils/hooks";

import { Component, onWillStart, useState } from "@odoo/owl";

class SharePost extends Component {
    static components = {
        ShareBar,
    };
    static template = "social_share.SharePost";

    setup() {
        this.state = useState({});
        this.busService = this.env.services.bus_service;
        this.busService.addChannel("room#" + this.props.id);
        this.busService.subscribe("booking/create", (bookings) => {
            for (const booking of bookings) {
                this.addBooking(booking);
            }
            this.computeBookingsByDate();
        });
        this.rpc = useService("rpc");
        this.notificationService = useService("notification");
        onWillStart(async () => {});
    }
}

registry.category("public_components").add("social_share_post", SharePost);
