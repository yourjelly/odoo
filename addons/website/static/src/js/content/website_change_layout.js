/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.WebsiteLayout = publicWidget.Widget.extend({
    selector: ".o_website_grid_list",
    disabledInEditableMode: false,
    events: {
        "change .o_website_apply_layout input": "_onApplyLayoutChange",
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
            this._rpc({
                route: "/website/save_layout_mode",
                params: {
                    layout_mode: isList ? "list" : "grid",
                    view_id: document
                        .querySelector(".o_website_apply_layout")
                        .getAttribute("data-view-id"),
                },
            });
        }

        const activeClasses = ev.target.parentElement.dataset.activeClasses.split(" ");
        ev.target.parentElement.querySelectorAll(".btn").forEach((btn) => {
            activeClasses.map((c) => btn.classList.toggle(c));
        });

        if (isList) {
            document.querySelector(".o_website_grid").classList.add("d-none");
            document.querySelector(".o_website_list").classList.remove("d-none");
        } else {
            document.querySelector(".o_website_list").classList.add("d-none");
            document.querySelector(".o_website_grid").classList.remove("d-none");
        }
        if (wysiwyg) {
            wysiwyg.odooEditor.observerActive("_onApplyLayoutChange");
        }
    },
});
