/** @odoo-module */

import { createMock, makePublicListeners } from "../hoot_utils";

//-----------------------------------------------------------------------------
// Global
//-----------------------------------------------------------------------------

const { EventTarget, navigator, Set, TypeError } = globalThis;

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

const defaultUserAgent = navigator.userAgent;
/** @type {Set<MockPermissionStatus>} */
const permissionStatuses = new Set();
let currentUserAgent = defaultUserAgent;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class MockClipboard {
    /** @type {unknown} */
    #value = null;

    async read() {
        return this.readSync();
    }

    async readText() {
        return this.readTextSync();
    }

    async write(value) {
        return this.writeSync(value);
    }

    async writeText(value) {
        return this.writeTextSync(value);
    }

    // Methods below are not part of the Clipboard API but are useful to make
    // test events synchronous.

    /**
     * @returns {unknown}
     */
    readSync() {
        return this.#value;
    }

    /**
     * @returns {string}
     */
    readTextSync() {
        return String(this.#value ?? "");
    }

    /**
     * @param {unknown} value
     */
    writeSync(value) {
        this.#value = value;
    }

    /**
     * @param {string} value
     */
    writeTextSync(value) {
        this.#value = String(value ?? "");
    }
}

export class MockPermissions {
    /**
     * @param {PermissionDescriptor} permissionDesc
     */
    async query(permissionDesc) {
        return this.querySync(permissionDesc);
    }

    // Methods below are not part of the Permissions API but are useful to make
    // test events synchronous.

    /**
     * @param {PermissionDescriptor} permissionDesc
     */
    querySync({ name }) {
        if (!(name in PERMISSIONS)) {
            throw new TypeError(
                `The provided value '${name}' is not a valid enum value of type PermissionName`
            );
        }
        return new MockPermissionStatus(name);
    }
}

export class MockPermissionStatus extends EventTarget {
    /** @type {PermissionName} */
    #name;

    /**
     * @param {PermissionName} name
     * @param {PermissionState} value
     */
    constructor(name) {
        super(...arguments);

        makePublicListeners(this, ["change"]);

        this.#name = name;
    }

    get name() {
        return this.#name;
    }

    get state() {
        return PERMISSIONS[this.#name];
    }
}

export const mockClipboard = new MockClipboard();

export const mockPermissions = new MockPermissions();

export const mockNavigator = createMock(navigator, {
    clipboard: { value: mockClipboard },
    permissions: { value: mockPermissions },
    userAgent: { get: () => currentUserAgent },
});

/** @type {Record<PermissionName, PermissionState>} */
export const PERMISSIONS = {
    "persistent-storage": "denied",
    "screen-wake-lock": "denied",
    "xr-spatial-tracking": "denied",
    geolocation: "denied",
    notifications: "denied",
    push: "denied",
};

export function cleanupNavigator() {
    permissionStatuses.clear();
    currentUserAgent = defaultUserAgent;
}

/**
 * @param {PermissionName} name
 * @param {PermissionState} [value]
 */
export function mockPermission(name, value) {
    PERMISSIONS[name] = value;

    for (const permissionStatus of permissionStatuses) {
        if (permissionStatus.name === name) {
            permissionStatus.dispatchEvent(new Event("change"));
        }
    }
}

/**
 * @param {string} userAgent
 */
export function mockUserAgent(userAgent) {
    currentUserAgent = userAgent;
}
