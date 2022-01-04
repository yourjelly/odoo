from cryptography.hazmat.primitives import hmac
from cryptography.hazmat import backends
import hashlib
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from base64 import b64encode
from uuid import NAMESPACE_DNS
from lxml import etree
import struct

import requests
from OpenSSL.crypto import FILETYPE_PEM, load_certificate, load_privatekey
from urllib3.util.ssl_ import DEFAULT_CIPHERS, create_urllib3_context

# Custom patches to perform the WSDL requests.

EUSKADI_CIPHERS = f"{DEFAULT_CIPHERS}:!DH"


class PatchedHTTPAdapter(requests.adapters.HTTPAdapter):
    """ An adapter to block DH ciphers which may not work for the tax agencies called"""

    def init_poolmanager(self, *args, **kwargs):
        # OVERRIDE
        kwargs['ssl_context'] = create_urllib3_context(ciphers=EUSKADI_CIPHERS)
        return super().init_poolmanager(*args, **kwargs)

    def cert_verify(self, conn, url, verify, cert):
        # OVERRIDE
        # The last parameter is only used by the super method to check if the file exists.
        # In our case, cert is an odoo record 'l10n_es_edi.certificate' so not a path to a file.
        # By putting 'None' as last parameter, we ensure the check about TLS configuration is
        # still made without checking temporary files exist.
        super().cert_verify(conn, url, verify, None)
        conn.cert_file = cert
        conn.key_file = None

    def get_connection(self, url, proxies=None):
        # OVERRIDE
        # Patch the OpenSSLContext to decode the certificate in-memory.
        conn = super().get_connection(url, proxies=proxies)
        context = conn.conn_kw['ssl_context']

        def patched_load_cert_chain(l10n_es_odoo_certificate, keyfile=None, password=None):
            cert_file, key_file, dummy = l10n_es_odoo_certificate._decode_certificate()
            cert_obj = load_certificate(FILETYPE_PEM, cert_file)
            pkey_obj = load_privatekey(FILETYPE_PEM, key_file)

            context._ctx.use_certificate(cert_obj)
            context._ctx.use_privatekey(pkey_obj)

        context.load_cert_chain = patched_load_cert_chain

        return conn

def post(*args, **kwargs):
    session = requests.Session()
    session.cert = kwargs.pop('pkcs12_data')
    session.mount("https://", PatchedHTTPAdapter())
    return session.request('post', *args, **kwargs)


NS_MAP = {"ds": "http://www.w3.org/2000/09/xmldsig#"}

def base64_print(string):
    string = str(string, "utf8")
    return "\n".join(
        string[pos: pos + 64]  # noqa: E203
        for pos in range(0, len(string), 64)
    )

def get_uri(uri, reference):
    node = reference.getroottree()
    if uri == "":
        return etree.tostring(
            node,
            method="c14n",
            with_comments=False,
            exclusive=False,
        )

    if uri.startswith("#"):
        query = "//*[@*[local-name() = '{}' ]=$uri]"
        results = []
        for id in ("ID", "Id", "id"):
            results = node.xpath(query.format(id), uri=uri.lstrip("#"))
            if len(results) == 1:
                return etree.tostring(
                    results[0],
                    method="c14n",
                    with_comments=False,
                    exclusive=False,
                )
            if len(results) > 1:
                raise Exception("Ambiguous reference URI {} resolved to {} nodes".format(
                    uri, len(results)))

    raise Exception('URI "' + uri + '" cannot be read')

def reference_digests(node):
    for reference in node.findall("ds:Reference", namespaces=NS_MAP):
        ref_node = get_uri(reference.get("URI", ""), reference)
        lib = hashlib.new("sha256")
        # node_algo = reference.find("ds:DigestMethod", namespaces=NS_MAP).get("Algorithm")
        lib.update(ref_node)
        reference.find("ds:DigestValue", namespaces=NS_MAP).text = b64encode(lib.digest())


def rsa_sign(data, private_key, digest):
    return private_key.sign(data, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH), digest())

def long_to_bytes(n, blocksize=0):
    """long_to_bytes(n:long, blocksize:int) : string
    Convert a long integer to a byte string.
    If optional blocksize is given and greater than zero, pad the front of the
    byte string with binary zeros so that the length is a multiple of
    blocksize.
    """
    # after much testing, this algorithm was deemed to be the fastest
    s = b""
    pack = struct.pack
    while n > 0:
        s = pack(b">I", n & 0xFFFFFFFF) + s
        n = n >> 32
    # strip off leading zeros
    for i in range(len(s)):
        if s[i] != b"\000"[0]:
            break
    else:
        # only happens when n == 0
        s = b"\000"
        i = 0
    s = s[i:]
    # add back some pad bytes.  this could be done more efficiently w.r.t. the
    # de-padding being done above, but sigh...
    if blocksize > 0 and len(s) % blocksize:
        s = (blocksize - len(s) % blocksize) * b"\000" + s
    return s

def fill_signature(node, private_key):
    signed_info_xml = node.find("ds:SignedInfo", namespaces=NS_MAP)

    signed_info = etree.tostring(
        signed_info_xml,
        method="c14n",
        with_comments=False,
        exclusive=False,
    )

    node.find("ds:SignatureValue", namespaces=NS_MAP).text = base64_print(
        b64encode(rsa_sign(signed_info, private_key, hashes.SHA256))
    )
