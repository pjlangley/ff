from solders.keypair import Keypair


def create_key_pair():
    keypair = Keypair()
    return keypair


def get_address(keypair: Keypair):
    return keypair.pubkey()
