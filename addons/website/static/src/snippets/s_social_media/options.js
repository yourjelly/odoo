/** @odoo-module **/

import fonts from 'wysiwyg.fonts';
import {generateHTMLId} from 'web_editor.utils';
import options from 'web_editor.snippets.options';
import {_t} from 'web.core';

let dbSocialValues;

options.registry.SocialMedia = options.Class.extend({
    /**
     * @override
     */
    async willStart() {
        this.recordData = [];
        // Get the social medias from the DOM. This is done before the super
        // call, since _renderCustomXml depends on this.links.
        this.links = new Map([...this.$target[0].querySelectorAll(':scope:not(.s_preview) > a')].map(el => {
            return [generateHTMLId(), el];
        }));
        await this._super(...arguments);
        if (!dbSocialValues) {
            let websiteId;
            this.trigger_up('context_get', {
                callback: function (ctx) {
                    websiteId = ctx['website_id'];
                },
            });
            // Fetch URLs for db links.
            [dbSocialValues] = await this._rpc({
                model: 'website',
                method: 'read',
                args: [websiteId, ['social_facebook', 'social_twitter', 'social_youtube',
                    'social_instagram', 'social_linkedin', 'social_github']],
            });
            delete dbSocialValues.id;
        }
        // Adds the DB social media links that are not in the DOM.
        for (const socialMedia of Object.keys(dbSocialValues)) {
            const mediaName = socialMedia.split('social_').pop();
            let anchorEl = this.$target[0].querySelector(`:scope > a[href="/website/social/${mediaName}"]`);
            if (!anchorEl) {
                const otherAnchorEl = this.$target[0].querySelector(':scope > a');
                if (otherAnchorEl) {
                    anchorEl = otherAnchorEl.cloneNode(true);
                    this._removeSocialMediaClasses(anchorEl);
                } else {
                    anchorEl = document.createElement('a');
                    anchorEl.setAttribute('target', '_blank');
                    const iEl = document.createElement('i');
                    iEl.classList.add('fa', 'rounded-circle', 'shadow-sm');
                    iEl.setAttribute('contenteditable', 'false');
                    anchorEl.appendChild(iEl);
                }
                anchorEl.classList.add('d-none', `s_social_media_${mediaName}`);
                anchorEl.querySelector('i').classList.add(`fa-${mediaName}`);
                anchorEl.href = `/website/social/${mediaName}`;
            }
            if (!anchorEl.closest('.s_social_media:not(.s_preview)')) {
                this.links.set(generateHTMLId(), anchorEl);
            }
        }
        // Calculate the initial state of the ListUserValueWidget.
        for (const [id, el] of Array.from(this.links.entries())) {
            const media = el.href.split('/website/social/')[1];
            const display_name = media ?
                dbSocialValues[`social_${media}`] : el.getAttribute('href');
            const isVisible = !el.classList.contains('d-none');
            const isPreview = this.$target[0].classList.contains('s_preview');
            const forceSelected = media && display_name && isVisible;
            const entry = {
                id,
                display_name,
                selected: !isPreview && isVisible || forceSelected,
                undeletable: Boolean(media),
                placeholder: `https://${media || 'example'}.com/yourPage`,
            };
            this.recordData.push(entry);
        }
    },
    /**
     * @override
     */
    start() {
        const listEl = this.$el[0].querySelector('we-list');
        // Focus the first social media input when the alert is clicked.
        this.$target[0].addEventListener('click', function (ev) {
            const selector = 'div.css_non_editable_mode_hidden';
            if (ev.target.matches(selector) || ev.target.closest(selector)) {
                setTimeout(() => {
                    listEl.querySelector('input').focus();
                });
            }
        });
        return this._super(...arguments);
    },
    /**
     * @override
     */
    onBuilt() {
        for (const anchorEl of this.$target[0].querySelectorAll(':scope > a')) {
            const mediaName = anchorEl.href.split('/website/social/').pop();
            if (mediaName && !dbSocialValues[`social_${mediaName}`]) {
                // Hide social media without value in DB.
                anchorEl.classList.add('d-none');
            }
        }
        if (this.$target[0].querySelectorAll(':scope > a:not(.d-none)').length < 1) {
            // Ensure we do not drop a blank block.
            this._addNoMediaAlert();
        }
        this.$target[0].classList.remove('s_preview');
    },
    /**
     * @override
     */
    async cleanForSave() {
        // Update the DB links.
        let websiteId;
        this.trigger_up('context_get', {
            callback: function (ctx) {
                websiteId = ctx['website_id'];
            },
        });
        await this._rpc({
            model: 'website',
            method: 'write',
            args: [[websiteId], dbSocialValues],
        });
        // Clean the DOM.
        this.$target[0].querySelectorAll(':scope > a.d-none').forEach(el => el.remove());
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Applies the we-list on the target and rebuilds the social links.
     *
     * @see this.selectClass for parameters
     */
    async renderListItems(previewMode, widgetValue, params) {
        this.recordData = JSON.parse(widgetValue);
        // Handle element deletation.
        const entriesIds = this.recordData.map(entry => entry.id);
        Array.from(this.links.keys()).filter(id => !entriesIds.includes(id)).forEach(id => {
            this.links.get(id).remove();
            this.links.delete(id);
        });
        for (const entry of this.recordData) {
            let anchorEl = this.links.get(entry.id);
            if (!anchorEl) {
                // It's a new custom social media.
                anchorEl = this.$target[0].querySelector(':scope > a').cloneNode(true);
                anchorEl.href = '#';
                this.links.set(entry.id, anchorEl);
            }
            // Handle visibility of the link
            entry.selected = entry.selected && entry.display_name;
            anchorEl.classList.toggle('d-none', !entry.selected);
            // Check if the url is valid
            const url = entry.display_name;
            if (url && !/((^([a-zA-Z]*.):.+$)|^\/)/gm.test(url)) {
                // We permit every protocol (http:, https:, ftp:, mailto:,...).
                // If none is explicitly specified, we assume it is a https.
                entry.display_name = 'https://' + url;
            }
            const dbField = anchorEl.href.split('/website/social/')[1];
            if (dbField) {
                // Handle URL change for DB links.
                dbSocialValues['social_' + dbField] = entry.display_name;
            } else {
                // Handle URL change for custom links.
                const href = anchorEl.getAttribute('href');
                if (href !== entry.display_name) {
                    if (this._isValidURL(entry.display_name)) {
                        // Propose an icon only for valid URLs (no mailto).
                        const socialMedia = this._findRelevantSocialMedia(entry.display_name);

                        this._removeSocialMediaClasses(anchorEl);

                        const iEl = anchorEl.querySelector('i');
                        if (socialMedia) {
                            anchorEl.classList.add(`s_social_media_${socialMedia}`);
                            iEl.classList.add(`fa-${socialMedia}`);
                        } else {
                            iEl.classList.add(`fa-pencil`);
                        }
                    }
                    anchorEl.setAttribute('href', entry.display_name);
                }
            }
            // Place the link at the correct position
            this.$target[0].appendChild(anchorEl);
            this.links.set(entry.id, anchorEl);
        }
        const alertEl = this.$target[0].querySelector('div.css_non_editable_mode_hidden');
        if (!this.$target[0].querySelector(':scope > a:not(.d-none)') && !alertEl) {
            // Ensure the block is not void.
            this._addNoMediaAlert();
        }
        if (this.$target[0].querySelector(':scope > a:not(.d-none)') && alertEl) {
            alertEl.remove();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Adds a warning banner to alert that there are no social networks.
     */
    _addNoMediaAlert() {
        const divEl = document.createElement('div');
        divEl.classList.add('alert', 'alert-info', 'css_non_editable_mode_hidden', 'text-center');
        const spanEl = document.createElement('span');
        spanEl.textContent = _t(" Click here to setup your social networks");
        const iconEl = document.createElement('i');
        iconEl.classList.add('fa', 'fa-plus-circle');
        this.$target[0].appendChild(divEl).append(iconEl, spanEl);
    },
    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        if (methodName === 'renderListItems') {
            for (const entry of this.recordData) {
                if (entry.undeletable === 'true') {
                    const anchorEl = this.links.get(entry.id);
                    const media = anchorEl.href.split('/website/social/')[1];
                    entry.display_name = dbSocialValues[`social_${media}`];
                }
            }
            return JSON.stringify(this.recordData);
        }
        return this._super(methodName, params);
    },
    /**
     * Finds the social network for the given url.
     *
     * @param {String} url
     * @return {String} The social network to which the url leads to.
     */
    _findRelevantSocialMedia(url) {
        const supportedSocialMedia = [
            ['facebook', /^(https?:\/\/)(www\.)?(facebook|fb|m\.facebook)\.(com|me).*$/gm],
            ['twitter', /^(https?:\/\/)((www\.)?twitter\.com).*$/gm],
            ['youtube', /^(https?:\/\/)(www\.)?(youtube.com|youtu.be).*$/gm],
            ['instagram', /^(https?:\/\/)(www\.)?(instagram.com|instagr.am|instagr.com).*$/gm],
            ['linkedin', /^(https?:\/\/)((www\.)?linkedin\.com).*$/gm],
            ['github', /^(https?:\/\/)((www\.)?github\.com).*$/gm],
        ];
        for (const [socialMedia, regex] of supportedSocialMedia) {
            if (regex.test(url)) {
                return socialMedia;
            }
        }
        // Check if an icon matches the URL domain
        try {
            const domain = new URL(url).hostname.split('.').slice(-2)[0];
            fonts.computeFonts();
            const iconNames = fonts.fontIcons[0].alias;
            const exactIcon = iconNames.find(el => el === `fa-${domain}`);
            return (exactIcon || iconNames.find(el => el.includes(domain))).split('fa-').pop();
        } catch (error) {
            return false;
        }
    },
    /**
     * @param  {String} str
     * @returns {boolean} is the string a valid URL.
     */
    _isValidURL(str) {
        try {
            new URL(str);
        } catch (error) {
            return false;
        }
        return true;
    },
    /**
     * Removes social media classes from the given element.
     *
     * @param  {HTMLElement} anchorEl
     */
    _removeSocialMediaClasses(anchorEl) {
        let regx = new RegExp('\\b' + 's_social_media_' + '[^1-9][^ ]*[ ]?\\b', 'g');
        anchorEl.className = anchorEl.className.replace(regx, '');
        const iEl = anchorEl.querySelector('i');
        regx = new RegExp('\\b' + 'fa-' + '[^1-9][^ ]*[ ]?\\b', 'g');
        // Remove every fa classes except fa-x sizes.
        iEl.className = iEl.className.replace(regx, '');
    },
    /**
     * @override
     */
    _renderCustomXML(uiFragment) {
        uiFragment.querySelector('we-list').dataset.defaults = JSON.stringify(Array.from(
            this.links.keys()).filter(id => !this.links.get(id).classList.contains('d-none')));
    },
});

export default {
    SocialMedia: options.registry.SocialMedia,
};
