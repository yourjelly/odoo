/** @odoo-module */

import options from "@web_editor/js/editor/snippets.options";
import { renderToElement } from "@web/core/utils/render";
import { Tooltip } from "@web/core/tooltip/tooltip";

options.registry.Ssection = options.Class.extend({
    /**
     * @override
     */
    start: function () {
        this.$modal = undefined;

        return this._super.apply(this, arguments)
            .then(() => {
                let self = this;

                this._injectToolbar();
                if (this.$target.find(".row").is(":empty")) {
                    this._renderModal();
                }
                this.$target.find('.fakeOverlay .link').on('click', function() {
                    self.$modal = undefined;
                    self._renderModal();
                });
            });
    },

    /**
     * @override
     */
    cleanForSave: function() {
        this.$target.remove();
        this._super.apply(this, arguments);
    },

    /**
     * magic stuff
     */
    async _renderModal() {
        let self = this;

        if (this.$modal != undefined) {
            return;
        }

        this.$modal = $(renderToElement('website.ssection.modal', {
            title: this.modalTitle ? this.modalTitle : 'Choose a Section Template',
            templateSet: this.templateSet ? this.templateSet : "sections",
            hasContent: self.$target.hasClass('o-has-picture-preview') || !self.$target.find(".row").is(":empty"),
        }));


        this.$modal.find('[data-bs-toggle="tooltip"]').tooltip({
            delay: 0,
            placement: 'bottom',
            container: document.body,
        });

        this.$modal.find('.tab-pane').each(function() {
            const $pane = $(this);

            $pane.find('.s-preview > img').each(function() {
                const $snippet_clone = $(this).clone().addClass('o_was_ssection pe-none', 'pe-none');

                $(this).on('click', function(ev) {
                    if (self.$target.find(".row").is(":empty")) {
                        self.$target.find(".row").append($snippet_clone);
                        self.modalBS.hide();
                    } else {
                        if (window.confirm("Replace current content?")) {
                            self.$target.find(".row").empty();
                            self.$target.find(".row").append($snippet_clone);
                            self.modalBS.hide();
                        };
                    }

                    self.$target.addClass('o-has-picture-preview');
                })
            });
        });

        this.$modal.appendTo(document.body);
        this.modalBS = new Modal(this.$modal[0], {keyboard: true, backdrop: true});
        this.modalBS.show();

        this.$modal.on('hidden.bs.modal', function () {
            self.$target.removeClass("ui-blocked");
            self.$modal = undefined;
            self.modalBS = undefined;
            document.getElementById('snippetsLib').remove();
            // self.$target.trigger('click');
        });
    },

    _injectToolbar: function() {
        if (this.$overlay.find('.o_replaceTemplate').length > 0 ) {
            return;
        }
        let self = this;
        let $btn = $('<button/>').addClass("o_replaceTemplate o_we_bg_warning fa fa-refresh mx-1");
        this.$overlay.find('.o_overlay_edit_options').prepend($btn);

        $btn.on('click', function() {
            self.$modal = undefined;
            self._renderModal();
        });

    },
});

// Modal variations
options.registry.ScarouselNew = options.registry.Ssection.extend({
    start: function () {
        this.templateSet = "carousels";
        this.modalTitle = "Choose a Carousel Template";
        this._super.apply(this, arguments);
    },
});

options.registry.SgalleriesNew = options.registry.Ssection.extend({
    start: function () {
        this.templateSet = "galleries";
        this.modalTitle = "Choose a Gallery Template";
        this._super.apply(this, arguments);
    },
});

options.registry.SoverlaysNew = options.registry.Ssection.extend({
    start: function () {
        this.templateSet = "overlays";
        this.modalTitle = "Choose an Overlay Template";
        this._super.apply(this, arguments);
    },
});


// Inner Content
options.registry.contentNew = options.Class.extend({
    onBuilt: function () {
        this.$target.removeClass('s_content_new_animate');
        // this.$target.trigger('click');
    },
    start: function () {
    }
});