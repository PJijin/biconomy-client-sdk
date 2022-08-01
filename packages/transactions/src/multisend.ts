import { Contract, utils } from 'ethers'
import { buildContractCall, MetaTransaction, WalletTransaction } from './execution'

// TODO
// Review all types
const encodeMetaTransaction = (tx: MetaTransaction): string => {
  const data = utils.arrayify(tx.data)
  const encoded = utils.solidityPack(
    ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
    [tx.operation, tx.to, tx.value, data.length, data]
  )
  return encoded.slice(2)
}

export const encodeMultiSend = (txs: MetaTransaction[]): string => {
  return '0x' + txs.map((tx) => encodeMetaTransaction(tx)).join('')
}

export const buildMultiSendSmartAccountTx = (
    multiSend: Contract,
    txs: MetaTransaction[],
    nonce: number,
    overrides?: Partial<WalletTransaction>
): WalletTransaction => {
  return buildContractCall(multiSend, 'multiSend', [encodeMultiSend(txs)], nonce, true, overrides)
}