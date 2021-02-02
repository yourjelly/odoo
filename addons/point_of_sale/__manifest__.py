# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Point of Sale',
    'version': '1.0.1',
    'category': 'Sales/Point of Sale',
    'sequence': 40,
    'summary': 'User-friendly PoS interface for shops and restaurants',
    'description': "",
    'depends': ['stock_account', 'barcodes', 'web_editor', 'digest'],
    'data': [
        'security/point_of_sale_security.xml',
        'security/ir.model.access.csv',
        'data/default_barcode_patterns.xml',
        'data/digest_data.xml',
        'wizard/pos_box.xml',
        'wizard/pos_details.xml',
        'wizard/pos_payment.xml',
        'views/pos_assets_common.xml',
        'views/pos_assets_index.xml',
        'views/pos_assets_qunit.xml',
        'views/point_of_sale_report.xml',
        'views/point_of_sale_view.xml',
        'views/pos_order_view.xml',
        'views/pos_category_view.xml',
        'views/product_view.xml',
        'views/account_journal_view.xml',
        'views/pos_payment_method_views.xml',
        'views/pos_payment_views.xml',
        'views/pos_config_view.xml',
        'views/pos_session_view.xml',
        'views/point_of_sale_sequence.xml',
        'data/point_of_sale_data.xml',
        'views/pos_order_report_view.xml',
        'views/account_statement_view.xml',
        'views/res_config_settings_views.xml',
        'views/digest_views.xml',
        'views/res_partner_view.xml',
        'views/report_userlabel.xml',
        'views/report_saledetails.xml',
        'views/point_of_sale_dashboard.xml',
    ],
    'demo': [
        'data/point_of_sale_demo.xml',
    ],
    'installable': True,
    'application': True,
    'qweb': [
        'static/src/xml/Chrome.xml',
        'static/src/xml/debug_manager.xml',
        'static/src/xml/Screens/ProductScreen/ProductScreen.xml',
        'static/src/xml/Screens/ClientListScreen/ClientLine.xml',
        'static/src/xml/Screens/ClientListScreen/ClientDetailsEdit.xml',
        'static/src/xml/Screens/ClientListScreen/ClientListScreen.xml',
        'static/src/xml/Screens/OrderManagementScreen/ControlButtons/InvoiceButton.xml',
        'static/src/xml/Screens/OrderManagementScreen/ControlButtons/ReprintReceiptButton.xml',
        'static/src/xml/Screens/OrderManagementScreen/OrderManagementScreen.xml',
        'static/src/xml/Screens/OrderManagementScreen/MobileOrderManagementScreen.xml',
        'static/src/xml/Screens/OrderManagementScreen/OrderManagementControlPanel.xml',
        'static/src/xml/Screens/OrderManagementScreen/OrderList.xml',
        'static/src/xml/Screens/OrderManagementScreen/OrderRow.xml',
        'static/src/xml/Screens/OrderManagementScreen/OrderDetails.xml',
        'static/src/xml/Screens/OrderManagementScreen/OrderlineDetails.xml',
        'static/src/xml/Screens/OrderManagementScreen/ReprintReceiptScreen.xml',
        'static/src/xml/Screens/TicketScreen/TicketScreen.xml',
        'static/src/xml/Screens/PaymentScreen/PSNumpadInputButton.xml',
        'static/src/xml/Screens/PaymentScreen/PaymentScreenNumpad.xml',
        'static/src/xml/Screens/PaymentScreen/PaymentScreenElectronicPayment.xml',
        'static/src/xml/Screens/PaymentScreen/PaymentScreenPaymentLines.xml',
        'static/src/xml/Screens/PaymentScreen/PaymentScreenStatus.xml',
        'static/src/xml/Screens/PaymentScreen/PaymentMethodButton.xml',
        'static/src/xml/Screens/PaymentScreen/PaymentScreen.xml',
        'static/src/xml/Screens/ProductScreen/Orderline.xml',
        'static/src/xml/Screens/ProductScreen/OrderSummary.xml',
        'static/src/xml/Screens/ProductScreen/OrderWidget.xml',
        'static/src/xml/Screens/ProductScreen/NumpadWidget.xml',
        'static/src/xml/Screens/ProductScreen/ActionpadWidget.xml',
        'static/src/xml/Screens/ProductScreen/CategoryBreadcrumb.xml',
        'static/src/xml/Screens/ProductScreen/CategoryButton.xml',
        'static/src/xml/Screens/ProductScreen/CategorySimpleButton.xml',
        'static/src/xml/Screens/ProductScreen/HomeCategoryBreadcrumb.xml',
        'static/src/xml/Screens/ProductScreen/ProductsWidgetControlPanel.xml',
        'static/src/xml/Screens/ProductScreen/ProductItem.xml',
        'static/src/xml/Screens/ProductScreen/ProductList.xml',
        'static/src/xml/Screens/ProductScreen/ProductsWidget.xml',
        'static/src/xml/Screens/ReceiptScreen/WrappedProductNameLines.xml',
        'static/src/xml/Screens/ReceiptScreen/OrderReceipt.xml',
        'static/src/xml/Screens/ReceiptScreen/ReceiptScreen.xml',
        'static/src/xml/Screens/ScaleScreen/ScaleScreen.xml',
        'static/src/xml/ChromeWidgets/CashierName.xml',
        'static/src/xml/ChromeWidgets/ProxyStatus.xml',
        'static/src/xml/ChromeWidgets/SyncNotification.xml',
        'static/src/xml/ChromeWidgets/OrderManagementButton.xml',
        'static/src/xml/ChromeWidgets/HeaderButton.xml',
        'static/src/xml/ChromeWidgets/SaleDetailsButton.xml',
        'static/src/xml/ChromeWidgets/TicketButton.xml',
        'static/src/xml/CustomerFacingDisplay/CustomerFacingDisplayOrder.xml',
        'static/src/xml/SaleDetailsReport.xml',
        'static/src/xml/Misc/Draggable.xml',
        'static/src/xml/Misc/NotificationSound.xml',
        'static/src/xml/Misc/SearchBar.xml',
        'static/src/xml/ChromeWidgets/DebugWidget.xml',
        'static/src/xml/Popups/ErrorPopup.xml',
        'static/src/xml/Popups/ErrorBarcodePopup.xml',
        'static/src/xml/Popups/ConfirmPopup.xml',
        'static/src/xml/Popups/TextInputPopup.xml',
        'static/src/xml/Popups/TextAreaPopup.xml',
        'static/src/xml/Popups/ErrorTracebackPopup.xml',
        'static/src/xml/Popups/SelectionPopup.xml',
        'static/src/xml/Popups/EditListInput.xml',
        'static/src/xml/Popups/EditListPopup.xml',
        'static/src/xml/Popups/NumberPopup.xml',
        'static/src/xml/Popups/OfflineErrorPopup.xml',
        'static/src/xml/Popups/OrderImportPopup.xml',
        'static/src/xml/Popups/ProductConfiguratorPopup.xml',
        'static/src/xml/Popups/CashOpeningPopup.xml',
        'static/src/xml/Screens/ProductScreen/ControlButtons/SetPricelistButton.xml',
        'static/src/xml/Screens/ProductScreen/ControlButtons/SetFiscalPositionButton.xml',
        'static/src/xml/ChromeWidgets/ClientScreenButton.xml',
        'static/src/xml/Misc/MobileOrderWidget.xml',
        'static/src/xml/Notification.xml',
    ],
    'website': 'https://www.odoo.com/page/point-of-sale-shop',
    'assets': {
        'assets_tests': [
            # inside .
            'point_of_sale/static/tests/tours/helpers/utils.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/ProductScreenTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/TicketScreenTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/PaymentScreenTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/ProductConfiguratorTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/OrderManagementScreenTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/ClientListScreenTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/ReceiptScreenTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/ChromeTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/NumberPopupTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/ErrorPopupTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/SelectionPopupTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/helpers/CompositeTourMethods.js',
            # inside .
            'point_of_sale/static/tests/tours/point_of_sale.js',
            # inside .
            'point_of_sale/static/tests/tours/ProductScreen.tour.js',
            # inside .
            'point_of_sale/static/tests/tours/PaymentScreen.tour.js',
            # inside .
            'point_of_sale/static/tests/tours/ProductConfigurator.tour.js',
            # inside .
            'point_of_sale/static/tests/tours/OrderManagementScreen.tour.js',
            # inside .
            'point_of_sale/static/tests/tours/ReceiptScreen.tour.js',
            # inside .
            'point_of_sale/static/tests/tours/Chrome.tour.js',
            # inside .
            'point_of_sale/static/tests/tours/TicketScreen.tour.js',
        ],
        'point_of_sale.qunit_suite_tests': [
            # new module 
            'point_of_sale/static/tests/unit/test_ComponentRegistry.js',
            # new module 
            'point_of_sale/static/tests/unit/test_NumberBuffer.js',
            # new module 
            'point_of_sale/static/tests/unit/test_ChromeWidgets.js',
            # new module 
            'point_of_sale/static/tests/unit/test_ProductScreen.js',
            # new module 
            'point_of_sale/static/tests/unit/test_PaymentScreen.js',
            # new module 
            'point_of_sale/static/tests/unit/test_popups.js',
        ],
        'point_of_sale.assets': [
            # new module 
            'web/static/src/scss/fonts.scss',
            # new module 
            'web/static/lib/fontawesome/css/font-awesome.css',
            # new module 
            'point_of_sale/static/src/css/pos.css',
            # new module 
            'point_of_sale/static/src/css/keyboard.css',
            # new module 
            'point_of_sale/static/src/css/pos_receipts.css',
            # new module 
            'web/static/src/scss/fontawesome_overridden.scss',
            # new module 
            'point_of_sale/static/lib/html2canvas.js',
            # new module 
            'point_of_sale/static/lib/backbone/backbone.js',
            # new module 
            'point_of_sale/static/lib/waitfont.js',
            # new module 
            'point_of_sale/static/lib/sha1.js',
            # new module 
            'point_of_sale/static/src/js/utils.js',
            # new module 
            'point_of_sale/static/src/js/ClassRegistry.js',
            # new module 
            'point_of_sale/static/src/js/PosComponent.js',
            # new module 
            'point_of_sale/static/src/js/PosContext.js',
            # new module 
            'point_of_sale/static/src/js/ComponentRegistry.js',
            # new module 
            'point_of_sale/static/src/js/Registries.js',
            # new module 
            'point_of_sale/static/src/js/db.js',
            # new module 
            'point_of_sale/static/src/js/models.js',
            # new module 
            'point_of_sale/static/src/js/keyboard.js',
            # new module 
            'point_of_sale/static/src/js/barcode_reader.js',
            # new module 
            'point_of_sale/static/src/js/printers.js',
            # new module 
            'point_of_sale/static/src/js/Gui.js',
            # new module 
            'point_of_sale/static/src/js/PopupControllerMixin.js',
            # new module 
            'point_of_sale/static/src/js/ControlButtonsMixin.js',
            # new module 
            'point_of_sale/static/src/js/Chrome.js',
            # new module 
            'point_of_sale/static/src/js/devices.js',
            # new module 
            'point_of_sale/static/src/js/payment.js',
            # new module 
            'point_of_sale/static/src/js/custom_hooks.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ProductScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ClientListScreen/ClientLine.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ClientListScreen/ClientDetailsEdit.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ClientListScreen/ClientListScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/ControlButtons/InvoiceButton.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/ControlButtons/ReprintReceiptButton.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/OrderFetcher.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/OrderManagementScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/MobileOrderManagementScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/OrderManagementControlPanel.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/OrderList.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/OrderRow.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/OrderDetails.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/OrderlineDetails.js',
            # new module 
            'point_of_sale/static/src/js/Screens/OrderManagementScreen/ReprintReceiptScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/TicketScreen/TicketScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/PaymentScreen/PSNumpadInputButton.js',
            # new module 
            'point_of_sale/static/src/js/Screens/PaymentScreen/PaymentScreenNumpad.js',
            # new module 
            'point_of_sale/static/src/js/Screens/PaymentScreen/PaymentScreenElectronicPayment.js',
            # new module 
            'point_of_sale/static/src/js/Screens/PaymentScreen/PaymentScreenPaymentLines.js',
            # new module 
            'point_of_sale/static/src/js/Screens/PaymentScreen/PaymentScreenStatus.js',
            # new module 
            'point_of_sale/static/src/js/Screens/PaymentScreen/PaymentMethodButton.js',
            # new module 
            'point_of_sale/static/src/js/Screens/PaymentScreen/PaymentScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/Orderline.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/OrderSummary.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/OrderWidget.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/NumpadWidget.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ActionpadWidget.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/CategoryBreadcrumb.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/CategoryButton.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/CategorySimpleButton.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/HomeCategoryBreadcrumb.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ProductsWidgetControlPanel.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ProductItem.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ProductList.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ProductsWidget.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ReceiptScreen/WrappedProductNameLines.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ReceiptScreen/OrderReceipt.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ReceiptScreen/ReceiptScreen.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ScaleScreen/ScaleScreen.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/CashierName.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/ProxyStatus.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/SyncNotification.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/OrderManagementButton.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/HeaderButton.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/SaleDetailsButton.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/TicketButton.js',
            # new module 
            'point_of_sale/static/src/js/Misc/Draggable.js',
            # new module 
            'point_of_sale/static/src/js/Misc/NotificationSound.js',
            # new module 
            'point_of_sale/static/src/js/Misc/IndependentToOrderScreen.js',
            # new module 
            'point_of_sale/static/src/js/Misc/AbstractReceiptScreen.js',
            # new module 
            'point_of_sale/static/src/js/Misc/SearchBar.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/DebugWidget.js',
            # new module 
            'point_of_sale/static/src/js/Popups/AbstractAwaitablePopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/ErrorPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/ErrorBarcodePopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/ConfirmPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/TextInputPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/TextAreaPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/ErrorTracebackPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/SelectionPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/EditListInput.js',
            # new module 
            'point_of_sale/static/src/js/Popups/EditListPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/NumberPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/OfflineErrorPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/OrderImportPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/ProductConfiguratorPopup.js',
            # new module 
            'point_of_sale/static/src/js/Popups/CashOpeningPopup.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ControlButtons/SetPricelistButton.js',
            # new module 
            'point_of_sale/static/src/js/Screens/ProductScreen/ControlButtons/SetFiscalPositionButton.js',
            # new module 
            'point_of_sale/static/src/js/ChromeWidgets/ClientScreenButton.js',
            # new module 
            'point_of_sale/static/src/js/Misc/NumberBuffer.js',
            # new module 
            'point_of_sale/static/src/js/Misc/MobileOrderWidget.js',
            # new module 
            'point_of_sale/static/src/js/Notification.js',
        ],
        'point_of_sale.assets_backend': [
            # inside .
            'point_of_sale/static/src/scss/pos_dashboard.scss',
            # inside .
            'point_of_sale/static/src/js/tours/point_of_sale.js',
            # inside .
            'point_of_sale/static/src/js/debug_manager.js',
            # inside .
            'point_of_sale/static/src/js/web_overrides/pos_config_form.js',
        ],
    }
}
