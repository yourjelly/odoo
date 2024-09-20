/**
 * Use this method to populate the editor manifest.
 *
 * @param {string} version majorVersion.minorVersion
 * @param {Object} versionData see manifest
 */
export function addVersion(version, versionData) {
    if (!manifest.has(version)) {
        const index = searchVersionIndex(version, VERSIONS);
        VERSIONS.splice(index, 0, version);
        manifest.set(version, {});
    }
    Object.assign(manifest.get(version), versionData);
}

export const VERSION_SELECTOR = "[data-oe-version]";
export function stripVersion(element) {
    element.querySelectorAll(VERSION_SELECTOR).forEach((el) => {
        delete el.dataset.oeVersion;
    });
}

export const VERSION = "1.0";
export const VERSIONS = [VERSION];
export const manifest = new Map([
    // [
    //     "majorVersion.minorVersion",
    //     {
    //         "@module/path": {
    //             itemToUpgradeName: ".selector"
    //         }
    //     },
    // ],
    [VERSION, {}],
]);

/**
 * Compare 2 versions
 *
 * @param {string|Array<number>} version1
 * @param {string|Array<number>} version2
 * @returns {number} -1 if version1 < version2
 *                   0 if version1 === version2
 *                   1 if version1 > version2
 */
export function compareVersions(version1, version2) {
    if (typeof version1 === "string") {
        version1 = version1.split(".").map((v) => parseInt(v));
    }
    if (typeof version2 === "string") {
        version2 = version2.split(".").map((v) => parseInt(v));
    }
    if (version1[0] < version2[0] || (version1[0] === version2[0] && version1[1] < version2[1])) {
        return -1;
    } else if (version1[0] === version2[0] && version1[1] === version2[1]) {
        return 0;
    } else {
        return 1;
    }
}

function binarySearch(comparator, needle, array) {
    let first = 0;
    let last = array.length - 1;
    while (first <= last) {
        const mid = (first + last) >> 1;
        const c = comparator(needle, array[mid]);
        if (c > 0) {
            first = mid + 1;
        } else if (c < 0) {
            last = mid - 1;
        } else {
            return mid;
        }
    }
    return first;
}

const searchVersionIndex = binarySearch.bind(undefined, compareVersions);
