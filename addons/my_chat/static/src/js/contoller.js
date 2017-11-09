odoo.define('my_chat.controller', function (require) {
"use strict";

var def = require('web_editor.ready');
var base = require("web_editor.base");


var core = require('web.core');
var session = require('web.session');
var pyeval = require('web.pyeval');
var Class = core.Class;
var QWeb = core.qweb;
var Chatter = require('my_chat.chatter');

var MasterWebSocket = require('my_chat.master_websockte');


var Controller = core.Class.extend({

	init: function () {
		var masterWebSockte = new MasterWebSocket();
		this.chatterContainer = $('<div>').addClass('chatter_container').addClass('o_in_appswitcher');
        this.chatterContainer.appendTo($('body'));
        this.chatterList = {};
		this.initBus();
	},

	initBus: function () {
		var self = this;
		core.bus.on('my_chat_open_chatter', null, this._onOpenChatter.bind(this));
		core.bus.on('my_chat_online_users',null, self._onOnlineUser.bind(self));
        core.bus.on('my_chat_offline_users',null, self._onOfflineUser.bind(self));
        core.bus.on('my_chat_master_connection_close',null, self._onMasterClose.bind(self))
	},

	_onOpenChatter: function (id) {
		var chatter = new Chatter(id, this.onlineUsers.indexOf(id) !== -1);
        chatter.appendTo(this.chatterContainer);
        this.chatterList[id] = chatter;
	},

	_onOnlineUser: function (ids) {
		this.onlineUsers = ids;
		var self = this;
		_.each(ids, function (id) {
			if (self.chatterList[id]) {
				self.chatterList[id].isOnline(true);
			}
		});
	},

	_onOfflineUser: function (id) {
		this.onlineUsers =_.reject(this.onlineUsers, function(ou){ return ou !== id; });
		if (this.chatterList[id]) {
			this.chatterList[id].isOnline(false);
		}
	},

	_onMasterClose: function () {
		
	},
});
	

setTimeout(function(){ 
	new Controller();
 }, 1000);

});