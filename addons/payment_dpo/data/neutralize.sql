-- disable worldline payment provider
UPDATE payment_provider
   SET dpo_company_token = NULL,
       dpo_service = NULL,
       dpo_endpoint = NULL,
       dpo_payment_url = NULL,
