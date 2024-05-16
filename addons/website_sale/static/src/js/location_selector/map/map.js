/** @odoo-module **/
/*global L*/

import { Component, useEffect, useRef } from "@odoo/owl";
import { renderToString } from "@web/core/utils/render";
import {
    LocationSchedule
} from "@website_sale/js/location_selector/location_schedule/location_schedule";

export class Map extends Component {
    static components = { LocationSchedule };
    static template = 'website_sale.locationSelector.map';
    static props = {
        locations: {
            type: Array,
            element: {
                type: Object,
                values: {
                    id: String,
                    name: String,
                    openingHours: {
                        type: Object,
                        values: {
                            type: Array,
                            element: String,
                            optional: true,
                        },
                    },
                    street: String,
                    city: String,
                    postal_code: String,
                    country: String,
                    pickup_location_data: String,
                    latitude: String,
                    longitude: String,
                }
            },
        },
        selectedLocationId: [String, {value: false}],
        setSelectedLocation: Function,
        validateSelection: Function,
    };

    setup() {
        this.leafletMap = null;
        this.markers = [];
        this.mapContainerRef = useRef("mapContainer");

        // Create the map.
        useEffect(
            () => {
                this.leafletMap = L.map(this.mapContainerRef.el, {
                    zoom: 13,
                });
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                }).addTo(this.leafletMap);
            },
            () => []
        );

        // Update the makers.
        useEffect(
            (locations) => {
                this.addMarkers(locations);
                return () => {
                    this.removeMarkers();
                };
            },
            () => [this.props.locations, this.props.selectedLocationId]
        );

        // Center the map on the selected location.
        useEffect(
            (locations, selectedLocationId) => {
                const selectedLocation = locations.find(
                    l => String(l.id) === selectedLocationId
                );
                if (selectedLocation) {
                    // Center the Map.
                    this.leafletMap.panTo(
                        [selectedLocation.latitude, selectedLocation.longitude],
                        { animate: true }
                    );
                }
            },
            () => [this.props.locations, this.props.selectedLocationId]
        );
    }

    /**
     * Adds the closest locations' corresponding markers on the map.
     * Binds events to the created markers.
     *
     * @param {Array} locations - The list of locations to display on the map.
     * @return {void}
     */
    addMarkers(locations) {
        for (const loc of locations) {
            // Icon creation
            const iconInfo = {
                className: String(loc.id) === this.props.selectedLocationId
                           ? "o_location_selector_marker_icon_selected"
                           : "o_location_selector_marker_icon",
                html: renderToString(
                    "website_sale.locationSelector.map.marker",
                    { number: locations.indexOf(loc) + 1 },
                ),
            };
            const marker = L.marker(
                [ loc.latitude, loc.longitude ],
                {
                    icon: L.divIcon(iconInfo),
                    title: locations.indexOf(loc) + 1,
                },
            );
            marker.addTo(this.leafletMap);
            marker.on("click", () => {
                this.props.setSelectedLocation(loc.id);
            });
            this.markers.push(marker);
        }
    }

    /**
     * Remove the markers from the map and empty the markers array.
     *
     * @return {void}
     */
    removeMarkers() {
        for (const marker of this.markers) {
            marker.off("click");
            this.leafletMap.removeLayer(marker);
        }
        this.markers = [];
    }

    /**
     * Get the city and the postal code.
     *
     * Return the city and the postal code using the sequence specific to the country.
     *
     * @param {Number} selectedLocation - The location form which the city and the postal code
     *                                    should be taken.
     * @return {Object} The city and the postal code.
     */
    getCityAndPostalCode(selectedLocation) {
        if (this.env.zipBeforeCity) {
            return selectedLocation.postal_code + " " + selectedLocation.city
        } else {
            return selectedLocation.city + " " + selectedLocation.postal_code
        }
    }

    /**
     * Find the selected location based on its id.
     *
     * @return {Object} The selected location.
     */
    get selectedLocation() {
        return this.props.locations.find(l => String(l.id) === this.props.selectedLocationId)
    }
}
