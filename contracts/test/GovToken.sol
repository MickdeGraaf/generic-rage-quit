// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract GovToken is Context, AccessControlEnumerable, ERC20Votes {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    modifier onlyHasRole(bytes32 _role) {
        require(hasRole(_role, _msgSender()), "GovToken.onlyHasRole: msg.sender does not have role");
        _;
    }

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) ERC20Permit(_name) ERC20(_name, _symbol) {
        _mint(_msgSender(), _initialSupply);        
    }

    function mint(address _to, uint256 _amount) onlyHasRole(MINTER_ROLE) external {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) onlyHasRole(BURNER_ROLE) external {
        _burn(_from, _amount);
    }
    

}