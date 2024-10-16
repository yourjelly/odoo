import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

const stateNameRegex = /(.*?)(\(.*\))?$/;

export function useSpreadsheetGeoService() {
    const orm = useService("orm");
    return {
        getAvailableRegions: async function () {
            return [
                { id: "world", label: _t("World"), defaultProjection: "mercator" },
                { id: "usa", label: _t("United States"), defaultProjection: "albersUsa" },
                { id: "europe", label: _t("Europe"), defaultProjection: "mercator" },
                { id: "africa", label: _t("Africa"), defaultProjection: "mercator" },
                { id: "asia", label: _t("Asia"), defaultProjection: "mercator" },
            ];
        },
        getTopoJson: async function (region) {
            return await fetchJsonFromServer(`/spreadsheet/static/topojson/${region}.topo.json`);
        },
        geoFeatureNameToId: async function (region, name) {
            if (region === "usa") {
                // State display names are appended with the country in odoo (e.g. "California (US)").
                const match = name.match(stateNameRegex);
                if (match) {
                    name = match[1].trim();
                }
            }
            name = normalizeFeatureName(name);
            const mapping = await getFeatureIdMapping(orm, region);
            return mapping?.[name];
        },
    };
}

const featureMappingCache = new Map();
let countriesMappingPromise = undefined;
let usStatesMappingPromise = undefined;

async function getFeatureIdMapping(orm, region) {
    if (featureMappingCache.has(region)) {
        return featureMappingCache.get(region);
    }

    if (region === "usa") {
        if (usStatesMappingPromise) {
            return usStatesMappingPromise;
        }
        usStatesMappingPromise = orm
            .searchRead("res.country.state", [["country_id.code", "=", "US"]], ["name", "code"])
            .then((usStates) => {
                const mapping = {};
                for (const state of usStates) {
                    mapping[normalizeFeatureName(state.name)] = state.code;
                }
                featureMappingCache.set("usa", mapping);
                return featureMappingCache.get("usa");
            })
            .catch((e) => {
                console.error(e);
                featureMappingCache.set("usa", {});
            })
            .finally(() => {
                usStatesMappingPromise = undefined;
            });
        return usStatesMappingPromise;
    }

    if (countriesMappingPromise) {
        return countriesMappingPromise;
    }
    countriesMappingPromise = orm
        .searchRead("res.country", [], ["name", "code"])
        .then((resCountries) => {
            const mapping = {};
            for (const country of resCountries) {
                mapping[normalizeFeatureName(country.name)] = country.code;
            }
            featureMappingCache.set(region, mapping);
            return featureMappingCache.get(region);
        })
        .catch((e) => {
            console.error(e);
            featureMappingCache.set(region, {});
        })
        .finally(() => {
            countriesMappingPromise = undefined;
        });

    return countriesMappingPromise;
}

const diacriticalMarksRegex = /[\u0300-\u036f]/g;

/** Put the feature name in lowercase and remove the accents */
function normalizeFeatureName(name) {
    return name.normalize("NFD").replace(diacriticalMarksRegex, "").toLowerCase();
}

const currentPromises = new Map();
const cache = new Map();

async function fetchJsonFromServer(url) {
    if (cache.has(url)) {
        return cache.get(url);
    }
    if (currentPromises.has(url)) {
        return currentPromises.get(url);
    }

    const promise = fetch(url, { method: "GET" })
        .then((res) => res.json())
        .then((json) => {
            cache.set(url, json);
            return json;
        })
        .catch((e) => {
            cache.set(url, {});
            console.error(e);
        })
        .finally(() => {
            currentPromises.delete(url);
        });

    currentPromises.set(url, promise);
    return promise;
}
