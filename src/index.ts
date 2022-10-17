import {ethers, providers, Wallet, utils, Transaction} from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from  "@flashbots/ethers-provider-bundle"

import {exit} from "process"

const FLASHBOTS_URL = "https://relay-goerli.flashbots.net"
const TOKEN_ADDRESS = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"

const SPONSOR_KEY="7ad1155ef711e1956a1cefc98a3546479e359499116692e9206dab1b3babfacc"
const VICTIM_KEY="38a2c3d254a09a76726457ad5981001a65b9e9f834626a608a2a9b15c76912ef"

async function main() {
 if (
  SPONSOR_KEY === undefined ||
  VICTIM_KEY === undefined
 ){
  console.log("Please set both SPONSOR_KEY and VICTIM_KEY env")
  exit(1)
 }

 const provider = new providers.JsonRpcProvider(
  "https://rpc.goerli.mudit.blog/"
 )

 const authSigner = Wallet.createRandom();

 const flashbotsProvider = await FlashbotsBundleProvider.create(
  provider,
  authSigner,
  FLASHBOTS_URL
 )

 const sponsor = new Wallet(SPONSOR_KEY).connect(provider)
 const victim = new Wallet(VICTIM_KEY).connect(provider)

 const abi = ["function transfer(address, uint256) external"]
 const iface = new utils.Interface(abi)

 provider.on("block",  async (blockNumber) => {
  console.log(blockNumber)
  const targetBlockNumber = blockNumber + 1
  const resp = await flashbotsProvider.sendBundle([
    {
      signer: sponsor,
      transaction: {
        chainId: 5,
        type: 2,
        to: victim.address,
        value: utils.parseEther("0.01"),
        maxFeePerGas: utils.parseUnits("3", "gwei"),
        maxPriorityFeePerGas: utils.parseUnits("2", "gwei"),
      }
    },
    {
      signer: victim,
      transaction: {
        chainId: 5,
        type: 2,
        to: TOKEN_ADDRESS,
        gasLimit: "50000",
        data: iface.encodeFunctionData("transfer", [
          sponsor.address,
          utils.parseEther("1000000"),
        ]),
        maxFeePerGas: utils.parseUnits("3", "gwei"),
        maxPriorityFeePerGas: utils.parseUnits("2", "gwei")
      }
    }
  ], targetBlockNumber)
  if ("error" in resp){
    console.log(resp.error.message);
    return
  }
  const resolution = await resp.wait()

  if (resolution === FlashbotsBundleResolution.BundleIncluded){
    console.log(`Congrats, included in ${targetBlockNumber}`)
    exit(0)
  }else if(
    resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
  ){
    console.log(`Not included in ${targetBlockNumber}`);

  }else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh){
    console.log("Nonce too high, bailing")
    exit(1)
  }
 })

}

main()
