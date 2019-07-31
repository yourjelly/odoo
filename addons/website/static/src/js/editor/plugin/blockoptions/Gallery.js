odoo.define('web_editor.wysiwyg.block_option.FacebookPage', function (require) {
'use strict';

var GalleryOption = class extends (we3.getPlugin('BlockOption:default')) {
    /**
     * @constructor
     * @param {Object} parent
     * @param {Object} params
     * @param {Object} options
     */
    constructor(parent, params, options) {
        super(...arguments);

        this._targetEvents = {
            'click .o_add_images': '_onAddImagesClick',
            'dropped img': '_onImageDropped',
            'save img': '_onImageSave',
        };
    }
    /**
     * @override
     */
    onStart(ui, target, state) {
        this._bindDOMEvents(target, this._targetEvents);

        var container = target.querySelector('.container');
        if (container && container.children.length) {
            for (var i = 0; i < container.children.length; i++) {
                if (container.children[i].tagName !== 'DIV') {
                    this.mode(null, this._getMode(target));
                    break;
                }
            }
        }
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Allows to change the images layout. @see grid, masonry, nomode, slideshow
     *
     * @see this.selectClass for parameters
     */
    mode(target, state, previewMode, value, ui, opt) {
        this._setMode(target, value);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Returns the images, sorted by index.
     *
     * @private
     * @param {HTMLElement} target
     * @returns {HTMLElement[]}
     */
    _getImages(target) {
        var imgs = [].slice.call(target.querySelectorAll('img'));
        imgs.sort((a, b) => {
            return this._getIndex(a) - this._getIndex(b);
        });
        return imgs;
    }
    /**
     * Returns the index associated to a given image.
     *
     * @private
     * @param {HTMLElement} img
     * @returns {integer}
     */
    _getIndex(img) {
        return img.dataset.index || 0;
    }
    /**
     * Gets the image target's layout mode (slideshow, masonry, grid or nomode).
     *
     * @param {HTMLElement} target
     * @returns {String('slideshow'|'masonry'|'grid'|'nomode')}
     */
    _getMode(target) {
        if (target.classList.contains('o_masonry')) {
            return 'masonry';
        } else if (target.classList.contains('o_grid')) {
            return 'grid';
        } else if (target.classList.contains('o_nomode')) {
            return 'nomode';
        }
        return 'slideshow';
    }
    /**
     * @param {HTMLElement} target
     * @param {string} value
     */
    _setMode(target, value) {
        this._removeStyle(target, false, 'height');

        switch (value) {
            case 'grid':
                var imgs = this._getImages();
                var row = document.createElement('div');
                row.classList.add('row');
                var columns = this._getColumns();
                var colClass = 'col-lg-' + (12 / columns);
                var container = this._replaceContent(row);

                imgs.forEach(function (img, index) {
                    var col = document.createElement('div');
                    col.classList.add(colClass);
                    col.appendChild(img);
                    row.appendChild(col);
                    if ((index + 1) % columns === 0) {
                        row = document.createElement('div');
                        row.classList.add('row');
                        container.appendChild(row);
                    }
                });
                break;
            case 'masonry':

                break;
            case 'nomode':

                break;
            case 'slideshow':

                break;
            default:
                throw new Error('Unknown mode set in gallery block');
        }

        this._removeClass(target, false, ['o_nomode', 'o_masonry', 'o_grid', 'o_slideshow']);
        this._addClass(target, false, 'o_' + value);
        this.dependencies.Overlay.reposition(); // FIXME automatic on arch update ?
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * When the snippet is empty, an edition button is the default content.
     *
     * @todo find a nicer way to do that to have editor style
     * @private
     * @param {Event} ev
     */
    _onAddImagesClick(ev) {
        ev.stopImmediatePropagation();
        this.addImages(false);
    }
    /**
     * @private
     * @param {Event} ev
     */
    _onImageDropped(ev) {
        var img = ev.target;
        var gallery = img;
        while (!gallery.classList.contains('o_gallery')) {
            gallery = gallery.parentNode;
            if (!gallery) {
                return;
            }
        }
        this.mode(null, this._getMode(gallery));

        // Make sure to reposition the overlay after images are loaded.
        // TODO should be automatic
        if (img.height) {
            return;
        }
        var Overlay = this.dependencies.Overlay;
        var _loadFunction = () => {
            setTimeout(() => Overlay.reposition()); // TODO at all places, seems really change to know about the overlay here
            img.removeEventListener('load', _loadFunction);
        };
        img.addEventListener('load', _loadFunction);
    }
    /**
     * Make sure image previews are updated if images are changed.
     *
     * @private
     * @param {Event} ev
     */
    _onImageSave(ev) {
        var img = ev.target; // FIXME event delegation ?
        var carousel = img;
        while (!carousel.classList.contains('carousel')) {
            carousel = carousel.parentNode;
            if (!carousel) {
                return;
            }
        }
        var index = -1;
        carousel.querySelectorAll('.carousel-item').forEach((item, _index) => {
            if (item.classList.contains('active')) {
                index = _index;
            }
        });
        carousel.querySelector('li[data-target]:nth-child(' + index + ')')
            .style.backgroundImage = 'url(' + img.src + ')';
    }
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('gallery', GalleryOption);
});
