import e from "dotenv";
import { BrowserWindow as t, app as n, ipcMain as r, net as i, protocol as a, session as o } from "electron";
import { dirname as s, join as c } from "node:path";
import { fileURLToPath as l } from "node:url";
import { exec as u, execFile as d } from "node:child_process";
import * as f from "node:fs";
import { createWriteStream as p, promises as m } from "node:fs";
import * as h from "node:os";
import { MongoClient as ee, ObjectId as g } from "mongodb";
import _ from "mqtt";
import { promisify as v } from "node:util";
//#region electron/services/backendSync.ts
var y = "home";
async function te(e, t, n) {
	r.handle("app:route-changed", (e, t) => {
		y = t;
	}), setInterval(() => x(t, n), 6e4), setInterval(() => S(e, t, n), 5e3), x(t, n), S(e, t, n);
}
async function b(e, t) {
	try {
		let n = JSON.parse(await m.readFile(e, "utf-8")), r = {};
		try {
			r = JSON.parse(await m.readFile(t, "utf-8"));
		} catch {}
		return {
			...n.services,
			...r.services
		};
	} catch {
		return {};
	}
}
async function x(e, t) {
	let n = await b(e, t), r = n.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/", i = process.env.NOTIFY_API_KEY || n.notify_api_key || "";
	try {
		let e = await fetch(r, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": i
			},
			body: JSON.stringify({
				device_id: process.env.COBIEN_DEVICE_ID || "CoBien6",
				screen: y,
				sent_at: (/* @__PURE__ */ new Date()).toISOString(),
				software_version: "Electron-v1.0"
			})
		});
		e.ok ? console.log(`[HEARTBEAT] Sent (Screen: ${y})`) : console.warn(`[HEARTBEAT] Failed with status: ${e.status}`);
	} catch {
		console.error("[HEARTBEAT] Network error");
	}
}
async function S(e, t, n) {
	let r = await b(t, n), i = r.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/", a = process.env.NOTIFY_API_KEY || r.notify_api_key || "";
	try {
		let t = process.env.COBIEN_DEVICE_ID || "CoBien6", n = await fetch(`${i}?device_id=${t}`, {
			method: "GET",
			headers: { "X-API-KEY": a }
		});
		if (n.ok) {
			let t = (await n.json()).notifications || [];
			t.length > 0 && (console.log(`[POLL] Received ${t.length} notifications`), t.forEach((t) => {
				e.webContents.send("backend:notification", t);
			}));
		}
	} catch {}
}
//#endregion
//#region electron/services/eventsMongo.ts
var C = null;
async function w() {
	if (C) return C;
	let e = process.env.MONGO_URI || "";
	if (!e) throw Error("MONGO_URI is missing");
	return C = new ee(e), await C.connect(), C;
}
async function ne(e) {
	try {
		let t = JSON.parse(await m.readFile(e, "utf-8")), n = process.env.COBIEN_DEVICE_ID || t.settings?.device_id || "CoBien6", r = (await w()).db("LabasAppDB"), i = r.collection("eventos"), a = await r.collection("devices").findOne({ device_id: n }) || {}, o = String(a.event_visibility_scope || "all").trim().toLowerCase(), s = [], c = a.event_regions || [];
		typeof c == "string" ? s = c.split(/\r?\n/).map((e) => e.trim().toLowerCase()).filter(Boolean) : Array.isArray(c) && (s = c.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
		let l = process.env.COBIEN_DEVICE_LOCATION || a.location || t.settings?.device_location || "Bilbao", u = { $or: [{ $or: [
			{ audience: "all" },
			{ audience: { $exists: !1 } },
			{ audience: null }
		] }, {
			audience: "device",
			$or: [{ target_device: n }, { target_devices: n }]
		}] }, d = await i.find(u).toArray(), f = l.trim().toLowerCase();
		return d.map((e) => {
			let t = e.audience || "all";
			t = typeof t == "string" && t.toLowerCase() === "device" ? "device" : "public";
			let n = t === "device" ? "#FF3B30" : "#1E90FF";
			e.color && (n = e.color);
			let r = (e.location || "").trim();
			if (t === "public" && r) {
				let e = r.toLowerCase(), t = !1;
				if (t = e === f ? !0 : o === "region" ? (s.length > 0 ? s : f ? [f] : []).includes(e) : !0, !t) return null;
			}
			let i = e.date || e.fecha_inicio || "";
			if (i instanceof Date) {
				let e = i;
				i = `${e.getDate().toString().padStart(2, "0")}-${(e.getMonth() + 1).toString().padStart(2, "0")}-${e.getFullYear()}`;
			}
			return {
				id: e._id.toString(),
				date: i,
				title: e.title || e.titulo || "Sin título",
				description: e.description || e.descripcion || "Sin descripción",
				location: r || l,
				audience: t,
				color: n,
				target_device: e.target_device || "",
				created_by: e.created_by || "",
				all_day: e.all_day !== !1,
				start_time: e.start_time || "",
				end_time: e.end_time || ""
			};
		}).filter((e) => e !== null);
	} catch (e) {
		return console.error("[EVENTS] Error fetching from MongoDB:", e), [];
	}
}
async function re(e) {
	try {
		let t = (await w()).db("LabasAppDB").collection("eventos"), [n, r, i] = e.date.split("-").map(Number), a = new Date(i, r - 1, n);
		if (isNaN(a.getTime())) return console.error("[EVENTS] Invalid date provided:", e.date), !1;
		let o = {
			_id: new g(),
			title: e.title,
			description: e.description,
			date: e.date,
			fecha_inicio: a,
			audience: "device",
			target_device: e.deviceId,
			target_devices: [e.deviceId],
			location: e.location,
			all_day: !0,
			created_by: e.deviceId,
			created_at: /* @__PURE__ */ new Date()
		};
		return await t.insertOne(o), console.log(`[EVENTS] Personal event added: ${e.title} on ${e.date}`), !0;
	} catch (e) {
		return console.error("[EVENTS] Error adding personal event:", e.message || e), e.stack && console.error(e.stack), !1;
	}
}
async function ie(e) {
	try {
		let t = await (await w()).db("LabasAppDB").collection("eventos").updateOne({ _id: new g(e.id) }, { $set: {
			title: e.title,
			description: e.description,
			location: e.location
		} });
		return console.log(`[EVENTS] Personal event updated: ${e.id}`), t.modifiedCount > 0;
	} catch (e) {
		return console.error("[EVENTS] Error updating personal event:", e.message || e), e.stack && console.error(e.stack), !1;
	}
}
async function ae(e) {
	try {
		return (await (await w()).db("LabasAppDB").collection("eventos").deleteOne({ _id: new g(e) })).deletedCount > 0;
	} catch (e) {
		return console.error("[EVENTS] Error deleting event:", e), !1;
	}
}
//#endregion
//#region electron/services/boardService.ts
var oe = "board_cache";
async function se() {
	let e = c(n.getPath("userData"), oe);
	try {
		await m.access(e);
	} catch {
		await m.mkdir(e, { recursive: !0 });
	}
	return e;
}
async function ce(e, t, n) {
	if (!e) return "";
	try {
		let r = await se(), i = ".png";
		(e.includes(".jpg") || e.includes(".jpeg")) && (i = ".jpg");
		let a = c(r, `${t}_${n}${i}`);
		try {
			return await m.access(a), `cobien-media://${a}`;
		} catch {}
		let o = {};
		process.env.COBIEN_NOTIFY_API_KEY && (o["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
		let s = await fetch(e, { headers: o });
		if (!s.ok) throw Error(`Failed to fetch image: ${s.statusText}`);
		if (p(a), s.body) {
			let e = await s.arrayBuffer(), t = Buffer.from(e);
			return await m.writeFile(a, t), `cobien-media://${a}`;
		}
		return "";
	} catch (t) {
		return console.error(`[BOARD] Failed to cache image ${e}:`, t), "";
	}
}
async function le() {
	let e = process.env.COBIEN_DEVICE_ID || "CoBien6", t = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/?recipient=${e}`, n = {};
	process.env.COBIEN_NOTIFY_API_KEY && (n["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		let e = await fetch(t, { headers: n });
		if (!e.ok) throw Error(`API returned ${e.statusText}`);
		let r = (await e.json()).messages || [];
		return await Promise.all(r.map(async (e) => {
			let t = "", n = "";
			return (e.image || e.image_url) && (t = await ce(e.image || e.image_url, "img", e.id)), e.author_avatar_url && (n = await ce(e.author_avatar_url, "avatar", e.id)), {
				id: e.id,
				author: e.author_name || e.author || "—",
				author_avatar: n,
				text: e.text || "",
				image: t,
				created_at_human: e.created_at_human || "",
				read_by: (e.read_by || []).map((e) => e.device_id),
				quick_replies: e.quick_replies || [],
				quick_reply_selected: e.quick_reply_selected || null
			};
		}));
	} catch (e) {
		return console.error("[BOARD] Failed to fetch messages:", e), [];
	}
}
async function ue(e) {
	let t = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${e}/delete/`, n = {};
	process.env.COBIEN_NOTIFY_API_KEY && (n["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		return (await fetch(t, {
			method: "POST",
			headers: n
		})).ok;
	} catch (e) {
		return console.error("[BOARD] Failed to delete message:", e), !1;
	}
}
async function de(e) {
	let t = process.env.COBIEN_DEVICE_ID || "CoBien6", n = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${e}/read/`, r = { "Content-Type": "application/json" };
	process.env.COBIEN_NOTIFY_API_KEY && (r["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		return (await fetch(n, {
			method: "POST",
			headers: r,
			body: JSON.stringify({ device_id: t })
		})).ok;
	} catch (e) {
		return console.error("[BOARD] Failed to mark message read:", e), !1;
	}
}
async function fe(e, t) {
	let n = process.env.COBIEN_DEVICE_ID || "CoBien6", r = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${e}/reply/`, i = { "Content-Type": "application/json" };
	process.env.COBIEN_NOTIFY_API_KEY && (i["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		return (await fetch(r, {
			method: "POST",
			headers: i,
			body: JSON.stringify({
				device_id: n,
				reply_text: t
			})
		})).ok;
	} catch (e) {
		return console.error("[BOARD] Failed to submit reply:", e), !1;
	}
}
//#endregion
//#region electron/services/weatherService.ts
var pe = {
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
}, me = {
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
function T(e, t = !0) {
	return !t && e <= 1 ? "/svg/noche.svg" : pe[e] ?? "/svg/nubes.svg";
}
function E(e, t = "es") {
	return (me[t] || me.es)[e] ?? (t === "en" ? "Unknown condition" : t === "fr" ? "Condition inconnue" : "Condición desconocida");
}
function he(e) {
	let t = new Date(e).getHours(), n = t < 12 ? "a.m." : "p.m.";
	return `${t % 12 || 12} ${n}`;
}
async function ge(e) {
	try {
		let t = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e)}`, n = await (await fetch(t, { headers: { "User-Agent": "CoBien6-Furniture" } })).json();
		if (!n.length) return null;
		let r = parseFloat(n[0].lat), i = parseFloat(n[0].lon);
		return {
			lat: r,
			lon: i,
			tz: (await (await fetch(`https://api.open-meteo.com/v1/timezone?latitude=${r}&longitude=${i}`)).json()).timezone ?? "Europe/Madrid"
		};
	} catch (e) {
		return console.error("[WEATHER] Geocode error:", e), null;
	}
}
async function _e(e, t = "es") {
	let n = {
		city: e,
		temp: "—°",
		description: t === "en" ? "Not available" : t === "fr" ? "Non disponible" : "No disponible",
		icon: "/svg/nubes.svg",
		tempMin: "Min —°",
		tempMax: "Max —°",
		todayPop: 0,
		todayWind: 0,
		hourly: [],
		daily: []
	};
	try {
		let r = await ge(e);
		if (!r) return n.error = "Ciudad no encontrada", n;
		let { lat: i, lon: a, tz: o } = r, s = [
			`https://api.open-meteo.com/v1/forecast?latitude=${i}&longitude=${a}`,
			`&timezone=${encodeURIComponent(o)}`,
			"&current=temperature_2m,weathercode,is_day",
			"&hourly=temperature_2m,weathercode",
			"&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,wind_speed_10m_max",
			"&forecast_days=7"
		].join(""), c = await (await fetch(s)).json(), l = c.current?.weathercode ?? 0, u = (c.current?.is_day ?? 1) === 1;
		n.temp = `${Math.round(c.current?.temperature_2m ?? 0)}°`, n.icon = T(l, u);
		let d = process.env.OWM_API_KEY ?? "";
		if (d) try {
			let e = `https://api.openweathermap.org/data/2.5/weather?lat=${i}&lon=${a}&appid=${d}&units=metric&lang=${t}`;
			n.description = (await (await fetch(e)).json()).weather?.[0]?.description ?? E(l, t), n.description = n.description.charAt(0).toUpperCase() + n.description.slice(1);
		} catch {
			n.description = E(l, t);
		}
		else n.description = E(l, t);
		let f = Math.round(c.daily?.temperature_2m_min?.[0] ?? 0), p = Math.round(c.daily?.temperature_2m_max?.[0] ?? 0);
		n.tempMin = `Min ${f}°`, n.tempMax = `Max ${p}°`, n.todayPop = c.daily?.precipitation_probability_max?.[0] ?? 0, n.todayWind = Math.round(c.daily?.wind_speed_10m_max?.[0] ?? 0);
		let m = (/* @__PURE__ */ new Date()).getHours(), h = c.hourly?.time ?? [], ee = c.hourly?.temperature_2m ?? [], g = c.hourly?.weathercode ?? [], _ = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), v = h.findIndex((e) => e.startsWith(_) && new Date(e).getHours() >= m);
		v < 0 && (v = 0), n.hourly = h.slice(v, v + 12).map((e, t) => {
			let n = new Date(e).getHours();
			return {
				time: he(e),
				icon: T(g[v + t] ?? 0, n >= 6 && n < 20),
				temp: `${Math.round(ee[v + t] ?? 0)}°`
			};
		});
		let y = c.daily?.time ?? [], te = c.daily?.temperature_2m_max ?? [], b = c.daily?.temperature_2m_min ?? [], x = c.daily?.weathercode ?? [], S = c.daily?.precipitation_probability_max ?? [], C = c.daily?.wind_speed_10m_max ?? [];
		return n.daily = y.slice(1, 7).map((e, n) => {
			let r = new Date(e), i = r.getDate(), a = t === "en" ? "en-US" : t === "fr" ? "fr-FR" : "es-ES", o = r.toLocaleDateString(a, { month: "long" }), s = r.toLocaleDateString(a, { weekday: "long" });
			return {
				name: s.charAt(0).toUpperCase() + s.slice(1),
				date: t === "en" ? `${o} ${i}` : `${i} de ${o}`,
				icon: T(x[n + 1] ?? 0),
				tmin: `${Math.round(b[n + 1] ?? 0)}°`,
				tmax: `${Math.round(te[n + 1] ?? 0)}°`,
				pop: S[n + 1] ?? 0,
				wind: Math.round(C[n + 1] ?? 0)
			};
		}), n;
	} catch (e) {
		return console.error("[WEATHER] fetchWeatherBundle error:", e), n.error = String(e), n;
	}
}
//#endregion
//#region electron/services/jokesService.ts
var ve = c(typeof __dirname < "u" ? __dirname : s(l(import.meta.url)), "../public/data/jokes"), D = [], O = "";
async function ye(e = "es") {
	try {
		let t = e === "fr" ? "jokes_fr.json" : e === "en" ? "jokes_en.json" : "jokes_es.json", n = await m.readFile(c(ve, t), "utf-8"), r = JSON.parse(n), i = [];
		for (let e of Object.values(r)) if (Array.isArray(e)) {
			for (let t of e) if (typeof t == "string" && t.trim()) i.push(t.trim());
			else if (typeof t == "object" && t) {
				let e = t;
				e.text ? i.push(String(e.text).trim()) : e.setup && e.punchline && i.push(`${e.setup.trim()} — ${e.punchline.trim()}`);
			}
		}
		return i.filter(Boolean);
	} catch (t) {
		return console.error("[JOKES] Error loading jokes:", t), e === "en" ? [
			"Why don't scientists trust atoms? Because they make up everything!",
			"What do you call a fake noodle? An Impasta.",
			"Why did the scarecrow win an award? Because he was outstanding in his field."
		] : [
			"¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.",
			"¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.",
			"¿Cuál es el colmo de un electricista? Que su mujer se llame Luz."
		];
	}
}
async function be(e = "es") {
	if (D.length === 0 && (D = await ye(e)), D.length === 0) return e === "en" ? "No jokes available." : e === "fr" ? "Aucune blague disponible." : "No hay chistes disponibles.";
	let t = D.length > 1 ? D.filter((e) => e !== O) : D, n = t[Math.floor(Math.random() * t.length)];
	return O = n, n;
}
//#endregion
//#region electron/services/contactsService.ts
var xe = typeof __dirname < "u" ? __dirname : s(l(import.meta.url)), k = c(n.getPath("userData"), "contacts"), A = c(k, "list_contacts.txt"), Se = c(xe, "../public/images/default_user.png");
function j(e) {
	return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function Ce(e) {
	let t = j(e);
	for (let e of [
		".png",
		".jpg",
		".jpeg",
		".PNG",
		".JPG",
		".JPEG"
	]) {
		let n = c(k, t + e);
		if (f.existsSync(n)) return n;
	}
	return Se;
}
async function we() {
	let e = [];
	try {
		let t = await m.readFile(A, "utf-8");
		for (let n of t.split("\n")) {
			if (!n.includes("=")) continue;
			let [t, r] = n.split("=", 2).map((e) => e.trim());
			if (!t) continue;
			let i = /^[A-Za-z0-9_.-]+$/.test(r ?? ""), a = Ce(t);
			e.push({
				displayName: t,
				userName: r ?? "",
				imagePath: a,
				callable: i
			});
		}
	} catch (e) {
		console.error("[CONTACTS] Error loading contacts:", e);
	}
	return e;
}
async function Te(e, t, n) {
	try {
		let r = await fetch(e, {
			headers: { "X-Api-Key": n },
			signal: AbortSignal.timeout(15e3)
		});
		if (!r.ok) return null;
		let i = r.headers.get("Content-Type") || "", a = ".jpg";
		i.includes("png") ? a = ".png" : i.includes("webp") ? a = ".webp" : i.includes("gif") && (a = ".gif");
		let o = t + a, s = c(k, o), l = await r.arrayBuffer();
		return await m.writeFile(s, Buffer.from(l)), o;
	} catch (t) {
		return console.error(`[CONTACTS] Failed to download image ${e}:`, t), null;
	}
}
async function M(e, t, n) {
	try {
		f.existsSync(k) || f.mkdirSync(k, { recursive: !0 });
		let r = `${N(n, "/")}/pizarra/api/contacts/?device_id=${e}`, i = await fetch(r, {
			headers: { "X-Api-Key": t },
			signal: AbortSignal.timeout(1e4)
		});
		if (!i.ok) throw Error(`API returned ${i.status}`);
		let a = await i.json(), o = Array.isArray(a) ? a : a.contacts || [], s = [], c = 0;
		for (let e of o) {
			let r = (e.display_name || e.name || "").trim(), i = (e.user_name || e.username || "").trim(), a = (e.image_url || e.image || "").trim();
			if (!(!r || !i) && (s.push({
				display: r,
				user: i
			}), a)) {
				let e = a;
				a.startsWith("/") && (e = N(n, "/") + "/" + Ee(a, "/")), await Te(e, j(r), t) && c++;
			}
		}
		let l = s.map((e) => `${e.display}=${e.user}`).join("\n") + "\n";
		return await m.writeFile(A, l), console.log(`[CONTACTS] Sync complete. ${s.length} contacts, ${c} images.`), {
			count: s.length,
			images: c
		};
	} catch (e) {
		return console.error("[CONTACTS] Sync failed:", e), {
			count: 0,
			images: 0
		};
	}
}
function N(e, t) {
	let n = e;
	for (; n.endsWith(t);) n = n.slice(0, -t.length);
	return n;
}
function Ee(e, t) {
	let n = e;
	for (; n.startsWith(t);) n = n.slice(t.length);
	return n;
}
async function De(e, t, n, r) {
	if (!e || !/^[A-Za-z0-9_.-]+$/.test(e)) return {
		ok: !1,
		code: "VC-USER",
		detail: "Nombre de usuario inválido"
	};
	if (!n) return {
		ok: !1,
		code: "VC-CONFIG",
		detail: "API key no configurada"
	};
	if (!t) return {
		ok: !1,
		code: "VC-DEVICE",
		detail: "Device ID no configurado"
	};
	try {
		let i = `${N(r, "/")}/pizarra/api/notify/`, a = await fetch(i, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Api-Key": n
			},
			body: JSON.stringify({
				to_user: e,
				from_device: t,
				kind: "call_ready",
				message: "",
				ttl_hours: 12
			}),
			signal: AbortSignal.timeout(1e4)
		});
		return a.ok ? { ok: !0 } : {
			ok: !1,
			code: `VC-${a.status}`,
			detail: await a.text()
		};
	} catch (e) {
		return e?.name === "TimeoutError" ? {
			ok: !1,
			code: "VC-TIMEOUT",
			detail: "Tiempo de espera agotado"
		} : e?.code === "ECONNREFUSED" ? {
			ok: !1,
			code: "VC-NET",
			detail: "No hay conexión"
		} : {
			ok: !1,
			code: "VC-UNK",
			detail: String(e)
		};
	}
}
//#endregion
//#region electron/services/remindersService.ts
var P = null, F = /* @__PURE__ */ new Map(), I = null;
function L() {
	return P ||= c(n.getPath("userData"), "reminders.json"), P;
}
async function R() {
	try {
		let e = await m.readFile(L(), "utf-8");
		return JSON.parse(e);
	} catch {
		return [];
	}
}
async function z(e) {
	await m.writeFile(L(), JSON.stringify(e, null, 2), "utf-8");
}
function B(e) {
	let t = new Date(e.datetime).getTime() - Date.now();
	if (t <= 0) return;
	let n = setTimeout(async () => {
		F.delete(e.id), I?.(e), await z((await R()).filter((t) => t.id !== e.id));
	}, t);
	F.set(e.id, n);
}
async function Oe(e) {
	I = e;
	let t = await R(), n = /* @__PURE__ */ new Date(), r = [];
	for (let e of t) new Date(e.datetime) > n && (B(e), r.push(e));
	await z(r), console.log(`[REMINDERS] ${r.length} reminders scheduled`);
}
async function ke(e, t) {
	let n = {
		id: `rem_${Date.now()}`,
		message: e,
		datetime: t
	}, r = await R();
	return r.push(n), await z(r), B(n), n;
}
async function Ae() {
	let e = await R(), t = /* @__PURE__ */ new Date();
	return e.filter((e) => new Date(e.datetime) > t);
}
async function je(e) {
	let t = await R(), n = t.filter((t) => t.id !== e);
	if (n.length === t.length) return !1;
	await z(n);
	let r = F.get(e);
	return r && (clearTimeout(r), F.delete(e)), !0;
}
//#endregion
//#region electron/services/mqttService.ts
var V = "rfid/read", H = "sensors/update", U = "app/nav", Me = "events/reload", Ne = "board/reload", Pe = "weather/reload", Fe = [
	V,
	H,
	U,
	Me,
	Ne,
	Pe
], Ie = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
}, W = {}, Le = 5e3, Re = null, ze = 0, G = null, K = null;
function q(e) {
	!K || K.isDestroyed() || K.webContents.send("mqtt:event", e);
}
function Be(e) {
	let t;
	try {
		t = e?.data?.id === void 0 ? parseInt(e.id ?? 0) : parseInt(e.data.id);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Date.now();
	if (t === Re && n - ze < Le) {
		console.log(`[MQTT] RFID debounce ignored: ${t}`);
		return;
	}
	Re = t, ze = n, console.log(`[MQTT] RFID card: ${t}`);
	let r = W[t];
	q(r ? {
		topic: U,
		type: "nav",
		source: "rfid",
		...r
	} : {
		topic: V,
		type: "rfid",
		cardId: t
	});
}
function Ve(e) {
	let t;
	try {
		t = e?.data?.PIC === void 0 ? parseInt(e.PIC ?? 0) : parseInt(e.data.PIC);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Ie[t];
	n ? (console.log(`[MQTT] Button PIC=${t} → ${n.target}`), q({
		topic: H,
		type: "nav",
		target: n.target,
		source: n.source
	})) : console.warn(`[MQTT] Unknown button PIC: ${t}`);
}
function He(e) {
	q({
		topic: U,
		...e
	});
}
async function J() {
	let { promises: e } = await import("node:fs"), { join: t, dirname: n } = await import("node:path"), { app: r } = await import("electron"), i = t(r.getPath("userData"), "config.local.json");
	try {
		let t = JSON.parse(await e.readFile(i, "utf-8")).settings?.rfid_actions || {}, n = {};
		for (let [e, r] of Object.entries(t)) {
			let t = parseInt(e);
			if (isNaN(t)) continue;
			let i = r, a = i?.action || "day_events", o = i?.extra || "";
			a === "weather" ? n[t] = {
				target: "weather",
				extra: { name: o }
			} : a === "videocall" ? n[t] = {
				target: "videocall",
				extra: { to_user: o }
			} : n[t] = { target: "day_events" };
		}
		W = n, console.log(`[MQTT] Loaded ${Object.keys(W).length} RFID actions`);
	} catch (e) {
		console.error("[MQTT] Failed to load RFID config:", e);
	}
}
function Ue(e) {
	K = e, J();
	let t = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${t}`), G = _.connect(t, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: !0
	}), G.on("connect", () => {
		console.log("[MQTT] Connected");
		for (let e of Fe) G.subscribe(e, { qos: 0 }, (t) => {
			t ? console.error(`[MQTT] Subscribe error on ${e}:`, t) : console.log(`[MQTT] Subscribed: ${e}`);
		});
		q({
			topic: "mqtt/status",
			type: "status",
			connected: !0
		});
	}), G.on("message", (e, t) => {
		let n = {};
		try {
			n = JSON.parse(t.toString());
		} catch {
			n = {};
		}
		switch (e) {
			case V:
				Be(n);
				break;
			case H:
				Ve(n);
				break;
			case U:
				He(n);
				break;
			case Me:
				q({
					topic: e,
					type: "reload",
					target: "events"
				});
				break;
			case Ne:
				q({
					topic: e,
					type: "reload",
					target: "board"
				});
				break;
			case Pe:
				q({
					topic: e,
					type: "reload",
					target: "weather"
				});
				break;
			case "rfid/actions_reload":
				J();
				break;
			default: console.log(`[MQTT] Unhandled topic: ${e}`);
		}
	}), G.on("error", (e) => {
		console.warn("[MQTT] Error:", e.message), q({
			topic: "mqtt/status",
			type: "status",
			connected: !1,
			error: e.message
		});
	}), G.on("offline", () => {
		console.warn("[MQTT] Offline — will retry"), q({
			topic: "mqtt/status",
			type: "status",
			connected: !1
		});
	}), G.on("reconnect", () => {
		console.log("[MQTT] Reconnecting...");
	});
}
function We() {
	G && (G.end(!0), G = null, console.log("[MQTT] Disconnected"));
}
//#endregion
//#region electron/services/hardwareService.ts
var Y = v(u);
async function Ge(e, t = !1) {
	try {
		return t ? await Y(`pactl set-sink-volume @DEFAULT_SINK@ ${e}%`) : await Y(`pactl set-sink-volume @DEFAULT_SINK@ ${`${e >= 0 ? "+" : ""}${e}%`}`), !0;
	} catch (e) {
		return console.error("Failed to adjust volume:", e), !1;
	}
}
async function Ke() {
	try {
		let { stdout: e } = await Y("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(e.trim()) || 0;
	} catch (e) {
		return console.error("Failed to get volume:", e), 50;
	}
}
async function qe(e) {
	try {
		let { stdout: t } = await Y("xrandr --query | grep ' connected' | cut -d' ' -f1"), n = t.trim().split("\n");
		if (n.length === 0) return !1;
		for (let t of n) {
			let n = .4;
			if (e !== void 0) n = e;
			else {
				let { stdout: e } = await Y(`xrandr --verbose --output ${t} | grep -i brightness`), r = parseFloat(e.split(":")[1].trim());
				n = r < .6 ? .7 : r < .9 ? 1 : .4;
			}
			await Y(`xrandr --output ${t} --brightness ${n.toFixed(2)}`);
		}
		return !0;
	} catch (e) {
		return console.error("Failed to adjust brightness:", e), !1;
	}
}
//#endregion
//#region electron/main.ts
e.config();
var X = typeof __dirname < "u" ? __dirname : s(l(import.meta.url)), Z = null, Q = c(X, "../config/config.default.json");
function Je(e = "es", t = "male") {
	try {
		let r = c(X, "../config/config.default.json"), i = c(n.getPath("userData"), "config.local.json"), a = JSON.parse(f.readFileSync(r, "utf-8")), o = {};
		try {
			o = JSON.parse(f.readFileSync(i, "utf-8"));
		} catch {}
		let s = {
			...a.services,
			...o.services
		}, l = c(X, "../public/models/piper/bin/piper"), u = c(X, "../public/models/piper/es_ES-davefx-medium.onnx"), d = s.tts_piper_bin || l, p = s[`tts_piper_model_${e}_${t}`] || s[`tts_piper_model_${e}`], m = "";
		if (p) if (p.startsWith("/") || p.includes(":") || p.startsWith("http")) m = p;
		else {
			let e = c(X, "../public/models/piper", p);
			m = (f.existsSync(e), e);
		}
		else m = e === "fr" ? c(X, "../public/models/piper/fr_FR-siwis-medium.onnx") : e === "en" ? c(X, "../public/models/piper/en_US-amy-medium.onnx") : u;
		return {
			bin: d,
			model: m
		};
	} catch (e) {
		return console.error("Error reading piper config:", e), {
			bin: c(X, "../public/models/piper/bin/piper"),
			model: c(X, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
function Ye() {
	r.handle("config:getWeather", async () => {
		try {
			let e = JSON.parse(await m.readFile(Q, "utf-8"));
			return {
				catalog: e.settings.weather_city_catalog || [],
				active: e.settings.weather_cities || [],
				primary: e.settings.weather_primary_city || ""
			};
		} catch (e) {
			return console.error("Error reading config:", e), {
				catalog: [],
				active: [],
				primary: ""
			};
		}
	}), r.handle("config:getSettings", async () => {
		try {
			return JSON.parse(await m.readFile(Q, "utf-8")).settings || {};
		} catch {
			return {};
		}
	}), r.handle("config:saveWeather", async (e, t) => {
		try {
			let e = JSON.parse(await m.readFile(Q, "utf-8"));
			return e.settings.weather_city_catalog = t.catalog, e.settings.weather_cities = t.active, e.settings.weather_primary_city = t.primary, await m.writeFile(Q, JSON.stringify(e, null, 4)), !0;
		} catch (e) {
			return console.error("Error saving config:", e), !1;
		}
	}), r.handle("events:get", async () => await ne(Q)), r.handle("weather:fetch", async (e, t, n = "es") => await _e(t, n)), r.handle("jokes:getRandom", async (e, t = "es") => await be(t)), r.handle("contacts:list", async () => await we()), r.handle("contacts:sync", async () => {
		let e = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await M(process.env.COBIEN_DEVICE_ID || "CoBien6", e, (JSON.parse(await m.readFile(Q, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), r.handle("contacts:requestCall", async (e, t) => {
		let n = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await De(t, process.env.COBIEN_DEVICE_ID || "CoBien6", n, (JSON.parse(await m.readFile(Q, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), r.handle("contacts:openCall", async (e, t) => {
		let n = process.env.COBIEN_DEVICE_ID || "CoBien6", r = process.env.COBIEN_VIDEOCALL_DEVICE_API_KEY || "", i = process.env.COBIEN_DEVICE_VIDEOCALL_SESSION_URL || "https://portal.co-bien.eu/api/device-videocall-session/", a = process.env.COBIEN_PORTAL_VIDEOCALL_DEVICE_URL || "https://portal.co-bien.eu/videocall/device/", o = process.env.COBIEN_PORTAL_CALL_ANSWERED_URL || "https://portal.co-bien.eu/api/call-answered/", s = `${process.env.COBIEN_PORTAL_VIDEOCALL_URL || "https://portal.co-bien.eu/videocall/"}?room=${encodeURIComponent(t)}&device=${encodeURIComponent(n)}`;
		if (r) try {
			console.log(`[VIDEOCALL] Fetching device session for room: ${t}, device: ${n}`);
			let e = await fetch(i, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-DEVICE-ID": n,
					"X-DEVICE-KEY": r
				},
				body: JSON.stringify({
					device_id: n,
					room: t
				}),
				signal: AbortSignal.timeout(8e3)
			});
			if (e.ok) {
				let { token: t, room_name: n, identity: r, call_answered_url: i } = await e.json();
				if (t) {
					let e = i || o;
					try {
						console.log(`[VIDEOCALL] Notifying call answered to: ${e}`), await fetch(e, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								room: n,
								device: r
							}),
							signal: AbortSignal.timeout(5e3)
						});
					} catch (e) {
						console.error("[VIDEOCALL] Failed to notify backend call answered:", e);
					}
					s = `${a}#token=${encodeURIComponent(t)}&room=${encodeURIComponent(n)}&identity=${encodeURIComponent(r)}`, console.log("[VIDEOCALL] Generated Twilio token URL successfully");
				}
			} else console.warn(`[VIDEOCALL] Device session request failed with status: ${e.status}`);
		} catch (e) {
			console.error("[VIDEOCALL] Error request session:", e);
		}
		let { BrowserWindow: c } = await import("electron"), l = new c({
			width: 1024,
			height: 768,
			fullscreen: !0,
			webPreferences: {
				nodeIntegration: !1,
				contextIsolation: !0
			}
		});
		return l.loadURL(s), l.webContents.on("will-navigate", (e, t) => {
			t.startsWith("cobien://call-ended") && (e.preventDefault(), l.close());
		}), l.webContents.on("did-start-navigation", (e, t) => {
			t.startsWith("cobien://call-ended") && (e.preventDefault(), l.close());
		}), !0;
	}), r.handle("reminders:add", async (e, t, n) => await ke(t, n)), r.handle("reminders:list", async () => await Ae()), r.handle("reminders:delete", async (e, t) => await je(t)), r.handle("events:addPersonal", async (e, t) => {
		let n = JSON.parse(await m.readFile(Q, "utf-8")), r = process.env.COBIEN_DEVICE_LOCATION || n.settings?.device_location || "Bilbao", i = process.env.COBIEN_DEVICE_ID || "CoBien6", a = t.location || r;
		return await re({
			...t,
			location: a,
			deviceId: i
		});
	}), r.handle("events:updatePersonal", async (e, t) => await ie(t)), r.handle("events:delete", async (e, t) => await ae(t)), r.handle("board:fetch", async () => await le()), r.handle("board:delete", async (e, t) => await ue(t)), r.handle("board:read", async (e, t) => await de(t)), r.handle("board:reply", async (e, t, n) => await fe(t, n)), r.handle("config:getSystemInfo", () => ({
		version: n.getVersion(),
		deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX",
		contactsPath: c(n.getPath("userData"), "contacts/list_contacts.txt"),
		defaultLanguage: process.env.COBIEN_APP_LANGUAGE || "en"
	})), r.handle("app:restart", () => {
		n.relaunch(), n.exit();
	}), r.handle("app:exit", () => {
		n.quit();
	});
	let e = null;
	r.handle("tts:stop", () => {
		if (e) {
			try {
				e.kill();
			} catch {}
			e = null;
		}
	}), r.handle("tts:speak", async (t, n, r = "es", i = "male", a = "piper") => {
		if (console.log(`[TTS] Speaking (${r}/${i}) via ${a}: "${n}"`), e) {
			try {
				e.kill();
			} catch {}
			e = null;
		}
		let o = c(h.tmpdir(), `tts_${Date.now()}.wav`), { bin: s, model: l } = Je(r, i);
		return console.log(`[TTS] Piper Config: bin=${s}, model=${l}`), l ? new Promise((e) => {
			let t = d(s, [
				"--model",
				l,
				"--output_file",
				o
			], async (t, n, r) => {
				if (t) {
					console.error("[TTS] Piper exec error:", t, r), e(null);
					return;
				}
				try {
					let t = await m.readFile(o);
					await m.unlink(o), console.log(`[TTS] Generated WAV: ${t.length} bytes`), e(t);
				} catch (t) {
					console.error("[TTS] Error reading temp wav:", t), e(null);
				}
			});
			t.stdin?.write(n), t.stdin?.end();
		}) : (console.error("TTS: No Piper model configured."), null);
	}), r.handle("hardware:adjustVolume", async (e, t, n = !1) => await Ge(t, n)), r.handle("hardware:adjustBrightness", async (e, t) => await qe(t)), r.handle("hardware:getVolume", async () => await Ke());
}
function $() {
	Z = new t({
		width: 1024,
		height: 768,
		fullscreen: !1,
		webPreferences: {
			preload: c(X, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), Z.setBackgroundColor("#ffffff"), process.env.VITE_DEV_SERVER_URL ? (Z.loadURL(process.env.VITE_DEV_SERVER_URL), Z.webContents.openDevTools()) : Z.loadFile(c(X, "../dist/index.html"));
}
n.whenReady().then(() => {
	o.defaultSession.setPermissionRequestHandler((e, t, n) => {
		[
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(t) ? n(!0) : n(!1);
	}), o.defaultSession.setPermissionCheckHandler((e, t, n) => [
		"media",
		"geolocation",
		"notifications",
		"midiSysex",
		"openExternal"
	].includes(t)), a.handle("cobien-media", (e) => {
		let t = e.url.replace("cobien-media://", "");
		return i.fetch("file://" + t);
	}), Ye();
	let e = (JSON.parse(f.readFileSync(Q, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), r = process.env.COBIEN_NOTIFY_API_KEY || "";
	if (M(process.env.COBIEN_DEVICE_ID || "CoBien6", r, e).catch(console.error), $(), Oe((e) => {
		Z && Z.webContents.send("reminder:fire", e);
	}), Z) {
		let e = c(n.getPath("userData"), "config.local.json");
		te(Z, Q, e), Ue(Z);
	}
	n.on("activate", () => {
		t.getAllWindows().length === 0 && $();
	});
}), n.on("window-all-closed", () => {
	We(), process.platform !== "darwin" && n.quit();
});
//#endregion
