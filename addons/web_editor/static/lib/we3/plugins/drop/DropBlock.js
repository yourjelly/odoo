(function () {
'use strict';

var DropBlock = class extends we3.AbstractPlugin {
    /**
     *
     * @override
     *
     * @param {Object} parent
     * @param {Object} params
     *
     * @param {Object} params.dropblocks
     * @param {string} params.dropblocks.title
     * @param {Object[]} params.dropblocks.blocks
     * @param {string} params.dropblocks.blocks.title
     * @param {string} params.dropblocks.blocks.thumbnail
     * @param {string} params.dropblocks.blocks.content
     * @param {Object} params.dropblockOpenDefault
     * @param {Object} params.dropblockStayOpen
     * @param {Object} params.autoCloseDropblock
     **/
    constructor (parent, params) {
        super(...arguments);

        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_dropblock.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.dropblock',
            active: '_isActive',
            enabled: '_enabled',
        };
        this.dependencies = ['Arch', 'Renderer'];

        this.sidebarEvents = {
            'mousedown': '_onMouseDownBlock',
            'touchstart': '_onTouchStartBlock',
        };
        this.documentDomEvents = {
            'mousemove': '_onMouseMove',
            'mouseup': '_onMouseUp',
            'touchstart': '_onTouchStart',
            'touchmove': '_onTouchMove',
            'touchend': '_onTouchEnd',
            'touchcancel': '_onTouchEnd',
        };
        this.editableDomEvents = {
            'mouseenter': '_onMouseEnter',
            'mouseleave': '_onMouseLeave',
            'mousedown we3-dropblock-buttons we3-button': '_onMouseDownHandleButton',
            'touchstart we3-dropblock-buttons we3-button': '_onTouchStartHandleButton',
        };
        this.pluginEvents = {
            'dropzone': '_onDragAndDropNeedDropZone',
            'drag': '_onDragAndDropStart',
            'dragAndDrop': '_onDragAndDropMove',
            'drop': '_onDragAndDropEnd',
        };

        this._origin = document.createElement('we3-dropblock-dropzone-origin');
        this._origin.setAttribute('contentEditable', "false");
        this._blockContainer = document.createElement('we3-dropblock');
        if (this.options.dropblocks) {
            this._createBlocks(this.options.dropblocks);
        }
        params.insertBeforeEditable(this._blockContainer);

        this._dragAndDropMoveSearch = this._throttled(50, this._dragAndDropMoveSearch.bind(this));

        this._moveAndDropButtons = [];
    }
    start () {
        var self = this;
        var promise = super.start();
        if (!this.options.dropblocks) {
            promise = promise.then(this._loadTemplateBlocks.bind(this, this.options.dropBlockTemplate || 'wysiwyg.dropblock.defaultblocks'));
        }
        if (this.options.dropblockStayOpen || this.options.dropblockOpenDefault) {
            this.open();
        }
        return promise
            .then(this._bindEvents.bind(this))
            .then(this._createBlockDropable.bind(this))
            .then(this._markDragableBlocks.bind(this));
    }
    /**
     * Prepares the page so that it may be saved:
     * - Asks the snippet editors to clean their associated snippet
     * - Remove the 'contentEditable' attributes
     **/
    saveEditor () {
    }
    setEditorValue () {
        if (this._blockDropable) {
            this._markDragableBlocks();
        }
    }
    blurEditor () {
        this._dragAndDropEnd();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    close () {
        if (!this.options.dropblockStayOpen) {
            this.isOpen = false;
            this._blockContainer.style.display = 'none';
        }
    }
    open () {
        this.isOpen = true;
        this._blockContainer.style.display = 'block';
    }
    /**
     * Toggle the code view
     **/
    toggle () {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     *
     * @private
     **/
    _bindEvents () {
        this._bindDOMEvents(this._blockContainer, this.sidebarEvents);
    }
    /**
     * 
     * @params {object[]}   dropblocks
     * @params {string}     dropblocks[0].title
     * @params {object[]}   dropblocks[0].blocks
     * @params {string}     dropblocks[0].blocks.title
     * @params {string}     dropblocks[0].blocks.thumbnail
     * @params {string}     dropblocks[0].blocks.content
     **/
    _createBlocks (dropblocks) {
        var self = this;
        var blocks = [];
        var blockContainer = this._blockContainer;
        dropblocks.forEach(function (groupBlocks) {
            var nodeBlocks = document.createElement('we3-blocks');

            var title = document.createElement('we3-title');
            title.innerHTML = groupBlocks.title;
            nodeBlocks.appendChild(title);

            groupBlocks.blocks.forEach(function (block) {
                var blockNode = document.createElement('we3-block');
                var thumbnail = self._createBlockThumbnail(block);
                blocks.push(blockNode);
                nodeBlocks.appendChild(blockNode);
                blockNode.appendChild(thumbnail);
                blockNode.setAttribute('data-content', block.content);
            });

            blockContainer.appendChild(nodeBlocks);
        });
        this._blockNodes = blocks;
    }
    _createBlockDropable () {
        var self = this;
        this._blockDropable = [];
        this._blockNodes.forEach(function (block, index) {
            var items = [{
                target: block.getAttribute('data-content'),
            }];
            self.trigger('dropzone', items);
            self._blockDropable.push({
                dropIn: items.length && items[0].dropIn || function () { return []; },
                dropNear: items.length && items[0].dropNear || function () { return []; },
            });
        });
    }
    _createBlockThumbnail (thumbnailParams) {
        var thumbnail = document.createElement('we3-dropblock-thumbnail');
        var preview = document.createElement('we3-preview');
        preview.style.backgroundImage = 'url(' + thumbnailParams.thumbnail + ')';
        var title = document.createElement('we3-title');
        title.innerHTML = thumbnailParams.title;
        thumbnail.appendChild(preview);
        thumbnail.appendChild(title);
        return thumbnail;
    }
    /**
     * Return true if the codeview is active
     *
     * @returns {Boolean}
     **/
    _enabled () {
        return true;
    }
    /**
     * Return true if the container is open
     *
     * @returns {Boolean}
     **/
    _isActive () {
        return this.isOpen;
    }
    /**
     * The template must have the same structure created by '_createBlocks'
     * method
     * 
     * @params {string} dropBlockTemplate
     **/
    _loadTemplateBlocks (dropBlockTemplate) {
        this._blockContainer.innerHTML = this.options.renderTemplate('DropBlock', dropBlockTemplate);
        this._blockNodes = this._blockContainer.querySelectorAll('we3-block');
    }
    _dragAndDropStartCloneSidebarElements (block) {
        var thumbnail = block.querySelector('we3-dropblock-thumbnail');
        var box = thumbnail.getBoundingClientRect();
        var content = block.getAttribute('data-content');
        var el = document.createElement('we3-content');
        el.innerHTML = content;
        var childNodes = el.childNodes;
        var index = this._blockNodes.indexOf(block);

        this._dragAndDrop = {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            thumbnail: thumbnail.cloneNode(true),
            elements: [].slice.call(childNodes),
            content: content,
            dropIn: this._blockDropable[index].dropIn,
            dropNear: this._blockDropable[index].dropNear,
        };
    }
    _dragAndDropStartCloneEditableElements (block, id, button) {
        var box = button.parentNode.getBoundingClientRect();
        var content = document.createElement('we3-content');
        content.innerHTML = block.outerHTML;
        var buttons = content.querySelector('we3-dropblock-buttons');
        buttons.parentNode.removeChild(buttons);
        var childNodes = content.childNodes;

        this._dragAndDrop = {
            width: box.width,
            height: box.height,
            thumbnail: button.parentNode,
            elements: [].slice.call(childNodes),
            content: block.outerHTML,
            id: id,
            dropIn: button.we3DropableDropIn,
            dropNear: button.we3DropableDropNear,
        };
    }
    _dragAndDropStart (clientX, clientY) {
        this._origin.appendChild(this._dragAndDrop.thumbnail);
        this._dragAndDrop.thumbnail.style.width = this._dragAndDrop.width + 'px';
        this._dragAndDrop.thumbnail.style.height = this._dragAndDrop.height + 'px';
        this._enabledDropZones = [];
        this._createDropZoneOriginPosition();
        this._dragAndDropMove(clientX, clientY);
        this.trigger('drag', Object.assign({}, this._dragAndDrop), {
            dropIn: this._dragAndDrop.dropIn && this._dragAndDrop.dropIn(),
            dropNear: this._dragAndDrop.dropNear && this._dragAndDrop.dropNear(),
        });
        this.editable.setAttribute('contentEditable', 'false');
    }
    _dragAndDropMove (clientX, clientY) {
        if (!this._dragAndDrop) {
            return;
        }
        var originBox = this._origin.getBoundingClientRect()
        this._dragAndDrop.dx = clientX - originBox.left;
        this._dragAndDrop.dy = clientY - originBox.top;

        var handlePosition = this.editable.getBoundingClientRect();
        var left = this._dragAndDrop.left = clientX - handlePosition.left - this._dragAndDrop.width/2;
        var top = this._dragAndDrop.top = clientY - handlePosition.top - this._dragAndDrop.height/2;
        this._dragAndDrop.thumbnail.style.left = (left >= 0 ? '+' : '') + left + 'px';
        this._dragAndDrop.thumbnail.style.top = (top >= 0 ? '+' : '') + top + 'px';
    }
    _dragAndDropMoveSearch () {
        if (!this._dragAndDrop) {
            return;
        }
        var left = this._dragAndDrop.dx;
        var top = this._dragAndDrop.dy;

        var select, size = Infinity;
        this._enabledDropZones.forEach(function (dropzone) {
            var dtop = dropzone.top - 5;
            var dbottom = dropzone.top + dropzone.height + 5;
            var dleft = dropzone.left - 5;
            var dright = dropzone.left + dropzone.width + 5;
            if (!dropzone.vertical) {
                dtop -= dropzone.height/2;
                dbottom -= dropzone.height/2;
            }
            if (top >= dtop && top <= dbottom &&
                left >= dleft && left <= dright) {
                var dsize = Math.pow(dropzone.top - top, 2) + Math.pow(dropzone.left - top, 2);
                if (dsize < size) {
                    dsize = size;
                    select = dropzone;
                }
            }
        });

        if (select) {
            if (this._selectedDragAndDrop !== select.node) {
                this.trigger('dragAndDrop', Object.assign({}, this._dragAndDrop), select.node, this._selectedDragAndDrop);
                this._selectedDragAndDrop = select.node;
            }
        } else if (this._selectedDragAndDrop) {
            this.trigger('dragAndDrop', Object.assign({}, this._dragAndDrop), null, this._selectedDragAndDrop);
            this._selectedDragAndDrop = null;
        }
    }
    _dragAndDropEnd (ev) {
        this.editable.setAttribute('contentEditable', 'true');

        if (!this._dragAndDrop) {
            return;
        }

        this._origin.removeChild(this._dragAndDrop.thumbnail);
        this._removeMoveAndDropButtons();

        if (this._dragAndDropMoveBlock) {
            this._dragAndDropMoveBlock();
            this._dragAndDropMoveBlock = null;
        }

        var id, position;
        if (this._selectedDragAndDrop) {
            this._dragAndDrop.elements.forEach(function (node) {
                node.parentNode.removeChild(node);
            });
            id = +this._selectedDragAndDrop.getAttribute('data-id');
            position = this._selectedDragAndDrop.getAttribute('data-position');
            this._selectedDragAndDrop = null;
        }

        this._removeDropZoneOriginPosition();

        var dragAndDrop = this._dragAndDrop;
        this._dragAndDrop = null;

        this._removeDropZones();

        this.trigger('drop', dragAndDrop, id, position);
    }
    _markDragableBlocks () {
        var self = this;
        this._blockNodes.forEach(function (block, index) {
            var select = self._blockDropable[index];
            if (select.dropIn().length || select.dropNear().length) {
                block.classList.remove('we3-disabled');
            } else {
                block.classList.add('we3-disabled');
            }
        });
    }
    _removeDropZones () {
        this._enabledDropZones.forEach(function (zone) {
            zone.node.parentNode && zone.node.parentNode.removeChild(zone.node);
        });
        this._enabledDropZones = [];
    }
    _removeDropZoneOriginPosition () {
        this._origin.parentNode && this._origin.parentNode.removeChild(this._origin);
    }
    /**
     *
     * @params {enum<before|after|append|prepend>} position
     * @params {Node} node
     * @params {boolean} [vertical]
     * @returns {Node}
     **/
    _createDropZone (position, node) {
        var id = this.dependencies.Renderer.getID(node);
        if (!id) {
            return;
        }

        var dropzone = document.createElement('we3-dropblock-dropzone');
        dropzone.setAttribute('contentEditable', "false");
        dropzone.setAttribute('data-position', position);
        dropzone.setAttribute('data-id', id);

        switch (position) {
            case 'before':
                if (node.previousSibling && node.previousSibling.tagName === 'WE3-DROPBLOCK-DROPZONE') {
                    return;
                }
                node.parentNode.insertBefore(dropzone, node);
                break;
            case 'after':
                if (node.nextSibling && node.nextSibling.tagName === 'WE3-DROPBLOCK-DROPZONE') {
                    return;
                }
                if (node.nextSibling) {
                    node.parentNode.insertBefore(dropzone, node.nextSibling);
                } else {
                    node.parentNode.appendChild(dropzone);
                }
                break;
            case 'append':
                if (node.lastChild && node.lastChild.tagName === 'WE3-DROPBLOCK-DROPZONE') {
                    return;
                }
                node.appendChild(dropzone);
                break;
            case 'prepend':
                if (node.firstChild && node.firstChild.tagName === 'WE3-DROPBLOCK-DROPZONE') {
                    return;
                }
                var firstChild = node.firstChild;
                if (firstChild.tagName === 'WE3-DROPBLOCK-DROPZONE-ORIGIN') {
                    firstChild = firstChild.nextSibling;
                }
                if (firstChild) {
                    node.insertBefore(dropzone, firstChild);
                } else {
                    node.appendChild(dropzone);
                }
                break;
        }

        this._createDropZoneCss(dropzone, position, node);
        this._getDropZoneBoundingClientRect(dropzone);
    }
    _createDropZoneCss (dropzone, position, node) {
        var parent, child;
        if (position === 'append' || position === 'prepend') {
            child = node.nextSibling || node.previousSibling || node;
            parent = node;
        } else {
            child = node;
            parent = node.parentNode;
        }
        var css = this.window.getComputedStyle(child.tagName ? child : parent);
        var parentCss = this.window.getComputedStyle(node.parentNode);
        var float = css.float || css.cssFloat;
        var parentDisplay = parentCss.display;
        var parentFlex = parentCss.flexDirection;
        var vertical = false;
        if (!!(child && ((!child.tagName && child.textContent.match(/\S/)) || child.tagName === 'BR'))) {
            vertical = true;
        } else if (float === 'left' || float === 'right' || (parentDisplay === 'flex' && parentFlex === 'row')) {
            if (parent.clientWidth !== child.clientWidth) {
                vertical = true;
                dropzone.style.height = child.clientHeight + 'px';
            }
            dropzone.style.float = float;
        }
        if (vertical) {
            dropzone.setAttribute('orientation', 'vertical');
            dropzone.style.display = 'inline-block';
        }
    }
    _getDropZoneBoundingClientRect (dropzone) {
        var vertical = dropzone.getAttribute('orientation') === 'vertical';
        var box = dropzone.getBoundingClientRect();
        this._enabledDropZones.push({
            node: dropzone,
            vertical: vertical,
            top: box.top + (vertical ? 0 : 20) - this._originBox.top,
            left: box.left - this._originBox.left,
            width: box.width,
            height: box.height,
        });
    }
    _createDropZones (dropZones) {
        var self = this;
        var Renderer = this.dependencies.Renderer;
        if (dropZones.dropIn) {
            dropZones.dropIn.forEach(function (id) {
                var el = Renderer.getElement(id);
                if (!el || !el.parentNode) {
                    return;
                }
                [].slice.call(el.children).map(function (child) {
                    self._createDropZone('before', child);
                });
                self._createDropZone('append', el);
            });
        }
        if (dropZones.dropNear) {
            dropZones.dropNear.forEach(function (id) {
                var el = Renderer.getElement(id);
                if (!el || !el.parentNode) {
                    return;
                }
                self._createDropZone('before', el);
                self._createDropZone('after', el);
            });
        }
    }
    _createDropZoneOriginPosition () {
        if (this.editable.firstChild) {
            this.editable.insertBefore(this._origin, this.editable.firstChild);
        } else {
            this.editable.appendChild(this._origin);
        }
        this._originBox = this._origin.getBoundingClientRect();
    }
    _createMoveAndDropButtons () {
        var self = this;
        var Renderer = this.dependencies.Renderer;
        var items = [];
        this.trigger('dropzone', items);

        this._moveAndDropButtons = [];
        items.forEach(function (item) {
            var target = Renderer.getElement(item.target);
            var buttons = document.createElement('we3-dropblock-buttons');
            var button = document.createElement('we3-button');
            button.we3DropableDropIn = item.dropIn;
            button.we3DropableDropNear = item.dropNear;
            button.textContent = '';
            buttons.appendChild(button);
            if (target.firstChild) {
                target.insertBefore(buttons, target.firstChild);
            } else {
                target.appendChild(buttons);
            }
            self._moveAndDropButtons.push(buttons);
        });
        this._hasMoveAndDropButtons = true;
        this._markDragableItems(items);
    }
    _removeMoveAndDropButtons () {
        this._hasMoveAndDropButtons = false;
        this._moveAndDropButtons.forEach(function (el) {
            el.parentNode && el.parentNode.removeChild(el);
        });
        this._moveAndDropButtons = [];
        this._unmarkDragableItems();
    }
    _markDragableItems (items) {
        var Renderer = this.dependencies.Renderer;
        items.forEach(function (item) {
            var target = Renderer.getElement(item.target);
            target.classList.add('we3-dropblock-dropable');
            target.we3DropableDropIn = item.dropIn;
            target.we3DropableDropNear = item.dropNear;
        });
    }
    _unmarkDragableItems () {
        this.editable.querySelectorAll('.we3-dropblock-dropable').forEach(function (el) {
            el.classList.remove('we3-dropblock-dropable');
            delete el.we3DropableDropIn;
            delete el.we3DropableDropNear;
        });
    }
    _eventStartNewBlock (target) {
        this._dragAndDropEnd();
        var block;
        this._blockNodes.forEach(function (blockNode) {
            if (blockNode.contains(target)) {
                block = blockNode;
            }
        });
        if (block) {
            this._dragAndDropStartCloneSidebarElements(block);
            return true;
        }
    }
    _eventStartMoveBlock (button) {
        var block = button.parentNode.parentNode;
        var id = this.dependencies.Renderer.getID(block);
        if (!id || id === 1) {
            return;
        }
        this._dragAndDropStartCloneEditableElements(block, id, button);

        this._removeMoveAndDropButtons();

        var nextSibling = block.nextSibling;
        var parent = block.parentNode;
        parent.removeChild(block);
        this._dragAndDropMoveBlock = function reset () {
            if (nextSibling) {
                parent.insertBefore(block, nextSibling);
            } else {
                parent.appendChild(block);
            }
        };
        return id;
    }

    //--------------------------------------------------------------------------
    // Handle pluginEvents
    //--------------------------------------------------------------------------

    _onDragAndDropEnd (dragAndDrop, id, position) {
        if (!id) {
            if (dragAndDrop.id) {
                this.dependencies.Arch.remove(dragAndDrop.id);
                this._createMoveAndDropButtons();
                this._markDragableBlocks();
            }
            return;
        }
        var Arch = this.dependencies.Arch;
        var add = dragAndDrop.id || dragAndDrop.content;
        switch (position) {
            case 'before': Arch.insertBefore(add, id);
                break;
            case 'after': Arch.insertAfter(add, id);
                break;
            case 'append': Arch.insert(add, id, Infinity);
                break;
            case 'prepend': Arch.insert(add, id, 0);
                break;
        }
        this._createMoveAndDropButtons();
        this._markDragableBlocks();
    }
    _onDragAndDropMove (dragAndDrop, dropzone, previousDropzone) {
        if (previousDropzone) {
            previousDropzone.style.display = '';
        }

        if (dropzone) {
            dragAndDrop.elements.forEach(function (node) {
                dropzone.parentNode.insertBefore(node, dropzone);
            });
            dropzone.style.display = 'none';
        } else {
            dragAndDrop.elements.forEach(function (node) {
                node.parentNode.removeChild(node);
            });
        }
    }
    _onDragAndDropNeedDropZone (items) {
        var self = this;
        var Arch = this.dependencies.Arch;
        function dropIn () { return 1; }
        if (!items.length) {
            items = [].slice.call(this.editable.children).map(function (el) {
                var archNode = Arch.getNode(el);
                if (archNode) {
                    return {
                        target: archNode.id,
                        dropIn: dropIn,
                    }
                }
            });
        }
    }
    _onDragAndDropStart (dragAndDrop, dropZones) {
        this._createDropZones(dropZones);
    }

    //--------------------------------------------------------------------------
    // Handle MouseEvent
    //--------------------------------------------------------------------------

    _onMouseDownBlock (ev) {
        if (this.options.autoCloseDropblock) {
            this.close();
        }
        if (this._eventStartNewBlock(ev.target)) {
            ev.preventDefault();
            ev.stopPropagation();
            this._dragAndDropStart(ev.clientX, ev.clientY);
        }
    }
    _onMouseDownHandleButton (ev) {
        if (this.options.autoCloseDropblock) {
            this.close();
        }
        ev.preventDefault();
        ev.stopPropagation();
        if (this._eventStartMoveBlock(ev.target)) {
            this._dragAndDropStart(ev.clientX, ev.clientY);
        }
    }
    _onMouseEnter () {
        if (!this._dragAndDrop && !this._hasMoveAndDropButtons) {
            this._createMoveAndDropButtons();
        }
    }
    _onMouseLeave (ev) {
        if (ev.target === this.editable && this._hasMoveAndDropButtons) {
            this._removeMoveAndDropButtons();
        }
    }
    _onMouseMove (ev) {
        this._dragAndDropMove(ev.clientX, ev.clientY);
        this._dragAndDropMoveSearch();
    }
    _onMouseUp (ev) {
        this._dragAndDropEnd();
    }

    //--------------------------------------------------------------------------
    // Handle TouchEvent
    //--------------------------------------------------------------------------

    _onTouchEnd (ev) {
        if (!this._selectedDragAndDrop && ev.path[0].tagName === "WE3-DROPBLOCK-DROPZONE") {
            this._selectedDragAndDrop = ev.path[0];
        }
        this._dragAndDropEnd();
    }
    _onTouchMove (ev) {
        this._dragAndDropMove(ev.touches[0].clientX, ev.touches[0].clientY);
        this._dragAndDropMoveSearch();
    }
    _onTouchStart (ev) {
        if (!this._dragAndDrop && !this._hasMoveAndDropButtons && this.editable.contains(ev.target)) {
            this._createMoveAndDropButtons();
        } else if (this._hasMoveAndDropButtons && !this.editable.contains(ev.target)) {
            this._removeMoveAndDropButtons();
        }
    }
    _onTouchStartBlock (ev) {
        this.close();
        if (this._eventStartNewBlock(ev.target)) {
            ev.preventDefault();
            ev.stopPropagation();
            this._dragAndDropStart(ev.touches[0].clientX, ev.touches[0].clientY);
        }
    }
    _onTouchStartHandleButton (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.close();
        if (this._eventStartMoveBlock(ev.target)) {
            this._dragAndDropStart(ev.touches[0].clientX, ev.touches[0].clientY);
        }
    }
};

we3.addPlugin('DropBlock', DropBlock);

})();
