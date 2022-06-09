/** @odoo-module **/

import { registry } from '@web/core/registry';
import { useService } from '@web/core/utils/hooks';

const { Component, onWillStart, useRef } = owl;

export class WebsitePreview extends Component {
    setup() {
        this.websiteService = useService('website');

        this.iframeFallbackUrl = '/website/iframefallback';

        this.iframe = useRef('iframe');
        this.iframefallback = useRef('iframefallback');

        onWillStart(async () => {
            await this.websiteService.fetchWebsites();
            this.initialUrl = `/website/force/${this.websiteId}?path=${this.path}`;
        });
    }

    get websiteId() {
        let websiteId = this.props.action.context.params && this.props.action.context.params.website_id;
        if (!websiteId) {
            websiteId = this.websiteService.websites[0].id;
        }
        return websiteId;
    }

    get path() {
        let path = this.props.action.context.params && this.props.action.context.params.path;
        if (path) {
            const url = new URL(path, window.location.origin);
            // If a path with an external domain, or matching a backend route
            // that should be opened in the top window, is passed as a
            // paramater, it is likely that the user did not do that
            // intentionally. He is redirected to his homepage.
            if (this._isTopWindow(url)) {
                path = '/';
            }
        } else {
            path = '/';
        }
        return path;
    }

    /**
     * Returns true if the url should be opened in the top
     * window.
     *
     * @param host {string} host of the route.
     * @param pathname {string} path of the route.
     * @private
     */
    _isTopWindow({ host, pathname }) {
        const backendRoutes = ['/web', '/web/session/logout'];
        return host !== window.location.host || (pathname && backendRoutes.includes(pathname));
    }

    _onPageLoaded() {
        // This replaces the browser url (/web#action=website...) with
        // the iframe's url (it is clearer for the user).
        this.currentUrl = this.iframe.el.contentDocument.location.href;
        history.replaceState({}, this.props.action.display_name, this.currentUrl);

        // Before leaving the iframe, its content is replicated on an
        // underlying iframe, to avoid for white flashes (visible on
        // Chrome Windows/Linux).
        this.iframe.el.contentWindow.addEventListener('beforeunload', () => {
            this.iframefallback.el.contentDocument.body.replaceWith(this.iframe.el.contentDocument.body.cloneNode(true));
            $().getScrollingElement(this.iframefallback.el.contentDocument)[0].scrollTop = $().getScrollingElement(this.iframe.el.contentDocument)[0].scrollTop;
        });

        // The clicks on the iframe are listened, so that links with external
        // redirections can be opened in the top window.
        this.iframe.el.contentDocument.addEventListener('click', (ev) => {
            const linkEl = ev.target.closest('[href]');
            if (!linkEl) {
                return;
            }

            const { href, target } = linkEl;
            if (href && target !== '_blank' && !this.websiteContext.edition && this._isTopWindow(linkEl)) {
                ev.preventDefault();
                ev.stopPropagation();
                window.location.replace(href);
            }
        });
    }
}
WebsitePreview.template = 'website.WebsitePreview';

registry.category('actions').add('website_preview', WebsitePreview);
