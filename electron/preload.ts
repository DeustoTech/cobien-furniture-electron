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
  addPersonalEvent: (payload: any) => ipcRenderer.invoke('events:addPersonal', payload),
  fetchWeather: (city: string) => ipcRenderer.invoke('weather:fetch', city),
  getRandomJoke: () => ipcRenderer.invoke('jokes:getRandom'),
  getContacts: () => ipcRenderer.invoke('contacts:list'),
  requestCall: (userName: string) => ipcRenderer.invoke('contacts:requestCall', userName),
  openCall: (userName: string) => ipcRenderer.invoke('contacts:openCall', userName),
  addReminder: (message: string, isoDatetime: string) => ipcRenderer.invoke('reminders:add', message, isoDatetime),
  listReminders: () => ipcRenderer.invoke('reminders:list'),
  deleteReminder: (id: string) => ipcRenderer.invoke('reminders:delete', id),
  getBoardMessages: () => ipcRenderer.invoke('board:fetch'),
  deleteBoardMessage: (id: string) => ipcRenderer.invoke('board:delete', id),
  markMessageRead: (id: string) => ipcRenderer.invoke('board:read', id),
  submitQuickReply: (id: string, text: string) => ipcRenderer.invoke('board:reply', id, text),
  ttsSpeak: (text: string) => ipcRenderer.invoke('tts:speak', text),
  getSystemInfo: () => ipcRenderer.invoke('config:getSystemInfo'),
  reportRoute: (routeName: string) => ipcRenderer.invoke('app:route-changed', routeName),
  onNotification: (callback: (payload: any) => void) => {
    ipcRenderer.on('backend:notification', (_event, data) => callback(data))
  },
  onReminderFire: (callback: (reminder: any) => void) => {
    ipcRenderer.on('reminder:fire', (_event, data) => callback(data))
  }
})
