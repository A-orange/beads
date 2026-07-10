import { Message } from '@pixelium/web-vue/es'

function show(type: 'success' | 'warning' | 'error' | 'info', content: string) {
  return Message[type]({
    content,
    placement: 'top',
    duration: 2800,
  })
}

export const PixelMessage = {
  success: (content: string) => show('success', content),
  warning: (content: string) => show('warning', content),
  error: (content: string) => show('error', content),
  info: (content: string) => show('info', content),
}
