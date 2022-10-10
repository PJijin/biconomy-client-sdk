import { ethers } from 'ethers'
import { BytesLike, Bytes } from '@ethersproject/bytes'
import {
  Web3Provider,
  ExternalProvider,
  BaseProvider,
  JsonRpcProvider,
  Networkish
} from '@ethersproject/providers'
import { TypedDataDomain, TypedDataField, TypedDataSigner } from '@ethersproject/abstract-signer'
import { SmartAccountSigner } from '../signers/SmartAccountSigner'
import { JsonRpcHandler } from './types'
import { BigNumber, Signer } from 'ethers'
import { TransactionResponse } from '@ethersproject/providers'

import {
  ChainId,
  SendTransactionDto,
  SignTransactionDto,
  IWalletTransaction
} from '@biconomy-sdk/core-types'

// import { JsonRpcSender } from '@0xsequence/network'

/*export class SmartAccountProvider extends Web3Provider { //implements JsonRpcHandler

    // defaultChainId is the default chainId to use with requests, but may be
    // overridden by passing chainId argument to a specific request
    readonly _defaultChainId?: number
    
    constructor(provider: ExternalProvider, defaultChainId?: ChainId) {

    provider = provider
    super(provider, 'any')

    this._defaultChainId = Number(defaultChainId)

    }

    // getsigner()
}*/

// Other ways..
// We could just extend BaseProvider
export class SmartAccountProvider extends BaseProvider {
  readonly signer!: SmartAccountSigner

  //
  // Might need relayer url in config
  constructor(
    tempProvider: Web3Provider,
    chainId: ChainId,
    readonly originalSigner: Signer, // EOASigner
    readonly originalProvider: BaseProvider // could be Web3Provider // optional? cc @sachin
  ) // readonly httpRpcClient: HttpRpcClient, // Required for relaying to rpc-relayer
  // readonly smartAccountAPI: SmartAccountAPI ? // Could be useful/needful
  {
    super({
      name: 'Smart Account User Refund Provider',
      chainId: chainId
    })
    // Signer needs config, originalSigner, way to dispatch to rpc-relayer, smart-account-apis

    // Might pass relayer url as config
    this.signer = new SmartAccountSigner(tempProvider, chainId)
  }

  async init(): Promise<this> {
    // Could init client / API class instances
    return this
  }

  getSigner(): SmartAccountSigner {
    return this.signer
  }

  async getTransaction(transactionHash: string | Promise<string>): Promise<TransactionResponse> {
    // TODO
    // Getting wallet transaction
    return await super.getTransaction(transactionHash)
  }

  // Could be
  // getTransactionReceipt

  // TODO
  // Helper for fabricating a response in a format usable by ethers users...
  async constructSmartAccountTransactionResponse(
    tx: IWalletTransaction
  ): Promise<TransactionResponse | null> {
    console.log(tx)
    return null
  }

  // Could be extra method getAddress() or getSmartAccountAddress()

  // Could be extra method waitForTransaction()
  //{
  // This will poll on transactionId provided by the relayer, over the socket using messaging-sdk
  //}
}