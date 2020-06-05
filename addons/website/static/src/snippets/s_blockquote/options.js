odoo.define('website.s_blockquote_options', function (require) {
'use strict';

const snippetOptions = require('web_editor.snippets.options');

snippetOptions.registry.Blockquote = snippetOptions.SnippetOptionWidget.extend({

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Changes the position of the progressbar text.
     *
     * @see this.selectClass for parameters
     */
    display: async function (previewMode, widgetValue, params) {
        await this.editorCommands.toggleClass(
            this.$target.find('.s_blockquote_icon')[0],
            widgetValue !== 'classic'
        );
        // todo: remove this when the jabberwock editor support miminum dom modification.
        const getContent = () => this.$target.find('.s_blockquote_content');
        await this.editorCommands.remove(getContent().find('.quote_char')[0]);
        if (widgetValue === 'cover') {
            const content = $('<fa/>').addClass('quote_char fa fa-quote-left font-italic')[0].outerHTML;
            await this.editorCommands.insertHtml(
                [$content.find('.quote_char')[0], 'BEFORE'],
                content,
            );
        }

        // Text style
        await this.editorCommands.toggleClass(getContent()[0], 'text-center', widgetValue === 'cover');
        await this.editorCommands.toggleClass(getContent()[0], 'font-italic', widgetValue !== 'classic');

        // Bg Img
        if (widgetValue === 'cover') {
            await this.editorCommands.setStyle(this.$target[0], 'background-image', widgetValue === "url('/web/image/website.s_parallax_default_image')");
            await this.editorCommands.setStyle(this.$target[0], 'background-position', "50%");
            await this.editorCommands.setStyle(getContent()[0], 'background-color', "rgba(0, 0, 0, 0.5)");
        } else {
            await this.editorCommands.setStyle(this.$target[0], 'background-image', "unset");
            await this.editorCommands.setStyle(getContent()[0], 'background-color', "unset");
        }

        // Blockquote Footer
        // We currently create a function to retrieve the element as all "editorCommands" call
        // recreate all elements.
        // todo: remove this when the jabberwock editor support miminum dom modification.
        const getFooter = () => this.$target.find('footer');
        await this.editorCommands.toggleClass(getFooter()[0], 'text-white', widgetValue === 'cover');
        // $footer.toggleClass('text-white', widgetValue === 'cover');
        await this.editorCommands.toggleClass(this.$target[0], 'text-white', widgetValue === 'cover');
        // this.$target.toggleClass('text-white', widgetValue === 'cover');
        await this.editorCommands.toggleClass(getFooter()[0], 'd-none', widgetValue === 'minimalist');
        // $footer.toggleClass('d-none', widgetValue === 'minimalist');
        await this.editorCommands.toggleClass(
            this.$target.find('.s_blockquote_avatar')[0], 'd-none', widgetValue !== 'classic');
        // this.$target.find('.s_blockquote_avatar')
        //     .toggleClass('d-none', widgetValue !== 'classic');
    },
});
});
