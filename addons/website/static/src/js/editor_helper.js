/** @odoo-module */

import { loadWysiwyg } from 'web_editor.loader';
import createPublicRoot from '../js/content/website_root_instance';

// FIXME: Should be made more robust to ensure we're in edit mode.
if (window.parent !== window) {
    // FIXME: Probably don't need the entire package, most likely just styles.
    createPublicRoot.then(rootInstance => window.dispatchEvent(new CustomEvent('PUBLIC-ROOT-READY', {detail: {rootInstance}})));
}
