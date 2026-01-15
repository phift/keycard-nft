// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract PSK26TapNFT is ERC721, Ownable, Pausable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    string private _tokenURIValue;

    event Minted(address indexed to, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC721(name_, symbol_) {
        _tokenURIValue = tokenURI_;
    }

    function mintTo(address to) external onlyOwner whenNotPaused returns (uint256) {
        require(to != address(0), "Invalid recipient");
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(to, tokenId);
        emit Minted(to, tokenId);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721: invalid token ID");
        return _tokenURIValue;
    }

    function setTokenURI(string calldata newURI) external onlyOwner {
        _tokenURIValue = newURI;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
