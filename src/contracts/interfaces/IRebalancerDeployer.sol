// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "./IPool.sol";

interface IRebalancerDeployer {
    function parameters() external view returns (
        address factory,
        address pool
    );
}