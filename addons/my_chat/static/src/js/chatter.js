odoo.define('my_chat.chatter', function (require) {
"use strict";

require("web.dom_ready");
var core = require('web.core');
var ChatterWebSockte = require('my_chat.web_sockte').ChatterWebSockte;
var Widget = require('web.Widget');
var QWeb = core.qweb;
var rpc = require('web.rpc');

var Chatter = Widget.extend({ 
    template: 'my_chat.chatter',
    xmlDependencies: ['my_chat/static/src/xml/chatter.xml'],
    events: {
       'keydown .message_input' : '_onKeyDownInput',
       'click .close_chatter' : '_onCloseChatter'
    },

    init: function (recipientId, isOnline) {
        this._super.apply(this, arguments);
        this.recipientId = recipientId;
        this.color = isOnline ? 'green' : 'red'
    },

    willStart: function () {
        var defs = [this._super.apply(this, arguments), this._defaultGet()];
        return $.when.apply($, defs);
    },

    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {

            self.$msginput = self.$('.message_input');
            self.msgDiv = self.$('.messagesDiv');
            self.$status = self.$('.status');

            self.socket = new ChatterWebSockte({
                onOpen: self._onSockteOpen.bind(self),
                onClose: self._onSockteClose.bind(self),
                onMessage: self._onSockteMessageRecive.bind(self),
                onTyping: self._onSockteMessageTyping.bind(self),
                recipientId: self.recipientId,
            });
        });
    },

    _defaultGet: function () {
        var self = this; 
        return rpc.query({
                model: 'res.users',
                method: 'search_read',
                domain: [['id','=',this.recipientId]]
            }).then(function (result) {
                self.recipientName = result[0].display_name
            });
    },

    _onSockteOpen: function () {
        this.$status.html('Connected to Server');
    },

    _onSockteClose: function () {
        this.$status.html('Disconnected from Server');
        this.isOnline(false);
    },

    _onSockteMessageRecive: function (message) {
        var temp = QWeb.render('my_chat.message', {
            msg: message
        });
        this.msgDiv.append(temp);
        this.$status.html('Connected to Server');
    },

    _onSockteMessageTyping: function () {
        this.$status.html('typing');
    },

    _onCloseChatter: function () {
        this.socket.close();
        this.destroy();
    },

    _onKeyDownInput: function (e) {
        if ( e.keyCode === 13 ) {
            var temp = QWeb.render('my_chat.message', {
                msg: this.$msginput.val()
            });
            this.socket.sendMessage(this.$msginput.val());
            this.msgDiv.append(temp);
            this.$msginput.val('');
        } else {
            this.socket.typingMessage();
        }
    },

    isOnline: function (isOnline) {
        this.color = isOnline ? 'green' : 'red';
        var onlinestatus = this.$('.onlinestatus');
        onlinestatus.removeClass('green');
        onlinestatus.removeClass('red');
        onlinestatus.addClass(this.color);
    },
});

return Chatter;

});
