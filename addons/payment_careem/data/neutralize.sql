-- disable careem payment provider
UPDATE payment_provider
SET careem_access_token_expiry  = NULL,
    careem_client_secret_key    = NULL,
    careem_client_id            = NULL;
