# Xendit

## Technical details

API: [Invoices API](https://developers.xendit.co/api-reference/#create-invoice) version `2`
API: [Credit Charge API](https://developers.xendit.co/api-reference/#create-charge)
Xendit.js: [Tokenization](https://docs.xendit.co/credit-cards/integrations/tokenization)

This module integrates Xendit, which provides support for multiple payment methods in Asian countries
such as e-wallets, bank transfers, credit cards, and others.

For `Card` payments, a self-hosted payment form with regular (non iframe) inputs and relies on Xendit's
JS SDK to create token (whether single-use or multiple-use). JS assets are loaded in JavaScript when
payment form is submitted. Communications with Xendit are performed via server-to-server API calls.
As payment details are passed via Xendit's JS SDK, the solution qualifies for SAQ A-EP. Token
generated via Xendit JS SDK is then used to call an API which to create a charge. When payment is
successful, and user opts to save payment method, that same token will be saved in the database.

For other payment methods, this module uses generic payment with redirection flow based on form
submission provided by the `payment` module.

This implementation allows us to implement tokenization for `Card` payments while also retaining
the support of other payment methods via redirection flow. This will also keep front-end
development efforts low.

## Supported features

- Direct Payment flow for `Card` payment methods
- Payment with redirection flow for other payment methods
- Webhook notifications
- Tokenization with or without payment

## Module history

- `17.2`
  - Adding tokenization support via direct payment for card payments. odoo/odoo#158445
- `17.0`
  - The first version of the module is merged. odoo/odoo#141661

## Testing instructions

https://developers.xendit.co/api-reference/#test-scenarios
