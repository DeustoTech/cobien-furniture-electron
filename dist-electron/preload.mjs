let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
	on(...args) {
		const [channel, listener] = args;
		return electron.ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
	},
	off(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.off(channel, ...omit);
	},
	send(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.send(channel, ...omit);
	},
	invoke(...args) {
		const [channel, ...omit] = args;
		return electron.ipcRenderer.invoke(channel, ...omit);
	}
});
electron.contextBridge.exposeInMainWorld("tts", { speak: (text) => electron.ipcRenderer.invoke("tts:speak", text) });
electron.contextBridge.exposeInMainWorld("config", {
	getWeather: () => electron.ipcRenderer.invoke("config:getWeather"),
	saveWeather: (payload) => electron.ipcRenderer.invoke("config:saveWeather", payload),
	getEvents: () => electron.ipcRenderer.invoke("events:get"),
	addPersonalEvent: (payload) => electron.ipcRenderer.invoke("events:addPersonal", payload),
	getBoardMessages: () => electron.ipcRenderer.invoke("board:fetch"),
	deleteBoardMessage: (id) => electron.ipcRenderer.invoke("board:delete", id),
	markMessageRead: (id) => electron.ipcRenderer.invoke("board:read", id),
	submitQuickReply: (id, text) => electron.ipcRenderer.invoke("board:reply", id, text),
	getSystemInfo: () => electron.ipcRenderer.invoke("config:getSystemInfo"),
	reportRoute: (routeName) => electron.ipcRenderer.invoke("app:route-changed", routeName),
	onNotification: (callback) => {
		electron.ipcRenderer.on("backend:notification", (_event, data) => callback(data));
	}
});
//#endregion
