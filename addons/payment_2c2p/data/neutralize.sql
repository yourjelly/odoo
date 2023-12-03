-- disable 2c2p payment provider
UPDATE payment_provider
   SET tctp_merchant_id = NULL,
       tctp_secret_key = NULL;
