/** @odoo-module **/

/*global L*/

import { Component, onWillUnmount, onWillUpdateProps, useEffect, useRef, useState } from "@odoo/owl";

const apiTilesRouteWithToken =
    "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}";
const apiTilesRouteWithoutToken = "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png";

const colors = [
    "#F06050",
    "#6CC1ED",
    "#F7CD1F",
    "#814968",
    "#30C381",
    "#D6145F",
    "#475577",
    "#F4A460",
    "#EB7E7F",
    "#2C8397",
];

const mapTileAttribution = `
    © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>
    © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>
    <strong>
        <a href="https://www.mapbox.com/map-feedback/" target="_blank">
            Improve this map
        </a>
    </strong>`;

export class MapRenderer extends Component {
    setup() {
        this.leafletMap = null;
        this.polylines = [];
        this.mapContainerRef = useRef("mapContainer");
        this.state = useState({
            closedGroupIds: [],
            expendedPinList: false,
        });
        this.nextId = 1;

        useEffect(
            () => {
                this.leafletMap = L.map(this.mapContainerRef.el, {
                    maxBounds: [L.latLng(180, -180), L.latLng(-180, 180)],
                });
                L.tileLayer(this.apiTilesRoute, {
                    attribution: mapTileAttribution,
                    tileSize: 512,
                    zoomOffset: -1,
                    minZoom: 2,
                    maxZoom: 19,
                    id: "mapbox/streets-v11",
                    accessToken: this.props.model.metaData.mapBoxToken,
                }).addTo(this.leafletMap);
            },
            () => []
        );
        useEffect(() => {
            this.updateMap();
        });

        onWillUpdateProps(this.onWillUpdateProps);
        onWillUnmount(this.onWillUnmount);
    }
    /**
     * Update group opened/closed state.
     */
    async onWillUpdateProps(nextProps) {
        if (this.props.model.data.groupByKey !== nextProps.model.data.groupByKey) {
            this.state.closedGroupIds = [];
        }
    }
    /**
     * Remove map and the listeners on its markers and routes.
     */
    onWillUnmount() {

        // remove polyline() 
        if (this.leafletMap) {
            this.leafletMap.remove();
        }
    }

    get apiTilesRoute() {
        return this.props.model.data.useMapBoxAPI
            ? apiTilesRouteWithToken
            : apiTilesRouteWithoutToken;
    }

    /**
     * @param {Number} groupId
     */
    getGroupColor(groupId) {
        const index = Object.keys(this.props.model.data.recordGroups).indexOf(groupId);
        return colors[index % colors.length];
    }

    updateMap() {

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.leafletMap);

        let records = this.props.model.data.recordGroups;
        let minLat = 90;
        let minLon = 180;

        for (var group_key in records){
            var group_record = records[group_key];
            const trackers = []
            for (var record of group_record['records']) {
                trackers.push([record['latitude'],record['longitude']]);
                minLat = Math.min(record['latitude'],minLat)
                minLon = Math.min(record['longitude'],minLon)
            }
            L.polyline(trackers, {color: this.getGroupColor(group_key)}).addTo(this.leafletMap);              
        }
        this.leafletMap.setView([minLat, minLon], 18);
    }

    togglePinList() {
        this.state.expendedPinList = !this.state.expendedPinList;

    }

    get expendedPinList() {
        return this.env.isSmall ? this.state.expendedPinList : false;
    }

    get canDisplayPinList() {
        return !this.env.isSmall || this.expendedPinList;
    }
}

MapRenderer.template = "partner_tracker.MapRenderer";
MapRenderer.props = {
    model: Object,
    onMarkerClick: Function,
};
