odoo.define('barcodes.BarcodeEvents', function(require) {
"use strict";

var core = require('web.core');
var mixins = require('web.mixins');
var session = require('web.session');


// For IE >= 9, use this, new CustomEvent(), instead of new Event()
function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }
CustomEvent.prototype = window.Event.prototype;

var BarcodeEvents = core.Class.extend(mixins.PropertiesMixin, {
    timeout: null,
    key_pressed: {},
    // Regexp to match a barcode input and extract its payload
    // Note: to build in init() if prefix/suffix can be configured
    regexp: /(.{3,})[\n\r\t]*/,
    // By knowing the terminal character we can interpret buffered keys
    // as a barcode as soon as it's encountered (instead of waiting x ms)
    suffix: /[\n\r\t]+/,
    // Keys from a barcode scanner are usually processed as quick as possible,
    // but some scanners can use an intercharacter delay (we support <= 50 ms)
    max_time_between_keys_in_ms: session.max_time_between_keys_in_ms || 55,
    // To be able to receive the barcode value, an input must be focused.
    // On mobile devices, this causes the virtual keyboard to open.
    // Unfortunately it is not possible to avoid this behavior...
    // To avoid keyboard flickering at each detection of a barcode value,
    // we want to keep it open for a while (800 ms).
    inputTimeOut: 800,

    init: function () {
        mixins.PropertiesMixin.init.call(this);
        // Keep a reference of the handler functions to use when adding and removing event listeners
        this.__keydown_handler = _.bind(this.keydown_handler, this);
        this.__keyup_handler = _.bind(this.keyup_handler, this);
        // Bind event handler once the DOM is loaded
        // TODO: find a way to be active only when there are listeners on the bus
        $(_.bind(this.start, this, false));

        // Creates an input who will receive the barcode scanner value.
        this.$barcodeInput = $('<input/>', {
            name: 'barcode',
            type: 'text',
            css: {
                'position': 'fixed',
                'top': '50%',
                'transform': 'translateY(-50%)',
                'visibility': 'hidden',
                'z-index': '-1',
            },
        });
        // Avoid to show autocomplete for a non appearing input
        this.$barcodeInput.attr('autocomplete', 'off');

        this.__blurBarcodeInput = _.debounce(this._blurBarcodeInput, this.inputTimeOut);
    },

    // The keydown and keyup handlers are here to disallow key
    // repeat. When preventDefault() is called on a keydown event
    // the keypress that normally follows is cancelled.
    keydown_handler: function(e){
        if (this.key_pressed[e.which]) {
            e.preventDefault();
        } else {
            this.key_pressed[e.which] = true;
        }
    },

    keyup_handler: function(e){
        this.key_pressed[e.which] = false;
    },

    /**
     * Try to detect the barcode value by listening all keydown events:
     * Checks if a dom element who may contains text value has the focus.
     * If not, it's probably because these events are triggered by a barcode scanner.
     * To be able to handle this value, a focused input will be created.
     *
     * This function also has the responsibility to detect the end of the barcode value.
     * (1) In most of cases, an optional key (tab or enter) is sent to mark the end of the value.
     * So, we direclty handle the value.
     * (2) If no end key is configured, we have to calculate the delay between each keydowns.
     * 'max_time_between_keys_in_ms' depends of the device and may be configured.
     * Exceeded this timeout, we consider that the barcode value is entirely sent.
     *
     * @private
     * @param  {jQuery.Event} e keydown event
     */
    _listenBarcodeScanner: function (e) {
        // Don't catch keypresses which could have a UX purpose (like shortcuts)
        if (e.ctrlKey || e.metaKey || e.altKey)
            return;

        if (!$('input:text:focus, textarea:focus, [contenteditable]:focus').length) {
            $('body').append(this.$barcodeInput);
            this.$barcodeInput.focus();
        }
        if (this.$barcodeInput.is(":focus")) {
            // Handle buffered keys immediately if the keypress marks the end
            // of a barcode or after x milliseconds without a new keypress.
            clearTimeout(this.timeout);
            // On chrome mobile, e.which only works for some special characters like ENTER or TAB.
            if (String.fromCharCode(e.which).match(this.suffix)) {
                this._handleBarcodeValue(e);
            } else {
                this.timeout = setTimeout(this._handleBarcodeValue.bind(this, e),
                    this.max_time_between_keys_in_ms);
            }
            // if the barcode input doesn't receive keydown for a while, remove it.
            this.__blurBarcodeInput();
        }
    },

    /**
     * Retrieves the barcode value from the temporary input element.
     * This checks this value and trigger it on the bus.
     *
     * @private
     * @param  {jQuery.Event} keydown event
     */
    _handleBarcodeValue: function (e) {
        var barcodeValue = this.$barcodeInput.val();
        if (barcodeValue.match(this.regexp)) {
            core.bus.trigger('barcode_scanned', barcodeValue, $(e.target).parent()[0]);
            this._blurBarcodeInput();
        }
    },

    /**
     * Removes the value and focus from the barcode input.
     * If nothing happens, the focus will be lost and
     * the virtual keyboard on mobile devices will be closed.
     *
     * @private
     */
    _blurBarcodeInput: function () {
        if (this.$barcodeInput) {
            // Close the virtual keyboard on mobile browsers
            // FIXME: actually we can't prevent keyboard from opening
            this.$barcodeInput.val('').blur();
        }
    },

    start: function(prevent_key_repeat){
        // Chrome Mobile isn't triggering keypress event.
        // This is marked as Legacy in the DOM-Level-3 Standard.
        // See: https://www.w3.org/TR/uievents/#legacy-keyboardevent-event-types
        $('body').on("keydown", this._listenBarcodeScanner.bind(this));
        if (prevent_key_repeat === true) {
            $('body').bind("keydown", this.__keydown_handler);
            $('body').bind('keyup', this.__keyup_handler);
        }
    },

    stop: function(){
        $('body').unbind("keydown", this.__keydown_handler);
        $('body').unbind('keyup', this.__keyup_handler);
    },
});

return {
    /** Singleton that emits barcode_scanned events on core.bus */
    BarcodeEvents: new BarcodeEvents(),
    /**
     * List of barcode prefixes that are reserved for internal purposes
     * @type Array
     */
    ReservedBarcodePrefixes: ['O-CMD'],
};

});
