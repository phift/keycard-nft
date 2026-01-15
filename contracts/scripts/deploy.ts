import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config();

async function main() {
  const name = "Parallel Society x Keycard 2026";
  const symbol = "PSK26";
  const tokenURI =
    process.env.TOKEN_URI || "https://phift.github.io/keycard-nft/metadata.json";

  const Factory = await ethers.getContractFactory("PSK26TapNFT");
  const contract = await Factory.deploy(name, symbol, tokenURI);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PSK26TapNFT deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
