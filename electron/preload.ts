import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('tts', {
  speak: (text: string) => ipcRenderer.invoke('tts:speak', text)
})

contextBridge.exposeInMainWorld('config', {
  getWeather: () => ipcRenderer.invoke('config:getWeather'),
  saveWeather: (payload: any) => ipcRenderer.invoke('config:saveWeather', payload),
  getEvents: () => ipcRenderer.invoke('events:get'),
  reportRoute: (routeName: string) => ipcRenderer.invoke('app:route-changed', routeName),
  onNotification: (callback: (payload: any) => void) => {
    ipcRenderer.on('backend:notification', (_event, data) => callback(data))
  }
})
