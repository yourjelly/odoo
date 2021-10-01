odoo.define('web.calendar_tests', function (require) {
"use strict";

const AbstractField = require('web.AbstractField');
var AbstractStorageService = require('web.AbstractStorageService');
const BasicModel = require('web.BasicModel');
var CalendarView = require('web.CalendarView');
var CalendarRenderer = require('web.CalendarRenderer');
var Dialog = require('web.Dialog');
const fieldRegistry = require('web.field_registry');
var ViewDialogs = require('web.view_dialogs');
var fieldUtils = require('web.field_utils');
var mixins = require('web.mixins');
var testUtils = require('web.test_utils');
var session = require('web.session');
const Widget = require('web.Widget');

const { patchWithCleanup } = require("@web/../tests/helpers/utils");

const { createWebClient, doAction } = require('@web/../tests/webclient/helpers');
let serverData;

CalendarRenderer.include({
    getAvatars: function () {
        var res = this._super.apply(this, arguments);
        for (var k in res) {
            res[k] = res[k].replace(/src="([^"]+)"/, 'data-src="\$1"');
        }
        return res;
    }
});


var createCalendarView = testUtils.createCalendarView;

// 2016-12-12 08:00:00
var initialDate = new Date(2016, 11, 12, 8, 0, 0);
initialDate = new Date(initialDate.getTime() - initialDate.getTimezoneOffset()*60*1000);

function _preventScroll(ev) {
    ev.stopImmediatePropagation();
}

QUnit.module('Views', {
    beforeEach: function () {
        window.addEventListener('scroll', _preventScroll, true);
        patchWithCleanup(session, {
            uid: -1
        });
        this.data = {
            event: {
                fields: {
                    id: {string: "ID", type: "integer"},
                    user_id: {string: "user", type: "many2one", relation: 'user', default: session.uid},
                    partner_id: {string: "user", type: "many2one", relation: 'partner', related: 'user_id.partner_id', default: 1},
                    name: {string: "name", type: "char"},
                    start_date: {string: "start date", type: "date"},
                    stop_date: {string: "stop date", type: "date"},
                    start: {string: "start datetime", type: "datetime"},
                    stop: {string: "stop datetime", type: "datetime"},
                    delay: {string: "delay", type: "float"},
                    allday: {string: "allday", type: "boolean"},
                    partner_ids: {string: "attendees", type: "one2many", relation: 'partner', default: [[6, 0, [1]]]},
                    type: {string: "type", type: "integer"},
                    event_type_id: {string: "Event Type", type: "many2one", relation: 'event_type'},
                    color:  {string: "Color", type: "integer", related: 'event_type_id.color'},
                    is_hatched: {string: "Hatched", type: "boolean"}
                },
                records: [
                    {id: 1, user_id: session.uid, partner_id: 1, name: "event 1", start: "2016-12-11 00:00:00", stop: "2016-12-11 00:00:00", allday: false, partner_ids: [1,2,3], type: 1, is_hatched: false},
                    {id: 2, user_id: session.uid, partner_id: 1, name: "event 2", start: "2016-12-12 10:55:05", stop: "2016-12-12 14:55:05", allday: false, partner_ids: [1,2], type: 3, is_hatched: false},
                    {id: 3, user_id: 4, partner_id: 4, name: "event 3", start: "2016-12-12 15:55:05", stop: "2016-12-12 16:55:05", allday: false, partner_ids: [1], type: 2, is_hatched: true},
                    {id: 4, user_id: session.uid, partner_id: 1, name: "event 4", start: "2016-12-14 15:55:05", stop: "2016-12-14 18:55:05", allday: true, partner_ids: [1], type: 2, is_hatched: false},
                    {id: 5, user_id: 4, partner_id: 4, name: "event 5", start: "2016-12-13 15:55:05", stop: "2016-12-20 18:55:05", allday: false, partner_ids: [2,3], type: 2, is_hatched: true},
                    {id: 6, user_id: session.uid, partner_id: 1, name: "event 6", start: "2016-12-18 08:00:00", stop: "2016-12-18 09:00:00", allday: false, partner_ids: [3], type: 3, is_hatched: true},
                    {id: 7, user_id: session.uid, partner_id: 1, name: "event 7", start: "2016-11-14 08:00:00", stop: "2016-11-16 17:00:00", allday: false, partner_ids: [2], type: 1, is_hatched: false},
                ],
                check_access_rights: function () {
                    return Promise.resolve(true);
                }
            },
            user: {
                fields: {
                    id: {string: "ID", type: "integer"},
                    display_name: {string: "Displayed name", type: "char"},
                    partner_id: {string: "partner", type: "many2one", relation: 'partner'},
                    image: {string: "image", type: "integer"},
                },
                records: [
                    {id: session.uid, display_name: "user 1", partner_id: 1},
                    {id: 4, display_name: "user 4", partner_id: 4},
                ]
            },
            partner: {
                fields: {
                    id: {string: "ID", type: "integer"},
                    display_name: {string: "Displayed name", type: "char"},
                    image: {string: "image", type: "integer"},
                },
                records: [
                    {id: 1, display_name: "partner 1", image: 'AAA'},
                    {id: 2, display_name: "partner 2", image: 'BBB'},
                    {id: 3, display_name: "partner 3", image: 'CCC'},
                    {id: 4, display_name: "partner 4", image: 'DDD'}
                ]
            },
            event_type: {
                fields: {
                    id: {string: "ID", type: "integer"},
                    display_name: {string: "Displayed name", type: "char"},
                    color: {string: "Color", type: "integer"},
                },
                records: [
                    {id: 1, display_name: "Event Type 1", color: 1},
                    {id: 2, display_name: "Event Type 2", color: 2},
                    {id: 3, display_name: "Event Type 3 (color 4)", color: 4},
                ]
            },
            filter_partner: {
                fields: {
                    id: {string: "ID", type: "integer"},
                    user_id: {string: "user", type: "many2one", relation: 'user'},
                    partner_id: {string: "partner", type: "many2one", relation: 'partner'},
                    partner_checked: {string: "checked", type: "boolean"}
                },
                records: [
                    {id: 1, user_id: session.uid, partner_id: 1, partner_checked: true},
                    {id: 2, user_id: session.uid, partner_id: 2, partner_checked: true},
                    {id: 3, user_id: 4, partner_id: 3, partner_checked: true}
                ]
            },
        };
        serverData = { models: this.data };
        this.data.event.methods = {
            check_access_rights: this.data.event.check_access_rights,
        }
    },
    afterEach: function () {
        window.removeEventListener('scroll', _preventScroll, true);
    },
}, function () {

    QUnit.module('CalendarView');
});

});
