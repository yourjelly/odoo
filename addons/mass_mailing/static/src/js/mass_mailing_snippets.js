odoo.define('mass_mailing.snippets.options', function (require) {
"use strict";

var options = require('web_editor.snippets.options');
const {ColorpickerWidget} = require('web.Colorpicker');
const {_t} = require('web.core');

// Snippet option for resizing  image and column width inline like excel
options.registry.mass_mailing_sizing_x = options.Class.extend({
    /**
     * @override
     */
    start: function () {
        var def = this._super.apply(this, arguments);

        this.containerWidth = this.$target.parent().closest("td, table, div").width();

        var self = this;
        var offset, sib_offset, target_width, sib_width;

        this.$overlay.find(".o_handle.e, .o_handle.w").removeClass("readonly");
        this.isIMG = this.$target.is("img");
        if (this.isIMG) {
            this.$overlay.find(".o_handle.w").addClass("readonly");
        }

        var $body = $(this.ownerDocument.body);
        this.$overlay.find(".o_handle").on('mousedown', function (event) {
            event.preventDefault();
            var $handle = $(this);
            var compass = false;

            _.each(['n', 's', 'e', 'w'], function (handler) {
                if ($handle.hasClass(handler)) { compass = handler; }
            });
            if (self.isIMG) { compass = "image"; }

            $body.on("mousemove.mass_mailing_width_x", function (event) {
                event.preventDefault();
                offset = self.$target.offset().left;
                target_width = self.get_max_width(self.$target);
                if (compass === 'e' && self.$target.next().offset()) {
                    sib_width = self.get_max_width(self.$target.next());
                    sib_offset = self.$target.next().offset().left;
                    self.change_width(event, self.$target, target_width, offset, true);
                    self.change_width(event, self.$target.next(), sib_width, sib_offset, false);
                }
                if (compass === 'w' && self.$target.prev().offset()) {
                    sib_width = self.get_max_width(self.$target.prev());
                    sib_offset = self.$target.prev().offset().left;
                    self.change_width(event, self.$target, target_width, offset, false);
                    self.change_width(event, self.$target.prev(), sib_width, sib_offset, true);
                }
                if (compass === 'image') {
                    self.change_width(event, self.$target, target_width, offset, true);
                }
            });
            $body.one("mouseup", function () {
                $body.off('.mass_mailing_width_x');
            });
        });

        return def;
    },
    change_width: function (event, target, target_width, offset, grow) {
        target.css("width", Math.round(grow ? (event.pageX - offset) : (offset + target_width - event.pageX)));
        this.trigger_up('cover_update');
    },
    get_int_width: function (el) {
        return parseInt($(el).css("width"), 10);
    },
    get_max_width: function ($el) {
        return this.containerWidth - _.reduce(_.map($el.siblings(), this.get_int_width), function (memo, w) { return memo + w; });
    },
    onFocus: function () {
        this._super.apply(this, arguments);

        if (this.$target.is("td, th")) {
            this.$overlay.find(".o_handle.e, .o_handle.w").toggleClass("readonly", this.$target.siblings().length === 0);
        }
    },
});

// Adding compatibility for the outlook compliance of mailings.
// Commit of such compatibility : a14f89c8663c9cafecb1cc26918055e023ecbe42
options.registry.BackgroundImage = options.registry.BackgroundImage.extend({
    start: function () {
        this._super();
        if (this.snippets && this.snippets.split('.')[0] === "mass_mailing") {
            var $table_target = this.$target.find('table:first');
            if ($table_target.length) {
                this.$target = $table_target;
            }
        }
    }
});

options.registry.ImageOptimize.include({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async updateUIVisibility() {
        await this._super(...arguments);

        // The image shape option should work correctly with this update of the
        // ImageOptimize option but unfortunately, SVG support in mail clients
        // prevents the final rendering of the image. For now, we disable the
        // feature.
        const imgShapeContainerEl = this.el.querySelector('.o_we_image_shape');
        if (imgShapeContainerEl) {
            imgShapeContainerEl.classList.toggle('d-none', !odoo.debug);
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getCSSColorValue(color) {
        const doc = this.options.document;
        if (doc && doc.querySelector('.o_mass_mailing_iframe') && !ColorpickerWidget.isCSSColor(color)) {
            const tempEl = doc.body.appendChild(doc.createElement('div'));
            tempEl.className = `bg-${color}`;
            const colorValue = window.getComputedStyle(tempEl).getPropertyValue("background-color").trim();
            tempEl.parentNode.removeChild(tempEl);
            return ColorpickerWidget.normalizeCSSColor(colorValue).replace(/"/g, "'");
        }
        return this._super(...arguments);
    },
    /**
     * @override
     */
    async _renderCustomWidgets(uiFragment) {
        await this._super(...arguments);

        const imgShapeTitleEl = uiFragment.querySelector('.o_we_image_shape we-title');
        if (imgShapeTitleEl) {
            const warningEl = document.createElement('i');
            warningEl.classList.add('fa', 'fa-exclamation-triangle', 'ml-1');
            warningEl.title = _t("Be aware that this option may not work on many mail clients");
            imgShapeTitleEl.appendChild(warningEl);
        }
    },
});

options.registry.mail_footer_social = options.Class.extend({
    /**
     * @override
     */
    async start() {
        await this._super.apply(this, arguments);
        this._updateInputLinks = this._updateInputLinks.bind(this);
        this.options.wysiwyg.on('snippet_removed', this, this._updateInputLinks);

        this._socialObjects = [
            { faClass: 'fa-facebook', label: 'Facebook', fieldName: 'social_facebook' },
            { faClass: 'fa-youtube', label: 'Facebook', fieldName: 'social_youtube' },
            { faClass: 'fa-linkedin', label: 'Linkedin', fieldName: 'social_linkedin' },
            { faClass: 'fa-twitter', label: 'Twitter', fieldName: 'social_twitter' },
            { faClass: 'fa-instagram', label: 'Instagram', fieldName: 'social_instagram' },
        ];

        this._updateInputLinks();
    },
    /**
     * @override
     */
    destroy() {
        this.options.wysiwyg.off('removeEditor', this, this._updateInputLinks);
    },
    /**
     * @override
     */
    updateUI(){
        this._updateInputLinks();
    },
    /**
     * @override
     */
    async cleanForSave() {
        const fieldsToSave = {};
        for (const socialObject of this._socialObjects) {
            const href = this._getLink(socialObject.faClass).attr('href');
            if (href) {
                fieldsToSave[socialObject.fieldName] = href;
            }
        }
        if (Object.keys(fieldsToSave).length) {
            await this._rpc({
                model: 'res.company',
                method: 'try_set_social_media_links',
                args: [[]],
                kwargs: fieldsToSave,
            });
        }
    },
    /**
     * Gets the link that contains a fontawesome class.
     */
    _getLink(faClass) {
        return this.$target.find(`.${faClass}`).parent();
    },
    /**
     * Update the inputs.
     */
    _updateInputLinks()  {
        this.$el.html('');
        for (const socialObject of this._socialObjects) {
            this._getLink(socialObject.faClass);
            let $link = this._getLink(socialObject.faClass);
            let url = ($link.is('a') && $link.attr('href')) || '';

            if (!$link.length) {
                continue;
            }

            const $weInput = $(`
                <we-input class="o_we_user_value_widget o_we_large">
                    <we-title>
                        ${socialObject.label} url
                    </we-title>
                    <div>
                        <input type="text" autocomplete="chrome-off" class="text-left">
                    </div>
                </we-input>
            `);
            const $input = $weInput.find('input');
            $input.val(url);
            this.$el.append($weInput);
            $input.on('input', () => {
                const url = $input.val();
                if (!this._getLink(socialObject.faClass).length) {
                    $link = $(`<a style="margin-left:10px" aria-label="${socialObject.label}" title="${socialObject.label}" href="${url}">
                        <span class="fa ${socialObject.faClass}">​</span>
                    </a>`);
                    this.$target.append($link);
                    this._updateLinksInDocument();
                } else {
                    $link.attr('href', url);
                }
            });
            $input.on('input', () => {
                const url = $input.val();
                if (!url) {
                    this._getLink(socialObject.faClass).remove();
                }
            });
        }
        this._updateLinksInDocument();
    },
    _updateLinksInDocument() {
        const links = this._socialObjects
            .map(x=>this._getLink(x.faClass))
            .filter(x=>x.length);
        const $fakeEl = $('<fakeEl>');
        links.forEach(($link) => $fakeEl.append($link.clone()));
        if ($fakeEl.html() !== this.$target.html()){
            this.$target.html('');
            links.forEach(($link) => this.$target.append($link))
        }
    },
});
});
