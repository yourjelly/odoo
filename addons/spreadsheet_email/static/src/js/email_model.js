/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import spreadsheet from "@documents_spreadsheet/js/o_spreadsheet/o_spreadsheet_loader";
const Model = spreadsheet.Model;
const { createEmptyWorkbookData } = spreadsheet.helpers;
const CorePlugin = spreadsheet.CorePlugin;

patch(Model.prototype, 'spreadsheet_email/static/src/js/email_model.js',{
    createEmptyExcelWorkbookData() {
        return {
            ...createEmptyWorkbookData(),
            sheets: [this.createEmptySheet("sh1", "Sheet1")],
        };
    },

    createEmptySheet(sheetId, name) {
        return {
            id: sheetId,
            name,
            colNumber: 26,
            rowNumber: 100,
            cells: {},
            cols: {},
            rows: {},
            merges: [],
            conditionalFormats: [],
            figures: [],
            charts: [],
        };
    },

    async exportTable() {
        await this.waitForIdle();
        this.dispatch("EVALUATE_ALL_SHEETS");
        let data = this.createEmptyExcelWorkbookData();
        for (let handler of this.handlers) {
          if (handler instanceof CorePlugin) {
            handler.exportForExcel(data);
          }
        }
        data = JSON.parse(JSON.stringify(data));

        const sheetData = this.getActiveSheetData(data);
        return this.generateHtmlTable(sheetData.cellDataArray, sheetData.merges)
    },

    getActiveSheetData(jsonData) {
        const activeSheetId = this.getters.getActiveSheetId();

        const activeSheet = jsonData.sheets.find(sheet => sheet.id === activeSheetId);
        const merges = activeSheet.merges || [];

        const cells = activeSheet.cells;
        const styles = jsonData.styles;
        const cellKeys = Object.keys(cells);

        const cellDataArray = cellKeys.map(cellKey => {
          const cell = cells[cellKey];
          let styleObject = {};
          if (cell.style) {
            styleObject = styles[cell.style.toString()];
          }
          return {
            ref: cellKey,
            value: cell.value,
            style: styleObject,
          };
        });

        return { cellDataArray, merges };
    },  

    generateHtmlTable(cellDataArray, merges) {
        let maxRow = 0;
        let maxCol = 0;

        const mergeMap = new Map();
        merges.forEach(merge => {
          const [startRef, endRef] = merge.split(':');
          const startMatch = startRef.match(/([A-Z]+)(\d+)/);
          const endMatch = endRef.match(/([A-Z]+)(\d+)/);
          if (startMatch && endMatch) {
            const startCol = startMatch[1].charCodeAt(0) - 'A'.charCodeAt(0);
            const endCol = endMatch[1].charCodeAt(0) - 'A'.charCodeAt(0);
            const colspan = endCol - startCol + 1;
            mergeMap.set(startRef, colspan);
          }
        });

        cellDataArray.forEach(cellData => {
          const match = cellData.ref.match(/([A-Z]+)(\d+)/);
          if (match) {
            const col = Math.min(match[1].charCodeAt(0) - 'A'.charCodeAt(0), 25);
            const row = Math.min(parseInt(match[2], 10) - 1, 99);
            maxCol = Math.max(col, maxCol);
            maxRow = Math.max(row, maxRow);
          }
        });

        let htmlTable = '<table>';

        for (let r = 0; r <= maxRow; r++) {
          htmlTable += '<tr>';
          for (let c = 0; c <= maxCol; c++) {
            const cellRef = `${String.fromCharCode(65 + c)}${r + 1}`;
            const cellData = cellDataArray.find(cd => cd.ref === cellRef);
            let styleAttr = '';
            let cellValue = '';

            if (cellData && cellData.value !== undefined) { 
              cellValue = cellData.value;
              if (cellData.style) {
                styleAttr = ` style="${Object.entries(cellData.style).map(([key, value]) => `${key}:${value}`).join('; ')} border:1px solid black; padding: 0px 20px"`;
              }

              if (mergeMap.has(cellRef)) {
                const colspan = mergeMap.get(cellRef);
                htmlTable += `<td${styleAttr} colspan="${colspan}">${cellValue}</td>`;
                c += colspan - 1;
              } else {
                htmlTable += `<td${styleAttr}>${cellValue}</td>`;
              }
            } else if (mergeMap.has(cellRef)) {
              const colspan = mergeMap.get(cellRef);
              htmlTable += `<td${styleAttr} colspan="${colspan}"></td>`;
              c += colspan - 1; 
            } else {
              htmlTable += '<td></td>';
            }
          }
          htmlTable += '</tr>';
        }

        htmlTable += '</table>';
        return htmlTable;
    }
});