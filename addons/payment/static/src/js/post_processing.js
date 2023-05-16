/** @odoo-module alias=payment.post_processing **/
    
    import publicWidget from "web.public.widget";
    import core from "web.core";
    import {Markup} from "web.utils";

    var _t = core._t;

    $.blockUI.defaults.css.border = '0';
    $.blockUI.defaults.css["background-color"] = '';
    $.blockUI.defaults.overlayCSS["opacity"] = '0.9';

    publicWidget.registry.PaymentPostProcessing = publicWidget.Widget.extend({
        selector: 'div[name="o_payment_status"]',

        _pollCount: 0,

        start() {
            this.displayLoading();
            this.poll();
            return this._super.apply(this, arguments);
        },
        /* Methods */
        startPolling() {
            let timeout = 3000;
            //
            if(this._pollCount >= 10 && this._pollCount < 20) {
                timeout = 10000;
            }
            else if(this._pollCount >= 20) {
                timeout = 30000;
            }
            //
            setTimeout(this.poll.bind(this), timeout);
            this._pollCount ++;
        },
        poll() {
            const self = this;
            this._rpc({
                route: '/payment/status/poll',
                params: {
                    'csrf_token': core.csrf_token,
                }
            }).then(data => {
                if(data.success === true) {
                    self.processPolledData(data.display_values);
                }
                else {
                    switch(data.error) {
                    case "tx_process_retry":
                        break;
                    case "no_tx_found":
                        self.displayContent("payment.no_tx_found", {});
                        break;
                    default: // if an exception is raised
                        self.displayContent("payment.exception", {exception_msg: data.error});
                        break;
                    }
                }
                self.startPolling();

            }).guardedCatch(() => {
                self.displayContent("payment.rpc_error", {});
                self.startPolling();
            });
        },
        processPolledData(display_values) {

            if (display_values["display_message"]) {
                display_values.display_message = Markup(display_values.display_message)
            }

            /*
            * When the server sends the monitored transaction, it tries to post-process it if
            * it was successful one. If it succeeds or if the post-process has already been made, 
            * polling stops.
            */
            if (display_values.state === "done" &&
                display_values.is_post_processed) {
                    window.location = display_values.landing_route;
                    return;
            }
            
            // We don't want to redirect customers to the landing page when they have a pending
            // transaction. The successful transactions are dealt with before.
            if (display_values.state === "authorized" || display_values.state === "error") {
                window.location = display_values.landing_route;
                return;
            }

            this.displayContent("payment.display_tx_list", display_values);
        },
        displayContent(xmlid, display_values) {
            const html = core.qweb.render(xmlid, display_values);
            $.unblockUI();
            this.$el.find('div[name="o_payment_status_content"]').html(html);
        },
        displayLoading() {
            const msg = _t("We are processing your payment, please wait ...");
            $.blockUI({
                'message': '<h2 class="text-white"><img src="/web/static/img/spin.png" class="fa-pulse"/>' +
                    '    <br />' + msg +
                    '</h2>'
            });
        },
    });

    export default publicWidget.registry.PaymentPostProcessing;
