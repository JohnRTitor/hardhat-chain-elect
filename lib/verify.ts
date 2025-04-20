import hre from "hardhat";
import { BaseError } from "viem";

export async function verifyContract(contractAddress: string, args: string[]) {
  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    }); // hardhat verify --verify
  } catch (err) {
    const error = err as BaseError;
    // from the error message, determine if the contract has already been verified
    if (error.message.toLowerCase().includes("already been verified")) {
      console.log("Contract already verified");
    } else {
      console.error(error);
    }
  }
}
