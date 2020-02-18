odoo.define('portal.tour', function (require) {
'use strict';

var tour = require("web_tour.tour");

tour.register('portal_load_homepage', {
    test: true,
    url: '/my',
},
    [
        {
            content: "Check portal is loaded",
            trigger: 'a[href*="/my/account"]:contains("Edit"):first',
        },
        {
            content: "Load my account details",
            trigger: 'input[value="Joel Willis"]'
        }
    ]
);

});
odoo.define('portal.apikeys_tour', function(require) {
"use strict";

const tour = require('web_tour.tour');
const ajax = require('web.ajax');

tour.register('portal_apikeys_tour_setup', {
    test: true,
    url: '/my',
}, [{
    content: 'Open security page',
    trigger: 'a:contains("Security")',
}, {
    content: "Open API keys wizard",
    trigger: 'button:contains("Add New Key")',
}, {
    content: "Check that we have to enter enhanced security mode",
    trigger: 'p:contains("re-validate")',
    run: () => {},
}, {
    content: "Input password",
    trigger: '[name=password]',
    run: 'text portal', // FIXME: better way to do this?
}, {
    content: "Confirm",
    trigger: "button:contains(Confirm Password)",
}, {
    content: "Check that we're now on the key description dialog",
    trigger: 'p:contains("Enter a description of and purpose for the key.")',
    run: () => {},
}, {
    content: "Enter description",
    trigger: 'input[name=description]',
    run: 'text my key',
}, {
    content: "Confirm key creation",
    trigger: 'button:contains("Make key")'
}, {
    content: "Check that we're on the last step & grab key",
    trigger: 'p:contains("Here is your new API key")',
    run: async () => {
        const key = $('code').text();
        await ajax.jsonRpc('/web/dataset/call', 'call', {
            model: 'ir.logging', method: 'send_key',
            args: [key],
        });
        $('button:contains("Ok")').click();
    }
}, {
    content: "check that our key is present",
    trigger: 'li p:contains("my key")',
}]);

// deletes the previously created key
tour.register('portal_apikeys_tour_teardown', {
    test: true,
    url: '/my/security',
}, [{
    content: "delete key",
    trigger: 'p:contains(my key) + button.btn-danger',
    run: 'click',
}, {
    content: "Input password for security mode again",
    trigger: '[name=password]',
    run: 'text portal', // FIXME: better way to do this?
}, {
    content: "And confirm",
    trigger: 'button:contains(Confirm Password)',
}, {
    content: "Check that there's no more keys",
    // trigger: no ul between p and div
    trigger: 'h3:contains(API Keys)+p+div',
    run: () => {}
}]);
});
