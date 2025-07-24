import { Address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";
import counterIdl from "../blockchain/solana/target/idl/counter.json";
import usernameIdl from "../blockchain/solana/target/idl/username.json";
import roundIdl from "../blockchain/solana/target/idl/round.json";
import { Buffer } from "node:buffer";

const programIdlMap = {
  counter: counterIdl,
  round: roundIdl,
  username: usernameIdl,
};

type ProgramName = keyof typeof programIdlMap;

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
