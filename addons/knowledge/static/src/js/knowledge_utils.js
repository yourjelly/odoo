/** @odoo-module */

import localStorage from 'web.local_storage';

const key = 'knowledge_full_width_mode';

/**
 * @returns {boolean}
 */
export function isFullWidthModeOptionEnabled () {
    return localStorage.getItem(key) === 'true';
};

/**
 * @param {boolean} value
 */
export function saveFullWidthModeOption (value) {
    localStorage.setItem(key, value);
};
