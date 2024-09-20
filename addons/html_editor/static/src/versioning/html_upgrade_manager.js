import {
    compareVersions,
    manifest,
    VERSION,
    VERSION_SELECTOR,
    VERSIONS,
} from "@html_editor/versioning/__editor_manifest__";

function getUpgradeMap(version) {
    const upgradeMap = new Map();
    for (const subVersion of VERSIONS) {
        if (compareVersions(subVersion, version) < 1) {
            // skip already applied versions
            continue;
        }
        const upgradeInfo = {};
        for (const [path, items] of Object.entries(manifest.get(subVersion))) {
            for (const [item, selector] of Object.entries(items)) {
                upgradeInfo[item] ||= {
                    selectors: [],
                    upgrades: [],
                };
                const upgrade = odoo.loader.modules.get(path).upgrades[item];
                if (!upgrade) {
                    throw new Error(`"${item}" could not be found at "${path}" or it did not load`);
                }
                upgradeInfo[item].selectors.push(selector);
                upgradeInfo[item].upgrades.push(upgrade);
            }
        }
        upgradeMap.set(subVersion, upgradeInfo);
    }
    return upgradeMap;
}

export class HtmlUpgradeManager {
    constructor(env = {}) {
        this.fragment = this.setupFragment();
        this.editable = this.fragment.firstElementChild;
        this.env = env;
    }

    get value() {
        return this.upgradedValue || this.originalValue;
    }

    processForUpgrade(value) {
        this.originalValue = value;
        this.upgradedValue = value;
        this.editable.innerHTML = value;
        const versionNode = this.editable.querySelector(VERSION_SELECTOR);
        const version = versionNode?.dataset.oeVersion || "0.0";
        if (version === VERSION) {
            return value;
        }
        try {
            const upgradeMap = getUpgradeMap(version);
            this.upgradedValue = this.upgrade(upgradeMap);
        } catch (e) {
            console.log("upgrade failed");
            throw e;
        }
        return this.value;
    }

    setupFragment() {
        const fragment = document.createDocumentFragment();
        fragment.append(document.createElement("DIV"));
        return fragment;
    }

    upgrade(upgradeMap) {
        for (const upgradeInfo of upgradeMap.values()) {
            for (const info of Object.values(upgradeInfo)) {
                const selector = info.selectors.join(", ");
                const elements = this.editable.querySelectorAll(selector);
                if (elements.length) {
                    for (const upgrade of info.upgrades) {
                        upgrade(elements, this.env);
                    }
                }
            }
        }
        return this.editable.innerHTML;
    }
}
