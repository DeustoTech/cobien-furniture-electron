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
	getSettings: () => electron.ipcRenderer.invoke("config:getSettings"),
	saveWeather: (payload) => electron.ipcRenderer.invoke("config:saveWeather", payload),
	getEvents: () => electron.ipcRenderer.invoke("events:get"),
	addPersonalEvent: (payload) => electron.ipcRenderer.invoke("events:addPersonal", payload),
	deleteEvent: (id) => electron.ipcRenderer.invoke("events:delete", id),
	fetchWeather: (city) => electron.ipcRenderer.invoke("weather:fetch", city),
	getRandomJoke: () => electron.ipcRenderer.invoke("jokes:getRandom"),
	getContacts: () => electron.ipcRenderer.invoke("contacts:list"),
	requestCall: (userName) => electron.ipcRenderer.invoke("contacts:requestCall", userName),
	syncContacts: () => electron.ipcRenderer.invoke("contacts:sync"),
	openCall: (userName) => electron.ipcRenderer.invoke("contacts:openCall", userName),
	onAsrPartial: (callback) => {
		const subscription = (_event, text) => callback(text);
		electron.ipcRenderer.on("asr:partial", subscription);
		return () => electron.ipcRenderer.removeListener("asr:partial", subscription);
	},
	onAsrLevel: (callback) => {
		const subscription = (_event, level) => callback(level);
		electron.ipcRenderer.on("asr:level", subscription);
		return () => electron.ipcRenderer.removeListener("asr:level", subscription);
	},
	addReminder: (message, isoDatetime) => electron.ipcRenderer.invoke("reminders:add", message, isoDatetime),
	listReminders: () => electron.ipcRenderer.invoke("reminders:list"),
	deleteReminder: (id) => electron.ipcRenderer.invoke("reminders:delete", id),
	getBoardMessages: () => electron.ipcRenderer.invoke("board:fetch"),
	deleteBoardMessage: (id) => electron.ipcRenderer.invoke("board:delete", id),
	markMessageRead: (id) => electron.ipcRenderer.invoke("board:read", id),
	submitQuickReply: (id, text) => electron.ipcRenderer.invoke("board:reply", id, text),
	ttsSpeak: (text) => electron.ipcRenderer.invoke("tts:speak", text),
	sttListen: (language) => electron.ipcRenderer.invoke("stt:listen", language),
	abortStt: () => electron.ipcRenderer.invoke("stt:abort"),
	getSystemInfo: () => electron.ipcRenderer.invoke("config:getSystemInfo"),
	reportRoute: (routeName) => electron.ipcRenderer.invoke("app:route-changed", routeName),
	restartApp: () => electron.ipcRenderer.invoke("app:restart"),
	exitApp: () => electron.ipcRenderer.invoke("app:exit"),
	adjustVolume: (value, isAbsolute = false) => electron.ipcRenderer.invoke("hardware:adjustVolume", value, isAbsolute),
	getVolume: () => electron.ipcRenderer.invoke("hardware:getVolume"),
	adjustBrightness: (value) => electron.ipcRenderer.invoke("hardware:adjustBrightness", value),
	onWakeWordDetected: (callback) => {
		const subscription = () => callback();
		electron.ipcRenderer.on("asr:wake-word-detected", subscription);
		return () => electron.ipcRenderer.removeListener("asr:wake-word-detected", subscription);
	},
	restartWakeWord: () => electron.ipcRenderer.invoke("asr:restartWakeWord"),
	onNotification: (callback) => {
		electron.ipcRenderer.on("backend:notification", (_event, data) => callback(data));
	},
	onReminderFire: (callback) => {
		electron.ipcRenderer.on("reminder:fire", (_event, data) => callback(data));
	},
	onMqttEvent: (callback) => {
		electron.ipcRenderer.on("mqtt:event", (_event, data) => callback(data));
	}
});
//#endregion
