import { a as e, i as t, n, t as r } from "./eventsMongo-BM_eHlBl.js";
import i from "dotenv";
import { BrowserWindow as a, app as o, ipcMain as s, net as c, protocol as l, session as u } from "electron";
import { dirname as d, join as f } from "node:path";
import { fileURLToPath as p } from "node:url";
import { exec as ee, execFile as m } from "node:child_process";
import * as h from "node:fs";
import { createWriteStream as g, promises as _ } from "node:fs";
import * as v from "node:os";
import y from "mqtt";
import { promisify as te } from "node:util";
//#region electron/services/backendSync.ts
var b = "home";
async function x(e, t, n) {
	s.handle("app:route-changed", (e, t) => {
		b = t;
	}), setInterval(() => C(t, n), 6e4), setInterval(() => w(e, t, n), 5e3), C(t, n), w(e, t, n);
}
async function S(e, t) {
	try {
		let n = JSON.parse(await _.readFile(e, "utf-8")), r = {};
		try {
			r = JSON.parse(await _.readFile(t, "utf-8"));
		} catch {}
		return {
			...n.services,
			...r.services
		};
	} catch {
		return {};
	}
}
async function C(e, t) {
	let n = await S(e, t), r = n.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/", i = process.env.NOTIFY_API_KEY || n.notify_api_key || "";
	try {
		let e = await fetch(r, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": i
			},
			body: JSON.stringify({
				device_id: process.env.COBIEN_DEVICE_ID || "CoBien6",
				screen: b,
				sent_at: (/* @__PURE__ */ new Date()).toISOString(),
				software_version: "Electron-v1.0"
			})
		});
		e.ok ? console.log(`[HEARTBEAT] Sent (Screen: ${b})`) : console.warn(`[HEARTBEAT] Failed with status: ${e.status}`);
	} catch {
		console.error("[HEARTBEAT] Network error");
	}
}
async function w(e, t, n) {
	let r = await S(t, n), i = r.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/", a = process.env.NOTIFY_API_KEY || r.notify_api_key || "";
	try {
		let n = process.env.COBIEN_DEVICE_ID || "CoBien6", r = await fetch(`${i}?device_id=${n}`, {
			method: "GET",
			headers: { "X-API-KEY": a }
		});
		if (r.ok) {
			let n = (await r.json()).notifications || [];
			if (n.length > 0) {
				console.log(`[POLL] Received ${n.length} notifications`);
				let r = !1;
				n.forEach((t) => {
					e.webContents.send("backend:notification", t);
					let n = (t.type || "").toLowerCase();
					(n === "new_event" || n === "events_reload") && (r = !0);
				}), r && (console.log("[POLL] Event notification received. Refreshing local events cache..."), import("./eventsMongo-BM_eHlBl.js").then((e) => e.r).then(({ getEvents: e }) => {
					e(t).catch((e) => console.error("[POLL] Failed to background-refresh events:", e));
				}).catch((e) => console.error("[POLL] Failed to dynamically import eventsMongo:", e)));
			}
		}
	} catch {}
}
//#endregion
//#region electron/services/boardService.ts
var ne = "board_cache";
async function re() {
	let e = f(o.getPath("userData"), ne);
	try {
		await _.access(e);
	} catch {
		await _.mkdir(e, { recursive: !0 });
	}
	return e;
}
async function T(e, t, n) {
	if (!e) return "";
	try {
		let r = await re(), i = ".png";
		(e.includes(".jpg") || e.includes(".jpeg")) && (i = ".jpg");
		let a = f(r, `${t}_${n}${i}`);
		try {
			return await _.access(a), `cobien-media://${a}`;
		} catch {}
		let o = {};
		process.env.COBIEN_NOTIFY_API_KEY && (o["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
		let s = await fetch(e, { headers: o });
		if (!s.ok) throw Error(`Failed to fetch image: ${s.statusText}`);
		if (g(a), s.body) {
			let e = await s.arrayBuffer(), t = Buffer.from(e);
			return await _.writeFile(a, t), `cobien-media://${a}`;
		}
		return "";
	} catch (t) {
		return console.error(`[BOARD] Failed to cache image ${e}:`, t), "";
	}
}
async function ie() {
	let e = process.env.COBIEN_DEVICE_ID || "CoBien6", t = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/?recipient=${e}`, n = {};
	process.env.COBIEN_NOTIFY_API_KEY && (n["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		let e = await fetch(t, { headers: n });
		if (!e.ok) throw Error(`API returned ${e.statusText}`);
		let r = (await e.json()).messages || [];
		return await Promise.all(r.map(async (e) => {
			let t = "", n = "";
			return (e.image || e.image_url) && (t = await T(e.image || e.image_url, "img", e.id)), e.author_avatar_url && (n = await T(e.author_avatar_url, "avatar", e.id)), {
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
async function ae(e) {
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
async function oe(e) {
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
async function se(e, t) {
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
var ce = {
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
}, le = {
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
function E(e, t = !0) {
	return !t && e <= 1 ? "/svg/noche.svg" : ce[e] ?? "/svg/nubes.svg";
}
function D(e, t = "es") {
	return (le[t] || le.es)[e] ?? (t === "en" ? "Unknown condition" : t === "fr" ? "Condition inconnue" : "Condición desconocida");
}
function ue(e) {
	let t = new Date(e).getHours(), n = t < 12 ? "a.m." : "p.m.";
	return `${t % 12 || 12} ${n}`;
}
async function de(e) {
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
async function fe(e, t = "es") {
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
		let r = await de(e);
		if (!r) return n.error = "Ciudad no encontrada", n;
		let { lat: i, lon: a, tz: o } = r, s = [
			`https://api.open-meteo.com/v1/forecast?latitude=${i}&longitude=${a}`,
			`&timezone=${encodeURIComponent(o)}`,
			"&current=temperature_2m,weathercode,is_day",
			"&hourly=temperature_2m,weathercode",
			"&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,wind_speed_10m_max",
			"&forecast_days=7"
		].join(""), c = await (await fetch(s)).json(), l = c.current?.weathercode ?? 0, u = (c.current?.is_day ?? 1) === 1;
		n.temp = `${Math.round(c.current?.temperature_2m ?? 0)}°`, n.icon = E(l, u);
		let d = process.env.OWM_API_KEY ?? "";
		if (d) try {
			let e = `https://api.openweathermap.org/data/2.5/weather?lat=${i}&lon=${a}&appid=${d}&units=metric&lang=${t}`;
			n.description = (await (await fetch(e)).json()).weather?.[0]?.description ?? D(l, t), n.description = n.description.charAt(0).toUpperCase() + n.description.slice(1);
		} catch {
			n.description = D(l, t);
		}
		else n.description = D(l, t);
		let f = Math.round(c.daily?.temperature_2m_min?.[0] ?? 0), p = Math.round(c.daily?.temperature_2m_max?.[0] ?? 0);
		n.tempMin = `Min ${f}°`, n.tempMax = `Max ${p}°`, n.todayPop = c.daily?.precipitation_probability_max?.[0] ?? 0, n.todayWind = Math.round(c.daily?.wind_speed_10m_max?.[0] ?? 0);
		let ee = (/* @__PURE__ */ new Date()).getHours(), m = c.hourly?.time ?? [], h = c.hourly?.temperature_2m ?? [], g = c.hourly?.weathercode ?? [], _ = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), v = m.findIndex((e) => e.startsWith(_) && new Date(e).getHours() >= ee);
		v < 0 && (v = 0), n.hourly = m.slice(v, v + 12).map((e, t) => {
			let n = new Date(e).getHours();
			return {
				time: ue(e),
				icon: E(g[v + t] ?? 0, n >= 6 && n < 20),
				temp: `${Math.round(h[v + t] ?? 0)}°`
			};
		});
		let y = c.daily?.time ?? [], te = c.daily?.temperature_2m_max ?? [], b = c.daily?.temperature_2m_min ?? [], x = c.daily?.weathercode ?? [], S = c.daily?.precipitation_probability_max ?? [], C = c.daily?.wind_speed_10m_max ?? [];
		return n.daily = y.slice(1, 7).map((e, n) => {
			let r = new Date(e), i = r.getDate(), a = t === "en" ? "en-US" : t === "fr" ? "fr-FR" : "es-ES", o = r.toLocaleDateString(a, { month: "long" }), s = r.toLocaleDateString(a, { weekday: "long" });
			return {
				name: s.charAt(0).toUpperCase() + s.slice(1),
				date: t === "en" ? `${o} ${i}` : `${i} de ${o}`,
				icon: E(x[n + 1] ?? 0),
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
var pe = f(typeof __dirname < "u" ? __dirname : d(p(import.meta.url)), "../public/data/jokes"), O = [], k = "";
async function me(e = "es") {
	try {
		let t = e === "fr" ? "jokes_fr.json" : e === "en" ? "jokes_en.json" : "jokes_es.json", n = await _.readFile(f(pe, t), "utf-8"), r = JSON.parse(n), i = [];
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
async function he(e = "es") {
	if (O.length === 0 && (O = await me(e)), O.length === 0) return e === "en" ? "No jokes available." : e === "fr" ? "Aucune blague disponible." : "No hay chistes disponibles.";
	let t = O.length > 1 ? O.filter((e) => e !== k) : O, n = t[Math.floor(Math.random() * t.length)];
	return k = n, n;
}
//#endregion
//#region electron/services/contactsService.ts
var ge = typeof __dirname < "u" ? __dirname : d(p(import.meta.url)), A = f(o.getPath("userData"), "contacts"), j = f(A, "list_contacts.txt"), _e = f(ge, "../public/images/default_user.png");
function M(e) {
	return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function ve(e) {
	let t = M(e);
	for (let e of [
		".png",
		".jpg",
		".jpeg",
		".PNG",
		".JPG",
		".JPEG"
	]) {
		let n = f(A, t + e);
		if (h.existsSync(n)) return n;
	}
	return _e;
}
async function ye() {
	let e = [];
	try {
		let t = await _.readFile(j, "utf-8");
		for (let n of t.split("\n")) {
			if (!n.includes("=")) continue;
			let [t, r] = n.split("=", 2).map((e) => e.trim());
			if (!t) continue;
			let i = /^[A-Za-z0-9_.-]+$/.test(r ?? ""), a = ve(t);
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
async function be(e, t, n) {
	try {
		let r = await fetch(e, {
			headers: { "X-Api-Key": n },
			signal: AbortSignal.timeout(15e3)
		});
		if (!r.ok) return null;
		let i = r.headers.get("Content-Type") || "", a = ".jpg";
		i.includes("png") ? a = ".png" : i.includes("webp") ? a = ".webp" : i.includes("gif") && (a = ".gif");
		let o = t + a, s = f(A, o), c = await r.arrayBuffer();
		return await _.writeFile(s, Buffer.from(c)), o;
	} catch (t) {
		return console.error(`[CONTACTS] Failed to download image ${e}:`, t), null;
	}
}
async function N(e, t, n) {
	try {
		h.existsSync(A) || h.mkdirSync(A, { recursive: !0 });
		let r = `${P(n, "/")}/pizarra/api/contacts/?device_id=${e}`, i = await fetch(r, {
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
				a.startsWith("/") && (e = P(n, "/") + "/" + xe(a, "/")), await be(e, M(r), t) && c++;
			}
		}
		let l = s.map((e) => `${e.display}=${e.user}`).join("\n") + "\n";
		return await _.writeFile(j, l), console.log(`[CONTACTS] Sync complete. ${s.length} contacts, ${c} images.`), {
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
function P(e, t) {
	let n = e;
	for (; n.endsWith(t);) n = n.slice(0, -t.length);
	return n;
}
function xe(e, t) {
	let n = e;
	for (; n.startsWith(t);) n = n.slice(t.length);
	return n;
}
async function Se(e, t, n, r) {
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
		let i = `${P(r, "/")}/pizarra/api/notify/`, a = await fetch(i, {
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
var F = null, I = /* @__PURE__ */ new Map(), L = null;
function R() {
	return F ||= f(o.getPath("userData"), "reminders.json"), F;
}
async function z() {
	try {
		let e = await _.readFile(R(), "utf-8");
		return JSON.parse(e);
	} catch {
		return [];
	}
}
async function B(e) {
	await _.writeFile(R(), JSON.stringify(e, null, 2), "utf-8");
}
function V(e) {
	let t = new Date(e.datetime).getTime() - Date.now();
	if (t <= 0) return;
	let n = setTimeout(async () => {
		I.delete(e.id), L?.(e), await B((await z()).filter((t) => t.id !== e.id));
	}, t);
	I.set(e.id, n);
}
async function Ce(e) {
	L = e;
	let t = await z(), n = /* @__PURE__ */ new Date(), r = [];
	for (let e of t) new Date(e.datetime) > n && (V(e), r.push(e));
	await B(r), console.log(`[REMINDERS] ${r.length} reminders scheduled`);
}
async function we(e, t) {
	let n = {
		id: `rem_${Date.now()}`,
		message: e,
		datetime: t
	}, r = await z();
	return r.push(n), await B(r), V(n), n;
}
async function Te() {
	let e = await z(), t = /* @__PURE__ */ new Date();
	return e.filter((e) => new Date(e.datetime) > t);
}
async function Ee(e) {
	let t = await z(), n = t.filter((t) => t.id !== e);
	if (n.length === t.length) return !1;
	await B(n);
	let r = I.get(e);
	return r && (clearTimeout(r), I.delete(e)), !0;
}
//#endregion
//#region electron/services/mqttService.ts
var H = "rfid/read", U = "sensors/update", W = "app/nav", G = "events/reload", De = "board/reload", Oe = "weather/reload", ke = [
	H,
	U,
	W,
	G,
	De,
	Oe
], Ae = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
}, K = {}, je = 5e3, Me = null, Ne = 0, q = null, J = null;
function Y(e) {
	!J || J.isDestroyed() || J.webContents.send("mqtt:event", e);
}
function Pe(e) {
	let t;
	try {
		t = e?.data?.id === void 0 ? parseInt(e.id ?? 0) : parseInt(e.data.id);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Date.now();
	if (t === Me && n - Ne < je) {
		console.log(`[MQTT] RFID debounce ignored: ${t}`);
		return;
	}
	Me = t, Ne = n, console.log(`[MQTT] RFID card: ${t}`);
	let r = K[t];
	Y(r ? {
		topic: W,
		type: "nav",
		source: "rfid",
		...r
	} : {
		topic: H,
		type: "rfid",
		cardId: t
	});
}
function Fe(e) {
	let t;
	try {
		t = e?.data?.PIC === void 0 ? parseInt(e.PIC ?? 0) : parseInt(e.data.PIC);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Ae[t];
	n ? (console.log(`[MQTT] Button PIC=${t} → ${n.target}`), Y({
		topic: U,
		type: "nav",
		target: n.target,
		source: n.source
	})) : console.warn(`[MQTT] Unknown button PIC: ${t}`);
}
function Ie(e) {
	Y({
		topic: W,
		...e
	});
}
async function Le() {
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
		K = n, console.log(`[MQTT] Loaded ${Object.keys(K).length} RFID actions`);
	} catch (e) {
		console.error("[MQTT] Failed to load RFID config:", e);
	}
}
function Re(e) {
	J = e, Le();
	let t = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${t}`), q = y.connect(t, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: !0
	}), q.on("connect", () => {
		console.log("[MQTT] Connected");
		for (let e of ke) q.subscribe(e, { qos: 0 }, (t) => {
			t ? console.error(`[MQTT] Subscribe error on ${e}:`, t) : console.log(`[MQTT] Subscribed: ${e}`);
		});
		Y({
			topic: "mqtt/status",
			type: "status",
			connected: !0
		});
	}), q.on("message", (e, t) => {
		let n = {};
		try {
			n = JSON.parse(t.toString());
		} catch {
			n = {};
		}
		switch (e) {
			case H:
				Pe(n);
				break;
			case U:
				Fe(n);
				break;
			case W:
				Ie(n);
				break;
			case G:
				Y({
					topic: e,
					type: "reload",
					target: "events"
				});
				break;
			case De:
				Y({
					topic: e,
					type: "reload",
					target: "board"
				});
				break;
			case Oe:
				Y({
					topic: e,
					type: "reload",
					target: "weather"
				});
				break;
			case "rfid/actions_reload":
				Le();
				break;
			default: console.log(`[MQTT] Unhandled topic: ${e}`);
		}
	}), q.on("error", (e) => {
		console.warn("[MQTT] Error:", e.message), Y({
			topic: "mqtt/status",
			type: "status",
			connected: !1,
			error: e.message
		});
	}), q.on("offline", () => {
		console.warn("[MQTT] Offline — will retry"), Y({
			topic: "mqtt/status",
			type: "status",
			connected: !1
		});
	}), q.on("reconnect", () => {
		console.log("[MQTT] Reconnecting...");
	});
}
function ze() {
	q && (q.end(!0), q = null, console.log("[MQTT] Disconnected"));
}
//#endregion
//#region electron/services/hardwareService.ts
var X = te(ee);
async function Be(e, t = !1) {
	try {
		return t ? await X(`pactl set-sink-volume @DEFAULT_SINK@ ${e}%`) : await X(`pactl set-sink-volume @DEFAULT_SINK@ ${`${e >= 0 ? "+" : ""}${e}%`}`), !0;
	} catch (e) {
		return console.error("Failed to adjust volume:", e), !1;
	}
}
async function Ve() {
	try {
		let { stdout: e } = await X("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(e.trim()) || 0;
	} catch (e) {
		return console.error("Failed to get volume:", e), 50;
	}
}
async function He(e) {
	try {
		let { stdout: t } = await X("xrandr --query | grep ' connected' | cut -d' ' -f1"), n = t.trim().split("\n");
		if (n.length === 0) return !1;
		for (let t of n) {
			let n = .4;
			if (e !== void 0) n = e;
			else {
				let { stdout: e } = await X(`xrandr --verbose --output ${t} | grep -i brightness`), r = parseFloat(e.split(":")[1].trim());
				n = r < .6 ? .7 : r < .9 ? 1 : .4;
			}
			await X(`xrandr --output ${t} --brightness ${n.toFixed(2)}`);
		}
		return !0;
	} catch (e) {
		return console.error("Failed to adjust brightness:", e), !1;
	}
}
//#endregion
//#region electron/main.ts
i.config();
var Z = typeof __dirname < "u" ? __dirname : d(p(import.meta.url)), Q = null, $ = f(Z, "../config/config.default.json");
function Ue(e = "es", t = "male") {
	try {
		let n = f(Z, "../config/config.default.json"), r = f(o.getPath("userData"), "config.local.json"), i = JSON.parse(h.readFileSync(n, "utf-8")), a = {};
		try {
			a = JSON.parse(h.readFileSync(r, "utf-8"));
		} catch {}
		let s = {
			...i.services,
			...a.services
		}, c = f(Z, "../public/models/piper/bin/piper"), l = f(Z, "../public/models/piper/es_ES-davefx-medium.onnx"), u = s.tts_piper_bin || c, d = s[`tts_piper_model_${e}_${t}`] || s[`tts_piper_model_${e}`], p = "";
		if (d) if (d.startsWith("/") || d.includes(":") || d.startsWith("http")) p = d;
		else {
			let e = f(Z, "../public/models/piper", d);
			p = (h.existsSync(e), e);
		}
		else p = e === "fr" ? f(Z, "../public/models/piper/fr_FR-siwis-medium.onnx") : e === "en" ? f(Z, "../public/models/piper/en_US-amy-medium.onnx") : l;
		return {
			bin: u,
			model: p
		};
	} catch (e) {
		return console.error("Error reading piper config:", e), {
			bin: f(Z, "../public/models/piper/bin/piper"),
			model: f(Z, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
function We() {
	s.handle("config:getWeather", async () => {
		try {
			let e = JSON.parse(await _.readFile($, "utf-8"));
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
	}), s.handle("config:getSettings", async () => {
		try {
			return JSON.parse(await _.readFile($, "utf-8")).settings || {};
		} catch {
			return {};
		}
	}), s.handle("config:saveWeather", async (e, t) => {
		try {
			let e = JSON.parse(await _.readFile($, "utf-8"));
			return e.settings.weather_city_catalog = t.catalog, e.settings.weather_cities = t.active, e.settings.weather_primary_city = t.primary, await _.writeFile($, JSON.stringify(e, null, 4)), !0;
		} catch (e) {
			return console.error("Error saving config:", e), !1;
		}
	}), s.handle("events:get", async () => await t($)), s.handle("weather:fetch", async (e, t, n = "es") => await fe(t, n)), s.handle("jokes:getRandom", async (e, t = "es") => await he(t)), s.handle("contacts:list", async () => await ye()), s.handle("contacts:sync", async () => {
		let e = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await N(process.env.COBIEN_DEVICE_ID || "CoBien6", e, (JSON.parse(await _.readFile($, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), s.handle("contacts:requestCall", async (e, t) => {
		let n = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await Se(t, process.env.COBIEN_DEVICE_ID || "CoBien6", n, (JSON.parse(await _.readFile($, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), s.handle("contacts:openCall", async (e, t) => {
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
	}), s.handle("reminders:add", async (e, t, n) => await we(t, n)), s.handle("reminders:list", async () => await Te()), s.handle("reminders:delete", async (e, t) => await Ee(t)), s.handle("events:addPersonal", async (e, t) => {
		let n = JSON.parse(await _.readFile($, "utf-8")), i = process.env.COBIEN_DEVICE_LOCATION || n.settings?.device_location || "Bilbao", a = process.env.COBIEN_DEVICE_ID || "CoBien6", o = t.location || i;
		return await r({
			...t,
			location: o,
			deviceId: a
		});
	}), s.handle("events:updatePersonal", async (t, n) => await e(n)), s.handle("events:delete", async (e, t) => await n(t)), s.handle("board:fetch", async () => await ie()), s.handle("board:delete", async (e, t) => await ae(t)), s.handle("board:read", async (e, t) => await oe(t)), s.handle("board:reply", async (e, t, n) => await se(t, n)), s.handle("config:getSystemInfo", () => ({
		version: o.getVersion(),
		deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX",
		contactsPath: f(o.getPath("userData"), "contacts/list_contacts.txt"),
		defaultLanguage: process.env.COBIEN_APP_LANGUAGE || "en"
	})), s.handle("app:restart", () => {
		o.relaunch(), o.exit();
	}), s.handle("app:exit", () => {
		o.quit();
	});
	let i = null;
	s.handle("tts:stop", () => {
		if (i) {
			try {
				i.kill();
			} catch {}
			i = null;
		}
	}), s.handle("tts:speak", async (e, t, n = "es", r = "male", a = "piper") => {
		if (console.log(`[TTS] Speaking (${n}/${r}) via ${a}: "${t}"`), i) {
			try {
				i.kill();
			} catch {}
			i = null;
		}
		let o = f(v.tmpdir(), `tts_${Date.now()}.wav`), { bin: s, model: c } = Ue(n, r);
		return console.log(`[TTS] Piper Config: bin=${s}, model=${c}`), c ? new Promise((e) => {
			let n = m(s, [
				"--model",
				c,
				"--output_file",
				o
			], async (t, n, r) => {
				if (t) {
					console.error("[TTS] Piper exec error:", t, r), e(null);
					return;
				}
				try {
					let t = await _.readFile(o);
					await _.unlink(o), console.log(`[TTS] Generated WAV: ${t.length} bytes`), e(t);
				} catch (t) {
					console.error("[TTS] Error reading temp wav:", t), e(null);
				}
			});
			n.stdin?.write(t), n.stdin?.end();
		}) : (console.error("TTS: No Piper model configured."), null);
	}), s.handle("hardware:adjustVolume", async (e, t, n = !1) => await Be(t, n)), s.handle("hardware:adjustBrightness", async (e, t) => await He(t)), s.handle("hardware:getVolume", async () => await Ve());
}
function Ge() {
	Q = new a({
		width: 1024,
		height: 768,
		fullscreen: !1,
		webPreferences: {
			preload: f(Z, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), Q.setBackgroundColor("#ffffff"), process.env.VITE_DEV_SERVER_URL ? (Q.loadURL(process.env.VITE_DEV_SERVER_URL), Q.webContents.openDevTools()) : Q.loadFile(f(Z, "../dist/index.html"));
}
o.whenReady().then(() => {
	u.defaultSession.setPermissionRequestHandler((e, t, n) => {
		[
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(t) ? n(!0) : n(!1);
	}), u.defaultSession.setPermissionCheckHandler((e, t, n) => [
		"media",
		"geolocation",
		"notifications",
		"midiSysex",
		"openExternal"
	].includes(t)), l.handle("cobien-media", (e) => {
		let t = e.url.replace("cobien-media://", "");
		return c.fetch("file://" + t);
	}), We();
	let e = (JSON.parse(h.readFileSync($, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), t = process.env.COBIEN_NOTIFY_API_KEY || "";
	if (N(process.env.COBIEN_DEVICE_ID || "CoBien6", t, e).catch(console.error), Ge(), Ce((e) => {
		Q && Q.webContents.send("reminder:fire", e);
	}), Q) {
		let e = f(o.getPath("userData"), "config.local.json");
		x(Q, $, e), Re(Q);
	}
	o.on("activate", () => {
		a.getAllWindows().length === 0 && Ge();
	});
}), o.on("window-all-closed", () => {
	ze(), process.platform !== "darwin" && o.quit();
});
//#endregion
