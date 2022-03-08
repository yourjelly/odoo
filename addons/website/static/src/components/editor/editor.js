/** @odoo-module */
// Legacy services
import legacyEnv from 'web.commonEnv';
import ajax from 'web.ajax';
import core from 'web.core';

import { getWysiwygClass } from 'web_editor.loader';
import { useService } from '@web/core/utils/hooks';

const { markup, Component, useState, useChildSubEnv, useEffect, useExternalListener } = owl;

import { WysiwygAdapterComponent } from '../wysiwyg_adapter/wysiwyg_adapter';
const EDITION_STATE = {
    LOADING: 'LOADING',
    STARTED: true,
    RELOAD: 'RELOAD',
    OFF: false,
};

export class WebsiteEditorComponent extends Component {
    /**
     * @override
     */
    setup() {
        this.iframe = this.props.iframe;
        this.websiteService = useService('website');

        this.state = useState({ edition: false});
        this.websiteContext = useState(this.websiteService.context);

        useChildSubEnv(legacyEnv);
        useExternalListener(window.document, 'FRONTEND-EDITION-READY', (event) => {
            this.websiteRootInstance = event.detail.websiteRootInstance;
            this.websiteContext.isEditionReady = true;
        });

        useEffect(() => {
            if (this.websiteContext.edition && this.websiteContext.isEditionReady) {
                if (this.$welcomeMessage) {
                    this.$welcomeMessage.detach();
                }
                if (this.reloadSelector) {
                    this.reloadTarget = this.iframe.el.contentWindow.$(this.reloadSelector)[0];
                }
                this.wysiwygLoading = true;
                this._loadWysiwyg();
            } else if (this.websiteContext.isEditionReady) {
                const $wrap = $(this.iframe.el.contentDocument.getElementById('wrap'));
                if ($wrap.length && $wrap.html().trim() === '') {
                    this.$welcomeMessage = $(core.qweb.render('website.homepage_editor_welcome_message'));
                    this.$welcomeMessage.addClass('o_homepage_editor_welcome_message');
                    this.$welcomeMessage.css('min-height', $wrap.parent('main').height() - ($wrap.outerHeight(true) - $wrap.height()));
                    $wrap.empty().append(this.$welcomeMessage);
                }
            }
        }, () => [this.websiteContext.edition, this.websiteContext.isEditionReady]);
        useEffect(() => {
            if (this.state.edition === EDITION_STATE.RELOAD) {
                this._reloadIframe();
            }
        }, () => [this.state.edition]);
    }
    /**
     * Reload the iframe and the editor
     *
     * @return {Promise} the iframe and the state is set to launch
     */
    async reload(event, widgetEl) {
        if (widgetEl) {
            this.loadingDummy = markup(widgetEl.innerHTML);
        }
        this.state.loading = true;
        // We do not change the websiteContext edition to false so when the
        // context isEditionReady is true after the iframe
        // reloaded, the edition will start again.
        if (event.data.option_selector) {
            this.reloadSelector = event.data.option_selector;
        }
        this.state.edition = EDITION_STATE.RELOAD;
    }
    /**
     * Reload the iframe and set the edition states to false
     */
    async quit() {
        this.state.edition = EDITION_STATE.OFF;
        this.websiteContext.edition = false;
        this.reloadTarget = null;
        this.reloadSelector = null;
        return this._reloadIframe();
    }
    /**
     * Reload the iframe
     *
     * @return {Promise} the iframe has reloaded
     */
    async _reloadIframe() {
        return new Promise((resolve, reject) => {
            this.websiteContext.isEditionReady = false;
            this.iframe.el.addEventListener('load', resolve);
            this.iframe.el.contentWindow.location.reload();
        });
    }
    /**
     * Load wysiwyg libs and start the editor
     *
     * @return {Promise} the libs are loaded, the editor is starting
     */
    async _loadWysiwyg() {
        if (!this.Wysiwyg) {
            await ajax.loadXML('/website/static/src/xml/website.editor.xml', core.qweb);
            this.Wysiwyg = await getWysiwygClass({}, ['website.compiled_assets_wysiwyg']);
        }
        this.state.edition = EDITION_STATE.STARTED;
        this.wysiwygLoading = false;
        if (this.state.loading) {
            this.state.loading = false;
        }
    }
}
WebsiteEditorComponent.components = { WysiwygAdapterComponent };
WebsiteEditorComponent.template = 'website.WebsiteEditorComponent';
