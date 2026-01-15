import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config();

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const tokenURI = process.env.TOKEN_URI;

  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required");
  }
  if (!tokenURI) {
    throw new Error("TOKEN_URI is required");
  }

  const contract = await ethers.getContractAt("PSK26TapNFT", contractAddress);
  const tx = await contract.setTokenURI(tokenURI);
  await tx.wait();

  console.log("Token URI updated to:", tokenURI);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
