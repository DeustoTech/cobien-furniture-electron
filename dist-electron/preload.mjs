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
	reportRoute: (routeName) => electron.ipcRenderer.invoke("app:route-changed", routeName),
	onNotification: (callback) => {
		electron.ipcRenderer.on("backend:notification", (_event, data) => callback(data));
	}
});
//#endregion
