/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

import { Component, onWillStart, onMounted, onWillUnmount, useEffect, useExternalListener, useRef, useState } from "@odoo/owl";

export class ShareBar extends Component {
    static template = "social_share.ShareBar";

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

    get url() {
        return this.props.shareUrl;
    }

    get imageUrl() {
        return this.props.imageUrl;
    }

    _onShareLinkClick(ev) {

        ev.preventDefault();
        ev.stopPropagation();

        const aEl = ev.currentTarget;

        const shareWindow = window.open(
            aEl.href,
            aEl.target,
            "menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=550,width=600",
        );
        this._awaitWindowClose(window, this._onShare.bind(this))
        //this._onVisitLocation(shareWindow, 'http://???')
    }
    _onShare(timeToShare) {
        if (timeToShare < 1000) {
            return;
        }
        else {
            console.log("SHARED!")
            // call to get a new reward I guess?
        }
    }

    _awaitWindowClose(window, callback, time=0) {
        console.log(window.closed)
        if (window.closed) {
            callback()
        } else {
            console.log('timeout')
            setTimeout(() => this._awaitWindowClose(window, callback, time + 1000), 1000)
        }
    }
}
