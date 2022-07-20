/** @odoo-module **/

import { browser } from '@web/core/browser/browser';
import { registry } from '@web/core/registry';

const { EventBus } = owl;

export const presenceService = {
    start() {
        const LOCAL_STORAGE_PREFIX = 'presence';
        const bus = new EventBus();

        let isOdooFocused = true;
        let lastPresenceTime = (
            browser.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}.lastPresence`)
            || new Date().getTime()
        );

        function onPresence() {
            lastPresenceTime = new Date().getTime();
            browser.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}.lastPresence`, lastPresenceTime);
        }

        function onFocusChange(isFocused) {
            isOdooFocused = isFocused;
            browser.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}.focus`, isOdooFocused);
            if (isFocused) {
                lastPresenceTime = new Date().getTime();
                bus.trigger('window_focus', isOdooFocused);
            }
        }

        function onStorage({ key, newValue }) {
            if (key === `${LOCAL_STORAGE_PREFIX}.focus`) {
                isOdooFocused = JSON.parse(newValue);
                bus.trigger('window_focus', newValue);
            }
            if (key === `${LOCAL_STORAGE_PREFIX}.lastPresence`) {
                lastPresenceTime = JSON.parse(newValue);
            }
        }
        browser.addEventListener('storage', onStorage);
        browser.addEventListener('focus', () => onFocusChange(true));
        browser.addEventListener('blur', () => onFocusChange(false));
        browser.addEventListener('unload', () => onFocusChange(false));
        browser.addEventListener('click', onPresence);
        browser.addEventListener('keydown', onPresence);

        return Object.assign(bus, {
            getLastPresence() {
                return lastPresenceTime;
            },
            isOdooFocused() {
                return isOdooFocused;
            }
        });
    },
};

registry.category('services').add('presence', presenceService);
