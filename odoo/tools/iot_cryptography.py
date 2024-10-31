import json
import secrets

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

HASH_ALGORITHM = hashes.SHA256()
OVERHEAD = 2 * HASH_ALGORITHM.digest_size + 2


# -------------- #
# KEY MANAGEMENT #
# -------------- #


def generate_keypair():
    """Generate an RSA keypair following NIST recommendations.

    :return: A tuple containing the private key and the public key.
    """
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)
    public_key = private_key.public_key()
    return private_key, public_key


def get_storable_key(rsa_key, secret=None):
    """Formats an RSA Key following PEM standard and returns it in hexadecimal.
    Allows to store the private key in the database.

    :param RSAPrivateKey|RSAPublicKey rsa_key: The private/public key to store.
    :param str secret: The secret to encrypt the private key.
    :return: The private key in hexadecimal format.
    """
    if isinstance(rsa_key, rsa.RSAPrivateKey):
        encryption = serialization.BestAvailableEncryption(secret.encode()) if secret else serialization.NoEncryption()
        return rsa_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=encryption,
        ).hex()

    if isinstance(rsa_key, rsa.RSAPublicKey):
        return rsa_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).hex()


def load_stored_key(rsa_key, secret=None, is_private=False):
    """Load a key from its hexadecimal representation stored in db.

    :param str rsa_key: The rsa key in hexadecimal format.
    :param str secret: The secret to decrypt the private key.
    :param bool is_private: Whether the key is private or public.
    :return: The rsa key.
    """
    key_bytes = bytes.fromhex(rsa_key)
    if is_private:
        try:
            return serialization.load_pem_private_key(key_bytes, password=secret.encode() if secret else None)
        except ValueError:
            return False  # Invalid password

    return serialization.load_pem_public_key(key_bytes)


# ------- #
# SIGNING #
# ------- #


def rsa_sign(private_key, payload):
    """Sign a payload using the private key.
    The signature returned is in hexadecimal format to allow sending it in json over the network.

    :param private_key: The private key to use for the signature.
    :param payload: The payload to sign.
    :return: The signature in hexadecimal format.
    """
    return private_key.sign(
        payload.encode(),
        padding.PSS(mgf=padding.MGF1(HASH_ALGORITHM), salt_length=padding.PSS.MAX_LENGTH),
        HASH_ALGORITHM,
    ).hex()


def rsa_verify_signature(public_key, payload, signature):
    """Verify the signature of a payload using the public key.

    :param RSAPublicKey public_key: The public key to use for the verification.
    :param str payload: The payload to verify.
    :param signature: The signature to verify (hex representation).
    :return: True if the signature is valid, False otherwise.
    """
    try:
        public_key.verify(
            bytes.fromhex(signature),
            payload.encode(),
            padding.PSS(mgf=padding.MGF1(HASH_ALGORITHM), salt_length=padding.PSS.MAX_LENGTH),
            HASH_ALGORITHM,
        )
        return True
    except InvalidSignature:
        return False


# ---------- #
# ENCRYPTION #
# ---------- #


def rsa_encrypt(public_key, payload):
    """Encrypt a payload using the public key.
    The ciphertext returned is in hexadecimal format to allow sending it in json over the network.

    :param RSAPublicKey public_key: The public key to use for the encryption.
    :param str|dict payload: The payload to encrypt.
    :return: A dictionary containing the ciphertext in hexadecimal format and the key and iv if needed.
    """
    if isinstance(payload, dict):
        payload = json.dumps(payload, sort_keys=True)

    # RSA Algorithm can't encrypt more than the key size, minus the padding
    # which corresponds to the overhead of the encryption (2 * size of the
    # hashing algorithm + 2).
    # The solution is to encrypt a symmetric key and an initialization vector
    # with the public key, and then encrypt the payload with the symmetric key.
    if len(payload) > public_key.key_size // 8 - OVERHEAD:
        encryption_secret = secrets.token_hex(32)  # 256 bits
        nonce = secrets.token_hex(16)
        return {
            'key': rsa_encrypt(public_key, {'secret': encryption_secret, 'nonce': nonce})['data'],
            'data': aes_encrypt(encryption_secret, nonce, payload).hex(),
        }
    return {
        'data': public_key.encrypt(payload.encode(), padding.OAEP(
            mgf=padding.MGF1(HASH_ALGORITHM),
            algorithm=HASH_ALGORITHM,
            label=None,
        )).hex()
    }


def rsa_decrypt(private_key, ciphertext):
    """Decrypt a ciphertext using the private key.

    :param RSAPrivateKey private_key: The private key to use for the decryption.
    :param str ciphertext: The ciphertext in hexadecimal format.
    :return: The decrypted payload.
    """
    return private_key.decrypt(bytes.fromhex(ciphertext), padding.OAEP(
        mgf=padding.MGF1(HASH_ALGORITHM),
        algorithm=HASH_ALGORITHM,
        label=None,
    ))


def aes_encrypt(key, nonce, payload):
    """Encrypt a payload using AES algorithm (CTR mode to avoid padding issues).

    :param str key: The key to use for the encryption.
    :param str nonce: The nonce to use for the encryption.
    :param str payload: The payload to encrypt.
    :return: The ciphertext in hexadecimal format.
    """
    cipher = Cipher(algorithm=algorithms.AES(bytes.fromhex(key)), mode=modes.CTR(bytes.fromhex(nonce)))
    encryptor = cipher.encryptor()

    return encryptor.update(payload.encode()) + encryptor.finalize()


def aes_decrypt(key, nonce, ciphertext):
    """Decrypt a ciphertext using AES algorithm (CTR mode to avoid padding issues).

    :param str key: The key to use for the decryption.
    :param str nonce: The nonce to use for the decryption.
    :param str ciphertext: The ciphertext in hexadecimal format.
    :return: The decrypted payload.
    """
    cipher = Cipher(algorithm=algorithms.AES(bytes.fromhex(key)), mode=modes.CTR(bytes.fromhex(nonce)))
    decryptor = cipher.decryptor()

    return decryptor.update(bytes.fromhex(ciphertext)) + decryptor.finalize()
