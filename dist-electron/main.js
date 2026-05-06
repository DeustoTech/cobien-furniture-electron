import dotenv from "dotenv";
import { BrowserWindow, app, ipcMain, net, protocol } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exec, execFile, spawn } from "node:child_process";
import * as fsSync from "node:fs";
import { createWriteStream, promises } from "node:fs";
import * as os from "node:os";
import { MongoClient, ObjectId } from "mongodb";
import mqtt from "mqtt";
import { promisify } from "node:util";
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
async function deleteEvent(id) {
	try {
		return (await (await getClient()).db("LabasAppDB").collection("eventos").deleteOne({ _id: new ObjectId(id) })).deletedCount > 0;
	} catch (e) {
		console.error("[EVENTS] Error deleting event:", e);
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
//#region electron/services/weatherService.ts
var WMO_ICON_MAP = {
	0: "/images/sol.png",
	1: "/images/parcial.png",
	2: "/images/parcial.png",
	3: "/images/nubes.png",
	45: "/images/neblina.png",
	48: "/images/neblina.png",
	51: "/images/lluvia.png",
	53: "/images/lluvia.png",
	55: "/images/lluvia.png",
	56: "/images/lluvia.png",
	57: "/images/lluvia.png",
	61: "/images/lluvia.png",
	63: "/images/lluvia.png",
	65: "/images/lluvia.png",
	66: "/images/lluvia.png",
	67: "/images/lluvia.png",
	71: "/images/nieve.png",
	73: "/images/nieve.png",
	75: "/images/nieve.png",
	77: "/images/nieve.png",
	80: "/images/lluvia.png",
	81: "/images/lluvia.png",
	82: "/images/lluvia.png",
	85: "/images/nieve.png",
	86: "/images/nieve.png",
	95: "/images/tormenta.png",
	96: "/images/tormenta.png",
	99: "/images/tormenta.png"
};
var WMO_DESC_ES = {
	0: "Cielo despejado",
	1: "Mayormente despejado",
	2: "Parcialmente nublado",
	3: "Nublado",
	45: "Niebla",
	48: "Niebla con escarcha",
	51: "Llovizna ligera",
	53: "Llovizna moderada",
	55: "Llovizna densa",
	61: "Lluvia ligera",
	63: "Lluvia moderada",
	65: "Lluvia intensa",
	71: "Nevada ligera",
	73: "Nevada moderada",
	75: "Nevada intensa",
	80: "Chubascos ligeros",
	81: "Chubascos moderados",
	82: "Chubascos fuertes",
	95: "Tormenta",
	96: "Tormenta con granizo",
	99: "Tormenta con granizo fuerte"
};
var WEEKDAY_ES = [
	"Domingo",
	"Lunes",
	"Martes",
	"Miércoles",
	"Jueves",
	"Viernes",
	"Sábado"
];
function wmoIcon(code, isDay = true) {
	if (!isDay && code <= 1) return "/images/noche.png";
	return WMO_ICON_MAP[code] ?? "/images/nubes.png";
}
function wmoDesc(code) {
	return WMO_DESC_ES[code] ?? "Condición desconocida";
}
function amPmLabel(isoHour) {
	const h = new Date(isoHour).getHours();
	const label = h < 12 ? "a.m." : "p.m.";
	return `${h % 12 || 12} ${label}`;
}
async function geocodeCity(cityName) {
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`;
		const data = await (await fetch(url, { headers: { "User-Agent": "CoBien6-Furniture" } })).json();
		if (!data.length) return null;
		const lat = parseFloat(data[0].lat);
		const lon = parseFloat(data[0].lon);
		return {
			lat,
			lon,
			tz: (await (await fetch(`https://api.open-meteo.com/v1/timezone?latitude=${lat}&longitude=${lon}`)).json()).timezone ?? "Europe/Madrid"
		};
	} catch (e) {
		console.error("[WEATHER] Geocode error:", e);
		return null;
	}
}
async function fetchWeatherBundle(cityName) {
	const base = {
		city: cityName,
		temp: "—°",
		description: "No disponible",
		icon: "/images/nubes.png",
		tempMin: "Min —°",
		tempMax: "Max —°",
		hourly: [],
		daily: []
	};
	try {
		const geo = await geocodeCity(cityName);
		if (!geo) {
			base.error = "Ciudad no encontrada";
			return base;
		}
		const { lat, lon, tz } = geo;
		const omUrl = [
			`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`,
			`&timezone=${encodeURIComponent(tz)}`,
			`&current=temperature_2m,weathercode,is_day`,
			`&hourly=temperature_2m,weathercode`,
			`&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max`,
			`&forecast_days=7`
		].join("");
		const om = await (await fetch(omUrl)).json();
		const currentCode = om.current?.weathercode ?? 0;
		const isDay = (om.current?.is_day ?? 1) === 1;
		base.temp = `${Math.round(om.current?.temperature_2m ?? 0)}°`;
		base.icon = wmoIcon(currentCode, isDay);
		const owmKey = process.env.OWM_API_KEY ?? "";
		if (owmKey) try {
			const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=es`;
			base.description = (await (await fetch(owmUrl)).json()).weather?.[0]?.description ?? wmoDesc(currentCode);
			base.description = base.description.charAt(0).toUpperCase() + base.description.slice(1);
		} catch {
			base.description = wmoDesc(currentCode);
		}
		else base.description = wmoDesc(currentCode);
		const todayMin = Math.round(om.daily?.temperature_2m_min?.[0] ?? 0);
		const todayMax = Math.round(om.daily?.temperature_2m_max?.[0] ?? 0);
		base.tempMin = `Min ${todayMin}°`;
		base.tempMax = `Max ${todayMax}°`;
		const nowHour = (/* @__PURE__ */ new Date()).getHours();
		const hourlyTimes = om.hourly?.time ?? [];
		const hourlyTemps = om.hourly?.temperature_2m ?? [];
		const hourlyCodes = om.hourly?.weathercode ?? [];
		const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
		let startIdx = hourlyTimes.findIndex((t) => t.startsWith(todayStr) && new Date(t).getHours() >= nowHour);
		if (startIdx < 0) startIdx = 0;
		base.hourly = hourlyTimes.slice(startIdx, startIdx + 12).map((t, i) => {
			const h = new Date(t).getHours();
			return {
				time: amPmLabel(t),
				icon: wmoIcon(hourlyCodes[startIdx + i] ?? 0, h >= 6 && h < 20),
				temp: `${Math.round(hourlyTemps[startIdx + i] ?? 0)}°`
			};
		});
		const dailyTimes = om.daily?.time ?? [];
		const dailyMaxArr = om.daily?.temperature_2m_max ?? [];
		const dailyMinArr = om.daily?.temperature_2m_min ?? [];
		const dailyCodesArr = om.daily?.weathercode ?? [];
		const dailyPopArr = om.daily?.precipitation_probability_max ?? [];
		base.daily = dailyTimes.slice(1, 7).map((t, i) => {
			return {
				name: WEEKDAY_ES[new Date(t).getDay()],
				icon: wmoIcon(dailyCodesArr[i + 1] ?? 0),
				tmin: `${Math.round(dailyMinArr[i + 1] ?? 0)}°`,
				tmax: `${Math.round(dailyMaxArr[i + 1] ?? 0)}°`,
				pop: dailyPopArr[i + 1] ?? 0
			};
		});
		return base;
	} catch (e) {
		console.error("[WEATHER] fetchWeatherBundle error:", e);
		base.error = String(e);
		return base;
	}
}
//#endregion
//#region electron/services/jokesService.ts
/**
* jokesService.ts — Load and serve random jokes from legacy cobien_FrontEnd dataset
*/
var JOKES_DIR = join(typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url)), "../../../cobien_FrontEnd/app/data/jokes");
var cachedJokes = [];
var lastJoke = "";
async function loadJokes(lang = "es") {
	try {
		const file = lang === "fr" ? "jokes_fr.json" : "jokes_es.json";
		const raw = await promises.readFile(join(JOKES_DIR, file), "utf-8");
		const data = JSON.parse(raw);
		const jokes = [];
		for (const catJokes of Object.values(data)) if (Array.isArray(catJokes)) {
			for (const joke of catJokes) if (typeof joke === "string" && joke.trim()) jokes.push(joke.trim());
			else if (typeof joke === "object" && joke !== null) {
				const j = joke;
				if (j.text) jokes.push(String(j.text).trim());
				else if (j.setup && j.punchline) jokes.push(`${j.setup.trim()} — ${j.punchline.trim()}`);
			}
		}
		return jokes.filter(Boolean);
	} catch (e) {
		console.error("[JOKES] Error loading jokes:", e);
		return [
			"¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.",
			"¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.",
			"¿Cuál es el colmo de un electricista? Que su mujer se llame Luz."
		];
	}
}
async function getRandomJoke(lang = "es") {
	if (cachedJokes.length === 0) cachedJokes = await loadJokes(lang);
	if (cachedJokes.length === 0) return "No hay chistes disponibles.";
	const available = cachedJokes.length > 1 ? cachedJokes.filter((j) => j !== lastJoke) : cachedJokes;
	const joke = available[Math.floor(Math.random() * available.length)];
	lastJoke = joke;
	return joke;
}
//#endregion
//#region electron/services/contactsService.ts
/**
* contactsService.ts — Load contacts from legacy list_contacts.txt
* and send videocall notifications via portal API.
*/
var CONTACTS_DIR = join(typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url)), "../../../cobien_FrontEnd/app/contacts");
var CONTACTS_FILE = join(CONTACTS_DIR, "list_contacts.txt");
var DEFAULT_IMG = join(CONTACTS_DIR, "default_user.png");
function normalizeName(name) {
	return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findContactImage(displayName) {
	const base = normalizeName(displayName);
	for (const ext of [
		".png",
		".jpg",
		".jpeg",
		".PNG",
		".JPG",
		".JPEG"
	]) {
		const p = join(CONTACTS_DIR, base + ext);
		if (fsSync.existsSync(p)) return p;
	}
	return DEFAULT_IMG;
}
async function loadContacts() {
	const contacts = [];
	try {
		const raw = await promises.readFile(CONTACTS_FILE, "utf-8");
		for (const line of raw.split("\n")) {
			if (!line.includes("=")) continue;
			const [displayName, userName] = line.split("=", 2).map((s) => s.trim());
			if (!displayName) continue;
			const callable = /^[A-Za-z0-9_.-]+$/.test(userName ?? "");
			const imagePath = findContactImage(displayName);
			contacts.push({
				displayName,
				userName: userName ?? "",
				imagePath,
				callable
			});
		}
	} catch (e) {
		console.error("[CONTACTS] Error loading contacts:", e);
	}
	return contacts;
}
async function downloadImage(url, baseName, apiKey) {
	try {
		const res = await fetch(url, {
			headers: { "X-Api-Key": apiKey },
			signal: AbortSignal.timeout(15e3)
		});
		if (!res.ok) return null;
		const contentType = res.headers.get("Content-Type") || "";
		let ext = ".jpg";
		if (contentType.includes("png")) ext = ".png";
		else if (contentType.includes("webp")) ext = ".webp";
		else if (contentType.includes("gif")) ext = ".gif";
		const fileName = baseName + ext;
		const filePath = join(CONTACTS_DIR, fileName);
		const buffer = await res.arrayBuffer();
		await promises.writeFile(filePath, Buffer.from(buffer));
		return fileName;
	} catch (e) {
		console.error(`[CONTACTS] Failed to download image ${url}:`, e);
		return null;
	}
}
async function syncContacts(deviceId, apiKey, baseUrl) {
	try {
		if (!fsSync.existsSync(CONTACTS_DIR)) fsSync.mkdirSync(CONTACTS_DIR, { recursive: true });
		const url = `${rstrip(baseUrl, "/")}/pizarra/api/contacts/?device_id=${deviceId}`;
		const res = await fetch(url, {
			headers: { "X-Api-Key": apiKey },
			signal: AbortSignal.timeout(1e4)
		});
		if (!res.ok) throw new Error(`API returned ${res.status}`);
		const data = await res.json();
		const rawContacts = Array.isArray(data) ? data : data.contacts || [];
		const mapped = [];
		let imagesDownloaded = 0;
		for (const raw of rawContacts) {
			const displayName = (raw.display_name || raw.name || "").trim();
			const userName = (raw.user_name || raw.username || "").trim();
			const imageUrl = (raw.image_url || raw.image || "").trim();
			if (!displayName || !userName) continue;
			mapped.push({
				display: displayName,
				user: userName
			});
			if (imageUrl) {
				let fullUrl = imageUrl;
				if (imageUrl.startsWith("/")) fullUrl = rstrip(baseUrl, "/") + "/" + lstrip(imageUrl, "/");
				if (await downloadImage(fullUrl, normalizeName(displayName), apiKey)) imagesDownloaded++;
			}
		}
		const content = mapped.map((c) => `${c.display}=${c.user}`).join("\n") + "\n";
		await promises.writeFile(CONTACTS_FILE, content);
		console.log(`[CONTACTS] Sync complete. ${mapped.length} contacts, ${imagesDownloaded} images.`);
		return {
			count: mapped.length,
			images: imagesDownloaded
		};
	} catch (e) {
		console.error("[CONTACTS] Sync failed:", e);
		return {
			count: 0,
			images: 0
		};
	}
}
function rstrip(str, chars) {
	let res = str;
	while (res.endsWith(chars)) res = res.slice(0, -chars.length);
	return res;
}
function lstrip(str, chars) {
	let res = str;
	while (res.startsWith(chars)) res = res.slice(chars.length);
	return res;
}
async function requestCall(userName, deviceId, apiKey, baseUrl) {
	if (!userName || !/^[A-Za-z0-9_.-]+$/.test(userName)) return {
		ok: false,
		code: "VC-USER",
		detail: "Nombre de usuario inválido"
	};
	if (!apiKey) return {
		ok: false,
		code: "VC-CONFIG",
		detail: "API key no configurada"
	};
	if (!deviceId) return {
		ok: false,
		code: "VC-DEVICE",
		detail: "Device ID no configurado"
	};
	try {
		const url = `${rstrip(baseUrl, "/")}/pizarra/api/notify/`;
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Api-Key": apiKey
			},
			body: JSON.stringify({
				type: "videollamada",
				destination: userName,
				origin: deviceId
			}),
			signal: AbortSignal.timeout(1e4)
		});
		if (!res.ok) return {
			ok: false,
			code: `VC-${res.status}`,
			detail: await res.text()
		};
		return { ok: true };
	} catch (e) {
		if (e?.name === "TimeoutError") return {
			ok: false,
			code: "VC-TIMEOUT",
			detail: "Tiempo de espera agotado"
		};
		if (e?.code === "ECONNREFUSED") return {
			ok: false,
			code: "VC-NET",
			detail: "No hay conexión"
		};
		return {
			ok: false,
			code: "VC-UNK",
			detail: String(e)
		};
	}
}
//#endregion
//#region electron/services/remindersService.ts
/**
* remindersService.ts — Persistent reminder scheduling
* Mirrors cobien_FrontEnd/app/reminders/reminders.py
*/
var _dataPath = null;
var timers = /* @__PURE__ */ new Map();
var notifyCallback = null;
function getDataPath() {
	if (!_dataPath) _dataPath = join(app.getPath("userData"), "reminders.json");
	return _dataPath;
}
async function readAll() {
	try {
		const raw = await promises.readFile(getDataPath(), "utf-8");
		return JSON.parse(raw);
	} catch {
		return [];
	}
}
async function writeAll(reminders) {
	await promises.writeFile(getDataPath(), JSON.stringify(reminders, null, 2), "utf-8");
}
function schedule(reminder) {
	const ms = new Date(reminder.datetime).getTime() - Date.now();
	if (ms <= 0) return;
	const t = setTimeout(async () => {
		timers.delete(reminder.id);
		notifyCallback?.(reminder);
		await writeAll((await readAll()).filter((r) => r.id !== reminder.id));
	}, ms);
	timers.set(reminder.id, t);
}
async function loadPendingReminders(onFire) {
	notifyCallback = onFire;
	const all = await readAll();
	const now = /* @__PURE__ */ new Date();
	const pending = [];
	for (const r of all) if (new Date(r.datetime) > now) {
		schedule(r);
		pending.push(r);
	}
	await writeAll(pending);
	console.log(`[REMINDERS] ${pending.length} reminders scheduled`);
}
async function addReminder(message, isoDatetime) {
	const reminder = {
		id: `rem_${Date.now()}`,
		message,
		datetime: isoDatetime
	};
	const all = await readAll();
	all.push(reminder);
	await writeAll(all);
	schedule(reminder);
	return reminder;
}
async function listReminders() {
	const all = await readAll();
	const now = /* @__PURE__ */ new Date();
	return all.filter((r) => new Date(r.datetime) > now);
}
async function deleteReminder(id) {
	const all = await readAll();
	const filtered = all.filter((r) => r.id !== id);
	if (filtered.length === all.length) return false;
	await writeAll(filtered);
	const t = timers.get(id);
	if (t) {
		clearTimeout(t);
		timers.delete(id);
	}
	return true;
}
//#endregion
//#region electron/services/mqttService.ts
/**
* mqttService.ts — MQTT sensor bridge for CoBien furniture
*
* Mirrors cobien_FrontEnd/app/mqtt_publisher.py logic:
*
* Topics subscribed (from hardware/broker):
*   rfid/read       → RFID card tap → navigate/videocall/weather
*   sensors/update  → Capacitive buttons (PIC id) → navigate to screen
*   app/nav         → Already processed nav commands (from legacy Python bridge)
*   events/reload   → Force events screen refresh
*   board/reload    → Force board screen refresh
*   weather/reload  → Force weather refresh
*
* All events are forwarded to the renderer via IPC: 'mqtt:event'
* Payload shape: { topic: string, type: string, target: string, extra?: any }
*/
var TOPIC_RFID = "rfid/read";
var TOPIC_SENSORS = "sensors/update";
var TOPIC_APP_NAV = "app/nav";
var TOPIC_EVENTS_RELOAD = "events/reload";
var TOPIC_BOARD_RELOAD = "board/reload";
var TOPIC_WEATHER_RELOAD = "weather/reload";
var SUBSCRIBED_TOPICS = [
	TOPIC_RFID,
	TOPIC_SENSORS,
	TOPIC_APP_NAV,
	TOPIC_EVENTS_RELOAD,
	TOPIC_BOARD_RELOAD,
	TOPIC_WEATHER_RELOAD
];
var BUTTON_ACTIONS = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
};
var rfidActions = {};
var RFID_DEBOUNCE_MS = 5e3;
var lastRfidId = null;
var lastRfidAt = 0;
var client = null;
var mainWindowRef = null;
function send(payload) {
	if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
	mainWindowRef.webContents.send("mqtt:event", payload);
}
function handleRfid(raw) {
	let cardId;
	try {
		cardId = raw?.data?.id !== void 0 ? parseInt(raw.data.id) : parseInt(raw.id ?? 0);
	} catch {
		cardId = 0;
	}
	if (!cardId) return;
	const now = Date.now();
	if (cardId === lastRfidId && now - lastRfidAt < RFID_DEBOUNCE_MS) {
		console.log(`[MQTT] RFID debounce ignored: ${cardId}`);
		return;
	}
	lastRfidId = cardId;
	lastRfidAt = now;
	console.log(`[MQTT] RFID card: ${cardId}`);
	const action = rfidActions[cardId];
	if (action) send({
		topic: TOPIC_APP_NAV,
		type: "nav",
		source: "rfid",
		...action
	});
	else send({
		topic: TOPIC_RFID,
		type: "rfid",
		cardId
	});
}
function handleSensors(raw) {
	let picId;
	try {
		picId = raw?.data?.PIC !== void 0 ? parseInt(raw.data.PIC) : parseInt(raw.PIC ?? 0);
	} catch {
		picId = 0;
	}
	if (!picId) return;
	const action = BUTTON_ACTIONS[picId];
	if (action) {
		console.log(`[MQTT] Button PIC=${picId} → ${action.target}`);
		send({
			topic: TOPIC_SENSORS,
			type: "nav",
			target: action.target,
			source: action.source
		});
	} else console.warn(`[MQTT] Unknown button PIC: ${picId}`);
}
function handleAppNav(raw) {
	send({
		topic: TOPIC_APP_NAV,
		...raw
	});
}
async function loadRfidActions() {
	const { promises: fs } = await import("node:fs");
	const { join, dirname } = await import("node:path");
	const { app } = await import("electron");
	const configPath = join(app.getPath("userData"), "config.local.json");
	try {
		const mappings = JSON.parse(await fs.readFile(configPath, "utf-8")).settings?.rfid_actions || {};
		const newActions = {};
		for (const [idStr, payload] of Object.entries(mappings)) {
			const id = parseInt(idStr);
			if (isNaN(id)) continue;
			const p = payload;
			const action = p?.action || "day_events";
			const extra = p?.extra || "";
			if (action === "weather") newActions[id] = {
				target: "weather",
				extra: { name: extra }
			};
			else if (action === "videocall") newActions[id] = {
				target: "videocall",
				extra: { to_user: extra }
			};
			else newActions[id] = { target: "day_events" };
		}
		rfidActions = newActions;
		console.log(`[MQTT] Loaded ${Object.keys(rfidActions).length} RFID actions`);
	} catch (e) {
		console.error("[MQTT] Failed to load RFID config:", e);
	}
}
function startMqtt(win) {
	mainWindowRef = win;
	loadRfidActions();
	const url = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${url}`);
	client = mqtt.connect(url, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: true
	});
	client.on("connect", () => {
		console.log("[MQTT] Connected");
		for (const topic of SUBSCRIBED_TOPICS) client.subscribe(topic, { qos: 0 }, (err) => {
			if (err) console.error(`[MQTT] Subscribe error on ${topic}:`, err);
			else console.log(`[MQTT] Subscribed: ${topic}`);
		});
		send({
			topic: "mqtt/status",
			type: "status",
			connected: true
		});
	});
	client.on("message", (topic, message) => {
		let payload = {};
		try {
			payload = JSON.parse(message.toString());
		} catch {
			payload = {};
		}
		switch (topic) {
			case TOPIC_RFID:
				handleRfid(payload);
				break;
			case TOPIC_SENSORS:
				handleSensors(payload);
				break;
			case TOPIC_APP_NAV:
				handleAppNav(payload);
				break;
			case TOPIC_EVENTS_RELOAD:
				send({
					topic,
					type: "reload",
					target: "events"
				});
				break;
			case TOPIC_BOARD_RELOAD:
				send({
					topic,
					type: "reload",
					target: "board"
				});
				break;
			case TOPIC_WEATHER_RELOAD:
				send({
					topic,
					type: "reload",
					target: "weather"
				});
				break;
			case "rfid/actions_reload":
				loadRfidActions();
				break;
			default: console.log(`[MQTT] Unhandled topic: ${topic}`);
		}
	});
	client.on("error", (err) => {
		console.warn("[MQTT] Error:", err.message);
		send({
			topic: "mqtt/status",
			type: "status",
			connected: false,
			error: err.message
		});
	});
	client.on("offline", () => {
		console.warn("[MQTT] Offline — will retry");
		send({
			topic: "mqtt/status",
			type: "status",
			connected: false
		});
	});
	client.on("reconnect", () => {
		console.log("[MQTT] Reconnecting...");
	});
}
function stopMqtt() {
	if (client) {
		client.end(true);
		client = null;
		console.log("[MQTT] Disconnected");
	}
}
//#endregion
//#region electron/services/asrService.ts
var _dirname$1 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var currentPythonProcess = null;
function abortStt() {
	if (currentPythonProcess) {
		console.log("[ASR] Aborting current STT process");
		currentPythonProcess.kill();
		currentPythonProcess = null;
	}
}
function listenWithVosk(language = "es", onLevel, onPartial) {
	abortStt();
	const bridgePath = join(_dirname$1, "../public/python/asr_bridge.py");
	const modelPath = language === "es" ? join(_dirname$1, "../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-es-0.42") : join(_dirname$1, "../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-fr-0.22");
	return new Promise((resolve) => {
		const pythonBin = join(_dirname$1, "../../../cobien_FrontEnd/app/.venv/bin/python3");
		console.log(`[ASR] Spawning bridge: ${pythonBin} ${bridgePath} ${modelPath}`);
		currentPythonProcess = spawn(pythonBin, [bridgePath, modelPath]);
		const python = currentPythonProcess;
		let result = "";
		python.stdout.on("data", (data) => {
			const chunk = data.toString();
			result += chunk;
			const lines = chunk.split("\n");
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.includes("\"level\":")) try {
					const parsed = JSON.parse(trimmed);
					if (typeof parsed.level === "number" && onLevel) onLevel(parsed.level);
				} catch (e) {}
				else if (trimmed.includes("\"partial\":")) try {
					const parsed = JSON.parse(trimmed);
					if (typeof parsed.partial === "string" && onPartial) onPartial(parsed.partial);
				} catch (e) {}
			}
		});
		python.stderr.on("data", (data) => {
			console.error(`[ASR] Bridge Error: ${data}`);
		});
		python.on("close", (code) => {
			console.log(`[ASR] Bridge closed with code ${code}`);
			try {
				const lines = result.trim().split("\n");
				let lastJson = "";
				for (let i = lines.length - 1; i >= 0; i--) {
					const line = lines[i].trim();
					if (line.startsWith("{") && line.endsWith("}") && line.includes("\"text\":")) {
						lastJson = line;
						break;
					}
				}
				if (!lastJson) {
					console.error("ASR Bridge: No text JSON found in output", result);
					resolve(null);
					return;
				}
				resolve(JSON.parse(lastJson).text || null);
			} catch (e) {
				console.error("ASR Bridge parse error:", e, result);
				resolve(null);
			}
		});
	});
}
//#endregion
//#region electron/services/hardwareService.ts
var execAsync = promisify(exec);
async function adjustVolume(value, isAbsolute = false) {
	try {
		if (isAbsolute) await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${value}%`);
		else await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${`${value >= 0 ? "+" : ""}${value}%`}`);
		return true;
	} catch (e) {
		console.error("Failed to adjust volume:", e);
		return false;
	}
}
async function getVolume() {
	try {
		const { stdout } = await execAsync("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(stdout.trim()) || 0;
	} catch (e) {
		console.error("Failed to get volume:", e);
		return 50;
	}
}
async function adjustBrightness(value) {
	try {
		const { stdout } = await execAsync("xrandr --query | grep ' connected' | cut -d' ' -f1");
		const outputs = stdout.trim().split("\n");
		if (outputs.length === 0) return false;
		for (const output of outputs) {
			let next = .4;
			if (value !== void 0) next = value;
			else {
				const { stdout: verbose } = await execAsync(`xrandr --verbose --output ${output} | grep -i brightness`);
				const current = parseFloat(verbose.split(":")[1].trim());
				if (current < .6) next = .7;
				else if (current < .9) next = 1;
				else next = .4;
			}
			await execAsync(`xrandr --output ${output} --brightness ${next.toFixed(2)}`);
		}
		return true;
	} catch (e) {
		console.error("Failed to adjust brightness:", e);
		return false;
	}
}
//#endregion
//#region electron/services/wakeWordService.ts
var wakeWordProcess = null;
var isListening = false;
function startWakeWordDetection(mainWindow, _dirname) {
	if (isListening) return;
	isListening = true;
	const pythonBin = join(_dirname, "../../../cobien_FrontEnd/app/.venv/bin/python3");
	const bridgePath = join(_dirname, "../public/python/asr_bridge.py");
	const modelPath = join(_dirname, "../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-es-0.42");
	console.log(`[WAKE] Starting detection for "cobien"...`);
	wakeWordProcess = spawn(pythonBin, [
		bridgePath,
		modelPath,
		"--wake-word",
		"cobien"
	]);
	wakeWordProcess.stdout?.on("data", (data) => {
		const lines = data.toString().split("\n");
		for (const line of lines) if (line.includes("\"wake_word_detected\":")) {
			console.log("[WAKE] Keyword detected!");
			mainWindow.webContents.send("asr:wake-word-detected");
			stopWakeWordDetection();
			break;
		}
	});
	wakeWordProcess.stderr?.on("data", (data) => {
		console.error(`[WAKE] Bridge Error: ${data}`);
	});
	wakeWordProcess.on("close", (code) => {
		console.log(`[WAKE] Bridge closed with code ${code}`);
		isListening = false;
		wakeWordProcess = null;
	});
}
function stopWakeWordDetection() {
	if (wakeWordProcess) {
		wakeWordProcess.kill();
		wakeWordProcess = null;
	}
	isListening = false;
}
//#endregion
//#region electron/main.ts
dotenv.config();
var _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var mainWindow = null;
var configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
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
	ipcMain.handle("config:getSettings", async () => {
		try {
			return JSON.parse(await promises.readFile(configPath, "utf-8")).settings || {};
		} catch (e) {
			return {};
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
	ipcMain.handle("weather:fetch", async (_, cityName) => {
		return await fetchWeatherBundle(cityName);
	});
	ipcMain.handle("jokes:getRandom", async () => {
		return await getRandomJoke("es");
	});
	ipcMain.handle("contacts:list", async () => {
		return await loadContacts();
	});
	ipcMain.handle("contacts:sync", async () => {
		const apiKey = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await syncContacts(process.env.COBIEN_DEVICE_ID || "CoBien6", apiKey, (JSON.parse(await promises.readFile(configPath, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	});
	ipcMain.handle("contacts:requestCall", async (_, userName) => {
		const apiKey = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await requestCall(userName, process.env.COBIEN_DEVICE_ID || "CoBien6", apiKey, (JSON.parse(await promises.readFile(configPath, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	});
	ipcMain.handle("contacts:openCall", async (_, userName) => {
		const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
		const url = `${(JSON.parse(await promises.readFile(configPath, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, "")}/videocall/?room=${encodeURIComponent(userName)}&device=${encodeURIComponent(deviceId)}`;
		const { BrowserWindow: BW } = await import("electron");
		new BW({
			width: 1024,
			height: 768,
			fullscreen: true,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true
			}
		}).loadURL(url);
		return true;
	});
	ipcMain.handle("reminders:add", async (_, message, isoDatetime) => {
		return await addReminder(message, isoDatetime);
	});
	ipcMain.handle("reminders:list", async () => {
		return await listReminders();
	});
	ipcMain.handle("reminders:delete", async (_, id) => {
		return await deleteReminder(id);
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
	ipcMain.handle("events:delete", async (_, id) => {
		return await deleteEvent(id);
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
	ipcMain.handle("app:restart", () => {
		app.relaunch();
		app.exit();
	});
	ipcMain.handle("app:exit", () => {
		app.quit();
	});
	ipcMain.handle("tts:speak", async (event, text) => {
		console.log(`[TTS] Speaking: "${text}"`);
		const { bin, model } = getPiperConfig();
		console.log(`[TTS] Config: bin=${bin}, model=${model}`);
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
					console.error("[TTS] Piper exec error:", error, stderr);
					resolve(null);
					return;
				}
				try {
					const buffer = await promises.readFile(tempWav);
					await promises.unlink(tempWav);
					console.log(`[TTS] Generated WAV: ${buffer.length} bytes`);
					resolve(buffer);
				} catch (e) {
					console.error("[TTS] Error reading temp wav:", e);
					resolve(null);
				}
			});
			child.stdin?.write(text);
			child.stdin?.end();
		});
	});
	ipcMain.handle("stt:listen", async (event, language) => {
		return await listenWithVosk(language, (level) => {
			event.sender.send("asr:level", level);
		}, (partial) => {
			event.sender.send("asr:partial", partial);
		});
	});
	ipcMain.handle("hardware:adjustVolume", async (_, value, isAbsolute = false) => {
		return await adjustVolume(value, isAbsolute);
	});
	ipcMain.handle("hardware:adjustBrightness", async (_, value) => {
		return await adjustBrightness(value);
	});
	ipcMain.handle("hardware:getVolume", async () => {
		return await getVolume();
	});
	ipcMain.handle("stt:abort", () => {
		abortStt();
	});
	ipcMain.handle("asr:restartWakeWord", () => {
		if (mainWindow) startWakeWordDetection(mainWindow, _dirname);
	});
}
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1024,
		height: 768,
		fullscreen: false,
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
	const baseUrl = (JSON.parse(fsSync.readFileSync(configPath, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
	const apiKey = process.env.COBIEN_NOTIFY_API_KEY || "";
	syncContacts(process.env.COBIEN_DEVICE_ID || "CoBien6", apiKey, baseUrl).catch(console.error);
	createWindow();
	loadPendingReminders((reminder) => {
		if (mainWindow) mainWindow.webContents.send("reminder:fire", reminder);
	});
	if (mainWindow) {
		const configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
		const localPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.local.json");
		startBackendSync(mainWindow, configPath, localPath);
		startMqtt(mainWindow);
		startWakeWordDetection(mainWindow, _dirname);
	}
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	stopMqtt();
	if (process.platform !== "darwin") app.quit();
});
//#endregion
