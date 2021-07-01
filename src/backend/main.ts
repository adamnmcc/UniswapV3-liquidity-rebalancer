import { ethers } from "ethers";
import hre from "hardhat";
import * as dotenv from "dotenv";
import { IRebalancer } from "../../dist/contracts/typechain/IRebalancer";

dotenv.config();

const getProvider = (): ethers.providers.Provider => {
    let provider: ethers.providers.Provider;
    if (process.env.PROVIDER === undefined) throw `PROVIDER is undefined`;

    if (process.env.PROVIDER_TYPE == "ipc") {
        provider = new ethers.providers.IpcProvider(process.env.PROVIDER);
    } else if (process.env.PROVIDER_TYPE == "http") {
        provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER);
    } else {
        throw `Unrecognized PROVIDER_TYPE == ${process.env.PROVIDER_TYPE}`;
    }
    return provider;
};

const getRebalancer = async (
    signer: ethers.Signer
): Promise<ethers.Contract> => {
    let rebalancerAddress: string;
    if (process.env.NODE_ENV == "development") {
        const RebalancerFactory = await hre.ethers.getContractFactory(
            "RebalancerFactory",
            signer
        );
        let hardhatRebalancerFactory = await RebalancerFactory.deploy();
        let tx = await hardhatRebalancerFactory.createRebalancer(
            "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
            3000
        );
        tx = await tx.wait();
        rebalancerAddress = tx.events[0].args.rebalancer;
    } else {
        if (process.env.REBALANCER_ADDRESS === undefined)
            throw "In production contract should be deployed. You must set contract address";
        rebalancerAddress = process.env.REBALANCER_ADDRESS;
    }
    const rebalancer = await hre.ethers.getContractAt(
        "Rebalancer",
        rebalancerAddress
    );
    return rebalancer;
};

async function* getLatestBlock(provider: ethers.providers.Provider) {
    let lastSeenBlockNumber = await provider.getBlockNumber();
    while (true) {
        const latestBlockNumber = await provider.getBlockNumber();
        if (latestBlockNumber > lastSeenBlockNumber) {
            lastSeenBlockNumber = latestBlockNumber;
            yield lastSeenBlockNumber;
        }
    }
}

const needToStartSummarization = (rebalancer: IRebalancer): boolean => {
    return true;
};
const summarizationInProcess = (rebalancer: IRebalancer): boolean => {
    return true;
};
const priceInPositionRange = (rebalancer: IRebalancer): boolean => {
    return true;
};
const calcRebalanceParams = (rebalancer: IRebalancer): number => {
    return 0;
};
const executeRebalancing = (rebalancer: IRebalancer): boolean => {
    return true;
};

const sendTransaction = async (func: Function): Promise<boolean> => {
    try {
        const tx = await func();
        const receipt = await tx.wait();
        console.log(`Executed ${func.name}`);
        console.log(receipt);
    } catch (e) {
        console.log(e);
        return false;
    }
    return true;
};

const main = async () => {
    const provider = getProvider();
    const accounts = await hre.ethers.getSigners();
    const rebalancer = (await getRebalancer(accounts[0])) as IRebalancer;

    for await (const newBlockNumber of getLatestBlock(provider)) {
        console.log(newBlockNumber);
        if (
            needToStartSummarization(rebalancer) ||
            summarizationInProcess(rebalancer)
        ) {
            let summParams = await rebalancer.summParams();
            console.log(summParams.stage.toString());
            if (summParams.stage.eq(0)) {
                if (!sendTransaction(rebalancer.startSummarizeTrades)) continue;

                summParams = await rebalancer.summParams();
                console.log(summParams.stage.toString());

                do {
                    if (!sendTransaction(rebalancer.summarizeUsersStates))
                        break;
                    summParams = await rebalancer.summParams();
                    console.log(summParams.stage.toString());
                } while (!summParams.stage.eq(0));
            } else {
                sendTransaction(rebalancer.summarizeUsersStates);
            }
        }
        if (priceInPositionRange(rebalancer)) {
            continue;
        } else {
            const rebalanceParams = calcRebalanceParams(rebalancer);
            executeRebalancing(rebalancer);
        }
    }
};

main().then(() => {});
