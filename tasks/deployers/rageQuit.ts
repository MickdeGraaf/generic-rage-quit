import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { RageQuit, RageQuit__factory } from "../../typechain";

task("deploy:rageQuit")
    .addParam("rageQuitToken")
    .addParam("vault")
    .setAction(async (taskArguments: TaskArguments, { ethers }) => {
        const rageQuitFactory: RageQuit__factory = await ethers.getContractFactory("RageQuit");
        const rageQuit: RageQuit = await rageQuitFactory.deploy(taskArguments.rageQuitToken, taskArguments.vault, taskArguments.vault);
        await rageQuit.deployed();
        console.log(`rageQuit deployed to: ${rageQuit.address}`);
        console.log(`To verify run: npx hardhat verify ${rageQuit.address} ${taskArguments.rageQuitToken} ${taskArguments.vault} --network [NETWORK_NAME]`);
});
