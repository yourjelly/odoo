odoo.define('website_event_meet.website_event_meet_meeting_room', function (require) {
'use strict';

let publicWidget = require('web.public.widget');
let core = require('web.core');
let QWeb = core.qweb;

publicWidget.registry.websiteEventMeetingRoom = publicWidget.Widget.extend({
    selector: '.o_wevent_meeting_room_card',
    xmlDependencies: ['/website_event_meet/static/src/xml/website_event_meeting_room.xml'],
    events: {
        'click .o_wevent_meeting_room_link': '_onJitsiLinkClick',
        'click .o_wevent_meeting_room_delete': '_onDeleteClick',
        'click .o_wevent_meeting_room_duplicate': '_onDuplicateClick',
    },

    start: async function () {
        await this._super.apply(this, arguments);
        this.jitsiCode = this.$el.data('jitsi-code');
        this.meetingRoomId = parseInt(this.$el.data('meeting-room-id'));
        this.openRoom = parseInt(this.$el.data('open-room'));
        this.full = parseInt(this.$el.data('full'));

        if (this.openRoom) {
            // automatically join the room if necessary
            await this._onJitsiLinkClick();
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
      * Delete the meeting room.
      */
    _onDeleteClick: async function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        if (window.confirm("Are you sure you want to delete this room ?")) {
            await this._rpc({
                model: 'event.meeting_room',
                method: 'write',
                args: [this.meetingRoomId, {active: false}],
                context: this.context,
            });
            // remove the element so we do not need to refresh the page
            this.$el.remove();
        }

    },

    /**
      * Duplicate the room
      */
    _onDuplicateClick: async function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (window.confirm("Are you sure you want to duplicate this room ?")) {
            await this._rpc({
                model: 'event.meeting_room',
                method: 'copy',
                args: [this.meetingRoomId],
                context: this.context,
            });
            // remove the element so we do not need to refresh the page
            window.location.reload();
        }
    },

    /**
      * Click on a meeting room to join it.
      */
    _onJitsiLinkClick: async function () {
        let $jitsiModal = $(QWeb.render('meeting_room_jitsi_modal', {}));
        $jitsiModal.insertAfter(this.$el);
        $jitsiModal.modal('show');

        await this._loadJisti();
        let jitsiRoom = await this._joinJitsiRoom($jitsiModal);
        $jitsiModal.on('hidden.bs.modal', async () => {
            jitsiRoom.dispose();

            if (this.allParticipantIds && this.allParticipantIds.length === 1 && this.allParticipantIds[0] === this.participantId) {
              // we are the last participant in the room and we left it
              this._updateParticipantCount(0, false);
            }
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
      * Jitsi do not provide an REST API to get the number of participant in a room.
      * The only way to get the number of participant is to be in the room and to use
      * the Javascript API. So, to update the participant count on the server side,
      * the participant have to send the count in RPC...
      *
      * When leaving a room, the event "participantLeft" is called for the current user
      * once per participant in the room (like if all other participants were leaving the
      * room and then the current user himself).
      *
      * "participantLeft" is called only one time for the other participant who are still
      * in the room.
      *
      * We can not ask the user who is leaving the room to update the participant count
      * because user might close their browser tab without hanging up (and so without
      * triggering the event "videoConferenceLeft"). So, we wait for a moment (because the
      * event "participantLeft" is called many time for the participant who is leaving)
      * and the first participant send the new participant count (so we avoid spamming the
      * server with HTTP requests).
      *
      * We use "setTimout" to send maximum one HTTP request per interval, even if multiple
      * participants join/leave at the same time in the defined interval.
      *
      * Update on the 29 June 2020
      */
    _joinJitsiRoom: async function ($jitsiModal) {
        const domain = 'meet.jit.si';
        const options = {
            roomName: this.jitsiCode,
            width: '100%',
            height: '100%',
            parentNode: $jitsiModal.find('.modal-body')[0],
            configOverwrite: {disableDeepLinking: true},
        };
        let jitsiRoom = new window.JitsiMeetExternalAPI(domain, options);

        let timeoutCall = null;
        const updateParticipantCount = (joined) => {
            // we clear the old timeout to be sure to call it only once each 2 seconds
            // (so if 2 participants join/leave in this interval, we will perform only
            // one HTTP request for both).
            clearTimeout(timeoutCall);
            timeoutCall = setTimeout(() => {
                this.allParticipantIds = Object.keys(jitsiRoom._participants).sort();
                if (this.participantId === this.allParticipantIds[0]) {
                    // only the first participant of the room send the new participant
                    // count so we avoid to send to many HTTP requests
                    this._updateParticipantCount(this.allParticipantIds.length, joined);
                }
            }, 2000);
        };

        jitsiRoom.addEventListener('participantJoined', () => updateParticipantCount(true));
        jitsiRoom.addEventListener('participantLeft', () => updateParticipantCount(false));

        // update the participant count when joining the room
        jitsiRoom.addEventListener('videoConferenceJoined', async (event) => {
            this.participantId = event.id;
            updateParticipantCount(true);
            $jitsiModal.find('.o_wevent_jitsi_loading').addClass('d-none');
        });

        // close the modal when hanging up
        jitsiRoom.addEventListener('videoConferenceLeft', async (event) => {
            $('.o_wevent_meeting_room_jitsi_modal').modal('hide');
        });

        return jitsiRoom;
    },

    /**
      * Perform an HTTP request to update the participant count on the server side.
      */
    _updateParticipantCount: async function (count, joined) {
        await this._rpc({
            route: `/event/update_participant_count`,
            params: {
                'participant_count': count,
                'meeting_room_id': this.meetingRoomId,
                'joined': joined,
            },
        });
    },

    /**
      * Load the Jitsi external library if necessary.
      */
    _loadJisti: async function () {
      if (!window.JitsiMeetExternalAPI) {
          await $.ajax({
              url: "https://meet.jit.si/external_api.js",
              dataType: "script",
          });
      }
    },

});

return publicWidget.registry.websiteEventMeetingRoom;

});
