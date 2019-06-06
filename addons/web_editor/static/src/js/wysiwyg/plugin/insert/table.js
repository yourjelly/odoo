(function () {
'use strict';

var TablePicker = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_table.xml'];
        this.dependencies = ['Arch'];
        this.buttons = {
            template: 'wysiwyg.buttons.tablepicker',
            events: {
                'click': '_updatePicker',
                'mouseover we3-row we3-button': '_updatePicker',
            },
        };
        this.tableClassName = 'table table-bordered';
        this._MIN_ROWS = 3;
        this._MIN_COLS = 3;
        this._CELL_SIZE_EM = 1;
        this._ROW_MARGIN_EM = 0.45;
        this._COL_MARGIN_EM = 0.24;
        this._MAX_ROWS = this.options.insertTableMaxSize.row;
        this._MAX_COLS = this.options.insertTableMaxSize.col;
        this._tableMatrix = this._getTableMatrix(this._MAX_ROWS, this._MAX_COLS);

        // contentEditable fail for image and font in table
        // user must use right arrow the number of space but without feedback
        var tds = this.editable.getElementsByTagName('td');
        for (var k = 0; k < tds.length; k++) {
            var td = tds[k];
            if (tds[k].querySelector('img, span.fa')) {
                if (td.firstChild && !td.firstChild.tagName) {
                    var startSpace = this.utils.getRegex('startSpace');
                    td.firstChild.textContent = td.firstChild.textContent.replace(startSpace, ' ');
                }
                if (td.lastChild && !td.lastChild.tagName) {
                    var endSpace = this.utils.getRegex('endSpace');
                    td.lastChild.textContent = td.lastChild.textContent.replace(endSpace, ' ');
                }
            }
        }
        // self.context.invoke('HistoryPlugin.clear'); TODO: put back
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Create empty table element.
     *
     * @param {Number} rowCount
     * @param {Number} colCount
     * @returns {Node} table
     */
    createTable (rowCount, colCount) {
        var table = this.dependencies.Arch.createArchNode('table', [['class', this.tableClassName]]);
        for (var i = 0; i < rowCount; i++) {
            var tr = this.dependencies.Arch.createArchNode('tr');
            for (var j = 0; j < colCount; j++) {
                var td = this.dependencies.Arch.createArchNode('td');
                var br = this.dependencies.Arch.createArchNode('br');
                td.append(br);
                tr.append(td);
            }
            table.append(tr);
        }
        return table;
    }
    /**
     * Insert a table.
     * Note: adds <p><br></p> before/after the table if the table
     * has nothing brefore/after it, so as to allow the carret to move there.
     *
     * @param {String} dim dimension of table (ex : "5x5")
     */
    insertTable (dim) {
        var dimension = dim.split('x');
        var table = this.createTable(dimension[0], dimension[1], this.options);
        this.dependencies.Arch.insert(table);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Get the number of columns or rows to show in the picker in function of the
     * currently selected column/row.
     *
     * @param {String ('col' | 'row')} colOrRow
     * @returns {Number}
     */
    _cellsToShow (colOrRow) {
        var CELLS_LOOKAHEAD = 1;
        var current = colOrRow === 'col' ? this._col : this._row;
        var min = colOrRow === 'col' ? this._MIN_COLS : this._MIN_ROWS;
        var max = colOrRow === 'col' ? this._MAX_COLS : this._MAX_ROWS;
        var show = current + CELLS_LOOKAHEAD > max ? max : current + CELLS_LOOKAHEAD;
        return show < min ? min : show;
    }
    /**
     * Get the width of a number `n` of columns or the height of a number `n` of rows.
     *
     * @param {Number} n
     * @param {String ('col' | 'row')} colOrRow
     * @returns {Number}
     */
    _cellsSize (n, colOrRow) {
        var margin = colOrRow === 'col' ? this._COL_MARGIN_EM : this._ROW_MARGIN_EM;
        return (n * this._CELL_SIZE_EM) + (n * margin);
    }
    /**
     * Return a 3D array representing a table.
     * It contains `nRows` arrays of length `nCols`.
     * Each cell contains its position as 'rowxcol' (1-indexed).
     *
     * Eg.: _getRowsArray(2, 3) returns
     * [['1x1', '1x2', '1x3'],
     *  ['2x1', '2x2', '2x3']]
     *
     * @param {Number} nRows
     * @param {Number} nCols
     * @returns {Number []}
     */
    _getTableMatrix (nRows, nCols) {
        var emptyRowsArray = Array.apply(null, Array(nRows));
        var emptyColsArray = Array.apply(null, Array(nCols));

        return emptyRowsArray.map(function (v, i) {
            var rowIndex = i + 1;
            return emptyColsArray.map(function (w, j) {
                var colIndex = j + 1;
                return rowIndex + 'x' + colIndex;
            });
        });
    }
    /**
     * Update the picker highlighter with the current selected columns and rows.
     */
    _highlightPicker (group) {
        var self = this;
        var buttons = group.querySelectorAll('.wysiwyg-dimension-picker-mousecatcher we3-button');

        buttons.forEach(function (button) {
            button.classList.remove('wysiwyg-tablepicker-highlighted');

            var data = button.getAttribute('data-value');
            if (!data) {
                return;
            }
            var value = data.split('x');
            var row = parseInt(value[0]);
            var col = parseInt(value[1]);
            if (self._row >= row && self._col >= col) {
                button.classList.add('wysiwyg-tablepicker-highlighted');
            }
        });
    }
    /**
     * Resize the picker to show up to the current selected columns and rows + `CELLS_LOOKAHEAD`,
     * unless that sum goes beyond the binds of `this._[MIN|MAX]_[COLS|ROWS]`.
     */
    _resizePicker (group) {
        var picker = group.querySelector('.wysiwyg-dimension-picker');
        var width = this._cellsSize(this._cellsToShow('col'), 'col');
        var height = this._cellsSize(this._cellsToShow('row'), 'row');
        picker.style.width = width + 'em';
        picker.style.height = height + 'em';
    }
    /**
     * Update the dimensions display of the picker with the currently selected row and column.
     */
    _updateDimensionsDisplay (group) {
        var display = group.querySelector('.wysiwyg-dimension-display');
        display.innerText = this._row + ' x ' + this._col;
    }
    /**
     * Update the picker and selected rows and columns.
     *
     * @param {MouseEvent} ev 
     */
    _updatePicker (ev) {
        if (!ev.target || ev.target.tagName !== "WE3-BUTTON" || ev.target.parentNode.tagName === 'WE3-DROPDOWN') {
            this._row = this._col = 1;
        } else {
            var values = ev.target.getAttribute('data-value').split('x');
            this._row = parseInt(values[0]);
            this._col = parseInt(values[1]);
        }
        for (var k = 0; k < this.buttons.elements.length; k++) {
            var group = this.buttons.elements[k];
            if (group === ev.target || group.contains(ev.target)) {
                break;
            }
        }
        this._resizePicker(ev.currentTarget);
        this._highlightPicker(ev.currentTarget);
        this._updateDimensionsDisplay(ev.currentTarget);
    }
};

var Table = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_table.xml'];
        this.dependencies = [];
        this.buttons = {
            template: 'wysiwyg.popover.table',
        };
    }

    get (archNode) {
        return archNode.ancestor('isCell');
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Add a new col.
     *
     * @param {String('left'|'right')} position
     * @param {Node} cell
     */
    addCol (position, range) {
        var self = this;
        var cell = range.sc;
        var cells = this._currentCol(cell);
        cells.forEach(function (cell) {
            var td = self._createCell();
            if (position === 'left') {
                cell.parentNode.insertBefore(td, cell);
            } else {
                cell.parentNode.insertBefore(td, cell.nextSibling);
            }
        });
    }
    /**
     * Add a new row.
     *
     * @param {String('above'|'below')} position
     * @param {Node} cell
     */
    addRow (position, range) {
        var cell = range.sc;
        var parentRow = this._currentRow(cell);
        var nCols = parentRow.querySelectorAll('td').length;
        var tr = this.dependencies.Arch.createArchNode('tr');
        for (var i = 0; i < nCols; i++) {
            tr.append(this._createCell());
        }
        if (position === 'above') {
            parentRow.parentNode.insertBefore(tr, parentRow);
        } else if (parentRow.nextSibling) {
            parentRow.parentNode.insertBefore(tr, parentRow.nextSibling);
        } else {
            parentRow.parentNode.append(tr);
        }
    }
    /**
     * Delete the current column.
     *
     * @param {null} value
     * @param {Node} cell
     */
    deleteCol (value, range) {
        var self = this;
        var cell = range.sc;
        // Delete the last remaining column === delete the table
        if (!cell.previousElementSibling && !cell.nextElementSibling) {
            return this.deleteTable(null, cell);
        }
        var cells = this._currentCol(cell);
        var point;
        cells.forEach(function (node) {
            point = self.dom.removeBlockNode(node);
        });

        if (point && point.node) {
            range = range.replace({
                sc: this.utils.firstLeaf(point.node),
                so: 0,
            });
            this.dependencies.Arch.setRange(range);
        }
    }
    /**
     * Delete the current row.
     *
     * @param {null} value
     * @param {Node} cell
     */
    deleteRow (value, range) {
        // Delete the last remaining row === delete the table
        var cell = range.sc;
        var row = this._currentRow(cell);
        if (!row) {
            return;
        }
        if (!row.previousElementSibling && !row.nextElementSibling) {
            return this.deleteTable(null, cell);
        }
        var point = this.dom.removeBlockNode(row);
        
        // Put the range back on the previous or next row after deleting
        // to allow chain-removing
        if (point && point.node) {
            range = range.replace({
                sc: this.utils.firstLeaf(point.node),
                so: 0,
            });
            this.dependencies.Arch.setRange(range);
        }
    }
    /**
     * Delete the current table.
     *
     * @param {null} value
     * @param {Node} cell
     */
    deleteTable (value, range) {
        var cell = range.sc;
        var point = this.dom.removeBlockNode(this._currentTable(cell));
        if (this.dependencies.Arch.isEditableNode(point.node) && !this.utils.isText(point.node)) {
            point.replace(this.utils.firstLeaf(point.node), 0);
        }
        range = range.replace({
            sc: point.node,
            so: point.offset,
        });
        this.dependencies.Arch.setRange(range);
    }
    next (value, range) {
        var cell = this.utils.ancestor(range.ec, this.utils.isCell);
        var nextCell = cell.nextElementSibling;
        if (!nextCell) {
            var row = this.utils.ancestor(range.ec, function (node) {
                return node.tagName === 'TR';
            });
            var nextRow = row.nextElementSibling;
            if (!nextRow) {
                return;
            }
            nextCell = nextRow.firstElementChild;
        }
        return nextCell;
    }
    prev (value, range) {
        var cell = range.scArch.isCell();
        var nextCell = cell.previousElementSibling;
        if (!nextCell) {
            var row = this.utils.ancestor(range.sc, function (node) {
                return node.tagName === 'TR';
            });
            var nextRow = row.previousElementSibling;
            if (!nextRow) {
                return;
            }
            nextCell = nextRow.lastElementChild;
        }
        return nextCell;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _createCell () {
        var td = this.dependencies.Arch.createArchNode('td');
        var br = this.dependencies.Arch.createArchNode('br');
        td.append(br);
        return td;
    }
    /**
     * Get the current column (as an array of cells).
     *
     * @param {Node} cell
     * @returns {Node []}
     */
    _currentCol (cell) {
        var colIndex = cell.ancestor(node => node.nodeName === 'td').index();
        var rows = this._currentTable(cell).descendents(node => node.nodeName === 'tr', true);
        var cells = [];
        rows.forEach(function (row) {
            cells.push(row.nthChild(colIndex));
        });
        return cells;
    }
    /**
     * Get the current row.
     *
     * @param {Node} cell
     * @returns {Node}
     */
    _currentRow (cell) {
        return cell.firstLeaf().ancestor(node => node.nodeName === 'tr');
    }
    /**
     * Get the current table.
     *
     * @param {Node} cell
     * @returns {Node}
     */
    _currentTable (cell) {
        return cell.ancestor(node => node.isTable());
    }
};

we3.addPlugin('TablePicker', TablePicker);
we3.addPlugin('Table', Table);

})();
