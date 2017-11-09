odoo.define('my_chat.systray', function (require) {
"use strict";


var SystrayMenu = require('web.SystrayMenu');
var Widget = require('web.Widget');
var session = require('web.session');
var core = require('web.core');
var QWeb = core.qweb;

var MySysMenu = Widget.extend({ 
    template: 'my_chat.MessageChatterMenu',
    xmlDependencies: ['my_chat/static/src/xml/chatter.xml'],
    events: {
    	'click .user_chat_select' : '_onClickUser'
    },

    start: function () {
    	var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.$userList = self.$('.userList');
            self._rpc({
            	model: 'res.users',
            	method: 'search_read'
            }).then(function (result) {
                self.users = result;
                self.renderUsers();
            });
            core.bus.on('my_chat_online_users',null, self._onOnlineUser.bind(self));
            core.bus.on('my_chat_offline_users',null, self._onOfflineUser.bind(self));
            core.bus.on('my_chat_master_connection_close',null, self._onMasterClose.bind(self))
        });
    },

    _onClickUser: function (e) {
        var id = $(e.target).data('id');
        e.preventDefault();
        core.bus.trigger('my_chat_open_chatter',id);
    },

    _onOnlineUser: function (ids) {
        var self = this;
        _.each(ids, function (id) {
            _.find(self.users, function (u) { return u.id === id}).color = "green";
        });
        self.renderUsers();
    },

    _onOfflineUser: function (id) {
        _.find(this.users, function (u) { return u.id === id}).color = "red";
        this.renderUsers();
    },

    _onMasterClose: function () {
        debugger
        var self = this;
        _.each(self.users, function (user) {
            user.color = 'red';
        });
        self.renderUsers();
    },

    renderUsers: function () {
        var self = this;
        self.$userList.empty();
        _.each(self.users, function (user) {
            if (user.id !== session.uid) {
                self.$userList.append(QWeb.render('my_chat.MessageChatterUserList', {
                    id: user.id,
                    username: user.display_name,
                    color: user.color || 'red',
                }));
            }
        })
    },
});

SystrayMenu.Items.push(MySysMenu);

});