from solders.keypair import Keypair


def create_key_pair():
    return Keypair()


def get_address(keypair: Keypair):
    return keypair.pubkey()
