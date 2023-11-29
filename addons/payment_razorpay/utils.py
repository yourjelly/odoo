# Part of Odoo. See LICENSE file for full copyright and licensing details.

def get_razorpay_key(self):
    """ Return the publishable key for Razorpay.

    Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

    :param recordset provider_sudo: The provider on which the key should be read, as a sudoed
                                    `payment.provider` record.
    :return: The publishable key
    :rtype: str
    """
    return self.razorpay_key_id


def get_secret_key(self):
    """ Return the secret key for Razorpay.

    Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

    :param recordset provider_sudo: The provider on which the key should be read, as a sudoed
                                    `payment.provider` record.
    :return: The secret key
    :rtype: str
    """
    return self.razorpay_key_secret


def get_webhook_secret(self):
    """ Return the webhook secret for Razorpay.

    Note: This method serves as a hook for modules that would fully implement Razorpay Connect.

    :param recordset provider_sudo: The provider on which the key should be read, as a sudoed
                                    `payment.provider` record.
    :returns: The webhook secret
    :rtype: str
    """
    return self.razorpay_webhook_secret
