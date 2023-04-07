/** @odoo-module */

import { Dialog } from "@web/core/dialog/dialog";
import { _lt } from "@web/core/l10n/translation";
import { useChildRef, useService } from '@web/core/utils/hooks';

import { Component, onWillUpdateProps, markup, Markup } from '@odoo/owl';
import {
    ConfirmationDialog
} from '@web/core/confirmation_dialog/confirmation_dialog';

export class ComparisonDialog extends ConfirmationDialog {}
ComparisonDialog.template = "web_editor.ComparisonDialog";
ComparisonDialog.props = {
    ...ConfirmationDialog.props,
    comparisonHtml: { type: Markup, optional: true },
};
ComparisonDialog.defaultProps = {
    ...ConfirmationDialog.defaultProps,
    confirmLabel: _lt("Restore this version"),
    title: _lt("Version comparison"),
    cancel: () => {}
};
