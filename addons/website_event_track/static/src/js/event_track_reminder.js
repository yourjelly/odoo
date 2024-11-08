/** @odoo-module **/

import { debounce } from "@web/core/utils/timing";
import publicWidget from "@web/legacy/js/public/public_widget";
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";
import { Component } from "@odoo/owl";

publicWidget.registry.websiteEventTrackReminder = publicWidget.Widget.extend({
    selector: '.o_wetrack_js_reminder',
    events: {
        'click': '_onReminderToggleClick',
    },

    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this._onReminderToggleClick = debounce(this._onReminderToggleClick, 500, true);
        this.notification = this.bindService("notification");
    },

    //--------------------------------------------------------------------------
    // Handlers
    //-------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onReminderToggleClick: function (ev) {
        var modalEmailReminder = new publicWidget.registry.websiteEventModalEmailReminder();
        console.log(modalEmailReminder);
        ev.stopPropagation();
        ev.preventDefault();
        var self = this;
        var $trackLink = $(ev.currentTarget).find('i');

        if (this.reminderOn === undefined) {
            this.reminderOn = $trackLink.data('reminderOn');
        }

        var reminderOnValue = !this.reminderOn;

        var trackId = $trackLink.data('trackId')

        rpc('/event/track/toggle_reminder', {
            track_id: trackId,
            set_reminder_on: reminderOnValue,
        }).then(function (result) {
            if (result.error && result.error === 'ignored') {
                self.notification.add(_t('Talk already in your Favorites'), {
                    type: 'info',
                    title: _t('Error'),
                });
            } else {
                self.reminderOn = reminderOnValue;
                var reminderText = self.reminderOn ? _t('Favorite On') : _t('Set Favorite');
                self.$('.o_wetrack_js_reminder_text').text(reminderText);
                self._updateDisplay();
                if (self.reminderOn) {
                    self._sendReminderMail(trackId)
                    var message = _t('Track successfully added to your favorites. Check your email to add them to your agenda.');
                }
                else{
                    message = _t('Talk removed from your Favorites');
                }
                self.notification.add(message, {
                    type: 'info',
                });
                if (self.reminderOn) {
                    Component.env.bus.trigger('open_notification_request', [
                        'add_track_to_favorite',
                        {
                            title: _t('Allow push notifications?'),
                            body: _t('You have to enable push notifications to get reminders for your favorite tracks.'),
                            delay: 0
                        },
                    ]);
                }
            }
        });
    },

    _updateDisplay: function () {
        var $trackLink = this.$el.find('i');
        if (this.reminderOn) {
            $trackLink.addClass('fa-bell').removeClass('fa-bell-o');
            $trackLink.attr('title', _t('Favorite On'));
        } else {
            $trackLink.addClass('fa-bell-o').removeClass('fa-bell');
            $trackLink.attr('title', _t('Set Favorite'));
        }
    },

    _sendReminderMail: function(trackId){
        rpc('/event/has_email_reminder').then( function (result){
            if (result.hasEmailReminder){
                rpc('/event/send_email_reminder',  {
                    track_id: trackId,
                });
            }
            else {
                rpc('/event/get_email_reminder_modal').then(function (result) {
                   $("#modal_email_reminder_container").append(result.modal)
                })
            }
        })
    },
});

export default publicWidget.registry.websiteEventTrackReminder;
