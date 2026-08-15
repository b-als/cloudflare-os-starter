/** Entrypoint for the sandboxed BA Studio iframe. All data flows through the host-injected
 * BaUiApi RPC capability (see custom.ts's CustomAccount.startAppUi()). */

import { createRoot } from 'react-dom/client'
import { RpcTarget, newMessagePortRpcSession } from 'capnweb'
import type { RpcStub } from 'capnweb'
import type { BaUiApi } from '../src/ba-ui-types'
import App from './App'
import './styles.css'

// The only capability the iframe exposes back to the host: a receiver for theme-mode pushes.
class AppIframe extends RpcTarget {
  setThemeMode(mode: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-mode', mode)
    document.documentElement.style.colorScheme = mode
  }
}

interface HostCapability extends RpcTarget {
  readonly ui: RpcStub<BaUiApi>
  subscribeTheme(receiver: AppIframe): Promise<'light' | 'dark'>
}

function main() {
  const root = document.getElementById('root')
  if (!root) throw new Error('missing #root')

  const { port1, port2 } = new MessageChannel()
  // Opaque-origin iframes can't name their parent origin. The parent accepts this handshake only
  // from this frame + null origin; the message only transfers a private port.
  window.parent.postMessage({ type: 'handshake' }, '*', [port2])
  const iframe = new AppIframe()
  const host = newMessagePortRpcSession<HostCapability>(port1, iframe)
  host.subscribeTheme(iframe).then((mode) => iframe.setThemeMode(mode)).catch(() => {})

  createRoot(root).render(<App api={host.ui} />)
}

main()
