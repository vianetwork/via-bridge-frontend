export interface UTXO {
  txid: string
  vout: number
  value: number
  status?: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
}

export interface UserAddress {
  address: string
  publicKey: string
  purpose: string
}

export enum BitcoinNetwork {
  MAINNET = "mainnet",
  TESTNET = "testnet4",
  REGTEST = "regtest",
}

export interface DepositDetails {
  bridgeAddress: string
  l2ReceiverAddress: string
  satsAmount: number
  network: BitcoinNetwork
}
