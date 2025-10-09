import { getEnvVar } from "./env_vars/env_vars_utils";
import { getBalance } from "./solana_balance/solana_balance_utils";
import { sendAndConfirmAirdrop } from "./solana_airdrop/solana_airdrop_utils";
import { initRpcClient as initSolanaRpcClient } from "./solana_rpc/solana_rpc_utils";
import { generateKeyPairSigner } from "@solana/kit";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

(async () => {
  // env vars
  console.log('fragment "env_vars/getEnvVar" output:', getEnvVar("REPO_NAME"));

  const solanaKeypair = await generateKeyPairSigner();
  const solanaKeypairAddress = solanaKeypair.address;

  // solana balance
  console.log('fragment "solana_balance/getBalance" output:', await getBalance(solanaKeypairAddress));

  // solana airdrop
  console.log(
    'fragment "solana_airdrop/sendAndConfirmAirdrop" output:',
    await sendAndConfirmAirdrop(solanaKeypairAddress, BigInt(LAMPORTS_PER_SOL)),
  );

  // solana rpc utils
  const solanaRpcClient = initSolanaRpcClient();
  console.log(
    'fragment "solana_rpc_client/initRpcClient getVersion" output:',
    await solanaRpcClient.getVersion().send(),
  );
})();
