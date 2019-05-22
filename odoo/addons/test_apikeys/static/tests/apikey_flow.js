odoo.define('test_apikeys.tour', function(require) {
"use strict";

const tour = require('web_tour.tour');
const ajax = require('web.ajax');

tour.register('apikeys_tour_setup', {
    test: true,
    url: '/web',
}, [{
    content: 'Open user account menu',
    trigger: '.o_user_menu .oe_topbar_name',
    run: 'click',
}, {
    content: "Open preferences / profile screen",
    trigger: '[data-menu=settings]',
    run: 'click',
}, {
    content: "Open API keys wizard",
    trigger: 'button:contains("Add Key")',
}, {
    content: "Check that we have to enter enhanced security mode",
    trigger: 'p:contains("re-validate")',
    run: () => {},
}, {
    content: "Input password",
    trigger: '[name=password]',
    run: 'text demo', // FIXME: better way to do this?
}, {
    content: "Confirm",
    trigger: "button:contains(Confirm Password)",
}, {
    content: "Check that we're now on the key description dialog",
    trigger: 'p:contains("Enter a description of and purpose for the key.")',
    run: () => {},
}, {
    content: "Enter description",
    trigger: 'input[name=name]',
    run: 'text my key',
}, {
    content: "Confirm key creation",
    trigger: 'button:contains("Make key")'
}, {
    content: "Check that we're on the last step & grab key",
    trigger: 'p:contains("Here is your new API key")',
    run: async () => {
        const key = $('code span[name=key]').text();
        await ajax.jsonRpc('/web/dataset/call', 'call', {
            model: 'ir.logging', method: 'send_key',
            args: [key],
        });
        $('button:contains("Close")').click();
    }
}, {
    content: 'Re-open preferences',
    trigger: '.o_user_menu .oe_topbar_name',
}, {
    trigger: '[data-menu=settings]',
}, {
    content: "check that our key is present",
    trigger: '[name=api_key_ids] td:contains("my key")',
}]);

// deletes the previously created key
tour.register('apikeys_tour_teardown', {
    test: true,
    url: '/web',
}, [{
    content: 'Open preferences',
    trigger: '.o_user_menu .oe_topbar_name',
}, {
    trigger: '[data-menu=settings]',
}, {
    content: "delete key",
    trigger: '[name=api_key_ids] i.fa-trash',
    run: 'click',
}, {
    content: "Input password for security mode again",
    trigger: '[name=password]',
    run: 'text demo', // FIXME: better way to do this?
}, {
    content: "And confirm",
    trigger: 'button:contains(Confirm Password)',
}, {
    content: 'Re-open preferences again',
    trigger: '.o_user_menu .oe_topbar_name',
}, {
    trigger: '[data-menu=settings]',
}, {
    content: "Check that there's no more keys",
    trigger: '[name=api_key_ids]',
    run: function() {
        var field = this.$anchor;
        this.$anchor.find('td').each(function () {
            const s = _.str.trim(this.textContent || '');
            if (s !== '') {
                throw new Error(_.str.sprintf(
                    "Expected empty m2m, found %s in %s",
                    s, field.html()
                ));
            }
        });
    }
}]);
});
