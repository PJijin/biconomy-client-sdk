import {
  arrayify,
  // defaultAbiCoder,
  // hexConcat,
  parseEther
  // solidityKeccak256,
} from 'ethers/lib/utils'
import {
  ethers,
  BigNumber,
  // BigNumberish,
  // Contract,
  // ContractReceipt,
  Wallet
} from 'ethers'
/* import {
  IERC20,
  EntryPoint,
  EntryPoint__factory,
  SimpleWallet__factory,
} from "../typechain"; */
// import { BytesLike } from "@ethersproject/bytes";
// import { expect } from "chai";
// import { debugTransaction } from "./debugTx";
import { keccak256 } from 'ethereumjs-util'

export const AddressZero = ethers.constants.AddressZero
export const HashZero = ethers.constants.HashZero
export const ONE_ETH = parseEther('1')
export const TWO_ETH = parseEther('2')
export const FIVE_ETH = parseEther('5')

export const tostr = (x: any) => (x != null ? x.toString() : 'null')

let counter = 0
// create non-random account, so gas calculations are deterministic
export function createWalletOwner(): Wallet {
  const privateKey = keccak256(Buffer.from(arrayify(BigNumber.from(++counter))))
  return new ethers.Wallet(privateKey, ethers.providers.getDefaultProvider())
  // return new ethers.Wallet('0x'.padEnd(66, privkeyBase), ethers.provider);
}

export async function getBalance(address: string): Promise<number> {
  const balance = await ethers.providers.getDefaultProvider().getBalance(address)
  return parseInt(balance.toString())
}

export function getSignatureParameters(signature: string) {
  if (!ethers.utils.isHexString(signature)) {
    throw new Error('Given value "'.concat(signature, '" is not a valid hex string.'))
  }
  var r = signature.slice(0, 66)
  var s = '0x'.concat(signature.slice(66, 130))
  var v = ethers.BigNumber.from('0x'.concat(signature.slice(130, 132))).toNumber()
  if (![27, 28].includes(v)) v += 27
  return {
    r: r,
    s: s,
    v: v
  }
}

export const Erc20 = [
  'function transfer(address _receiver, uint256 _value) public returns (bool success)',
  'function transferFrom(address, address, uint) public returns (bool)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function allowance(address _owner, address _spender) public view returns (uint256 remaining)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'event Approval(address indexed _owner, address indexed _spender, uint256 _value)'
]

export const Erc20Interface = new ethers.utils.Interface(Erc20)

export const encodeTransfer = (target: string, amount: string | number): string => {
  return Erc20Interface.encodeFunctionData('transfer', [target, amount])
}

export const encodeTransferFrom = (
  from: string,
  target: string,
  amount: string | number
): string => {
  return Erc20Interface.encodeFunctionData('transferFrom', [from, target, amount])
}
