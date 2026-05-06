import dotenv from "dotenv";
import { BrowserWindow, app, ipcMain, net, protocol } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import * as fsSync from "node:fs";
import { createWriteStream, promises } from "node:fs";
import * as os from "node:os";
import { MongoClient, ObjectId } from "mongodb";
//#region electron/services/backendSync.ts
var currentScreen = "home";
async function startBackendSync(mainWindow, configPath, localConfigPath) {
	ipcMain.handle("app:route-changed", (event, routeName) => {
		currentScreen = routeName;
	});
	setInterval(() => sendHeartbeat(configPath, localConfigPath), 6e4);
	setInterval(() => pollNotifications(mainWindow, configPath, localConfigPath), 5e3);
	sendHeartbeat(configPath, localConfigPath);
	pollNotifications(mainWindow, configPath, localConfigPath);
}
async function getConfig(configPath, localConfigPath) {
	try {
		const defaultData = JSON.parse(await promises.readFile(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(await promises.readFile(localConfigPath, "utf-8"));
		} catch (e) {}
		return {
			...defaultData.services,
			...localData.services
		};
	} catch (e) {
		return {};
	}
}
async function sendHeartbeat(configPath, localConfigPath) {
	const services = await getConfig(configPath, localConfigPath);
	const url = services.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/";
	const apiKey = process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": apiKey
			},
			body: JSON.stringify({
				device_id: "CoBien6",
				screen: currentScreen,
				sent_at: (/* @__PURE__ */ new Date()).toISOString(),
				software_version: "Electron-v1.0"
			})
		});
		if (!res.ok) console.warn(`[HEARTBEAT] Failed with status: ${res.status}`);
		else console.log(`[HEARTBEAT] Sent (Screen: ${currentScreen})`);
	} catch (e) {
		console.error(`[HEARTBEAT] Network error`);
	}
}
async function pollNotifications(mainWindow, configPath, localConfigPath) {
	const services = await getConfig(configPath, localConfigPath);
	const url = services.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/";
	const apiKey = process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	try {
		const res = await fetch(`${url}?device_id=CoBien6`, {
			method: "GET",
			headers: { "X-API-KEY": apiKey }
		});
		if (res.ok) {
			const notifications = (await res.json()).notifications || [];
			if (notifications.length > 0) {
				console.log(`[POLL] Received ${notifications.length} notifications`);
				notifications.forEach((notif) => {
					mainWindow.webContents.send("backend:notification", notif);
				});
			}
		}
	} catch (e) {}
}
//#endregion
//#region electron/services/eventsMongo.ts
var cachedClient = null;
async function getClient() {
	if (cachedClient) return cachedClient;
	const uri = process.env.MONGO_URI || "";
	if (!uri) throw new Error("MONGO_URI is missing");
	cachedClient = new MongoClient(uri);
	await cachedClient.connect();
	return cachedClient;
}
async function getEvents(configPath) {
	try {
		const locationName = JSON.parse(await promises.readFile(configPath, "utf-8")).settings?.device_location || "Bilbao";
		const rawEvents = await (await getClient()).db("LabasAppDB").collection("eventos").find({ $or: [{ $or: [
			{ audience: "all" },
			{ audience: { $exists: false } },
			{ audience: null }
		] }, {
			audience: "device",
			$or: [{ target_device: "CoBien6" }, { target_devices: "CoBien6" }]
		}] }).toArray();
		const normalizedLocation = locationName.trim().toLowerCase();
		return rawEvents.map((event) => {
			let audience = event.audience || "all";
			if (typeof audience === "string" && audience.toLowerCase() === "device") audience = "device";
			else audience = "all";
			let color = audience === "device" ? "#FF3B30" : "#1E90FF";
			if (event.color) color = event.color;
			let loc = (event.location || "").trim();
			if (audience === "all" && loc && loc.toLowerCase() !== normalizedLocation) return null;
			let dateStr = event.date || event.fecha_inicio || "";
			if (dateStr instanceof Date) {
				const d = dateStr;
				dateStr = `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getFullYear()}`;
			}
			return {
				id: event._id.toString(),
				date: dateStr,
				title: event.title || event.titulo || "Sin título",
				description: event.description || event.descripcion || "Sin descripción",
				location: loc || locationName,
				audience,
				color,
				target_device: event.target_device || "",
				created_by: event.created_by || "",
				all_day: event.all_day !== false,
				start_time: event.start_time || "",
				end_time: event.end_time || ""
			};
		}).filter((e) => e !== null);
	} catch (e) {
		console.error("[EVENTS] Error fetching from MongoDB:", e);
		return [];
	}
}
async function addPersonalEvent(payload) {
	try {
		const collection = (await getClient()).db("LabasAppDB").collection("eventos");
		const [day, month, year] = payload.date.split("-").map(Number);
		const dateObj = new Date(year, month - 1, day);
		const doc = {
			_id: new ObjectId(),
			title: payload.title,
			description: payload.description,
			date: payload.date,
			fecha_inicio: dateObj,
			audience: "device",
			target_device: payload.deviceId,
			location: payload.location,
			all_day: true,
			created_by: payload.deviceId,
			created_at: /* @__PURE__ */ new Date()
		};
		await collection.insertOne(doc);
		console.log(`[EVENTS] Personal event added: ${payload.title} on ${payload.date}`);
		return true;
	} catch (e) {
		console.error("[EVENTS] Error adding personal event:", e);
		return false;
	}
}
//#endregion
//#region electron/services/boardService.ts
var CACHE_DIR_NAME = "board_cache";
async function getCacheDir() {
	const dir = join(app.getPath("userData"), CACHE_DIR_NAME);
	try {
		await promises.access(dir);
	} catch {
		await promises.mkdir(dir, { recursive: true });
	}
	return dir;
}
async function downloadAndCacheImage(url, prefix, id) {
	if (!url) return "";
	try {
		const dir = await getCacheDir();
		let ext = ".png";
		if (url.includes(".jpg") || url.includes(".jpeg")) ext = ".jpg";
		const targetPath = join(dir, `${prefix}_${id}${ext}`);
		try {
			await promises.access(targetPath);
			return `cobien-media://${targetPath}`;
		} catch {}
		const headers = {};
		if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
		const res = await fetch(url, { headers });
		if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
		createWriteStream(targetPath);
		if (res.body) {
			const arrayBuffer = await res.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			await promises.writeFile(targetPath, buffer);
			return `cobien-media://${targetPath}`;
		}
		return "";
	} catch (e) {
		console.error(`[BOARD] Failed to cache image ${url}:`, e);
		return "";
	}
}
async function fetchMessages() {
	const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/?recipient=${deviceId}`;
	const headers = {};
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		const res = await fetch(url, { headers });
		if (!res.ok) throw new Error(`API returned ${res.statusText}`);
		const messages = (await res.json()).messages || [];
		return await Promise.all(messages.map(async (msg) => {
			let imagePath = "";
			let avatarPath = "";
			if (msg.image || msg.image_url) imagePath = await downloadAndCacheImage(msg.image || msg.image_url, "img", msg.id);
			if (msg.author_avatar_url) avatarPath = await downloadAndCacheImage(msg.author_avatar_url, "avatar", msg.id);
			return {
				id: msg.id,
				author: msg.author_name || msg.author || "—",
				author_avatar: avatarPath,
				text: msg.text || "",
				image: imagePath,
				created_at_human: msg.created_at_human || "",
				read_by: (msg.read_by || []).map((r) => r.device_id),
				quick_replies: msg.quick_replies || [],
				quick_reply_selected: msg.quick_reply_selected || null
			};
		}));
	} catch (e) {
		console.error("[BOARD] Failed to fetch messages:", e);
		return [];
	}
}
async function deleteMessage(id) {
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${id}/delete/`;
	const headers = {};
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		return (await fetch(url, {
			method: "POST",
			headers
		})).ok;
	} catch (e) {
		console.error("[BOARD] Failed to delete message:", e);
		return false;
	}
}
async function markMessageRead(id) {
	const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${id}/read/`;
	const headers = { "Content-Type": "application/json" };
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		return (await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({ device_id: deviceId })
		})).ok;
	} catch (e) {
		console.error("[BOARD] Failed to mark message read:", e);
		return false;
	}
}
async function submitQuickReply(id, replyText) {
	const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${id}/reply/`;
	const headers = { "Content-Type": "application/json" };
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		return (await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({
				device_id: deviceId,
				reply_text: replyText
			})
		})).ok;
	} catch (e) {
		console.error("[BOARD] Failed to submit reply:", e);
		return false;
	}
}
//#endregion
//#region electron/main.ts
dotenv.config();
var _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var mainWindow = null;
function getPiperConfig() {
	try {
		const configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
		const localPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.local.json");
		const defaultData = JSON.parse(fsSync.readFileSync(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(fsSync.readFileSync(localPath, "utf-8"));
		} catch (e) {}
		const services = {
			...defaultData.services,
			...localData.services
		};
		const internalBin = join(_dirname, "../public/models/piper/bin/piper");
		const internalModel = join(_dirname, "../public/models/piper/es_ES-davefx-medium.onnx");
		return {
			bin: services.tts_piper_bin || internalBin,
			model: services.tts_piper_model_es_male || services.tts_piper_model_es || internalModel
		};
	} catch (e) {
		console.error("Error reading piper config:", e);
		return {
			bin: join(_dirname, "../public/models/piper/bin/piper"),
			model: join(_dirname, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
function setupIPC() {
	const configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
	ipcMain.handle("config:getWeather", async () => {
		try {
			const data = JSON.parse(await promises.readFile(configPath, "utf-8"));
			return {
				catalog: data.settings.weather_city_catalog || [],
				active: data.settings.weather_cities || [],
				primary: data.settings.weather_primary_city || ""
			};
		} catch (e) {
			console.error("Error reading config:", e);
			return {
				catalog: [],
				active: [],
				primary: ""
			};
		}
	});
	ipcMain.handle("config:saveWeather", async (event, payload) => {
		try {
			const data = JSON.parse(await promises.readFile(configPath, "utf-8"));
			data.settings.weather_city_catalog = payload.catalog;
			data.settings.weather_cities = payload.active;
			data.settings.weather_primary_city = payload.primary;
			await promises.writeFile(configPath, JSON.stringify(data, null, 4));
			return true;
		} catch (e) {
			console.error("Error saving config:", e);
			return false;
		}
	});
	ipcMain.handle("events:get", async () => {
		return await getEvents(configPath);
	});
	ipcMain.handle("events:addPersonal", async (_, payload) => {
		const location = JSON.parse(await promises.readFile(configPath, "utf-8")).settings?.device_location || "Bilbao";
		const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
		return await addPersonalEvent({
			...payload,
			location,
			deviceId
		});
	});
	ipcMain.handle("board:fetch", async () => await fetchMessages());
	ipcMain.handle("board:delete", async (_, id) => await deleteMessage(id));
	ipcMain.handle("board:read", async (_, id) => await markMessageRead(id));
	ipcMain.handle("board:reply", async (_, id, text) => await submitQuickReply(id, text));
	ipcMain.handle("config:getSystemInfo", () => {
		return {
			version: app.getVersion(),
			deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX"
		};
	});
	ipcMain.handle("tts:speak", async (event, text) => {
		const { bin, model } = getPiperConfig();
		if (!model) {
			console.error("TTS: No Piper model configured.");
			return null;
		}
		const tempWav = join(os.tmpdir(), `tts_${Date.now()}.wav`);
		return new Promise((resolve, reject) => {
			const child = execFile(bin, [
				"--model",
				model,
				"--output_file",
				tempWav
			], async (error, stdout, stderr) => {
				if (error) {
					console.error("Piper TTS error:", error, stderr);
					resolve(null);
					return;
				}
				try {
					const buffer = await promises.readFile(tempWav);
					await promises.unlink(tempWav);
					resolve(buffer);
				} catch (e) {
					console.error("Error reading temp wav:", e);
					resolve(null);
				}
			});
			child.stdin?.write(text);
			child.stdin?.end();
		});
	});
}
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1024,
		height: 768,
		fullscreen: true,
		webPreferences: {
			preload: join(_dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	mainWindow.setBackgroundColor("#ffffff");
	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		mainWindow.webContents.openDevTools();
	} else mainWindow.loadFile(join(_dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
	protocol.handle("cobien-media", (request) => {
		const url = request.url.replace("cobien-media://", "");
		return net.fetch("file://" + url);
	});
	setupIPC();
	createWindow();
	if (mainWindow) {
		const configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
		const localPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.local.json");
		startBackendSync(mainWindow, configPath, localPath);
	}
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
