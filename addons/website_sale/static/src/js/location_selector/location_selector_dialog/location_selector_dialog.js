/** @odoo-module **/

import {
    Component,
    onMounted,
    onWillStart,
    onWillUnmount,
    useEffect,
    useState,
    useSubEnv
} from "@odoo/owl";
import { AssetsLoadingError, loadCSS, loadJS } from "@web/core/assets";
import { browser } from "@web/core/browser/browser";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";
import { SelectMenu } from "@web/core/select_menu/select_menu";
import { useDebounced } from "@web/core/utils/timing";
import { LocationList } from "@website_sale/js/location_selector/location_list/location_list";
import { Map } from "@website_sale/js/location_selector/map/map";

export class LocationSelectorDialog extends Component {
    static components = { Dialog, LocationList, Map, SelectMenu };
    static template = 'website_sale.locationSelector.dialog';
    static props = {
        zipCode: String,
        countryCode: { type: String, optional: true},
        selectedLocationId: { type: String, optional: true},
        save: Function,
        close: Function, // This is the close from the env of the Dialog Component
    };
    static defaultProps = {
        selectedLocationId: false,
    };

    setup() {
        this.title = _t("Choose a pick-up point");
        this.state = useState({
            locations: [],
            countries: [],
            selectedCountry: {code: this.props?.countryCode || false},
            error: false,
            viewMode: 'list',
            zipCode: this.props.zipCode,
            // Some APIs like FedEx use strings to identify locations.
            selectedLocationId: String(this.props.selectedLocationId),
            loadMap: false,
            isSmall: this.env.isSmall,
        });
        this.debouncedOnResize = useDebounced(this.updateSize, 300);
        this.debouncedSearchButton = useDebounced(() => {
            this.state.locations = [];
            this._updateLocations();
        }, 300);

        useSubEnv({
            zipBeforeCity: this.zipBeforeCity.bind(this),
        });

        onMounted(() => {
            browser.addEventListener("resize", this.debouncedOnResize);
            this.updateSize();
        });
        onWillUnmount(() => browser.removeEventListener("resize", this.debouncedOnResize));

        // Fetch new locations when the zip code is updated.
        useEffect(
            (zipCode) => {
                this._updateLocations(zipCode)
                return () => {
                    this.state.locations = []
                };
            },
            () => [this.state.zipCode]
        );

        onWillStart(async () => {
            /**
             * We load the script for the map before rendering the owl component to avoid a
             * UserError if the script can't be loaded (e.g. if the customer loses the connection
             * between the rendering of the page and when he opens the location selector, or if the
             * CDN’s doesn't host the library anymore).
             */
            try {
                await Promise.all([
                    loadJS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"),
                    loadCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"),
                ])
                this.state.loadMap = true;
            } catch (error) {
                if (!(error instanceof AssetsLoadingError)) {
                    throw error;
                }
            }
        });

        onWillStart(async () => {
            this.state.countries = await this._getCountries();
        });
    }

    //--------------------------------------------------------------------------
    // Data Exchanges
    //--------------------------------------------------------------------------

    /**
     * Fetch the closest pickup locations based on the zip code.
     *
     * @private
     * @param {String} zip - The postal code used to look for close locations.
     * @return {Object} The result values.
     */
    async _getLocations(zip) {
        return rpc('/shop/get_close_locations', {
            zip_code: zip,
            country_code: this.state.selectedCountry.code,
        });
    }

    async _getCountries() {
        return rpc('/shop/get_delivery_method_countries', {
            dm_id: this.props.dmId,
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Get the locations based on the zip code.
     *
     * Select the first location available if no location is currently selected or if the currently
     * selected location is not on the list anymore.
     *
     * @private
     * @param {String} zip - The postal code used to look for close locations.
     * @return {void}
     */
    async _updateLocations(zip) {
        this.state.locations = []
        this.state.error = false;
        const { close_locations, selected_country, error } = await this._getLocations(zip);
        if (error) {
            this.state.error = error;
        } else {
            this.state.locations = close_locations;
            this.state.selectedCountry = selected_country;
            if (!this.state.locations.find(l => String(l.id) === this.state.selectedLocationId)) {
                this.state.selectedLocationId = this.state.locations[0]
                                                ? String(this.state.locations[0].id)
                                                : false;
            };
        }
    }

    /**
     * Set the selectedLocationId in the state.
     *
     * @param {String} locationId
     * @return {void}
     */
    setSelectedLocation(locationId) {
        this.state.selectedLocationId = String(locationId);
    }

    /**
     * Confirm the current selected location.
     *
     * @return {void}
     */
    async validateSelection() {
        if (!this.state.selectedLocationId) return;
        const location = this.state.locations.find(
            l => String(l.id) === this.state.selectedLocationId
        );
        await this.props.save(location, this.state.selectedCountry.code);
        this.props.close();
    }

    //--------------------------------------------------------------------------
    // User Interface
    //--------------------------------------------------------------------------

    /**
     * Determines the component to show in mobile view based on the current state.
     *
     * If the map can be loaded, return the Map component if `viewMode` is strictly equal to `map`,
     * else return the List component.
     *
     * @return {Component} The component to show in mobile view.
     */
    get mobileComponent() {
        if (this.state.viewMode == 'map' && this.state.loadMap) return Map;
        return LocationList;
    }

    /**
     *
     * @return {void}
     */
    updateSize() {
        this.state.isSmall = this.env.isSmall;
    }

    zipBeforeCity() {
        const fields = this.state.selectedCountry.fields;
        if (fields.indexOf('zip') < fields.indexOf('city')) {
            return true
        }
        else {
            return false
        }
    }

}
