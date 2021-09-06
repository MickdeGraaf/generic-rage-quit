import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { MockToken__factory } from "../../typechain/factories/MockToken__factory";

task("deploy-mock-token")
    .setAction(async(taskArgs: TaskArguments, { ethers }) => {
        const signers = await ethers.getSigners();
        const token = await new MockToken__factory(signers[0]).deploy(taskArgs.name, taskArgs.symbol, parseEther(taskArgs.initialSupply));
        console.log(`Mock token deployed at: ${token.address}`);
});