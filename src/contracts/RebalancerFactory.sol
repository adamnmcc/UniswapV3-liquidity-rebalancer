// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "./interfaces/IPool.sol";
import {IPoolFactory} from "./interfaces/factories/IPoolFactory.sol";
import "./interfaces/IRebalancerFactory.sol";
import "./interfaces/IRebalancer.sol";
import "./RebalancerDeployer.sol";
import "./NoDelegateCall.sol";

contract RebalancerFactory is
    IRebalancerFactory,
    RebalancerDeployer,
    NoDelegateCall
{
    

    RebalancerFee public override rebalancerFee = RebalancerFee(0, 0);
    mapping(address => address) public override getRebalancer;

    // Once in every 24 hours
    uint256 public override summarizationFrequency = 5760;

    address public override owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can execute this function");
        _;
    }

    function setOwner(address _owner) external override onlyOwner {
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }

    constructor() {
        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);
    }

    function setBlockFrequencySummarization(uint256 _summarizationFrequency)
        external
        override
        onlyOwner
    {
        emit BlockFrequencySummarizationChanged(
            summarizationFrequency,
            _summarizationFrequency
        );

        // Even owner can not set more than ~48 hours and less than ~1 hour.
        // This measure prevents misbehavior from owners side
        require(
            _summarizationFrequency < 11601,
            "Unreasonably big summarizationFrequency. Set it less than 11601"
        );
        require(
            _summarizationFrequency > 10,
            "Unreasonably small summarizationFrequency. Set it greater than 240"
        );
        summarizationFrequency = _summarizationFrequency;
    }

    function setRebalanceFee(uint256 numerator, uint256 denominator)
        external
        override
        onlyOwner
    {
        require(numerator < denominator, "Numerator can not be >= denominator");
        emit RebalancerFeeChanged(rebalancerFee, numerator, denominator);
        rebalancerFee.numerator = numerator;
        rebalancerFee.denominator = denominator;
    }

    function createRebalancer(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external override onlyOwner noDelegateCall returns (address rebalancer) {
        address pool = IPoolFactory(0x420DD381b31aEf6683db6B902084cB0FFECe40Da).getPool(tokenA, tokenB, true);

        require(
            address(pool) != address(0),
            "Provided UniswapV3 pool doesn't exist. Check inputs"
        );
        require(
            getRebalancer[address(pool)] == address(0),
            "Rebalancer for input pool had been created"
        );

        rebalancer = deploy(address(this), address(pool));

        getRebalancer[address(pool)] = address(rebalancer);

        emit RebalancerCreated(
            tokenA,
            tokenB,
            fee,
            address(pool),
            address(rebalancer)
        );
    }
}
