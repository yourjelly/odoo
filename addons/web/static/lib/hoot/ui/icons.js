/** @odoo-module **/

import { markup } from "@odoo/owl";

const makeIcon = (emoji) => markup(`<i class="hoot-icon">${emoji}</i>`);

export const ICONS = {
    bug: makeIcon("🐞"),
    down: makeIcon("▼"),
    chain: makeIcon("⛓️"),
    fail: makeIcon("❌"),
    folder: makeIcon("📂"),
    forward: makeIcon("⏩"),
    gear: makeIcon("⚙️"),
    label: makeIcon("🏷️"),
    moon: makeIcon("🌕"),
    play: makeIcon("▶️"),
    repeat: makeIcon("⟲"),
    stop: makeIcon("■"),
    sun: makeIcon("☀️"),
    test: makeIcon("🧪"),
    up: makeIcon("▲"),
};
