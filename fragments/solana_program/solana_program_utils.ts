import counterIdl from "../blockchain/solana/target/idl/counter.json";

const programIdlMap = {
  counter: counterIdl,
};

export const getInstructionDiscriminator = (instructionName: string, programName: keyof typeof programIdlMap) => {
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
