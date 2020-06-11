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
        if (widgetValue === 'classic') {
            await this.editorDom.removeClass({
                domNode: this.$target.find('.s_blockquote_icon')[0],
                class: 'd-none',
            });
        } else {
            await this.editorDom.addClass({
                domNode: this.$target.find('.s_blockquote_icon')[0],
                class: 'd-none',
            });
        }
        // todo: remove this when the jabberwock editor support miminum dom modification.
        const getContent = () => this.$target.find('.s_blockquote_content');
        await this.editorDom.remove({
            domNode: getContent().find('.quote_char')[0],
        });
        if (widgetValue === 'cover') {
            const content = $('<fa/>').addClass('quote_char fa fa-quote-left font-italic')[0].outerHTML;
            await this.editorDom.insertHtml(
                {
                    html: content,
                    domNode: $content.find('.quote_char')[0],
                    position: 'BEFORE',
                }
            );
        }

        // Text style
        if (widgetValue === 'cover') {
            await this.editorDom.addClass({
                domNode: getContent()[0],
                class: 'text-center',
            });
        } else {
            await this.editorDom.removeClass({
                domNode: getContent()[0],
                class: 'text-center',
            });
        }
        if (widgetValue === 'classic') {
            await this.editorDom.removeClass({
                domNode: getContent()[0],
                class: 'font-italic',
            });
        } else {
            await this.editorDom.addClass({
                domNode: getContent()[0],
                class: 'font-italic',
            });
        }

        // Bg Img
        if (widgetValue === 'cover') {
            await this.editorDom.setStyle({
                domNode: this.$target[0],
                name: 'background-image',
                value: '' + widgetValue === "url('/web/image/website.s_parallax_default_image')",
            });
            await this.editorDom.setStyle({
                domNode: this.$target[0],
                name: 'background-position',
                value: '50%',
            });
            await this.editorDom.setStyle({
                domNode: this.$target[0],
                name: 'background-color',
                value: 'rgba(0, 0, 0, 0.5)',
            });
        } else {
            await this.editorDom.setStyle({
                domNode: this.$target[0],
                name: 'background-image',
                value: 'unset',
            });
            await this.editorDom.setStyle({
                domNode: getContent()[0],
                name: 'background-color',
                value: 'unset',
            });
        }

        // Blockquote Footer
        // We currently create a function to retrieve the element as all
        // `editor.execCommand` calls recreate all elements.
        // todo: remove this when the jabberwock editor support miminum dom
        //modification.
        const getFooter = () => this.$target.find('footer');
        if (widgetValue === 'cover') {
            await this.editorDom.addClass({
                domNode: [getFooter()[0], this.$target[0]],
                class: 'text-white',
            });
        } else {
            await this.editorDom.removeClass({
                domNode: [getFooter()[0], this.$target[0]],
                class: 'text-white',
            });
        }
        // $footer.toggleClass('text-white', widgetValue === 'cover');
        // this.$target.toggleClass('text-white', widgetValue === 'cover');
        if (widgetValue === 'minimalist') {
            await this.editorDom.addClass({
                domNode: getFooter()[0],
                class: 'd-none',
            });
        } else {
            await this.editorDom.removeClass({
                domNode: getFooter()[0],
                class: 'd-none',
            });
        }
        // $footer.toggleClass('d-none', widgetValue === 'minimalist');
        if (widgetValue === 'classic') {
            await this.editorDom.removeClass({
                domNode: this.$target.find('.s_blockquote_avatar')[0],
                class: 'd-none',
            });
        } else {
            await this.editorDom.addClass({
                domNode: this.$target.find('.s_blockquote_avatar')[0],
                class: 'd-none',
            });
        }
        // this.$target.find('.s_blockquote_avatar')
        //     .toggleClass('d-none', widgetValue !== 'classic');
    },
});
});
