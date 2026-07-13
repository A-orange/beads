type ToastType = 'success' | 'warning' | 'error' | 'info'

const DURATION = 2800
let toastId = 0

function getContainer(): HTMLElement {
  let root = document.querySelector<HTMLElement>('[data-island-toast-root]')
  if (!root) {
    root = document.createElement('div')
    root.dataset.islandToastRoot = ''
    root.className = 'island-toast-root'
    document.body.appendChild(root)
  }
  return root
}

function show(type: ToastType, message: string) {
  const container = getContainer()
  const id = ++toastId
  const el = document.createElement('div')
  el.className = `island-toast island-toast--${type}`
  el.setAttribute('role', 'status')
  el.innerHTML = `
    <span class="island-toast__icon" aria-hidden="true"></span>
    <span class="island-toast__message">${message}</span>
  `
  container.appendChild(el)
  requestAnimationFrame(() => el.classList.add('island-toast--visible'))

  const dismiss = () => {
    if (!el.isConnected) return
    el.classList.remove('island-toast--visible')
    el.classList.add('island-toast--leaving')
    window.setTimeout(() => el.remove(), 250)
  }

  const timer = window.setTimeout(dismiss, DURATION)
  el.addEventListener('click', () => {
    window.clearTimeout(timer)
    dismiss()
  })
  return id
}

export const IslandMessage = {
  success: (content: string) => show('success', content),
  warning: (content: string) => show('warning', content),
  error: (content: string) => show('error', content),
  info: (content: string) => show('info', content),
}
