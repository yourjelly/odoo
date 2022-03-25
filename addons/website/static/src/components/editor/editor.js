/** @odoo-module */
// Legacy services
import legacyEnv from 'web.commonEnv';
import ajax from 'web.ajax';
import core from 'web.core';

import { getWysiwygClass } from 'web_editor.loader';
import { useService } from '@web/core/utils/hooks';

const { markup, Component, useState, useChildSubEnv, useEffect } = owl;
let Wysiwyg;

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

        useEffect((isPublicRootReady) => {
            if (isPublicRootReady) {
                if (this.$welcomeMessage) {
                    this.$welcomeMessage.detach();
                }
                if (this.reloadSelector) {
                    this.reloadTarget = $(this.iframe.el.contentDocument).find(this.reloadSelector)[0];
                }
                this._loadWysiwyg();
            }
        }, () => [this.websiteContext.isPublicRootReady]);
        useEffect(() => {
            if (this.state.edition === EDITION_STATE.RELOAD) {
                this.props.reloadIframe();
            }
            if (this.state.edition === EDITION_STATE.OFF) {
                this.iframe.el.classList.remove('editor_enable', 'editor_has_snippets');
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
    async wysiwygStarted() {
        if (this.state.edition !== EDITION_STATE.RELOAD) {
            this.websiteService.toggleFullscreen();
            this.iframe.el.classList.add('editor_enable', 'editor_has_snippets');
            // make sure the animation is played
            setTimeout(() => {
                document.getElementById('oe_snippets').classList.add('o_loaded');
            });
        }
    }
    /**
     * Reload the iframe and set the edition states to false
     */
    async quit() {
        await this.props.reloadIframe();
        this.state.edition = EDITION_STATE.OFF;
        this.websiteContext.edition = false;
    }
    /**
     * Load wysiwyg libs and start the editor
     *
     * @return {Promise} the libs are loaded, the editor is starting
     */
    async _loadWysiwyg() {
        if (!Wysiwyg) {
            await ajax.loadXML('/website/static/src/xml/website.editor.xml', core.qweb);
            Wysiwyg = await getWysiwygClass({wysiwygAlias: 'website.wysiwyg'}, ['website.compiled_assets_wysiwyg']);
        }
        this.Wysiwyg = Wysiwyg;
        this.state.edition = EDITION_STATE.STARTED;
        if (this.state.loading) {
            this.state.loading = false;
        }
    }
}
WebsiteEditorComponent.components = { WysiwygAdapterComponent };
WebsiteEditorComponent.template = 'website.WebsiteEditorComponent';
