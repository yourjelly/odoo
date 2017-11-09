odoo.define('my_chat.web_sockte', function (require) {
"use strict";

var core = require('web.core');
var session = require('web.session');
var pyeval = require('web.pyeval');
var Class = core.Class;

var AbstrectWebSocket = Class.extend({
	init: function () { 
        this.socket = new WebSocket('ws://192.168.1.75:8770/');
        this._initMethods();
	},

	_initMethods: function () {
		this._onSocketOpen(this.onOpen.bind(this));
		this._onSocketMessage(this.onMessage.bind(this));
		this._onSocketClose(this.onClose.bind(this));
	},

	// *******************************
	// Bind Core Socket Methods 
	// *******************************

	_onSocketMessage: function (onmessage) {
		this.socket.onmessage = onmessage;
	},

	_onSocketOpen: function (onopen) {
		this.socket.onopen = onopen;
	},

	_onSocketClose: function (onclose) {
		this.socket.onclose = onclose;
	},

	_sendSocketMessage: function (message) {
		this.socket.send(message);
	},

	onOpen: function () {},

	onMessage: function () {},

	onClose: function () {},

	sendSocketMessage: function (message) {
		this._sendSocketMessage(message);
	},

	close: function () {
		this.socket.close();
	},
});

var ChatterWebSockte = AbstrectWebSocket.extend({
	init: function (options) {
		this._super.apply(this, arguments);
        this.methods = options;
        this.recipientId = options.recipientId;
	},

	// ******************************
	// Override Socket Methods
	// ******************************

	onOpen: function () {
		var connectionString = {
			userId: session.uid,
			initMessage: true,
			recipientId: this.recipientId,
		}
		this.sendSocketMessage(JSON.stringify(connectionString));
		this.methods.onOpen();
	},

	onClose: function () {
		this.methods.onClose();
	},

	onMessage: function (m) {
		var message = pyeval.eval('context', m.data);
		if (message.typing) {
			this.methods.onTyping();
		} else {
			this.methods.onMessage(message.message);
		}
	},

	sendMessage: function (message) {
		var dataString = {
			userId: session.uid,
			recipientId: this.recipientId,
			message: message,
		}
		this.sendSocketMessage(JSON.stringify(dataString));
	},

	typingMessage: function () {
		var dataString = {
			userId: session.uid,
			recipientId: this.recipientId,
			typing: true,
		}
		this.sendSocketMessage(JSON.stringify(dataString));
	},

  });

return {
	ChatterWebSockte: ChatterWebSockte,
	AbstrectWebSocket: AbstrectWebSocket,
}
});