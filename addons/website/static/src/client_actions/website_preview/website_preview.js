/** @odoo-module **/

import { registry } from '@web/core/registry';
import { useService } from '@web/core/utils/hooks';
import core from 'web.core';

import { WebsiteEditorComponent } from '../../components/editor/editor';
import { WebsiteTranslator } from '../../components/translator/translator';
import {OptimizeSEODialog} from '@website/components/dialog/seo';

const { Component, onWillStart, useEffect, useRef, useState } = owl;

class BlockIframe extends Component {
    setup() {
        this.websiteService = useService('website');
        this.state = useState({
            blockIframe: false,
            showLoader: false,
        });
        this.iframeLocks = 0;
        this.websiteService.bus.addEventListener("BLOCK", this.block.bind(this));
        this.websiteService.bus.addEventListener("UNBLOCK", this.unblock.bind(this));
    }
    block(event) {
        if (event.detail.showLoader && !this.state.showLoader) {
            setTimeout(() => {
                this.state.showLoader = true;
            }, event.detail.loaderDelay);
        }
        if (this.iframeLocks === 0) {
            this.state.blockIframe = true;
        }
        this.iframeLocks++;
    }
    unblock() {
        this.iframeLocks--;
        if (this.iframeLocks < 0) {
            this.iframeLocks = 0;
        }
        if (this.iframeLocks === 0) {
            this.state.blockIframe = false;
            this.state.showLoader = false;
        }
    }
}
BlockIframe.template = 'website.BlockIframe';

export class WebsitePreview extends Component {
    setup() {
        this.websiteService = useService('website');
        this.dialogService = useService('dialog');
        this.title = useService('title');

        this.iframeFallbackUrl = '/website/iframefallback';

        this.iframe = useRef('iframe');
        this.iframefallback = useRef('iframefallback');
        this.websiteContext = useState(this.websiteService.context);

        onWillStart(async () => {
            await this.websiteService.fetchWebsites();
            this.initialUrl = `/website/force/${this.websiteId}?path=${this.path}`;
        });

        useEffect(() => {
            this.websiteService.currentWebsiteId = this.websiteId;
            this.websiteService.context.showNewContentModal = this.props.action.context.params && this.props.action.context.params.display_new_content;
            this.websiteService.context.edition = this.props.action.context.params && !!this.props.action.context.params.enable_editor;
            this.websiteService.context.translation = this.props.action.context.params && !!this.props.action.context.params.edit_translations;
            if (this.props.action.context.params && this.props.action.context.params.enable_seo) {
                this.iframe.el.addEventListener('load', () => {
                    this.websiteService.pageDocument = this.iframe.el.contentDocument;
                    this.dialogService.add(OptimizeSEODialog);
                }, {once: true});
            }
            return () => {
                this.websiteService.currentWebsiteId = null;
                this.websiteService.websiteRootInstance = undefined;
                this.websiteService.pageDocument = null;
                this.websiteService.contentWindow = null;
            };
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
                this.websiteService.contentWindow = this.iframe.el.contentWindow;

                // Before leaving the iframe, its content is replicated on an
                // underlying iframe, to avoid for white flashes (visible on
                // Chrome Windows/Linux).
                this.iframe.el.contentWindow.addEventListener('beforeunload', () => {
                    this.iframefallback.el.contentDocument.body.replaceWith(this.iframe.el.contentDocument.body.cloneNode(true));
                    $().getScrollingElement(this.iframefallback.el.contentDocument)[0].scrollTop = $().getScrollingElement(this.iframe.el.contentDocument)[0].scrollTop;
                });
                this.iframe.el.contentWindow.addEventListener('PUBLIC-ROOT-READY', (event) => {
                    if (!this.websiteContext.edition) {
                        this.addWelcomeMessage();
                    }
                    this.websiteService.websiteRootInstance = event.detail.rootInstance;
                });
            };

            this.iframe.el.addEventListener('load', () => onPageLoaded());
            return this.iframe.el.removeEventListener('load', () => onPageLoaded());
        }, () => []);

        useEffect(() => {
            if (this.websiteContext.edition) {
                if (this.$welcomeMessage) {
                    this.$welcomeMessage.detach();
                }
            } else {
                this.addWelcomeMessage();
            }
        }, () => [this.websiteContext.edition]);

        useEffect(() => {
            this.websiteService.blockIframe();
            this.iframe.el.addEventListener('OdooFrameContentLoaded', () => this.websiteService.unblockIframe(), { once: true });
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
        let path = this.websiteService.editedObjectPath;
        if (!path) {
            path = this.props.action.context.params && this.props.action.context.params.path;
        }
        if (!path) {
            path = '/';
        }
        return path;
    }

    reloadIframe(url) {
        return new Promise((resolve, reject) => {
            this.iframe.el.addEventListener('OdooFrameContentLoaded', resolve, { once: true });
            this.websiteService.websiteRootInstance = undefined;
            if (url) {
                this.iframe.el.contentWindow.location = url;
            } else {
                this.iframe.el.contentWindow.location.reload();
            }
        });
    }

    addWelcomeMessage() {
        const $wrap = $(this.iframe.el.contentDocument.querySelector('#wrapwrap.homepage')).find('#wrap');
        if ($wrap.length && $wrap.html().trim() === '') {
            this.$welcomeMessage = $(core.qweb.render('website.homepage_editor_welcome_message'));
            this.$welcomeMessage.addClass('o_homepage_editor_welcome_message');
            this.$welcomeMessage.css('min-height', $wrap.parent('main').height() - ($wrap.outerHeight(true) - $wrap.height()));
            $wrap.empty().append(this.$welcomeMessage);
        }
    }
}
WebsitePreview.template = 'website.WebsitePreview';
WebsitePreview.components = {
    WebsiteEditorComponent,
    BlockIframe,
    WebsiteTranslator,
};

registry.category('actions').add('website_preview', WebsitePreview);
