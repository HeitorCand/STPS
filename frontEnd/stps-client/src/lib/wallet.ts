declare global {
  interface Window {
    solana?: InjectedSolanaProvider
    backpack?: {
      solana?: InjectedSolanaProvider
    }
  }
}

export type InjectedSolanaProvider = {
  isPhantom?: boolean
  publicKey?: { toBase58(): string }
  isConnected?: boolean
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58(): string } }>
  disconnect: () => Promise<void>
  signMessage: (
    message: Uint8Array,
    display?: 'utf8',
  ) => Promise<Uint8Array | { signature: Uint8Array }>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  off?: (event: string, listener: (...args: unknown[]) => void) => void
}

export function getInjectedWallet(): InjectedSolanaProvider | null {
  return window.backpack?.solana ?? window.solana ?? null
}

export function hasInjectedWallet(): boolean {
  return Boolean(getInjectedWallet())
}

export async function connectInjectedWallet(): Promise<string> {
  const provider = getInjectedWallet()
  if (!provider) throw new Error('No Solana wallet found in this browser')
  const result = await provider.connect()
  return result.publicKey.toBase58()
}

export async function disconnectInjectedWallet(): Promise<void> {
  const provider = getInjectedWallet()
  if (!provider) return
  await provider.disconnect()
}

export async function signUtf8Message(message: string): Promise<string> {
  const provider = getInjectedWallet()
  if (!provider) throw new Error('No Solana wallet found in this browser')

  const payload = new TextEncoder().encode(message)
  const result = await provider.signMessage(payload, 'utf8')
  const signature = result instanceof Uint8Array ? result : result.signature
  return uint8ArrayToBase64(signature)
}

export function subscribeWalletDisconnect(onDisconnect: () => void): () => void {
  const provider = getInjectedWallet()
  if (!provider?.on) return () => undefined

  const handleDisconnect = () => {
    onDisconnect()
  }

  const handleAccountChanged = (...args: unknown[]) => {
    const next = args[0]
    if (next == null) {
      onDisconnect()
      return
    }

    if (Array.isArray(next) && next.length === 0) {
      onDisconnect()
    }
  }

  provider.on('disconnect', handleDisconnect)
  provider.on('accountChanged', handleAccountChanged)

  return () => {
    provider.off?.('disconnect', handleDisconnect)
    provider.off?.('accountChanged', handleAccountChanged)
  }
}

function uint8ArrayToBase64(value: Uint8Array): string {
  let binary = ''
  value.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return window.btoa(binary)
}
