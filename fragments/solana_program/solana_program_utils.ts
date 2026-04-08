import { Address, address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";
import { offsetDecoder } from "@solana/codecs-core";
import counterIdl from "../blockchain/solana/target/idl/counter.json";
import usernameIdl from "../blockchain/solana/target/idl/username.json";
import registerIdl from "../blockchain/solana/target/idl/register.json";
import roundIdl from "../blockchain/solana/target/idl/round.json";
import { Buffer } from "node:buffer";

const programIdlMap = {
  counter: counterIdl,
  register: registerIdl,
  round: roundIdl,
  username: usernameIdl,
};

type ProgramName = keyof typeof programIdlMap;

export const BPF_LOADER_UPGRADEABLE_ID = address("BPFLoaderUpgradeab1e11111111111111111111111");

export const getInstructionDiscriminator = (instructionName: string, programName: ProgramName) => {
  const idl = programIdlMap[programName];
  if (!idl) {
    throw new Error(`Program ${programName} IDL not found`);
  }

  const instr = idl.instructions.find((instr) => instr.name === instructionName);
  if (!instr) {
    throw new Error(`Instruction ${instructionName} not found in program ${programName} IDL`);
  }

  return new Uint8Array(instr.discriminator);
};

export const getPda = async (
  userAddress: Address,
  programAddress: Address,
  accountName: string,
): Promise<Address> => {
  const encoder = getAddressEncoder();
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from(accountName), encoder.encode(userAddress)],
  });
  return pda;
};

export const skipAnchorDiscriminator: Parameters<typeof offsetDecoder>[1] = {
  preOffset: ({ wrapBytes }) => wrapBytes(8),
};
