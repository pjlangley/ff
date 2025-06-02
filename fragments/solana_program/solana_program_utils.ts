import { Address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";
import counterIdl from "../blockchain/solana/target/idl/counter.json";
import { Buffer } from "node:buffer";

const programIdlMap = {
  counter: counterIdl,
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
  programName: ProgramName,
): Promise<Address> => {
  const encoder = getAddressEncoder();
  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [Buffer.from(programName), encoder.encode(userAddress)],
  });
  return pda;
};
