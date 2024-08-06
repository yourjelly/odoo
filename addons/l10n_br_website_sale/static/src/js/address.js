/** @odoo-module **/

import websiteSaleAddress from '@website_sale/js/address';

websiteSaleAddress.include({
    events: Object.assign(
        {},
        websiteSaleAddress.prototype.events,
        {
            'change input[name="zip"]': '_onChangeZip',
        }
    ),

    _selectState: function(id) {
        this.addressForm.querySelector(`select[name="state_id"] > option[value="${id}"]`).selected = 'selected';
    },

    _onChangeZip: function() {
        const newZip = this.addressForm.zip.value.padEnd(5, '0');

        for (let option of this.addressForm.querySelectorAll('select[name="city_id"]:not(.d-none) > option')) {
            const ranges = option.getAttribute('zip-ranges');
            if (ranges) {
                for (let range of ranges.matchAll(/\[[^\[]+\]/g)) {
                    range = range[0].replace(/[\[\]]/g, '');
                    let [start, end] = range.split(' ');
                    if (newZip >= start && newZip <= end) {
                        option.selected = 'selected';
                        this._selectState(option.getAttribute('state-id'));
                        return;
                    }
                }
            }
        }
    },

    _setVisibility(selector, should_show) {
        this.addressForm.querySelectorAll(selector).forEach(el => {
            if (should_show) {
                el.classList.remove('d-none');
            } else {
                el.classList.add('d-none');
            }

            // Disable hidden inputs to avoid sending back e.g. an empty street when street_name and street_number is
            // filled. It causes street_name and street_number to be lost.
            if (el.tagName === 'INPUT') {
                el.disabled = !should_show;
            }

            el.querySelectorAll('input').forEach(input => input.disabled = !should_show);
        })
    },

    async _changeCountry(ev) {
        const res = await this._super(...arguments);
        const countryOption = this.addressForm.country_id;
        const selectedCountryCode = countryOption.value ? countryOption.selectedOptions[0].getAttribute('code') : '';

        if (selectedCountryCode === 'BR') {
            this._setVisibility('.o_standard_address', !'hide');
            this._setVisibility('.o_extended_address', !!'show');
        } else {
            this._setVisibility('.o_standard_address', !!'show');
            this._setVisibility('.o_extended_address', !'hide');
        }

        return res;
    }
});
