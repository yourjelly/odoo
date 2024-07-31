import { Notebook } from "@web/core/notebook/notebook";

import { useEffect } from "@odoo/owl";

export class AccountMoveNotebook extends Notebook {
    static template = "account.AccountMoveNotebook";

    setup(){
        super.setup();
        this.lineIdsPage = this.pages.find((e) => e[1].name === "aml_tab");
        this.invoiceLineIdsPage = this.pages.find((e) => e[1].name === "invoice_tab");
        useEffect(
            () => {
                this.env.model.root.update({invoice_line_ids_mode: this.state.currentPage === this.invoiceLineIdsPage[0]});
            },
            () => [this.state.currentPage]
        );
    }

    // Override
//    get page() {
//        if(this.state.currentPage === "page_2"){
//            const sourcePage = this.pages.find((e) => e[0] === "page_3")[1];
//            const targetPage = this.pages.find((e) => e[0] === "page_2")[1];
//            targetPage.__ctx = sourcePage.__ctx;
//            targetPage.__render = sourcePage.__render;
//        }
//        return super.page;
//    }






//    // Override
//    activatePage(pageIndex) {
//        this.env.model.root.update({invoice_line_ids_mode: pageIndex === this.invoiceLineIdsPage[0]});
//        super.activatePage(pageIndex);
//    }
//
//    // Override
//    computeActivePage(defaultPage, activateDefault) {
//        const pageIndex = super.computeActivePage(...arguments);
//        this.env.model.root.update({invoice_line_ids_mode: pageIndex === this.invoiceLineIdsPage[0]});
//        return results;
//    }
//    setup() {
//        this.props.slots.page_2.__ctx = this.props.slots.page_3.__ctx;
//        this.props.slots.page_2.__render = this.props.slots.page_3.__render;
//        debugger;
//        super.setup();
//    }
    // Override
//    computePages(props) {
//        const pages = super.computePages(...arguments);
//        const pagesMapping = Object.fromEntries(pages.map((x, i) => [x[1].name, i]));
//        const sourceTabName = "aml_tab";
//        const targetTabName = "aml_tab2";
//        if(sourceTabName in pagesMapping && targetTabName in pagesMapping){
//            const targetPage = pages[pagesMapping[targetTabName]];
//            targetPage[1] = Object.assign(
//                {},
//                pages[pagesMapping[sourceTabName]][1],
//                {
//                    name: targetPage[1].name,
//                    title: targetPage[1].title,
//                    isVisible: targetPage[1].isVisible,
//                }
//            );
//        }
//
//        debugger;
//        return pages;
//    }
}
