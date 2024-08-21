import options from "@web_editor/js/editor/snippets.options";

options.registry.MegaMenuLayout = options.registry.MegaMenuLayout.extend({
    /**
     * @override
     */
    events: {
        'click we-button': '_checkButtonVisibility',
        'click .custom_button': '_onClick',
    },
    
    _checkButtonVisibility: function () {
        // Find the selected we-button
        const selectedButton = document.querySelector('we-select we-button.o_we_preview');

        // Check if the selected button has the 'ecommerce_mega_menu_button' class
        const isButtonVisible = selectedButton && selectedButton.classList.contains('ecommerce_mega_menu_button');
        const button = document.querySelector('.custom_button');

        if (isButtonVisible) {
            button.classList.remove('d-none');
        } else {
            button.classList.add('d-none');
        }
    },

    _onClick: function () {
        const selectedButton = document.querySelector('we-select we-button.active');

        if (selectedButton) {
            const currentTemplateId = selectedButton.getAttribute('data-select-template');
            const newTemplateId = this._getNewTemplateId(currentTemplateId);

            if (newTemplateId) {
                this._switchTemplate(newTemplateId);
            }
        }
    },

    _getNewTemplateId: function (currentTemplateId) {
        const templateMapping = {
            'website.s_mega_menu_multi_menus': 'website_sale.s_mega_menu_multi_menus',
        };

        return templateMapping[currentTemplateId];
    },

    _switchTemplate: function (newTemplateId) {
        this._getTemplate(newTemplateId).then(template => {
            const sectionEl = this.containerEl.querySelector('section');
            if (sectionEl) {
                sectionEl.outerHTML = template;
            }
        });
    },

})
