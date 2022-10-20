import { Deferrable, defineReadOnly } from '@ethersproject/properties'
import { Provider, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { Signer } from '@ethersproject/abstract-signer'

import { Bytes, ethers } from 'ethers'
import { ERC4337EthersProvider } from './ERC4337EthersProvider'
import { ClientConfig } from './ClientConfig'
import { HttpRpcClient } from './HttpRpcClient'
import { UserOperation } from '@biconomy-sdk/core-types'
import { BaseWalletAPI } from './BaseWalletAPI'
export class ERC4337EthersSigner extends Signer {
  // TODO: we have 'erc4337provider', remove shared dependencies or avoid two-way reference
  constructor (
    readonly config: ClientConfig,
    readonly originalSigner: Signer,
    readonly erc4337provider: ERC4337EthersProvider,
    readonly httpRpcClient: HttpRpcClient,
    readonly smartWalletAPI: BaseWalletAPI) {
    super()
    defineReadOnly(this, 'provider', erc4337provider)
  }

  // todo chirag review response
  async deployWalletOnly(): Promise<TransactionResponse | undefined> {
    const userOperation = await this.smartWalletAPI.createSignedUserOp({
      target: '',
      data: '',
      value: 0,
      gasLimit: 21000
    })

    console.log('signed userOp ', userOperation)
    let transactionResponse;

    try{
    transactionResponse = await this.erc4337provider.constructUserOpTransactionResponse(userOperation)
    console.log('transactionResponse ', transactionResponse)
    }
    catch(err) {
      console.log('error when making transaction for only deployment')
      console.log(err)
    }

    try {
      await this.httpRpcClient.sendUserOpToBundler(userOperation)
    } catch (error: any) {
      // console.error('sendUserOpToBundler failed', error)
      throw this.unwrapError(error)
    }
    // TODO: handle errors - transaction that is "rejected" by bundler is _not likely_ to ever resolve its "wait()"
    return transactionResponse
  }
  // This one is called by Contract. It signs the request and passes in to Provider to be sent.
  async sendTransaction (transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
    console.log('received transaction ', transaction)
    const customData : any = transaction.customData
    console.log(customData)
    let gasLimit = customData.appliedGasLimit;

    // temp
    transaction.gasLimit = gasLimit

    // TODO : if isDeployed = false || skipGasLimit = true then use provided gas limit => transaction.gasLimit = gasLimit
    delete transaction.customData
    // transaction.from = await this.smartWalletAPI.getWalletAddress()
    const tx: TransactionRequest = await this.populateTransaction(transaction)
    console.log('populate trx ', tx)
    await this.verifyAllNecessaryFields(tx)
    const userOperation = await this.smartWalletAPI.createSignedUserOp({
      target: tx.to ?? '',
      data: tx.data?.toString() ?? '',
      value: tx.value,
      gasLimit: tx.gasLimit,
      isDelegateCall: true // get from customData.isBatchedToMultiSend
    })
    console.log('signed userOp ', userOperation)
    const transactionResponse = await this.erc4337provider.constructUserOpTransactionResponse(userOperation)
    console.log('transactionResponse ', transactionResponse)

    try {
      await this.httpRpcClient.sendUserOpToBundler(userOperation)
    } catch (error: any) {
      // console.error('sendUserOpToBundler failed', error)
      throw this.unwrapError(error)
    }
    // TODO: handle errors - transaction that is "rejected" by bundler is _not likely_ to ever resolve its "wait()"
    return transactionResponse
  }

  unwrapError (errorIn: any): Error {
    if (errorIn.body != null) {
      const errorBody = JSON.parse(errorIn.body)
      let paymasterInfo: string = ''
      let failedOpMessage: string | undefined = errorBody?.error?.message
      if (failedOpMessage?.includes('FailedOp') === true) {
        // TODO: better error extraction methods will be needed
        const matched = failedOpMessage.match(/FailedOp\((.*)\)/)
        if (matched != null) {
          const split = matched[1].split(',')
          paymasterInfo = `(paymaster address: ${split[1]})`
          failedOpMessage = split[2]
        }
      }
      const error = new Error(`The bundler has failed to include UserOperation in a batch: ${failedOpMessage} ${paymasterInfo})`)
      error.stack = errorIn.stack
      return error
    }
    return errorIn
  }

  async verifyAllNecessaryFields (transactionRequest: TransactionRequest): Promise<void> {
    if (transactionRequest.to == null) {
      throw new Error('Missing call target')
    }
    if (transactionRequest.data == null && transactionRequest.value == null) {
      // TBD: banning no-op UserOps seems to make sense on provider level
      throw new Error('Missing call data or value')
    }
  }

  connect (provider: Provider): Signer {
    console.log(provider)
    throw new Error('changing providers is not supported')
  }

  async getAddress (): Promise<string> {
    return await this.erc4337provider.getSenderWalletAddress()
  }

  async signMessage (message: Bytes | string): Promise<string> {
    return await this.originalSigner.signMessage(message)
  }

  async signTransaction (transaction: Deferrable<TransactionRequest>): Promise<string> {
    console.log(transaction)
    throw new Error('not implemented')
  }

  async signUserOperation (userOperation: UserOperation): Promise<string> {
    const message = await this.smartWalletAPI.getRequestId(userOperation)
    return await this.originalSigner.signMessage(message)
  }
}
