odoo.define('project.update_kanban', function (require) {
'use strict';

var core = require('web.core');
var Dialog = require('web.Dialog');
var KanbanRecord = require('web.KanbanRecord');

var QWeb = core.qweb;
var _t = core._t;


KanbanRecord.include({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    _openRecord: function () {
        if (this.modelName === 'project.project') {
            this.$('.o_project_kanban_boxes a').first().click();
        } else {
            this._super.apply(this, arguments);
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    _onKanbanActionClicked: function (ev) {
        var self = this;
        if (this.modelName === 'project.task' && $(ev.currentTarget).data('type') === 'set_cover') {
            ev.preventDefault();

            var domain = [['res_model', '=', 'project.task'], ['res_id', '=', this.id], ['mimetype', 'ilike', 'image']];
            this._rpc({
                    model: 'ir.attachment',
                    method: 'search_read',
                    domain: domain,
                    fields: ['id', 'name'],
                })
                .then(open_cover_images_dialog);
        } else {
            this._super.apply(this, arguments, ev);
        }


        function open_cover_images_dialog(attachment_ids) {
            var cover_id = self.record.displayed_image_id.raw_value[0];
            var $content = $(QWeb.render("project.SetCoverModal", {
                cover_id: cover_id,
                attachment_ids: attachment_ids,
            }));
            var $imgs = $content.find('img');

            var dialog = new Dialog(self, {
                title: _t("Set a Cover Image"),
                buttons: [{text: _t("Select"), classes: 'btn-primary', close: true, disabled: !cover_id, click: function () {
                    var selected_img = $imgs.filter('.o_selected');
                    var data = {'id': selected_img.data('id'), 'display_name': selected_img.data('name')};
                    self._updateRecord({displayed_image_id: data});
                }}, {text: _t("Remove Cover Image"), close: true, click: function () {
                    self._updateRecord({displayed_image_id: false});
                }}, {text: _t("Discard"), close: true},
                {text: _t("Upload and Set"), close: true, click: function(){ cover_image_upload.call(self);
                }}],
                $content: $content,
            }).open();

        function cover_image_upload() {
            var self = this;
            var $upload_input = $('<input type="file" name="files[]"/>');
            $upload_input.on('change', function (e) {
                var f = e.target.files[0];
                var reader = new FileReader();
                reader.onload = function(e) {
                    console.log(e);
                    console.log(self.model);
                    self._rpc({
                            route: '/web/binary/upload_attachment',
                            method: 'upload_attachment',
                            params: {model:'project.task' ,id: 0,ufile: f.name},
                    })
                    .then(open_cover_images_dialog);
                };
                try {
                    reader.readAsDataURL(f);
                } catch (e) {
                    console.warn(e);
                }
            });

             $upload_input.click();
        }

            var $selectBtn = dialog.$footer.find('.btn-primary');
            $content.on('click', 'img', function (ev) {
                $imgs.not(ev.currentTarget).removeClass('o_selected');
                $selectBtn.prop('disabled', !$(ev.currentTarget).toggleClass('o_selected').hasClass('o_selected'));
            });

            $content.on('dblclick', 'img', function (ev) {
                var selected_img = $(ev.currentTarget);
                var data = {'id': selected_img.data('id'), 'display_name': selected_img.data('name')};
                self._updateRecord({displayed_image_id: data});
                dialog.close();
            });
        }
    },
});
});
