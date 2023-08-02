/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.WebsiteControllerPageListingLayout = publicWidget.Widget.extend({
    selector: ".o_website_listing_layout",
    disabledInEditableMode: false,
    events: {
        "change .listing_layout_switcher input": "_onApplyLayoutChange",
    },
    init(parent, options) {
        this._super(parent, options);
        this.rpc = this.bindService("rpc");
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onApplyLayoutChange: function (ev) {
        const wysiwyg = this.options.wysiwyg;
        if (wysiwyg) {
            wysiwyg.odooEditor.observerUnactive("_onApplyLayoutChange");
        }
        var clickedValue = $(ev.target).val();
        var isList = clickedValue === "list";
        if (!this.editableMode) {
            this.rpc("/website/save_session_layout_mode", {
                layout_mode: isList ? "list" : "grid",
                view_id: document
                    .querySelector(".listing_layout_switcher")
                    .getAttribute("data-view-id"),
            });
        }

        const activeClasses = ev.target.parentElement.dataset.activeClasses.split(" ");
        ev.target.parentElement.querySelectorAll(".btn").forEach((btn) => {
            activeClasses.map((c) => btn.classList.toggle(c));
        });

        const el = document.querySelector(isList ? ".o_website_grid" : ".o_website_list");
        this._updateUI(el, isList);

        if (wysiwyg) {
            wysiwyg.odooEditor.observerActive("_onApplyLayoutChange");
        }
    },

    _updateUI: function (el, isList) {
        if (el) {
            if (isList) {
                el.classList.add("o_website_list");
                el.classList.remove("o_website_grid");
                // remove bootstrap classes specific to grid display
                $(".o_website_list > div").each((index, card) => {
                    card.classList = ""
                });
            } else {
                el.classList.add("o_website_grid");
                el.classList.remove("o_website_list");
                // each card must have the correct bootstrap classes
                $(".o_website_grid > div").each((index, card) => {
                    card.classList = "col-lg-3 col-md-4 col-sm-6 px-2 col-xs-12"
                });
            }
        }
    }
});
