/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";

const { onMounted, useState } = owl;

export class BottomSheet extends Dialog {

    setup() {
        super.setup();
        this.yLocked = null;
        this.state = useState({
            display: true,//this.props.display,
            fullscreen: false,
        });

        onMounted(() => {
            if (this.props.onMounted) {
                this.props.onMounted();
            }
        });
    }

    _getClientY(ev) {
        return ev.changedTouches ? ev.changedTouches[0].clientY : ev.clientY;
    }

    async _onClickBackdrop(ev) {
        if (ev.target.classList.contains('o-bottom-sheet')) {
            this.close();
        }
    }

    onLock(ev) {
        this.yLocked = this._getClientY(ev);
    }

    onMove(ev) {
        if (this.yLocked || this.yLocked === 0) {
            const dy = Math.sign(this._getClientY(ev) - this.yLocked);
            if (dy !== 0) {
                this.state.fullscreen = dy < 0;
            }
            this.yLocked = null;
        }
    }
}

BottomSheet.contentClass = "o-bottom-sheet-dialog";
BottomSheet.bodyTemplate = "web.BottomSheet";
BottomSheet.renderFooter = false;
BottomSheet.renderHeader = false;
BottomSheet.title = "";
BottomSheet.props = Object.assign(Object.create(Dialog.props), {
    allowFullscreen: true,
})
