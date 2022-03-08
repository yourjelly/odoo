/** @odoo-module **/

import { registry } from '@web/core/registry';
import { useService } from '@web/core/utils/hooks';

const { Component, onWillStart, useEffect, useRef } = owl;

export class WebsitePreview extends Component {
    setup() {
        this.websiteService = useService('website');
        this.title = useService('title');

        this.iframeFallbackUrl = '/website/iframefallback';

        this.iframe = useRef('iframe');
        this.iframefallback = useRef('iframefallback');

        onWillStart(async () => {
            await this.websiteService.fetchWebsites();
            this.initialUrl = `/website/force/${this.websiteId}?path=${this.path}`;
        });

        useEffect(() => {
            this.websiteService.currentWebsiteId = this.websiteId;
            this.websiteService.context.showNewContentModal = this.props.action.context.params && this.props.action.context.params.display_new_content;
            return () => this.websiteService.currentWebsiteId = null;
        }, () => [this.props.action.context.params]);

        useEffect(() => {
            const onPageLoaded = () => {
                // This replaces the browser url (/web#action=website...) with
                // the iframe's url (it is clearer for the user).
                this.currentUrl = this.iframe.el.contentDocument.location.href;
                this.currentTitle = this.iframe.el.contentDocument.title;
                history.replaceState({}, this.currentTitle, this.currentUrl);
                this.title.setParts({ action: this.currentTitle });

                this.websiteService.pageDocument = this.iframe.el.contentDocument;

                // Before leaving the iframe, its content is replicated on an
                // underlying iframe, to avoid for white flashes (visible on
                // Chrome Windows/Linux).
                this.iframe.el.contentWindow.addEventListener('beforeunload', () => {
                    this.iframefallback.el.contentDocument.body.replaceWith(this.iframe.el.contentDocument.body.cloneNode(true));
                    $().getScrollingElement(this.iframefallback.el.contentDocument)[0].scrollTop = $().getScrollingElement(this.iframe.el.contentDocument)[0].scrollTop;
                });
            };

            this.iframe.el.addEventListener('load', () => onPageLoaded());
            return this.iframe.el.removeEventListener('load', () => onPageLoaded());
        }, () => []);
    }

    get websiteId() {
        let websiteId = this.props.action.context.params && this.props.action.context.params.website_id;
        // When no parameter is passed to the client action, the current
        // website from the website service is taken. By default, it will be
        // the one from the session.
        if (!websiteId) {
            websiteId = this.websiteService.currentWebsite && this.websiteService.currentWebsite.id;
        }
        if (!websiteId) {
            websiteId = this.websiteService.websites[0].id;
        }
        return websiteId;
    }

    get path() {
        let path = this.props.action.context.params && this.props.action.context.params.path;
        if (!path) {
            path = '/';
        }
        return path;
    }
}
WebsitePreview.template = 'website.WebsitePreview';

registry.category('actions').add('website_preview', WebsitePreview);
