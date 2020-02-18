odoo.define('portal.portal', function (require) {
'use strict';

var publicWidget = require('web.public.widget');
const Dialog = require('web.Dialog');
const {_t, qweb} = require('web.core');
const ajax = require('web.ajax');

publicWidget.registry.portalDetails = publicWidget.Widget.extend({
    selector: '.o_portal_details',
    events: {
        'change select[name="country_id"]': '_onCountryChange',
    },

    /**
     * @override
     */
    start: function () {
        var def = this._super.apply(this, arguments);

        this.$state = this.$('select[name="state_id"]');
        this.$stateOptions = this.$state.filter(':enabled').find('option:not(:first)');
        this._adaptAddressForm();

        return def;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _adaptAddressForm: function () {
        var $country = this.$('select[name="country_id"]');
        var countryID = ($country.val() || 0);
        this.$stateOptions.detach();
        var $displayedState = this.$stateOptions.filter('[data-country_id=' + countryID + ']');
        var nb = $displayedState.appendTo(this.$state).show().length;
        this.$state.parent().toggle(nb >= 1);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onCountryChange: function () {
        this._adaptAddressForm();
    },
});

publicWidget.registry.portalSearchPanel = publicWidget.Widget.extend({
    selector: '.o_portal_search_panel',
    events: {
        'click .search-submit': '_onSearchSubmitClick',
        'click .dropdown-item': '_onDropdownItemClick',
        'keyup input[name="search"]': '_onSearchInputKeyup',
    },

    /**
     * @override
     */
    start: function () {
        var def = this._super.apply(this, arguments);
        this._adaptSearchLabel(this.$('.dropdown-item.active'));
        return def;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _adaptSearchLabel: function (elem) {
        var $label = $(elem).clone();
        $label.find('span.nolabel').remove();
        this.$('input[name="search"]').attr('placeholder', $label.text().trim());
    },
    /**
     * @private
     */
    _search: function () {
        var search = $.deparam(window.location.search.substring(1));
        search['search_in'] = this.$('.dropdown-item.active').attr('href').replace('#', '');
        search['search'] = this.$('input[name="search"]').val();
        window.location.search = $.param(search);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onSearchSubmitClick: function () {
        this._search();
    },
    /**
     * @private
     */
    _onDropdownItemClick: function (ev) {
        ev.preventDefault();
        var $item = $(ev.currentTarget);
        $item.closest('.dropdown-menu').find('.dropdown-item').removeClass('active');
        $item.addClass('active');

        this._adaptSearchLabel(ev.currentTarget);
    },
    /**
     * @private
     */
    _onSearchInputKeyup: function (ev) {
        if (ev.keyCode === $.ui.keyCode.ENTER) {
            this._search();
        }
    },
});

const tmpl = ajax.loadXML('/portal/static/src/xml/portal_security.xml', qweb);

/**
 * Wraps an RPC call in a check for the result being an identity check action
 * descriptor. If no such result is found, just returns the wrapped promise's
 * result as-is; otherwise shows an identity check dialog and resumes the call
 * on success.
 *
 * Warning: does not in and of itself trigger an identity check, a promise which
 * never triggers and identity check internally will do nothing of use.
 *
 * @param {Function} rpc Widget#_rpc bound do the widget
 * @param {Promise} wrapped promise to check for an identity check request
 * @returns {Promise} result of the original call
 */
function handleCheckIdentity(rpc, wrapped) {
    return wrapped.then((r) => {
        if (!_.isMatch(r, {type: 'ir.actions.act_window', res_model: 'res.users.identitycheck'})) {
            return r;
        }
        const check_id = r.res_id;
        return tmpl.then(() => new Promise((resolve, reject) => {
            const d = new Dialog(null, {
                title: _t("Identity Check"),
                $content: qweb.render('portal.identitycheck'),
                buttons: [{
                    text: _t("Confirm Password"), classes: 'btn btn-primary',
                    // nb: if click & close, waits for click to resolve before closing
                    click() {
                        const password_input = this.el.querySelector('[name=password]');
                        if (!password_input.reportValidity()) {
                            password_input.classList.add('is-invalid');
                            return;
                        }
                        return rpc({
                            model: 'res.users.identitycheck',
                            method: 'write',
                            args: [check_id, {password: password_input.value}]
                        }).then(() => rpc({
                            model: 'res.users.identitycheck',
                            method: 'run_check',
                            args: [check_id]
                        })).then((r) => {
                            this.close();
                            resolve(r);
                        }, (err) => {
                            err.event.preventDefault(); // suppress crashmanager
                            password_input.classList.add('is-invalid');
                            password_input.setCustomValidity(_t("Check failed"));
                            password_input.reportValidity();
                        });
                    }
                }, {
                    text: _t('Cancel'), close: true
                }]
            }).on('close', null, () => {
                // unlink wizard object?
                reject();
            });
            d.opened(() => {
                const pw = d.el.querySelector('[name="password"]');
                pw.focus();
                pw.addEventListener('input', () => {
                    pw.classList.remove('is-invalid');
                    pw.setCustomValidity('');
                });
                d.el.addEventListener('submit', (e) => {
                    e.preventDefault();
                    d.$footer.find('.btn-primary').click();
                });
            });
            d.open();
        }));
    });
}
publicWidget.registry.addAPIKey = publicWidget.Widget.extend({
    // xmlDependencies: ['/portal/static/src/xml/portal_security.xml'],
    selector: '#o_portal_apikey_add',
    events: {click: '_onClick'},
    willStart() {
        return Promise.all([
            this._super.apply(this, arguments),
            tmpl
        ])
    },
    _onClick() {
        var self = this;
        function makeKey() {
            const description = d.el.querySelector('input[name="description"]').value;
            return self._rpc({
                model: 'res.users.apikeys.description',
                method: 'create',
                args: [{'name': description}]
            }).then((wizard_id) => self._rpc({
                model: 'res.users.apikeys.description',
                method: 'make_key',
                args: [wizard_id]
            })).then(
                (act) => ({
                    title: _t('Success!'),
                    $content: qweb.render('portal.api_key_success', {key: act.context.default_key}),
                }),
                () => ({
                    title: _t("Failure"),
                    $content: qweb.render('portal.api_key_failure', {description}),
                })
            ).then((descr) => {
                descr.buttons = [{text: _t("Ok"), close: true}];
                new Dialog(self, descr)
                    .on('closed', null, () => { window.location = window.location; })
                    .open();
            });
        }
        const d = new Dialog(this, {
            title: _t('New API Key'),
            $content: qweb.render('portal.api_key'),
            buttons: [
                {text: _t('Make key'), classes: 'btn btn-primary', click: makeKey, close: true},
                {text: _t('Cancel'), classes: 'btn btn-secondary', close: true}
            ]
        });
        d.opened(() => {
            d.el.querySelector('input[name="description"]').focus();
            d.el.addEventListener('submit', (e) => {
                e.preventDefault();
                d.$footer.find('.btn-primary').click();
            });
        });
        handleCheckIdentity(self.proxy('_rpc'), self._rpc({
            model: 'res.users',
            method: 'api_key_wizard',
            args: [self.getSession().user_id]
        })).then(() => d.open());
    }
});
publicWidget.registry.removeAPIKey = publicWidget.Widget.extend({
    selector: '.o_portal_apikey_delete',
    events: {'click': '_onClick'},
    willStart() {
        return Promise.all([
            this._super.apply(this, arguments),
            tmpl
        ])
    },
    _onClick() {
        handleCheckIdentity(this.proxy('_rpc'), this._rpc({
            model: 'res.users.apikeys', method: 'remove',
            args: [parseInt(this.el.getAttribute('data-id'))]
        })).then(() => { window.location = window.location; });
    }
});
return {
    handleCheckIdentity,
}
});
