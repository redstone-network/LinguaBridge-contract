// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KnowledgeToken is ERC20, Ownable {
    mapping(address => bool) public minters;
    
    modifier onlyMinter() {
        require(minters[msg.sender], unicode"只有铸币者可以执行此操作");
        _;
    }
    
    constructor(uint256 initialSupply) ERC20(unicode"知识库代币", "KT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
        minters[msg.sender] = true;
    }
    
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
    
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
    }
    
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
    }
}