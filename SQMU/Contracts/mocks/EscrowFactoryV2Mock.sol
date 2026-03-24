// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

import {EscrowFactory} from "../EscrowFactory.sol";

contract EscrowFactoryV2Mock is EscrowFactory {
    function version() external pure returns (uint256) {
        return 2;
    }
}
