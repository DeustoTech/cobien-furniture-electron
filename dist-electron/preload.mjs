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
	saveButtonColors: (payload) => electron.ipcRenderer.invoke("config:saveButtonColors", payload),
	saveEmotionPromptTime: (time) => electron.ipcRenderer.invoke("config:saveEmotionPromptTime", time),
	submitEmotion: (emotion) => electron.ipcRenderer.invoke("config:submitEmotion", emotion),
	startVoiceAssistant: () => electron.ipcRenderer.invoke("config:startVoiceAssistant"),
	getNotifications: () => electron.ipcRenderer.invoke("config:getNotifications"),
	saveNotifications: (payload) => electron.ipcRenderer.invoke("config:saveNotifications", payload),
	getRingtones: () => electron.ipcRenderer.invoke("config:getRingtones"),
	triggerNotificationLed: (type) => electron.ipcRenderer.invoke("config:triggerNotificationLed", type),
	turnOffNotificationLed: () => electron.ipcRenderer.invoke("config:turnOffNotificationLed"),
	simulateNotification: (type) => electron.ipcRenderer.invoke("config:simulateNotification", type),
	getEvents: () => electron.ipcRenderer.invoke("events:get"),
	addPersonalEvent: (payload) => electron.ipcRenderer.invoke("events:addPersonal", payload),
	updatePersonalEvent: (payload) => electron.ipcRenderer.invoke("events:updatePersonal", payload),
	deleteEvent: (id) => electron.ipcRenderer.invoke("events:delete", id),
	fetchWeather: (city, lang = "es") => electron.ipcRenderer.invoke("weather:fetch", city, lang),
	getRandomJoke: (lang = "es") => electron.ipcRenderer.invoke("jokes:getRandom", lang),
	getContacts: () => electron.ipcRenderer.invoke("contacts:list"),
	requestCall: (userName) => electron.ipcRenderer.invoke("contacts:requestCall", userName),
	syncContacts: () => electron.ipcRenderer.invoke("contacts:sync"),
	openCall: (userName) => electron.ipcRenderer.invoke("contacts:openCall", userName),
	getRfidActions: () => electron.ipcRenderer.invoke("config:getRfidActions"),
	initRfidConfigMode: () => electron.ipcRenderer.invoke("config:initRfidConfigMode"),
	cancelRfidConfigMode: () => electron.ipcRenderer.invoke("config:cancelRfidConfigMode"),
	saveRfidAction: (cardId, action, extra = "") => electron.ipcRenderer.invoke("config:saveRfidAction", cardId, action, extra),
	deleteRfidAction: (cardId) => electron.ipcRenderer.invoke("config:deleteRfidAction", cardId),
	addReminder: (message, isoDatetime) => electron.ipcRenderer.invoke("reminders:add", message, isoDatetime),
	listReminders: () => electron.ipcRenderer.invoke("reminders:list"),
	deleteReminder: (id) => electron.ipcRenderer.invoke("reminders:delete", id),
	getBoardMessages: () => electron.ipcRenderer.invoke("board:fetch"),
	deleteBoardMessage: (id) => electron.ipcRenderer.invoke("board:delete", id),
	markMessageRead: (id) => electron.ipcRenderer.invoke("board:read", id),
	submitQuickReply: (id, text) => electron.ipcRenderer.invoke("board:reply", id, text),
	ttsSpeak: (text, lang = "es", gender = "male", engine = "piper") => electron.ipcRenderer.invoke("tts:speak", text, lang, gender, engine),
	ttsStop: () => electron.ipcRenderer.invoke("tts:stop"),
	getSystemInfo: () => electron.ipcRenderer.invoke("config:getSystemInfo"),
	isOnline: () => electron.ipcRenderer.invoke("network:is-online"),
	measureNetworkSpeed: () => electron.ipcRenderer.invoke("config:measureNetworkSpeed"),
	reportRoute: (routeName) => electron.ipcRenderer.invoke("app:route-changed", routeName),
	restartApp: () => electron.ipcRenderer.invoke("app:restart"),
	rebootSystem: () => electron.ipcRenderer.invoke("app:reboot-system"),
	exitApp: () => electron.ipcRenderer.invoke("app:exit"),
	uninstallSystem: () => electron.ipcRenderer.invoke("app:uninstall"),
	updateSystem: () => electron.ipcRenderer.invoke("app:update"),
	adjustVolume: (value, isAbsolute = false) => electron.ipcRenderer.invoke("hardware:adjustVolume", value, isAbsolute),
	getVolume: () => electron.ipcRenderer.invoke("hardware:getVolume"),
	adjustBrightness: (value) => electron.ipcRenderer.invoke("hardware:adjustBrightness", value),
	scanWifi: () => electron.ipcRenderer.invoke("config:scanWifi"),
	connectWifi: (ssid, password) => electron.ipcRenderer.invoke("config:connectWifi", ssid, password),
	getCurrentWifi: () => electron.ipcRenderer.invoke("config:getCurrentWifi"),
	getLogTypes: () => electron.ipcRenderer.invoke("logs:getTypes"),
	getLogTail: (type) => electron.ipcRenderer.invoke("logs:getTail", type),
	onNotification: (callback) => {
		electron.ipcRenderer.on("backend:notification", (_event, data) => callback(data));
	},
	onReminderFire: (callback) => {
		electron.ipcRenderer.on("reminder:fire", (_event, data) => callback(data));
	},
	onMqttEvent: (callback) => {
		electron.ipcRenderer.on("mqtt:event", (_event, data) => callback(data));
	},
	onEventsChanged: (callback) => {
		electron.ipcRenderer.on("events:changed", () => callback());
	}
});
//#endregion
