/** @odoo-module **/

import fonts from 'wysiwyg.fonts';
import {generateHTMLId} from 'web_editor.utils';
import options from 'web_editor.snippets.options';

let dbSocialValues;

options.registry.SocialMedia = options.Class.extend({
    /**
     * @override
     */
    async willStart() {
        this.links = [];
        this.$target[0].querySelectorAll(':scope > a')
            .forEach(el => this.links.push({id: generateHTMLId(), el: el}));

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
        const entries = JSON.parse(widgetValue);
        // Handle element deletation.
        const entriesIds = entries.map(entry => entry.id);
        const anchorsEls = this.$target[0].querySelectorAll(':scope > a');
        const deletedEl = Array.from(anchorsEls)
            .find(aEl => !entriesIds.includes(this.links.find(linkEl => linkEl.el === aEl).id));
        if (deletedEl) {
            deletedEl.remove();
        }
        for (const entry of entries) {
            let anchorEl;
            let link = this.links.find(linkEl => linkEl.id === entry.id);
            if (!link) {
                // It's a new social media.
                anchorEl = this.$target[0].querySelector(':scope > a').cloneNode(true);
                anchorEl.href = '#';
                this.links.push({id: entry.id, el: anchorEl});
            } else {
                anchorEl = link.el;
            }
            // Handle visibility of the link
            anchorEl.classList.toggle('d-none', !entry.selected);

            // Check if the url is valid
            const url = entry.display_name;
            if (url && !/((^([a-zA-Z]*.):.+$)|^\/)/gm.test(url)) {
                // We permit every protocol (http:, https:, ftp:, mailto:,...).
                // If none is explicitly specified, we assume it is a http.
                entry.display_name = 'http://' + url;
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
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        if (methodName !== 'renderListItems') {
            return this._super(methodName, params);
        }
        const listEntries = [];
        for (const socialMedia of Object.keys(dbSocialValues)) {
            const mediaName = socialMedia.split('social_')[1];
            const dbEl = this.$target[0].querySelector(`a[href="/website/social/${mediaName}"]`);
            if (!dbEl) {
                // If a social media exists in DB but not in target, create it.
                const anchorEl = this.$target[0].querySelector(':scope > a').cloneNode(true);
                anchorEl.href = `/website/social/${mediaName}`;
                this._removeSocialMediaClasses(anchorEl);
                anchorEl.classList.add(`s_social_media_${mediaName}`, 'd-none');
                anchorEl.querySelector('i').classList.add(`fa-${mediaName}`);
                this.$target[0].appendChild(anchorEl);
                this.links.push({id: generateHTMLId(), el: anchorEl});
            } else if (dbSocialValues[socialMedia] === '') {
                // Hide existing <a> if there is no url in DB.
                dbEl.classList.add('d-none');
            }
        }
        for (const anchorEl of this.$target[0].querySelectorAll(':scope > a')) {
            const dbField = anchorEl.href.split('/website/social/')[1];
            const entry = {
                id: this.links.find(linkEl => linkEl.el === anchorEl).id,
                selected: !anchorEl.classList.contains('d-none'),
                display_name: dbField ?
                    dbSocialValues['social_' + dbField] : anchorEl.getAttribute('href'),
                undeletable: Boolean(dbField),
                placeholder: `https://${dbField || 'example'}.com/yourPage`,
            };
            listEntries.push(entry);
        }
        return JSON.stringify(listEntries);
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
            const exactIcon = fonts.fontIcons[0].alias.find(el => el === `fa-${domain}`);
            return exactIcon ? exactIcon.split('fa-').pop() :
                fonts.fontIcons[0].alias.find(el => el.includes(domain)).split('fa-').pop();
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
        // Remove social media social media classes
        let regx = new RegExp('\\b' + 's_social_media_' + '[^1-9][^ ]*[ ]?\\b', 'g');
        anchorEl.className = anchorEl.className.replace(regx, '');
        // Remove every fa classes except fa-x sizes
        const iEl = anchorEl.querySelector('i');
        regx = new RegExp('\\b' + 'fa-' + '[^1-9][^ ]*[ ]?\\b', 'g');
        iEl.className = iEl.className.replace(regx, '');
    },
    /**
     * @override
     */
    _renderCustomXML(uiFragment) {
        const anchorEls = this.$target[0].querySelectorAll(':scope > a:not(.d-none)');
        uiFragment.querySelector('we-list').dataset.defaults = JSON.stringify(
            Array.from(anchorEls).map(el => this.links.find(linkEl => linkEl.el === el).id)
        );
    }
});

export default {
    SocialMedia: options.registry.SocialMedia,
};
