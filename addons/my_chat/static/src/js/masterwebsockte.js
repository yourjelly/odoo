odoo.define('my_chat.master_websockte', function (require) {
"use strict";

var core = require('web.core');
var session = require('web.session');
var pyeval = require('web.pyeval');
var Class = core.Class;
var AbstrectWebSocket = require('my_chat.web_sockte').AbstrectWebSocket;

var MasterWebSocket = AbstrectWebSocket.extend({
	onOpen: function () {
		var connectionString = {
			userId: session.uid,
			masterwebsockte: true,
		}
		this.sendSocketMessage(JSON.stringify(connectionString));
	},

	onMessage: function (m) {
		var data = pyeval.eval('context', m.data);
		if (data.open) {
			this.openChatter(data.open);
		}
		if (data.onlineUsers) {
			this.onlineUsers(data.onlineUsers);
		}
		if (data.offlineUsers) {
			this.offlineUsers(data.offlineUsers);
		}
	},

	openChatter: function (id) {
		core.bus.trigger('my_chat_open_chatter',id);
	},

	onlineUsers: function (ids) {
		core.bus.trigger('my_chat_online_users',ids);
	},

	offlineUsers: function (id) {
		core.bus.trigger('my_chat_offline_users', id);
	},

	onClose: function () {
		core.bus.trigger('my_chat_master_connection_close');
	},
});

return MasterWebSocket;

});