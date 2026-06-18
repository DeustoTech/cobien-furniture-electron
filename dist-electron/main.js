import { a as updatePersonalEvent, i as getEvents, n as deleteEvent, t as addPersonalEvent } from "./eventsMongo-CRQF6wPf.js";
import dotenv from "dotenv";
import { BrowserWindow, app, ipcMain, net, protocol, session } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exec, execFile } from "node:child_process";
import * as fsSync from "node:fs";
import { createWriteStream, promises } from "node:fs";
import * as os from "node:os";
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
				device_id: process.env.COBIEN_DEVICE_ID || "CoBien6",
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
		const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
		const res = await fetch(`${url}?device_id=${deviceId}`, {
			method: "GET",
			headers: { "X-API-KEY": apiKey }
		});
		if (res.ok) {
			const notifications = (await res.json()).notifications || [];
			if (notifications.length > 0) {
				console.log(`[POLL] Received ${notifications.length} notifications`);
				let reloadEvents = false;
				notifications.forEach((notif) => {
					mainWindow.webContents.send("backend:notification", notif);
					const type = (notif.type || "").toLowerCase();
					if (type === "new_event" || type === "events_reload") reloadEvents = true;
				});
				if (reloadEvents) {
					console.log("[POLL] Event notification received. Refreshing local events cache...");
					import("./eventsMongo-CRQF6wPf.js").then((n) => n.r).then(({ getEvents }) => {
						getEvents(configPath).catch((err) => console.error("[POLL] Failed to background-refresh events:", err));
					}).catch((err) => console.error("[POLL] Failed to dynamically import eventsMongo:", err));
				}
			}
		}
	} catch (e) {}
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
	1: "/svg/parcial.svg",
	2: "/svg/parcial.svg",
	3: "/svg/nubes.svg",
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
	71: "/svg/nieve.svg",
	73: "/svg/nieve.svg",
	75: "/svg/nieve.svg",
	77: "/svg/nieve.svg",
	80: "/images/lluvia.png",
	81: "/images/lluvia.png",
	82: "/images/lluvia.png",
	85: "/svg/nieve.svg",
	86: "/svg/nieve.svg",
	95: "/images/tormenta.png",
	96: "/images/tormenta.png",
	99: "/images/tormenta.png"
};
var WMO_DESC = {
	es: {
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
	},
	en: {
		0: "Clear sky",
		1: "Mainly clear",
		2: "Partially cloudy",
		3: "Cloudy",
		45: "Fog",
		48: "Depositing rime fog",
		51: "Light drizzle",
		53: "Moderate drizzle",
		55: "Dense drizzle",
		61: "Light rain",
		63: "Moderate rain",
		65: "Heavy rain",
		71: "Light snow",
		73: "Moderate snow",
		75: "Heavy snow",
		80: "Light rain showers",
		81: "Moderate rain showers",
		82: "Violent rain showers",
		95: "Thunderstorm",
		96: "Thunderstorm with slight hail",
		99: "Thunderstorm with heavy hail"
	},
	fr: {
		0: "Ciel dégagé",
		1: "Principalement dégagé",
		2: "Partiellement nuageux",
		3: "Couvert",
		45: "Brouillard",
		48: "Brouillard givrant",
		51: "Bruine légère",
		53: "Bruine modérée",
		55: "Bruine dense",
		61: "Pluie légère",
		63: "Pluie modérée",
		65: "Pluie forte",
		71: "Neige légère",
		73: "Neige modérée",
		75: "Neige forte",
		80: "Averses de pluie légères",
		81: "Averses de pluie modérées",
		82: "Averses de pluie violentes",
		95: "Orage",
		96: "Orage avec grêle légère",
		99: "Orage avec grêle forte"
	}
};
function wmoIcon(code, isDay = true) {
	if (!isDay && code <= 1) return "/svg/noche.svg";
	return WMO_ICON_MAP[code] ?? "/svg/nubes.svg";
}
function wmoDesc(code, lang = "es") {
	return (WMO_DESC[lang] || WMO_DESC["es"])[code] ?? (lang === "en" ? "Unknown condition" : lang === "fr" ? "Condition inconnue" : "Condición desconocida");
}
function amPmLabel(isoHour) {
	const h = new Date(isoHour).getHours();
	const label = h < 12 ? "a.m." : "p.m.";
	return `${h % 12 || 12} ${label}`;
}
async function geocodeCity(cityName) {
	const owmKey = process.env.OWM_API_KEY ?? "";
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`;
		const res = await fetch(url, { headers: { "User-Agent": "CoBien6-Furniture" } });
		if (!res.ok) throw new Error(`Nominatim returned status ${res.status}`);
		const data = await res.json();
		if (!data.length) throw new Error("No Nominatim results");
		return {
			lat: parseFloat(data[0].lat),
			lon: parseFloat(data[0].lon),
			tz: "auto"
		};
	} catch (e) {
		console.warn("[WEATHER] Nominatim geocode failed, trying OWM fallback:", e);
		if (owmKey) try {
			const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${owmKey}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`OWM Geo returned status ${res.status}`);
			const data = await res.json();
			if (data && data.length > 0) return {
				lat: data[0].lat,
				lon: data[0].lon,
				tz: "auto"
			};
		} catch (owmErr) {
			console.error("[WEATHER] OWM geocode fallback also failed:", owmErr);
		}
		return null;
	}
}
function owmIconToLocal(owmIcon) {
	const prefix = owmIcon.substring(0, 2);
	const isNight = owmIcon.endsWith("n");
	switch (prefix) {
		case "01": return isNight ? "/svg/noche.svg" : "/images/sol.png";
		case "02":
		case "03": return "/svg/parcial.svg";
		case "04": return "/svg/nubes.svg";
		case "09":
		case "10":
		case "11": return prefix === "11" ? "/images/tormenta.png" : "/images/lluvia.png";
		case "13": return "/svg/nieve.svg";
		case "50": return "/images/neblina.png";
		default: return "/svg/nubes.svg";
	}
}
async function fetchWeatherBundle(cityName, lang = "es") {
	const base = {
		city: cityName,
		temp: "—°",
		description: lang === "en" ? "Not available" : lang === "fr" ? "Non disponible" : "No disponible",
		icon: "/svg/nubes.svg",
		tempMin: lang === "en" ? "Min —°" : lang === "fr" ? "Min —°" : "Min —°",
		tempMax: lang === "en" ? "Max —°" : lang === "fr" ? "Max —°" : "Max —°",
		todayPop: 0,
		todayWind: 0,
		hourly: [],
		daily: []
	};
	const owmKey = process.env.OWM_API_KEY ?? "";
	try {
		const geo = await geocodeCity(cityName);
		if (!geo) {
			base.error = "Ciudad no encontrada";
			return base;
		}
		const { lat, lon, tz } = geo;
		try {
			const omUrl = [
				`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`,
				`&timezone=${encodeURIComponent(tz)}`,
				`&current=temperature_2m,weathercode,is_day`,
				`&hourly=temperature_2m,weathercode`,
				`&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,wind_speed_10m_max`,
				`&forecast_days=7`
			].join("");
			const omRes = await fetch(omUrl);
			if (!omRes.ok) throw new Error(`Open-Meteo returned status ${omRes.status}`);
			const om = await omRes.json();
			const currentCode = om.current?.weathercode ?? 0;
			const isDay = (om.current?.is_day ?? 1) === 1;
			base.temp = `${Math.round(om.current?.temperature_2m ?? 0)}°`;
			base.icon = wmoIcon(currentCode, isDay);
			if (owmKey) try {
				const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=${lang}`;
				base.description = (await (await fetch(owmUrl)).json()).weather?.[0]?.description ?? wmoDesc(currentCode, lang);
				base.description = base.description.charAt(0).toUpperCase() + base.description.slice(1);
			} catch {
				base.description = wmoDesc(currentCode, lang);
			}
			else base.description = wmoDesc(currentCode, lang);
			const todayMin = Math.round(om.daily?.temperature_2m_min?.[0] ?? 0);
			const todayMax = Math.round(om.daily?.temperature_2m_max?.[0] ?? 0);
			base.tempMin = `Min ${todayMin}°`;
			base.tempMax = `Max ${todayMax}°`;
			base.todayPop = om.daily?.precipitation_probability_max?.[0] ?? 0;
			base.todayWind = Math.round(om.daily?.wind_speed_10m_max?.[0] ?? 0);
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
			const dailyWindArr = om.daily?.wind_speed_10m_max ?? [];
			base.daily = dailyTimes.slice(1, 7).map((t, i) => {
				const d = new Date(t);
				const day = d.getDate();
				const localeStr = lang === "en" ? "en-US" : lang === "fr" ? "fr-FR" : "es-ES";
				const month = d.toLocaleDateString(localeStr, { month: "long" });
				const dayName = d.toLocaleDateString(localeStr, { weekday: "long" });
				return {
					name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
					date: lang === "en" ? `${month} ${day}` : `${day} de ${month}`,
					icon: wmoIcon(dailyCodesArr[i + 1] ?? 0),
					tmin: `${Math.round(dailyMinArr[i + 1] ?? 0)}°`,
					tmax: `${Math.round(dailyMaxArr[i + 1] ?? 0)}°`,
					pop: dailyPopArr[i + 1] ?? 0,
					wind: Math.round(dailyWindArr[i + 1] ?? 0)
				};
			});
		} catch (omError) {
			if (!owmKey) throw omError;
			console.warn("[WEATHER] Open-Meteo failed, executing OpenWeatherMap fallback:", omError.message || omError);
			const owmCurrentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=${lang}`;
			const owmForecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=${lang}`;
			const [currentRes, forecastRes] = await Promise.all([fetch(owmCurrentUrl), fetch(owmForecastUrl)]);
			if (!currentRes.ok) throw new Error(`OWM current weather returned status ${currentRes.status}`);
			if (!forecastRes.ok) throw new Error(`OWM forecast returned status ${forecastRes.status}`);
			const owmCurrent = await currentRes.json();
			const owmForecast = await forecastRes.json();
			base.temp = `${Math.round(owmCurrent.main.temp)}°`;
			base.icon = owmIconToLocal(owmCurrent.weather[0].icon);
			base.description = owmCurrent.weather[0].description;
			base.description = base.description.charAt(0).toUpperCase() + base.description.slice(1);
			base.tempMin = `Min ${Math.round(owmCurrent.main.temp_min)}°`;
			base.tempMax = `Max ${Math.round(owmCurrent.main.temp_max)}°`;
			base.todayPop = 0;
			base.todayWind = Math.round(owmCurrent.wind.speed * 3.6);
			base.hourly = owmForecast.list.slice(0, 4).map((item) => {
				return {
					time: amPmLabel(item.dt_txt),
					icon: owmIconToLocal(item.weather[0].icon),
					temp: `${Math.round(item.main.temp)}°`
				};
			});
			const dailyGroups = {};
			const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			for (const item of owmForecast.list) {
				const dayStr = item.dt_txt.slice(0, 10);
				if (dayStr === todayStr) {
					if (base.todayPop === 0 && item.pop !== void 0) base.todayPop = Math.round(item.pop * 100);
					continue;
				}
				if (!dailyGroups[dayStr]) dailyGroups[dayStr] = [];
				dailyGroups[dayStr].push(item);
			}
			base.daily = Object.keys(dailyGroups).sort().slice(0, 6).map((dayStr) => {
				const items = dailyGroups[dayStr];
				let tmin = 999;
				let tmax = -999;
				let maxPop = 0;
				let maxWind = 0;
				let midItem = items[Math.floor(items.length / 2)];
				for (const it of items) {
					if (it.main.temp_min < tmin) tmin = it.main.temp_min;
					if (it.main.temp_max > tmax) tmax = it.main.temp_max;
					if (it.pop && it.pop > maxPop) maxPop = it.pop;
					if (it.wind && it.wind.speed > maxWind) maxWind = it.wind.speed;
					if (it.dt_txt.endsWith("12:00:00")) midItem = it;
				}
				const d = new Date(dayStr);
				const localeStr = lang === "en" ? "en-US" : lang === "fr" ? "fr-FR" : "es-ES";
				const dayName = d.toLocaleDateString(localeStr, { weekday: "long" });
				const month = d.toLocaleDateString(localeStr, { month: "long" });
				const dayNum = d.getDate();
				return {
					name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
					date: lang === "en" ? `${month} ${dayNum}` : `${dayNum} de ${month}`,
					icon: owmIconToLocal(midItem.weather[0].icon),
					tmin: `${Math.round(tmin)}°`,
					tmax: `${Math.round(tmax)}°`,
					pop: Math.round(maxPop * 100),
					wind: Math.round(maxWind * 3.6)
				};
			});
		}
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
var JOKES_DIR = join(typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url)), "../public/data/jokes");
var cachedJokes = [];
var lastJoke = "";
async function loadJokes(lang = "es") {
	try {
		const file = lang === "fr" ? "jokes_fr.json" : lang === "en" ? "jokes_en.json" : "jokes_es.json";
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
		if (lang === "en") return [
			"Why don't scientists trust atoms? Because they make up everything!",
			"What do you call a fake noodle? An Impasta.",
			"Why did the scarecrow win an award? Because he was outstanding in his field."
		];
		return [
			"¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.",
			"¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.",
			"¿Cuál es el colmo de un electricista? Que su mujer se llame Luz."
		];
	}
}
async function getRandomJoke(lang = "es") {
	if (cachedJokes.length === 0) cachedJokes = await loadJokes(lang);
	if (cachedJokes.length === 0) return lang === "en" ? "No jokes available." : lang === "fr" ? "Aucune blague disponible." : "No hay chistes disponibles.";
	const available = cachedJokes.length > 1 ? cachedJokes.filter((j) => j !== lastJoke) : cachedJokes;
	const joke = available[Math.floor(Math.random() * available.length)];
	lastJoke = joke;
	return joke;
}
//#endregion
//#region electron/services/contactsService.ts
var _dirname$1 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var CONTACTS_DIR = join(app.getPath("userData"), "contacts");
var CONTACTS_FILE = join(CONTACTS_DIR, "list_contacts.txt");
var DEFAULT_IMG = join(_dirname$1, "../public/images/default_user.png");
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
				to_user: userName,
				from_device: deviceId,
				kind: "call_ready",
				message: "",
				ttl_hours: 12
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
//#region electron/main.ts
dotenv.config();
var devUrlArg = process.argv.find((arg) => arg.startsWith("--vite-dev-url="));
if (devUrlArg) process.env.VITE_DEV_SERVER_URL = devUrlArg.split("=")[1];
app.commandLine.appendSwitch("password-store", "basic");
var _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var mainWindow = null;
var configPath = join(_dirname, "../config/config.default.json");
function getPiperConfig(lang = "es", gender = "male") {
	try {
		const configPath = join(_dirname, "../config/config.default.json");
		const localPath = join(app.getPath("userData"), "config.local.json");
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
		const defaultModel = join(_dirname, "../public/models/piper/es_ES-davefx-medium.onnx");
		const bin = services.tts_piper_bin || internalBin;
		let modelName = services[`tts_piper_model_${lang}_${gender}`] || services[`tts_piper_model_${lang}`];
		let model = "";
		if (modelName) if (modelName.startsWith("/") || modelName.includes(":") || modelName.startsWith("http")) model = modelName;
		else {
			const elPath = join(_dirname, "../public/models/piper", modelName);
			if (fsSync.existsSync(elPath)) model = elPath;
			else model = elPath;
		}
		else if (lang === "fr") model = join(_dirname, "../public/models/piper/fr_FR-siwis-medium.onnx");
		else if (lang === "en") model = join(_dirname, "../public/models/piper/en_US-amy-medium.onnx");
		else model = defaultModel;
		return {
			bin,
			model
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
	ipcMain.handle("weather:fetch", async (_, cityName, lang = "es") => {
		return await fetchWeatherBundle(cityName, lang);
	});
	ipcMain.handle("jokes:getRandom", async (_, lang = "es") => {
		return await getRandomJoke(lang);
	});
	ipcMain.handle("contacts:list", async () => {
		return await loadContacts();
	});
	ipcMain.handle("contacts:sync", async () => {
		const apiKey = process.env.COBIEN_NOTIFY_API_KEY || "";
		const deviceId = process.env.COBIEN_DEVICE_ID;
		if (!deviceId) {
			console.error("ERROR: COBIEN_DEVICE_ID not set. Exiting.");
			process.exit(1);
		}
		return await syncContacts(deviceId, apiKey, (JSON.parse(await promises.readFile(configPath, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	});
	ipcMain.handle("contacts:requestCall", async (_, userName) => {
		const apiKey = process.env.COBIEN_NOTIFY_API_KEY || "";
		const deviceId = process.env.COBIEN_DEVICE_ID;
		if (!deviceId) {
			console.error("ERROR: COBIEN_DEVICE_ID not set. Exiting.");
			process.exit(1);
		}
		return await requestCall(userName, deviceId, apiKey, (JSON.parse(await promises.readFile(configPath, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	});
	ipcMain.handle("contacts:openCall", async (_, userName) => {
		const deviceId = process.env.COBIEN_DEVICE_ID;
		if (!deviceId) {
			console.error("ERROR: COBIEN_DEVICE_ID not set. Exiting.");
			process.exit(1);
		}
		const deviceApiKey = process.env.COBIEN_VIDEOCALL_DEVICE_API_KEY || "";
		const sessionUrl = process.env.COBIEN_DEVICE_VIDEOCALL_SESSION_URL || "https://portal.co-bien.eu/api/device-videocall-session/";
		const devicePortalUrl = process.env.COBIEN_PORTAL_VIDEOCALL_DEVICE_URL || "https://portal.co-bien.eu/videocall/device/";
		const answeredUrl = process.env.COBIEN_PORTAL_CALL_ANSWERED_URL || "https://portal.co-bien.eu/api/call-answered/";
		let targetUrl = `${process.env.COBIEN_PORTAL_VIDEOCALL_URL || "https://portal.co-bien.eu/videocall/"}?room=${encodeURIComponent(userName)}&device=${encodeURIComponent(deviceId)}`;
		if (deviceApiKey) try {
			console.log(`[VIDEOCALL] Fetching device session for room: ${userName}, device: ${deviceId}`);
			const sessionRes = await fetch(sessionUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-DEVICE-ID": deviceId,
					"X-DEVICE-KEY": deviceApiKey
				},
				body: JSON.stringify({
					device_id: deviceId,
					room: userName
				}),
				signal: AbortSignal.timeout(8e3)
			});
			if (sessionRes.ok) {
				const { token, room_name, identity, call_answered_url } = await sessionRes.json();
				if (token) {
					const targetAnsweredUrl = call_answered_url || answeredUrl;
					try {
						console.log(`[VIDEOCALL] Notifying call answered to: ${targetAnsweredUrl}`);
						await fetch(targetAnsweredUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								room: room_name,
								device: identity
							}),
							signal: AbortSignal.timeout(5e3)
						});
					} catch (err) {
						console.error("[VIDEOCALL] Failed to notify backend call answered:", err);
					}
					targetUrl = `${devicePortalUrl}#token=${encodeURIComponent(token)}&room=${encodeURIComponent(room_name)}&identity=${encodeURIComponent(identity)}`;
					console.log("[VIDEOCALL] Generated Twilio token URL successfully");
				}
			} else console.warn(`[VIDEOCALL] Device session request failed with status: ${sessionRes.status}`);
		} catch (err) {
			console.error("[VIDEOCALL] Error request session:", err);
		}
		const { BrowserWindow: BW } = await import("electron");
		const callWin = new BW({
			width: 1024,
			height: 768,
			fullscreen: true,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true
			}
		});
		callWin.loadURL(targetUrl);
		callWin.webContents.on("will-navigate", (event, url) => {
			if (url.startsWith("cobien://call-ended")) {
				event.preventDefault();
				callWin.hide();
				callWin.close();
			}
		});
		callWin.webContents.on("did-start-navigation", (event, url) => {
			if (url.startsWith("cobien://call-ended")) {
				event.preventDefault();
				callWin.hide();
				callWin.close();
			}
		});
		callWin.webContents.on("will-frame-navigate", (event) => {
			if (event.url.startsWith("cobien://call-ended")) {
				event.preventDefault();
				callWin.hide();
				callWin.close();
			}
		});
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
		const data = JSON.parse(await promises.readFile(configPath, "utf-8"));
		const defaultLocation = process.env.COBIEN_DEVICE_LOCATION || data.settings?.device_location || "Bilbao";
		const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
		const location = payload.location || defaultLocation;
		return await addPersonalEvent({
			...payload,
			location,
			deviceId
		});
	});
	ipcMain.handle("events:updatePersonal", async (_, payload) => {
		return await updatePersonalEvent(payload);
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
			deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX",
			contactsPath: join(app.getPath("userData"), "contacts/list_contacts.txt"),
			defaultLanguage: process.env.COBIEN_APP_LANGUAGE || "en"
		};
	});
	ipcMain.handle("app:restart", () => {
		console.log("[Main] Restarting application via window reload...");
		if (process.env.VITE_DEV_SERVER_URL) {
			if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		} else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadFile(join(_dirname, "../dist/index.html"));
		else {
			app.relaunch();
			app.exit(0);
		}
	});
	ipcMain.handle("app:exit", () => {
		app.quit();
	});
	ipcMain.handle("app:uninstall", async () => {
		const scriptPath = join(os.homedir(), "cobien/cobien-furniture-app-launcher/uninstall-cobien-furniture-environment.sh");
		console.log(`[Uninstall] Target script path: ${scriptPath}`);
		return new Promise((resolve, reject) => {
			const cmd = `echo "cobien" | sudo -S COBIEN_NON_INTERACTIVE=1 COBIEN_AUTO_CONFIRM=1 COBIEN_AUTO_REBOOT_AFTER_UNINSTALL=1 bash "${scriptPath}"`;
			console.log(`[Uninstall] Running command: ${cmd}`);
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
					console.error(`[Uninstall] Script error:`, error);
					console.error(`[Uninstall] Script stderr:`, stderr);
					reject(error);
				} else {
					console.log(`[Uninstall] Script stdout:`, stdout);
					resolve(true);
				}
			});
		});
	});
	let currentTtsProcess = null;
	ipcMain.handle("tts:stop", () => {
		if (currentTtsProcess) {
			try {
				currentTtsProcess.kill();
			} catch (e) {}
			currentTtsProcess = null;
		}
	});
	ipcMain.handle("tts:speak", async (event, text, lang = "es", gender = "male", engine = "piper") => {
		console.log(`[TTS] Speaking (${lang}/${gender}) via ${engine}: "${text}"`);
		if (currentTtsProcess) {
			try {
				currentTtsProcess.kill();
			} catch (e) {}
			currentTtsProcess = null;
		}
		const tempWav = join(os.tmpdir(), `tts_${Date.now()}.wav`);
		const { bin, model } = getPiperConfig(lang, gender);
		console.log(`[TTS] Piper Config: bin=${bin}, model=${model}`);
		if (!model) {
			console.error("TTS: No Piper model configured.");
			return null;
		}
		return new Promise((resolve) => {
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
	ipcMain.handle("hardware:adjustVolume", async (_, value, isAbsolute = false) => {
		return await adjustVolume(value, isAbsolute);
	});
	ipcMain.handle("hardware:adjustBrightness", async (_, value) => {
		return await adjustBrightness(value);
	});
	ipcMain.handle("hardware:getVolume", async () => {
		return await getVolume();
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
		mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
			if (process.env.VITE_DEV_SERVER_URL && validatedURL.startsWith(process.env.VITE_DEV_SERVER_URL)) {
				console.log(`[Main] Failed to load dev URL (error: ${errorDescription}). Retrying in 1s...`);
				setTimeout(() => {
					if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
				}, 1e3);
			}
		});
	} else mainWindow.loadFile(join(_dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
	session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
		if ([
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(permission)) callback(true);
		else callback(false);
	});
	session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
		return [
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(permission);
	});
	protocol.handle("cobien-media", (request) => {
		const url = request.url.replace("cobien-media://", "");
		return net.fetch("file://" + url);
	});
	setupIPC();
	const data = JSON.parse(fsSync.readFileSync(configPath, "utf-8"));
	const localConfigPath = join(app.getPath("userData"), "config.local.json");
	let localData = {};
	try {
		if (fsSync.existsSync(localConfigPath)) localData = JSON.parse(fsSync.readFileSync(localConfigPath, "utf-8"));
	} catch (e) {}
	const services = {
		...data.services,
		...localData.services
	};
	const settings = {
		...data.settings,
		...localData.settings
	};
	const baseUrl = (services.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
	const apiKey = process.env.COBIEN_NOTIFY_API_KEY || services.notify_api_key || "";
	const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id;
	if (!deviceId) {
		console.error("ERROR: COBIEN_DEVICE_ID not set. Exiting.");
		process.exit(1);
	}
	syncContacts(deviceId, apiKey, baseUrl).catch(console.error);
	const pollIntervalSec = parseInt(process.env.COBIEN_DEVICE_POLL_INTERVAL_SEC || "300", 10);
	if (pollIntervalSec > 0) setInterval(() => {
		console.log("[CONTACTS] Periodic sync started");
		syncContacts(deviceId, apiKey, baseUrl).then(() => {
			if (mainWindow) mainWindow.webContents.send("contacts:updated");
		}).catch(console.error);
	}, pollIntervalSec * 1e3);
	createWindow();
	loadPendingReminders((reminder) => {
		if (mainWindow) mainWindow.webContents.send("reminder:fire", reminder);
	});
	if (mainWindow) {
		const localPath = join(app.getPath("userData"), "config.local.json");
		startBackendSync(mainWindow, configPath, localPath);
		startMqtt(mainWindow);
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
