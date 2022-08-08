odoo.define('website.s_popup', function (require) {
'use strict';

const config = require('web.config');
const publicWidget = require('web.public.widget');
const {get_cookie, set_cookie} = require('web.utils.cookies');

const PopupWidget = publicWidget.Widget.extend({
    selector: '.s_popup',
    events: {
        'click .js_close_popup': '_onCloseClick',
        'hide.bs.modal': '_onHideModal',
        'show.bs.modal': '_onShowModal',
    },

    /**
     * @override
     */
    start: function () {
        this._popupAlreadyShown = !!get_cookie(this.$el.attr('id'));
        if (!this._popupAlreadyShown) {
            this._bindPopup();
        }
        return this._super(...arguments);
    },
    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);
        $(document).off('mouseleave.open_popup');
        this.$target.find('.modal').modal('hide');
        clearTimeout(this.timeout);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _bindPopup: function () {
        const $main = this.$target.find('.modal');

        let display = $main.data('display');
        let delay = $main.data('showAfter');

        if (config.device.isMobile) {
            if (display === 'mouseExit') {
                display = 'afterDelay';
                delay = 5000;
            }
        }

        if (display === 'afterDelay') {
            this.timeout = setTimeout(() => this._showPopup(), delay);
        } else {
            $(document).on('mouseleave.open_popup', () => this._showPopup());
        }
    },
    /**
     * @private
     */
    _canShowPopup() {
        return true;
    },
    /**
     * @private
     */
    _hidePopup: function () {
        this.$target.find('.modal').modal('hide');
    },
    /**
     * @private
     */
    _showPopup: function () {
        if (this._popupAlreadyShown || !this._canShowPopup()) {
            return;
        }
        this.$target.find('.modal').modal('show');
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onCloseClick: function () {
        this._hidePopup();
    },
    /**
     * @private
     */
    _onHideModal: function () {
        const nbDays = this.$el.find('.modal').data('consentsDuration');
        set_cookie(this.el.id, true, nbDays * 24 * 60 * 60, 'required');
        this._popupAlreadyShown = true;

        this.$target.find('.media_iframe_video iframe').each((i, iframe) => {
            iframe.src = '';
        });
    },
    /**
     * @private
     */
    _onShowModal() {
        this.el.querySelectorAll('.media_iframe_video').forEach(media => {
            const iframe = media.querySelector('iframe');
            iframe.src = media.dataset.oeExpression || media.dataset.src; // TODO still oeExpression to remove someday
        });
    },
});

publicWidget.registry.popup = PopupWidget;

// Extending the popup widget with cookiebar functionality.
// This allows for refusing optional cookies for now and can be
// extended to picking which cookies categories are accepted.
publicWidget.registry.cookies_bar = PopupWidget.extend({
    selector: '.s_cookiesbar',
    cookieDurationDays: 365,
    events: Object.assign({}, PopupWidget.prototype.events, {
        'click #cookies-consent-essential': '_onConsentEssentialClick',
        'click #cookies-consent-all': '_onConsentAllClick',
    }),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param acceptOptional Whether optional cookies were accepted or not
     */
    _onAcceptClick(acceptOptional) {
        const acceptedCookieTypes = JSON.parse(get_cookie('accepted_cookie_types') || '{}');
        Object.assign(acceptedCookieTypes, {'required': true, 'optional': acceptOptional});
        set_cookie('accepted_cookie_types',
            JSON.stringify(acceptedCookieTypes),
            this.cookieDurationDays * 24 * 60 * 60, 'required');
        // Prevent the modal from reopening again.
        this._onHideModal();
    },
    /**
     * @private
     */
    _onConsentAllClick() {
        this._onAcceptClick(true);
    },
    /**
     * @private
     */
    _onConsentEssentialClick() {
        this._onAcceptClick(false);
    },
    /**
     * @private
     */
    _onHideModal() {
        this._super.apply(this, arguments);
        if (!get_cookie('accepted_cookie_types')) {
            // No confirmation => show popup again next time.
            set_cookie(this.el.id, false, -1, 'required');
            this._popupAlreadyShown = false;
        }
    },
});

return PopupWidget;
});
