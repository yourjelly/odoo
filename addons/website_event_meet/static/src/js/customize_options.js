/** @odoo-module **/

import CustomizeMenu from "website.customizeMenu";
import { EventSpecificOptions } from "website_event.set_customize_options";

EventSpecificOptions.include({
    xmlDependencies: (EventSpecificOptions.prototype.xmlDependencies || [])
        .concat([
            '/website_event_meet/static/src/xml/customize_options.xml',
        ]),

    start() {
        this.$allowRoomCreationInput = this.$('#allow-room-creation');
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getCheckboxFields() {
        let fields = this._super();
        fields = _.union(fields, ['meeting_room_allow_creation']);
        return fields;
    },

    _getCheckboxFieldMatch(checkboxField) {
        if (checkboxField === 'meeting_room_allow_creation') {
            return this.$allowRoomCreationInput;
        }
        return this._super(checkboxField);
    },

    _initCheckboxCallback(rpcData) {
        this._super(rpcData);
        if (rpcData[0]['meeting_room_allow_creation']) {
            let submenuInput = this._getCheckboxFieldMatch('meeting_room_allow_creation');
            submenuInput.attr('checked', 'checked');
        }
    },
});

CustomizeMenu.include({
    /**
     * @override
     * @param {Event} ev 
     */
    _onCustomOptionClick(ev) {
        this._super(...arguments);
        if (this.eventOptions.modelName === "event.event") {
            const $currentTarget = $(ev.currentTarget);
            const $inputOption = $($currentTarget.find('input'));
            if ($inputOption[0].id === 'allow-room-creation') {
                var checkboxValue = $inputOption.is(':checked');
                this._toggleAllowRoomCreation(!checkboxValue);
            }
        }
    },
    _toggleAllowRoomCreation(val) {
        this._rpc({
            model: this.eventOptions.modelName,
            method: 'write',
            args: [[this.eventOptions.eventId], {
                meeting_room_allow_creation: val
            }],
        }).then(() => {
            window.location.reload();
        });
    },
});
