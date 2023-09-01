/** @odoo-module **/

import { useService } from '@web/core/utils/hooks';
import { _t } from "@web/core/l10n/translation";
import { Dialog } from '@web/core/dialog/dialog';
import { Component } from "@odoo/owl";
import { Draw } from '../drawing/app';

import { useSubEnv, useEnv } from "@odoo/owl";

export class DrawDialog extends Component {
    setup() {
        this.size = 'xl';
        this.contentClass = 'o_select_media_dialog';
        this.title = _t("Draw");
        this.saveCallback = this.save.bind(this);
        
        this.uploadService = useService('upload');
        this.rpc = useService('rpc');
        this.env = useEnv();
        useSubEnv({ elements: [] });
        console.log('canvas_element from draw dialog is: ', this.props.canvas_elements);
    };

    async save() {
        var canvas = document.querySelector('#canvas')
        var myImage = canvas.toDataURL("image/png")
        const img = document.createElement("img");
        img.src = myImage;
        img.setAttribute('data-elements', JSON.stringify(this.env.elements));
        this.props.save(img);
        this.props.close();
    }
}

DrawDialog.template = 'web_editor.DrawDialog';

DrawDialog.components = {
    Dialog,
    Draw,
};
