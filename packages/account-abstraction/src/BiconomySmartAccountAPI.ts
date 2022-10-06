import { BigNumber, BigNumberish } from 'ethers'
import { Provider } from '@ethersproject/providers'
import { UserOperationStruct } from '@account-abstraction/contracts'

import { EntryPointContractV101 } from '@biconomy-sdk/ethers-lib'
import { arrayify, hexConcat } from 'ethers/lib/utils'
import { Signer } from '@ethersproject/abstract-signer'
import { TransactionDetailsForUserOp } from './TransactionDetailsForUserOp'
import { resolveProperties } from 'ethers/lib/utils'
import { PaymasterAPI } from './PaymasterAPI'
import { getRequestId } from '@biconomy-sdk/common'
import { ContractUtils } from '@biconomy-sdk/transactions'
import {
  SmartWalletContract,
} from '@biconomy-sdk/core-types'
import { WalletFactoryAPI } from './WalletFactoryAPI'
/**
 * Base class for all Smart Wallet ERC-4337 Clients to implement.
 * Subclass should inherit 5 methods to support a specific wallet contract:
 *
 * - getWalletInitCode - return the value to put into the "initCode" field, if the wallet is not yet deployed. should create the wallet instance using a factory contract.
 * - getNonce - return current wallet's nonce value
 * - encodeExecute - encode the call from entryPoint through our wallet to the target contract.
 * - signRequestId - sign the requestId of a UserOp.
 *
 * The user can use the following APIs:
 * - createUnsignedUserOp - given "target" and "calldata", fill userOp to perform that operation from the wallet.
 * - createSignedUserOp - helper to call the above createUnsignedUserOp, and then extract the requestId and sign it
 */

// Note: Resembles SmartAccount methods itself. Could be sperated out across smart-account & || transactions || new package and reclaim

export class BiconomySmartAccountAPI {
  private senderAddress!: string
  private isPhantom = true
  // entryPoint connected to "zero" address. allowed to make static calls (e.g. to getSenderAddress)
  // private readonly entryPointView: EntryPoint

  /**
   * subclass MAY initialize to support custom paymaster
   */
  paymasterAPI?: PaymasterAPI

  /**
   * our wallet contract.
   * should support the "execFromSingleton" and "nonce" methods
   */
  walletContract?: any

  factory?: string

  /**
   * base constructor.
   * subclass SHOULD add parameters that define the owner (signer) of this wallet
   * @param provider - read-only provider for view calls
   * @param entryPointAddress - the entryPoint to send requests through (used to calculate the request-id, and for gas estimations)
   * @param walletAddress. may be empty for new wallet (using factory to determine address)
   */
   constructor (
    readonly provider: Provider,
    readonly contractUtils: ContractUtils,
    readonly entryPoint: EntryPointContractV101,
    readonly walletAddress: string | undefined,
    readonly owner: Signer,
    readonly handlerAddress: string,
    readonly factoryAddress: string,
    readonly index = 0
  ) {
  }

  async _getWalletContract(): Promise<SmartWalletContract> {
    if (this.walletContract == null) {
      // console.log('this.contractUtils, ' this.contractUtils)

      console.log('issue, ')

      console.log('chainId ', (await this.provider.getNetwork()).chainId)

      console.log(this.contractUtils
        .getSmartWalletContract((await this.provider.getNetwork()).chainId).getContract())

      let walletContract = this.contractUtils
        .getSmartWalletContract((await this.provider.getNetwork()).chainId)
        .getContract()
      walletContract = walletContract.attach(await this.getWalletAddress())
    }
    return this.walletContract
  }

  async init(): Promise<this> {
    await this.getWalletAddress()
    return this
  }

  /**
   * return the value to put into the "initCode" field, if the wallet is not yet deployed.
   * this value holds the "factory" address, followed by this wallet's information
   */
  /**
   * return the value to put into the "initCode" field, if the wallet is not yet deployed.
   * this value holds the "factory" address, followed by this wallet's information
   */
   async getWalletInitCode (): Promise<string> {
    const deployWalletCallData = WalletFactoryAPI.deployWalletTransactionCallData(this.factoryAddress, await this.owner.getAddress(), this.entryPoint.address, this.handlerAddress, 0)
    return hexConcat([
      this.factoryAddress,
      deployWalletCallData
    ])
  }

  /**
   * return current wallet's nonce.
   */
   async getNonce (batchId: number): Promise<BigNumber> {
    if (await this.checkWalletPhantom()) {
      return BigNumber.from(0)
    }
    const walletContract = await this._getWalletContract()
    return await walletContract.getNonce(batchId)
  }

  /**
   * encode the call from entryPoint through our wallet to the target contract.
   * @param target
   * @param value
   * @param data
   */
  /**
   * encode a method call from entryPoint to our contract
   * @param target
   * @param value
   * @param data
   */
   async encodeExecute (target: string, value: BigNumberish, data: string): Promise<string> {
    const walletContract = await this._getWalletContract()
    // Review Talha
    console.log('here')
    console.log(walletContract)
    return walletContract.getInterface().encodeFunctionData(
      'execFromEntryPoint',
      [
        target,
        value,
        data,
        0, //temp
        200000, //temp
      ])
  }

  // TODO: May be need to move this to ERC4337EthersPrivider
  async signRequestId (requestId: string): Promise<string> {
    return await this.owner.signMessage(arrayify(requestId))
  }

  /**
   * check if the wallet is already deployed.
   */
  async checkWalletPhantom(): Promise<boolean> {
    if (!this.isPhantom) {
      // already deployed. no need to check anymore.
      return this.isPhantom
    }
    const senderAddressCode = await this.provider.getCode(this.getWalletAddress())
    if (senderAddressCode.length > 2) {
      console.log(`SimpleWallet Contract already deployed at ${this.senderAddress}`)
      this.isPhantom = false
    } else {
      // console.log(`SimpleWallet Contract is NOT YET deployed at ${this.senderAddress} - working in "phantom wallet" mode.`)
    }
    return this.isPhantom
  }

  /**
   * calculate the wallet address even before it is deployed
   */
  async getCounterFactualAddress(): Promise<string> {
    const initCode = await this.getWalletInitCode()
    // use entryPoint to query wallet address (factory can provide a helper method to do the same, but
    // this method attempts to be generic
    return await this.entryPoint.callStatic.getSenderAddress(initCode)
  }

  /**
   * return initCode value to into the UserOp.
   * (either deployment code, or empty hex if contract already deployed)
   */
  async getInitCode(): Promise<string> {
    if (await this.checkWalletPhantom()) {
      return await this.getWalletInitCode()
    }
    return '0x'
  }

  /**
   * return maximum gas used for verification.
   * NOTE: createUnsignedUserOp will add to this value the cost of creation, if the wallet is not yet created.
   */
  async getVerificationGasLimit(): Promise<BigNumberish> {
    return 100000
  }

  /**
   * should cover cost of putting calldata on-chain, and some overhead.
   * actual overhead depends on the expected bundle size
   */
  async getPreVerificationGas(userOp: Partial<UserOperationStruct>): Promise<number> {
    console.log(userOp)
    const bundleSize = 1
    const cost = 21000
    // TODO: calculate calldata cost
    return Math.floor(cost / bundleSize)
  }

  async encodeUserOpCallDataAndGasLimit(
    detailsForUserOp: TransactionDetailsForUserOp
  ): Promise<{ callData: string; callGasLimit: BigNumber }> {
    function parseNumber(a: any): BigNumber | null {
      if (a == null || a === '') return null
      return BigNumber.from(a.toString())
    }

    const value = parseNumber(detailsForUserOp.value) ?? BigNumber.from(0)
    console.log('here')
    console.log((await this._getWalletContract()))
    const callData = await this.encodeExecute(detailsForUserOp.target, value, detailsForUserOp.data)
    /*const callData = (await this._getWalletContract()).encodeFunctionData('execFromEntryPoint', [
      detailsForUserOp.target,
      value,
      detailsForUserOp.data,
      0,
      300000
    ])*/

    const callGasLimit =
      parseNumber(detailsForUserOp.gasLimit) ??
      (await this.provider.estimateGas({
        from: this.entryPoint.address,
        to: this.getWalletAddress(),
        data: callData
      }))

    return {
      callData,
      callGasLimit
    }
  }

  /**
   * return requestId for signing.
   * This value matches entryPoint.getRequestId (calculated off-chain, to avoid a view call)
   * @param userOp userOperation, (signature field ignored)
   */
  async getRequestId(userOp: UserOperationStruct): Promise<string> {
    const op = await resolveProperties(userOp)
    const chainId = await this.provider.getNetwork().then((net) => net.chainId)
    return getRequestId(op, this.entryPoint.address, chainId)
  }

  /**
   * return the wallet's address.
   * this value is valid even before deploying the wallet.
   */
  async getWalletAddress(): Promise<string> {
    if (this.senderAddress == null) {
      if (this.walletAddress != null) {
        this.senderAddress = this.walletAddress
      } else {
        this.senderAddress = await this.getCounterFactualAddress()
      }
    }
    console.log('this.senderAddress ', this.senderAddress)
    return this.senderAddress
  }

  /**
   * create a UserOperation, filling all details (except signature)
   * - if wallet is not yet created, add initCode to deploy it.
   * - if gas or nonce are missing, read them from the chain (note that we can't fill gaslimit before the wallet is created)
   * @param info
   */
  async createUnsignedUserOp(info: TransactionDetailsForUserOp): Promise<UserOperationStruct> {
    const { callData, callGasLimit } = await this.encodeUserOpCallDataAndGasLimit(info)
    const initCode = await this.getInitCode()

    let verificationGasLimit = BigNumber.from(await this.getVerificationGasLimit())
    if (initCode.length > 2) {
      // add creation to required verification gas
      const initGas = await this.entryPoint.estimateGas.getSenderAddress(initCode)
      verificationGasLimit = verificationGasLimit.add(initGas)
    }

    let { maxFeePerGas, maxPriorityFeePerGas } = info
    if (maxFeePerGas == null || maxPriorityFeePerGas == null) {
      const feeData = await this.provider.getFeeData()
      if (maxFeePerGas == null) {
        maxFeePerGas = feeData.maxFeePerGas ?? undefined
      }
      if (maxPriorityFeePerGas == null) {
        maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? undefined
      }
    }

    const partialUserOp: any = {
      sender: this.getWalletAddress(),
      nonce: this.getNonce(0), // TODO: add batchid as param
      initCode,
      callData,
      callGasLimit,
      verificationGasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas
    }

    partialUserOp.paymasterAndData =
      this.paymasterAPI == null ? '0x' : await this.paymasterAPI.getPaymasterAndData(partialUserOp)
    return {
      ...partialUserOp,
      preVerificationGas: this.getPreVerificationGas(partialUserOp),
      signature: ''
    }
  }

  /**
   * Sign the filled userOp.
   * @param userOp the UserOperation to sign (with signature field ignored)
   */
  async signUserOp(userOp: UserOperationStruct): Promise<UserOperationStruct> {
    const requestId = await this.getRequestId(userOp)
    const signature = this.signRequestId(requestId)
    return {
      ...userOp,
      signature
    }
  }

  /**
   * helper method: create and sign a user operation.
   * @param info transaction details for the userOp
   */
  async createSignedUserOp(info: TransactionDetailsForUserOp): Promise<UserOperationStruct> {
    return await this.signUserOp(await this.createUnsignedUserOp(info))
  }
}
