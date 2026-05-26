import e from "dotenv";
import { BrowserWindow as t, app as n, ipcMain as r, net as i, protocol as a } from "electron";
import { dirname as o, join as s } from "node:path";
import { fileURLToPath as c } from "node:url";
import { exec as l, execFile as u } from "node:child_process";
import * as d from "node:fs";
import { createWriteStream as f, promises as p } from "node:fs";
import * as m from "node:os";
import { MongoClient as h, ObjectId as g } from "mongodb";
import _ from "mqtt";
import { promisify as v } from "node:util";
//#region electron/services/backendSync.ts
var y = "home";
async function b(e, t, n) {
	r.handle("app:route-changed", (e, t) => {
		y = t;
	}), setInterval(() => S(t, n), 6e4), setInterval(() => C(e, t, n), 5e3), S(t, n), C(e, t, n);
}
async function x(e, t) {
	try {
		let n = JSON.parse(await p.readFile(e, "utf-8")), r = {};
		try {
			r = JSON.parse(await p.readFile(t, "utf-8"));
		} catch {}
		return {
			...n.services,
			...r.services
		};
	} catch {
		return {};
	}
}
async function S(e, t) {
	let n = await x(e, t), r = n.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/", i = process.env.NOTIFY_API_KEY || n.notify_api_key || "";
	try {
		let e = await fetch(r, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": i
			},
			body: JSON.stringify({
				device_id: "CoBien6",
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
async function C(e, t, n) {
	let r = await x(t, n), i = r.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/", a = process.env.NOTIFY_API_KEY || r.notify_api_key || "";
	try {
		let t = await fetch(`${i}?device_id=CoBien6`, {
			method: "GET",
			headers: { "X-API-KEY": a }
		});
		if (t.ok) {
			let n = (await t.json()).notifications || [];
			n.length > 0 && (console.log(`[POLL] Received ${n.length} notifications`), n.forEach((t) => {
				e.webContents.send("backend:notification", t);
			}));
		}
	} catch {}
}
//#endregion
//#region electron/services/eventsMongo.ts
var w = null;
async function T() {
	if (w) return w;
	let e = process.env.MONGO_URI || "";
	if (!e) throw Error("MONGO_URI is missing");
	return w = new h(e), await w.connect(), w;
}
async function ee(e) {
	try {
		let t = JSON.parse(await p.readFile(e, "utf-8")).settings?.device_location || "Bilbao", n = await (await T()).db("LabasAppDB").collection("eventos").find({ $or: [{ $or: [
			{ audience: "all" },
			{ audience: { $exists: !1 } },
			{ audience: null }
		] }, {
			audience: "device",
			$or: [{ target_device: "CoBien6" }, { target_devices: "CoBien6" }]
		}] }).toArray(), r = t.trim().toLowerCase();
		return n.map((e) => {
			let n = e.audience || "all";
			n = typeof n == "string" && n.toLowerCase() === "device" ? "device" : "all";
			let i = n === "device" ? "#FF3B30" : "#1E90FF";
			e.color && (i = e.color);
			let a = (e.location || "").trim();
			if (n === "all" && a && a.toLowerCase() !== r) return null;
			let o = e.date || e.fecha_inicio || "";
			if (o instanceof Date) {
				let e = o;
				o = `${e.getDate().toString().padStart(2, "0")}-${(e.getMonth() + 1).toString().padStart(2, "0")}-${e.getFullYear()}`;
			}
			return {
				id: e._id.toString(),
				date: o,
				title: e.title || e.titulo || "Sin título",
				description: e.description || e.descripcion || "Sin descripción",
				location: a || t,
				audience: n,
				color: i,
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
async function te(e) {
	try {
		let t = (await T()).db("LabasAppDB").collection("eventos"), [n, r, i] = e.date.split("-").map(Number), a = new Date(i, r - 1, n);
		if (isNaN(a.getTime())) return console.error("[EVENTS] Invalid date provided:", e.date), !1;
		let o = {
			_id: new g(),
			title: e.title,
			description: e.description,
			date: e.date,
			fecha_inicio: a,
			audience: "device",
			target_device: e.deviceId,
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
async function ne(e) {
	try {
		return (await (await T()).db("LabasAppDB").collection("eventos").deleteOne({ _id: new g(e) })).deletedCount > 0;
	} catch (e) {
		return console.error("[EVENTS] Error deleting event:", e), !1;
	}
}
//#endregion
//#region electron/services/boardService.ts
var re = "board_cache";
async function ie() {
	let e = s(n.getPath("userData"), re);
	try {
		await p.access(e);
	} catch {
		await p.mkdir(e, { recursive: !0 });
	}
	return e;
}
async function ae(e, t, n) {
	if (!e) return "";
	try {
		let r = await ie(), i = ".png";
		(e.includes(".jpg") || e.includes(".jpeg")) && (i = ".jpg");
		let a = s(r, `${t}_${n}${i}`);
		try {
			return await p.access(a), `cobien-media://${a}`;
		} catch {}
		let o = {};
		process.env.COBIEN_NOTIFY_API_KEY && (o["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
		let c = await fetch(e, { headers: o });
		if (!c.ok) throw Error(`Failed to fetch image: ${c.statusText}`);
		if (f(a), c.body) {
			let e = await c.arrayBuffer(), t = Buffer.from(e);
			return await p.writeFile(a, t), `cobien-media://${a}`;
		}
		return "";
	} catch (t) {
		return console.error(`[BOARD] Failed to cache image ${e}:`, t), "";
	}
}
async function oe() {
	let e = process.env.COBIEN_DEVICE_ID || "CoBien6", t = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/?recipient=${e}`, n = {};
	process.env.COBIEN_NOTIFY_API_KEY && (n["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		let e = await fetch(t, { headers: n });
		if (!e.ok) throw Error(`API returned ${e.statusText}`);
		let r = (await e.json()).messages || [];
		return await Promise.all(r.map(async (e) => {
			let t = "", n = "";
			return (e.image || e.image_url) && (t = await ae(e.image || e.image_url, "img", e.id)), e.author_avatar_url && (n = await ae(e.author_avatar_url, "avatar", e.id)), {
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
async function se(e) {
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
async function ce(e) {
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
async function le(e, t) {
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
var ue = {
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
}, de = {
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
	return !t && e <= 1 ? "/svg/noche.svg" : ue[e] ?? "/svg/nubes.svg";
}
function D(e, t = "es") {
	return (de[t] || de.es)[e] ?? (t === "en" ? "Unknown condition" : t === "fr" ? "Condition inconnue" : "Condición desconocida");
}
function fe(e) {
	let t = new Date(e).getHours(), n = t < 12 ? "a.m." : "p.m.";
	return `${t % 12 || 12} ${n}`;
}
async function pe(e) {
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
async function me(e, t = "es") {
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
		let r = await pe(e);
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
		let m = (/* @__PURE__ */ new Date()).getHours(), h = c.hourly?.time ?? [], g = c.hourly?.temperature_2m ?? [], _ = c.hourly?.weathercode ?? [], v = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), y = h.findIndex((e) => e.startsWith(v) && new Date(e).getHours() >= m);
		y < 0 && (y = 0), n.hourly = h.slice(y, y + 12).map((e, t) => {
			let n = new Date(e).getHours();
			return {
				time: fe(e),
				icon: E(_[y + t] ?? 0, n >= 6 && n < 20),
				temp: `${Math.round(g[y + t] ?? 0)}°`
			};
		});
		let b = c.daily?.time ?? [], x = c.daily?.temperature_2m_max ?? [], S = c.daily?.temperature_2m_min ?? [], C = c.daily?.weathercode ?? [], w = c.daily?.precipitation_probability_max ?? [], T = c.daily?.wind_speed_10m_max ?? [];
		return n.daily = b.slice(1, 7).map((e, n) => {
			let r = new Date(e), i = r.getDate(), a = t === "en" ? "en-US" : t === "fr" ? "fr-FR" : "es-ES", o = r.toLocaleDateString(a, { month: "long" }), s = r.toLocaleDateString(a, { weekday: "long" });
			return {
				name: s.charAt(0).toUpperCase() + s.slice(1),
				date: t === "en" ? `${o} ${i}` : `${i} de ${o}`,
				icon: E(C[n + 1] ?? 0),
				tmin: `${Math.round(S[n + 1] ?? 0)}°`,
				tmax: `${Math.round(x[n + 1] ?? 0)}°`,
				pop: w[n + 1] ?? 0,
				wind: Math.round(T[n + 1] ?? 0)
			};
		}), n;
	} catch (e) {
		return console.error("[WEATHER] fetchWeatherBundle error:", e), n.error = String(e), n;
	}
}
//#endregion
//#region electron/services/jokesService.ts
var he = s(typeof __dirname < "u" ? __dirname : o(c(import.meta.url)), "../public/data/jokes"), O = [], k = "";
async function ge(e = "es") {
	try {
		let t = e === "fr" ? "jokes_fr.json" : e === "en" ? "jokes_en.json" : "jokes_es.json", n = await p.readFile(s(he, t), "utf-8"), r = JSON.parse(n), i = [];
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
async function _e(e = "es") {
	if (O.length === 0 && (O = await ge(e)), O.length === 0) return e === "en" ? "No jokes available." : e === "fr" ? "Aucune blague disponible." : "No hay chistes disponibles.";
	let t = O.length > 1 ? O.filter((e) => e !== k) : O, n = t[Math.floor(Math.random() * t.length)];
	return k = n, n;
}
//#endregion
//#region electron/services/contactsService.ts
var ve = typeof __dirname < "u" ? __dirname : o(c(import.meta.url)), A = s(n.getPath("userData"), "contacts"), j = s(A, "list_contacts.txt"), ye = s(ve, "../public/images/default_user.png");
function M(e) {
	return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function be(e) {
	let t = M(e);
	for (let e of [
		".png",
		".jpg",
		".jpeg",
		".PNG",
		".JPG",
		".JPEG"
	]) {
		let n = s(A, t + e);
		if (d.existsSync(n)) return n;
	}
	return ye;
}
async function xe() {
	let e = [];
	try {
		let t = await p.readFile(j, "utf-8");
		for (let n of t.split("\n")) {
			if (!n.includes("=")) continue;
			let [t, r] = n.split("=", 2).map((e) => e.trim());
			if (!t) continue;
			let i = /^[A-Za-z0-9_.-]+$/.test(r ?? ""), a = be(t);
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
async function Se(e, t, n) {
	try {
		let r = await fetch(e, {
			headers: { "X-Api-Key": n },
			signal: AbortSignal.timeout(15e3)
		});
		if (!r.ok) return null;
		let i = r.headers.get("Content-Type") || "", a = ".jpg";
		i.includes("png") ? a = ".png" : i.includes("webp") ? a = ".webp" : i.includes("gif") && (a = ".gif");
		let o = t + a, c = s(A, o), l = await r.arrayBuffer();
		return await p.writeFile(c, Buffer.from(l)), o;
	} catch (t) {
		return console.error(`[CONTACTS] Failed to download image ${e}:`, t), null;
	}
}
async function N(e, t, n) {
	try {
		d.existsSync(A) || d.mkdirSync(A, { recursive: !0 });
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
				a.startsWith("/") && (e = P(n, "/") + "/" + Ce(a, "/")), await Se(e, M(r), t) && c++;
			}
		}
		let l = s.map((e) => `${e.display}=${e.user}`).join("\n") + "\n";
		return await p.writeFile(j, l), console.log(`[CONTACTS] Sync complete. ${s.length} contacts, ${c} images.`), {
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
function Ce(e, t) {
	let n = e;
	for (; n.startsWith(t);) n = n.slice(t.length);
	return n;
}
async function we(e, t, n, r) {
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
				type: "videollamada",
				destination: e,
				origin: t
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
	return F ||= s(n.getPath("userData"), "reminders.json"), F;
}
async function z() {
	try {
		let e = await p.readFile(R(), "utf-8");
		return JSON.parse(e);
	} catch {
		return [];
	}
}
async function B(e) {
	await p.writeFile(R(), JSON.stringify(e, null, 2), "utf-8");
}
function V(e) {
	let t = new Date(e.datetime).getTime() - Date.now();
	if (t <= 0) return;
	let n = setTimeout(async () => {
		I.delete(e.id), L?.(e), await B((await z()).filter((t) => t.id !== e.id));
	}, t);
	I.set(e.id, n);
}
async function Te(e) {
	L = e;
	let t = await z(), n = /* @__PURE__ */ new Date(), r = [];
	for (let e of t) new Date(e.datetime) > n && (V(e), r.push(e));
	await B(r), console.log(`[REMINDERS] ${r.length} reminders scheduled`);
}
async function Ee(e, t) {
	let n = {
		id: `rem_${Date.now()}`,
		message: e,
		datetime: t
	}, r = await z();
	return r.push(n), await B(r), V(n), n;
}
async function De() {
	let e = await z(), t = /* @__PURE__ */ new Date();
	return e.filter((e) => new Date(e.datetime) > t);
}
async function Oe(e) {
	let t = await z(), n = t.filter((t) => t.id !== e);
	if (n.length === t.length) return !1;
	await B(n);
	let r = I.get(e);
	return r && (clearTimeout(r), I.delete(e)), !0;
}
//#endregion
//#region electron/services/mqttService.ts
var H = "rfid/read", U = "sensors/update", W = "app/nav", G = "events/reload", ke = "board/reload", Ae = "weather/reload", je = [
	H,
	U,
	W,
	G,
	ke,
	Ae
], Me = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
}, K = {}, Ne = 5e3, Pe = null, Fe = 0, q = null, J = null;
function Y(e) {
	!J || J.isDestroyed() || J.webContents.send("mqtt:event", e);
}
function Ie(e) {
	let t;
	try {
		t = e?.data?.id === void 0 ? parseInt(e.id ?? 0) : parseInt(e.data.id);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Date.now();
	if (t === Pe && n - Fe < Ne) {
		console.log(`[MQTT] RFID debounce ignored: ${t}`);
		return;
	}
	Pe = t, Fe = n, console.log(`[MQTT] RFID card: ${t}`);
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
function Le(e) {
	let t;
	try {
		t = e?.data?.PIC === void 0 ? parseInt(e.PIC ?? 0) : parseInt(e.data.PIC);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Me[t];
	n ? (console.log(`[MQTT] Button PIC=${t} → ${n.target}`), Y({
		topic: U,
		type: "nav",
		target: n.target,
		source: n.source
	})) : console.warn(`[MQTT] Unknown button PIC: ${t}`);
}
function Re(e) {
	Y({
		topic: W,
		...e
	});
}
async function ze() {
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
function Be(e) {
	J = e, ze();
	let t = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${t}`), q = _.connect(t, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: !0
	}), q.on("connect", () => {
		console.log("[MQTT] Connected");
		for (let e of je) q.subscribe(e, { qos: 0 }, (t) => {
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
				Ie(n);
				break;
			case U:
				Le(n);
				break;
			case W:
				Re(n);
				break;
			case G:
				Y({
					topic: e,
					type: "reload",
					target: "events"
				});
				break;
			case ke:
				Y({
					topic: e,
					type: "reload",
					target: "board"
				});
				break;
			case Ae:
				Y({
					topic: e,
					type: "reload",
					target: "weather"
				});
				break;
			case "rfid/actions_reload":
				ze();
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
function Ve() {
	q && (q.end(!0), q = null, console.log("[MQTT] Disconnected"));
}
//#endregion
//#region electron/services/hardwareService.ts
var X = v(l);
async function He(e, t = !1) {
	try {
		return t ? await X(`pactl set-sink-volume @DEFAULT_SINK@ ${e}%`) : await X(`pactl set-sink-volume @DEFAULT_SINK@ ${`${e >= 0 ? "+" : ""}${e}%`}`), !0;
	} catch (e) {
		return console.error("Failed to adjust volume:", e), !1;
	}
}
async function Ue() {
	try {
		let { stdout: e } = await X("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(e.trim()) || 0;
	} catch (e) {
		return console.error("Failed to get volume:", e), 50;
	}
}
async function We(e) {
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
e.config();
var Z = typeof __dirname < "u" ? __dirname : o(c(import.meta.url)), Q = null, $ = s(Z, "../config/config.default.json");
function Ge(e = "es", t = "male") {
	try {
		let r = s(Z, "../config/config.default.json"), i = s(n.getPath("userData"), "config.local.json"), a = JSON.parse(d.readFileSync(r, "utf-8")), o = {};
		try {
			o = JSON.parse(d.readFileSync(i, "utf-8"));
		} catch {}
		let c = {
			...a.services,
			...o.services
		}, l = s(Z, "../public/models/piper/bin/piper"), u = s(Z, "../public/models/piper/es_ES-davefx-medium.onnx"), f = c.tts_piper_bin || l, p = c[`tts_piper_model_${e}_${t}`] || c[`tts_piper_model_${e}`], m = "";
		if (p) if (p.startsWith("/") || p.includes(":") || p.startsWith("http")) m = p;
		else {
			let e = s(Z, "../public/models/piper", p);
			m = (d.existsSync(e), e);
		}
		else m = e === "fr" ? s(Z, "../public/models/piper/fr_FR-siwis-medium.onnx") : e === "en" ? s(Z, "../public/models/piper/en_US-amy-medium.onnx") : u;
		return {
			bin: f,
			model: m
		};
	} catch (e) {
		return console.error("Error reading piper config:", e), {
			bin: s(Z, "../public/models/piper/bin/piper"),
			model: s(Z, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
function Ke() {
	r.handle("config:getWeather", async () => {
		try {
			let e = JSON.parse(await p.readFile($, "utf-8"));
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
			return JSON.parse(await p.readFile($, "utf-8")).settings || {};
		} catch {
			return {};
		}
	}), r.handle("config:saveWeather", async (e, t) => {
		try {
			let e = JSON.parse(await p.readFile($, "utf-8"));
			return e.settings.weather_city_catalog = t.catalog, e.settings.weather_cities = t.active, e.settings.weather_primary_city = t.primary, await p.writeFile($, JSON.stringify(e, null, 4)), !0;
		} catch (e) {
			return console.error("Error saving config:", e), !1;
		}
	}), r.handle("events:get", async () => await ee($)), r.handle("weather:fetch", async (e, t, n = "es") => await me(t, n)), r.handle("jokes:getRandom", async (e, t = "es") => await _e(t)), r.handle("contacts:list", async () => await xe()), r.handle("contacts:sync", async () => {
		let e = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await N(process.env.COBIEN_DEVICE_ID || "CoBien6", e, (JSON.parse(await p.readFile($, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), r.handle("contacts:requestCall", async (e, t) => {
		let n = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await we(t, process.env.COBIEN_DEVICE_ID || "CoBien6", n, (JSON.parse(await p.readFile($, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), r.handle("contacts:openCall", async (e, t) => {
		let n = process.env.COBIEN_DEVICE_ID || "CoBien6", r = `${(JSON.parse(await p.readFile($, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, "")}/videocall/?room=${encodeURIComponent(t)}&device=${encodeURIComponent(n)}`, { BrowserWindow: i } = await import("electron");
		return new i({
			width: 1024,
			height: 768,
			fullscreen: !0,
			webPreferences: {
				nodeIntegration: !1,
				contextIsolation: !0
			}
		}).loadURL(r), !0;
	}), r.handle("reminders:add", async (e, t, n) => await Ee(t, n)), r.handle("reminders:list", async () => await De()), r.handle("reminders:delete", async (e, t) => await Oe(t)), r.handle("events:addPersonal", async (e, t) => {
		let n = JSON.parse(await p.readFile($, "utf-8")).settings?.device_location || "Bilbao", r = process.env.COBIEN_DEVICE_ID || "CoBien6", i = t.location || n;
		return await te({
			...t,
			location: i,
			deviceId: r
		});
	}), r.handle("events:delete", async (e, t) => await ne(t)), r.handle("board:fetch", async () => await oe()), r.handle("board:delete", async (e, t) => await se(t)), r.handle("board:read", async (e, t) => await ce(t)), r.handle("board:reply", async (e, t, n) => await le(t, n)), r.handle("config:getSystemInfo", () => ({
		version: n.getVersion(),
		deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX",
		contactsPath: s(n.getPath("userData"), "contacts/list_contacts.txt")
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
		let o = s(m.tmpdir(), `tts_${Date.now()}.wav`), { bin: c, model: l } = Ge(r, i);
		return console.log(`[TTS] Piper Config: bin=${c}, model=${l}`), l ? new Promise((e) => {
			let t = u(c, [
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
					let t = await p.readFile(o);
					await p.unlink(o), console.log(`[TTS] Generated WAV: ${t.length} bytes`), e(t);
				} catch (t) {
					console.error("[TTS] Error reading temp wav:", t), e(null);
				}
			});
			t.stdin?.write(n), t.stdin?.end();
		}) : (console.error("TTS: No Piper model configured."), null);
	}), r.handle("hardware:adjustVolume", async (e, t, n = !1) => await He(t, n)), r.handle("hardware:adjustBrightness", async (e, t) => await We(t)), r.handle("hardware:getVolume", async () => await Ue());
}
function qe() {
	Q = new t({
		width: 1024,
		height: 768,
		fullscreen: !1,
		webPreferences: {
			preload: s(Z, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), Q.setBackgroundColor("#ffffff"), process.env.VITE_DEV_SERVER_URL ? (Q.loadURL(process.env.VITE_DEV_SERVER_URL), Q.webContents.openDevTools()) : Q.loadFile(s(Z, "../dist/index.html"));
}
n.whenReady().then(() => {
	a.handle("cobien-media", (e) => {
		let t = e.url.replace("cobien-media://", "");
		return i.fetch("file://" + t);
	}), Ke();
	let e = (JSON.parse(d.readFileSync($, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), r = process.env.COBIEN_NOTIFY_API_KEY || "";
	if (N(process.env.COBIEN_DEVICE_ID || "CoBien6", r, e).catch(console.error), qe(), Te((e) => {
		Q && Q.webContents.send("reminder:fire", e);
	}), Q) {
		let e = s(n.getPath("userData"), "config.local.json");
		b(Q, $, e), Be(Q);
	}
	n.on("activate", () => {
		t.getAllWindows().length === 0 && qe();
	});
}), n.on("window-all-closed", () => {
	Ve(), process.platform !== "darwin" && n.quit();
});
//#endregion
