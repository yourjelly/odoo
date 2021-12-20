/** @odoo-module */

import { session } from '@web/session';
// import { _t } from "@web/core/l10n/translation"; // FIXME don't know why it does not work
const _t = str => str;

/**
 * This script, served with frontend pages, displays buttons in the top left
 * corner to provide the authenticated user an access to his odoo backend.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (session.is_website_user) {
        return;
    }

    if (!window.frameElement) {
        const websiteId = document.documentElement.dataset.websiteId;
        const {pathname, search} = window.location;
        const params = new URLSearchParams(search).toString();

        const autoredirectToBackendAction = false;
        if (autoredirectToBackendAction) {
            document.body.innerHTML = '';
            window.location.replace(`/web#action=website.website_preview&path=${encodeURIComponent(params ? `${pathname}?${params}` : pathname)}&website_id=${websiteId}`);
        } else {
            const frontendToBackendNavEl = document.createElement('div');
            frontendToBackendNavEl.classList.add('o_frontend_to_backend_nav');

            const backendAppsButtonEl = document.createElement('a');
            backendAppsButtonEl.href = '/web';
            backendAppsButtonEl.title = _t("Go to your Odoo Apps");
            backendAppsButtonEl.classList.add('o_frontend_to_backend_apps_btn', 'fa', 'fa-th');
            frontendToBackendNavEl.appendChild(backendAppsButtonEl);

            const backendEditButtonEl = document.createElement('a');
            backendEditButtonEl.href = `/web#action=website.website_preview&path=${encodeURIComponent(params ? `${pathname}?${params}` : pathname)}&website_id=${websiteId}`;
            backendEditButtonEl.title = _t("Edit your page content");
            backendEditButtonEl.classList.add('o_frontend_to_backend_edit_btn', 'fa', 'fa-cog');
            frontendToBackendNavEl.appendChild(backendEditButtonEl);

            document.body.appendChild(frontendToBackendNavEl);
        }
    }
});
