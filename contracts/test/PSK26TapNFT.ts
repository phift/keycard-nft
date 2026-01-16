import { expect } from "chai";
import { ethers } from "hardhat";

describe("PSK26TapNFT", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PSK26TapNFT");
    const contract = await Factory.deploy(
      "Parallel Society x Keycard 2026",
      "PSK26",
      "https://phift.github.io/keycard-nft/metadata.json"
    );
    await contract.waitForDeployment();
    return { contract, owner, other };
  }

  it("mints and emits Minted", async function () {
    const { contract, owner } = await deployFixture();
    await expect(contract.mintTo(owner.address))
      .to.emit(contract, "Minted")
      .withArgs(owner.address, 1n);
  });

  it("reverts for non-owner", async function () {
    const { contract, other } = await deployFixture();
    await expect(contract.connect(other).mintTo(other.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("allows up to 3 mints per recipient", async function () {
    const { contract, owner } = await deployFixture();
    await contract.mintTo(owner.address);
    await contract.mintTo(owner.address);
    await contract.mintTo(owner.address);
    await expect(contract.mintTo(owner.address)).to.be.revertedWith(
      "Mint limit reached"
    );
  });

  it("respects pause", async function () {
    const { contract, owner } = await deployFixture();
    await contract.pause();
    await expect(contract.mintTo(owner.address)).to.be.revertedWith(
      "Pausable: paused"
    );
  });
});
