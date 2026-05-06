import e from "dotenv";
import { BrowserWindow as t, app as n, ipcMain as r, net as i, protocol as a } from "electron";
import { dirname as o, join as s } from "node:path";
import { fileURLToPath as c } from "node:url";
import { exec as l, execFile as u, spawn as d } from "node:child_process";
import * as f from "node:fs";
import { createWriteStream as p, promises as m } from "node:fs";
import * as ee from "node:os";
import { MongoClient as h, ObjectId as g } from "mongodb";
import _ from "mqtt";
import { promisify as te } from "node:util";
//#region electron/services/backendSync.ts
var v = "home";
async function ne(e, t, n) {
	r.handle("app:route-changed", (e, t) => {
		v = t;
	}), setInterval(() => b(t, n), 6e4), setInterval(() => re(e, t, n), 5e3), b(t, n), re(e, t, n);
}
async function y(e, t) {
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
async function b(e, t) {
	let n = await y(e, t), r = n.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/", i = process.env.NOTIFY_API_KEY || n.notify_api_key || "";
	try {
		let e = await fetch(r, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": i
			},
			body: JSON.stringify({
				device_id: "CoBien6",
				screen: v,
				sent_at: (/* @__PURE__ */ new Date()).toISOString(),
				software_version: "Electron-v1.0"
			})
		});
		e.ok ? console.log(`[HEARTBEAT] Sent (Screen: ${v})`) : console.warn(`[HEARTBEAT] Failed with status: ${e.status}`);
	} catch {
		console.error("[HEARTBEAT] Network error");
	}
}
async function re(e, t, n) {
	let r = await y(t, n), i = r.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/", a = process.env.NOTIFY_API_KEY || r.notify_api_key || "";
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
var x = null;
async function S() {
	if (x) return x;
	let e = process.env.MONGO_URI || "";
	if (!e) throw Error("MONGO_URI is missing");
	return x = new h(e), await x.connect(), x;
}
async function ie(e) {
	try {
		let t = JSON.parse(await m.readFile(e, "utf-8")).settings?.device_location || "Bilbao", n = await (await S()).db("LabasAppDB").collection("eventos").find({ $or: [{ $or: [
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
async function ae(e) {
	try {
		let t = (await S()).db("LabasAppDB").collection("eventos"), [n, r, i] = e.date.split("-").map(Number), a = new Date(i, r - 1, n), o = {
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
		return console.error("[EVENTS] Error adding personal event:", e), !1;
	}
}
async function oe(e) {
	try {
		return (await (await S()).db("LabasAppDB").collection("eventos").deleteOne({ _id: new g(e) })).deletedCount > 0;
	} catch (e) {
		return console.error("[EVENTS] Error deleting event:", e), !1;
	}
}
//#endregion
//#region electron/services/boardService.ts
var se = "board_cache";
async function ce() {
	let e = s(n.getPath("userData"), se);
	try {
		await m.access(e);
	} catch {
		await m.mkdir(e, { recursive: !0 });
	}
	return e;
}
async function le(e, t, n) {
	if (!e) return "";
	try {
		let r = await ce(), i = ".png";
		(e.includes(".jpg") || e.includes(".jpeg")) && (i = ".jpg");
		let a = s(r, `${t}_${n}${i}`);
		try {
			return await m.access(a), `cobien-media://${a}`;
		} catch {}
		let o = {};
		process.env.COBIEN_NOTIFY_API_KEY && (o["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
		let c = await fetch(e, { headers: o });
		if (!c.ok) throw Error(`Failed to fetch image: ${c.statusText}`);
		if (p(a), c.body) {
			let e = await c.arrayBuffer(), t = Buffer.from(e);
			return await m.writeFile(a, t), `cobien-media://${a}`;
		}
		return "";
	} catch (t) {
		return console.error(`[BOARD] Failed to cache image ${e}:`, t), "";
	}
}
async function ue() {
	let e = process.env.COBIEN_DEVICE_ID || "CoBien6", t = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/?recipient=${e}`, n = {};
	process.env.COBIEN_NOTIFY_API_KEY && (n["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		let e = await fetch(t, { headers: n });
		if (!e.ok) throw Error(`API returned ${e.statusText}`);
		let r = (await e.json()).messages || [];
		return await Promise.all(r.map(async (e) => {
			let t = "", n = "";
			return (e.image || e.image_url) && (t = await le(e.image || e.image_url, "img", e.id)), e.author_avatar_url && (n = await le(e.author_avatar_url, "avatar", e.id)), {
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
async function de(e) {
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
async function fe(e) {
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
async function pe(e, t) {
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
var me = {
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
}, he = {
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
}, ge = [
	"Domingo",
	"Lunes",
	"Martes",
	"Miércoles",
	"Jueves",
	"Viernes",
	"Sábado"
];
function C(e, t = !0) {
	return !t && e <= 1 ? "/images/noche.png" : me[e] ?? "/images/nubes.png";
}
function w(e) {
	return he[e] ?? "Condición desconocida";
}
function _e(e) {
	let t = new Date(e).getHours(), n = t < 12 ? "a.m." : "p.m.";
	return `${t % 12 || 12} ${n}`;
}
async function ve(e) {
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
async function ye(e) {
	let t = {
		city: e,
		temp: "—°",
		description: "No disponible",
		icon: "/images/nubes.png",
		tempMin: "Min —°",
		tempMax: "Max —°",
		hourly: [],
		daily: []
	};
	try {
		let n = await ve(e);
		if (!n) return t.error = "Ciudad no encontrada", t;
		let { lat: r, lon: i, tz: a } = n, o = [
			`https://api.open-meteo.com/v1/forecast?latitude=${r}&longitude=${i}`,
			`&timezone=${encodeURIComponent(a)}`,
			"&current=temperature_2m,weathercode,is_day",
			"&hourly=temperature_2m,weathercode",
			"&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max",
			"&forecast_days=7"
		].join(""), s = await (await fetch(o)).json(), c = s.current?.weathercode ?? 0, l = (s.current?.is_day ?? 1) === 1;
		t.temp = `${Math.round(s.current?.temperature_2m ?? 0)}°`, t.icon = C(c, l);
		let u = process.env.OWM_API_KEY ?? "";
		if (u) try {
			let e = `https://api.openweathermap.org/data/2.5/weather?lat=${r}&lon=${i}&appid=${u}&units=metric&lang=es`;
			t.description = (await (await fetch(e)).json()).weather?.[0]?.description ?? w(c), t.description = t.description.charAt(0).toUpperCase() + t.description.slice(1);
		} catch {
			t.description = w(c);
		}
		else t.description = w(c);
		let d = Math.round(s.daily?.temperature_2m_min?.[0] ?? 0), f = Math.round(s.daily?.temperature_2m_max?.[0] ?? 0);
		t.tempMin = `Min ${d}°`, t.tempMax = `Max ${f}°`;
		let p = (/* @__PURE__ */ new Date()).getHours(), m = s.hourly?.time ?? [], ee = s.hourly?.temperature_2m ?? [], h = s.hourly?.weathercode ?? [], g = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), _ = m.findIndex((e) => e.startsWith(g) && new Date(e).getHours() >= p);
		_ < 0 && (_ = 0), t.hourly = m.slice(_, _ + 12).map((e, t) => {
			let n = new Date(e).getHours();
			return {
				time: _e(e),
				icon: C(h[_ + t] ?? 0, n >= 6 && n < 20),
				temp: `${Math.round(ee[_ + t] ?? 0)}°`
			};
		});
		let te = s.daily?.time ?? [], v = s.daily?.temperature_2m_max ?? [], ne = s.daily?.temperature_2m_min ?? [], y = s.daily?.weathercode ?? [], b = s.daily?.precipitation_probability_max ?? [];
		return t.daily = te.slice(1, 7).map((e, t) => ({
			name: ge[new Date(e).getDay()],
			icon: C(y[t + 1] ?? 0),
			tmin: `${Math.round(ne[t + 1] ?? 0)}°`,
			tmax: `${Math.round(v[t + 1] ?? 0)}°`,
			pop: b[t + 1] ?? 0
		})), t;
	} catch (e) {
		return console.error("[WEATHER] fetchWeatherBundle error:", e), t.error = String(e), t;
	}
}
//#endregion
//#region electron/services/jokesService.ts
var be = s(typeof __dirname < "u" ? __dirname : o(c(import.meta.url)), "../../../cobien_FrontEnd/app/data/jokes"), T = [], E = "";
async function xe(e = "es") {
	try {
		let t = e === "fr" ? "jokes_fr.json" : "jokes_es.json", n = await m.readFile(s(be, t), "utf-8"), r = JSON.parse(n), i = [];
		for (let e of Object.values(r)) if (Array.isArray(e)) {
			for (let t of e) if (typeof t == "string" && t.trim()) i.push(t.trim());
			else if (typeof t == "object" && t) {
				let e = t;
				e.text ? i.push(String(e.text).trim()) : e.setup && e.punchline && i.push(`${e.setup.trim()} — ${e.punchline.trim()}`);
			}
		}
		return i.filter(Boolean);
	} catch (e) {
		return console.error("[JOKES] Error loading jokes:", e), [
			"¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.",
			"¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.",
			"¿Cuál es el colmo de un electricista? Que su mujer se llame Luz."
		];
	}
}
async function Se(e = "es") {
	if (T.length === 0 && (T = await xe(e)), T.length === 0) return "No hay chistes disponibles.";
	let t = T.length > 1 ? T.filter((e) => e !== E) : T, n = t[Math.floor(Math.random() * t.length)];
	return E = n, n;
}
//#endregion
//#region electron/services/contactsService.ts
var D = s(typeof __dirname < "u" ? __dirname : o(c(import.meta.url)), "../../../cobien_FrontEnd/app/contacts"), O = s(D, "list_contacts.txt"), Ce = s(D, "default_user.png");
function we(e) {
	return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function Te(e) {
	let t = we(e);
	for (let e of [
		".png",
		".jpg",
		".jpeg",
		".PNG",
		".JPG",
		".JPEG"
	]) {
		let n = s(D, t + e);
		if (f.existsSync(n)) return n;
	}
	return Ce;
}
async function Ee() {
	let e = [];
	try {
		let t = await m.readFile(O, "utf-8");
		for (let n of t.split("\n")) {
			if (!n.includes("=")) continue;
			let [t, r] = n.split("=", 2).map((e) => e.trim());
			if (!t) continue;
			let i = /^[A-Za-z0-9_.-]+$/.test(r ?? ""), a = Te(t);
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
async function De(e, t, n) {
	try {
		let r = await fetch(e, {
			headers: { "X-Api-Key": n },
			signal: AbortSignal.timeout(15e3)
		});
		if (!r.ok) return null;
		let i = r.headers.get("Content-Type") || "", a = ".jpg";
		i.includes("png") ? a = ".png" : i.includes("webp") ? a = ".webp" : i.includes("gif") && (a = ".gif");
		let o = t + a, c = s(D, o), l = await r.arrayBuffer();
		return await m.writeFile(c, Buffer.from(l)), o;
	} catch (t) {
		return console.error(`[CONTACTS] Failed to download image ${e}:`, t), null;
	}
}
async function Oe(e, t, n) {
	try {
		f.existsSync(D) || f.mkdirSync(D, { recursive: !0 });
		let r = `${k(n, "/")}/pizarra/api/contacts/?device_id=${e}`, i = await fetch(r, {
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
				a.startsWith("/") && (e = k(n, "/") + "/" + ke(a, "/")), await De(e, we(r), t) && c++;
			}
		}
		let l = s.map((e) => `${e.display}=${e.user}`).join("\n") + "\n";
		return await m.writeFile(O, l), console.log(`[CONTACTS] Sync complete. ${s.length} contacts, ${c} images.`), {
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
function k(e, t) {
	let n = e;
	for (; n.endsWith(t);) n = n.slice(0, -t.length);
	return n;
}
function ke(e, t) {
	let n = e;
	for (; n.startsWith(t);) n = n.slice(t.length);
	return n;
}
async function Ae(e, t, n, r) {
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
		let i = `${k(r, "/")}/pizarra/api/notify/`, a = await fetch(i, {
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
var je = null, A = /* @__PURE__ */ new Map(), j = null;
function M() {
	return je ||= s(n.getPath("userData"), "reminders.json"), je;
}
async function N() {
	try {
		let e = await m.readFile(M(), "utf-8");
		return JSON.parse(e);
	} catch {
		return [];
	}
}
async function P(e) {
	await m.writeFile(M(), JSON.stringify(e, null, 2), "utf-8");
}
function F(e) {
	let t = new Date(e.datetime).getTime() - Date.now();
	if (t <= 0) return;
	let n = setTimeout(async () => {
		A.delete(e.id), j?.(e), await P((await N()).filter((t) => t.id !== e.id));
	}, t);
	A.set(e.id, n);
}
async function Me(e) {
	j = e;
	let t = await N(), n = /* @__PURE__ */ new Date(), r = [];
	for (let e of t) new Date(e.datetime) > n && (F(e), r.push(e));
	await P(r), console.log(`[REMINDERS] ${r.length} reminders scheduled`);
}
async function Ne(e, t) {
	let n = {
		id: `rem_${Date.now()}`,
		message: e,
		datetime: t
	}, r = await N();
	return r.push(n), await P(r), F(n), n;
}
async function Pe() {
	let e = await N(), t = /* @__PURE__ */ new Date();
	return e.filter((e) => new Date(e.datetime) > t);
}
async function Fe(e) {
	let t = await N(), n = t.filter((t) => t.id !== e);
	if (n.length === t.length) return !1;
	await P(n);
	let r = A.get(e);
	return r && (clearTimeout(r), A.delete(e)), !0;
}
//#endregion
//#region electron/services/mqttService.ts
var I = "rfid/read", L = "sensors/update", R = "app/nav", z = "events/reload", B = "board/reload", V = "weather/reload", Ie = [
	I,
	L,
	R,
	z,
	B,
	V
], Le = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
}, H = {}, Re = 5e3, ze = null, Be = 0, U = null, W = null;
function G(e) {
	!W || W.isDestroyed() || W.webContents.send("mqtt:event", e);
}
function Ve(e) {
	let t;
	try {
		t = e?.data?.id === void 0 ? parseInt(e.id ?? 0) : parseInt(e.data.id);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Date.now();
	if (t === ze && n - Be < Re) {
		console.log(`[MQTT] RFID debounce ignored: ${t}`);
		return;
	}
	ze = t, Be = n, console.log(`[MQTT] RFID card: ${t}`);
	let r = H[t];
	G(r ? {
		topic: R,
		type: "nav",
		source: "rfid",
		...r
	} : {
		topic: I,
		type: "rfid",
		cardId: t
	});
}
function He(e) {
	let t;
	try {
		t = e?.data?.PIC === void 0 ? parseInt(e.PIC ?? 0) : parseInt(e.data.PIC);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Le[t];
	n ? (console.log(`[MQTT] Button PIC=${t} → ${n.target}`), G({
		topic: L,
		type: "nav",
		target: n.target,
		source: n.source
	})) : console.warn(`[MQTT] Unknown button PIC: ${t}`);
}
function Ue(e) {
	G({
		topic: R,
		...e
	});
}
async function We() {
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
		H = n, console.log(`[MQTT] Loaded ${Object.keys(H).length} RFID actions`);
	} catch (e) {
		console.error("[MQTT] Failed to load RFID config:", e);
	}
}
function Ge(e) {
	W = e, We();
	let t = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${t}`), U = _.connect(t, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: !0
	}), U.on("connect", () => {
		console.log("[MQTT] Connected");
		for (let e of Ie) U.subscribe(e, { qos: 0 }, (t) => {
			t ? console.error(`[MQTT] Subscribe error on ${e}:`, t) : console.log(`[MQTT] Subscribed: ${e}`);
		});
		G({
			topic: "mqtt/status",
			type: "status",
			connected: !0
		});
	}), U.on("message", (e, t) => {
		let n = {};
		try {
			n = JSON.parse(t.toString());
		} catch {
			n = {};
		}
		switch (e) {
			case I:
				Ve(n);
				break;
			case L:
				He(n);
				break;
			case R:
				Ue(n);
				break;
			case z:
				G({
					topic: e,
					type: "reload",
					target: "events"
				});
				break;
			case B:
				G({
					topic: e,
					type: "reload",
					target: "board"
				});
				break;
			case V:
				G({
					topic: e,
					type: "reload",
					target: "weather"
				});
				break;
			case "rfid/actions_reload":
				We();
				break;
			default: console.log(`[MQTT] Unhandled topic: ${e}`);
		}
	}), U.on("error", (e) => {
		console.warn("[MQTT] Error:", e.message), G({
			topic: "mqtt/status",
			type: "status",
			connected: !1,
			error: e.message
		});
	}), U.on("offline", () => {
		console.warn("[MQTT] Offline — will retry"), G({
			topic: "mqtt/status",
			type: "status",
			connected: !1
		});
	}), U.on("reconnect", () => {
		console.log("[MQTT] Reconnecting...");
	});
}
function Ke() {
	U && (U.end(!0), U = null, console.log("[MQTT] Disconnected"));
}
//#endregion
//#region electron/services/asrService.ts
var K = typeof __dirname < "u" ? __dirname : o(c(import.meta.url)), q = null;
function qe() {
	q &&= (console.log("[ASR] Aborting current STT process"), q.kill(), null);
}
function Je(e = "es", t, n) {
	qe();
	let r = s(K, "../public/python/asr_bridge.py"), i = e === "es" ? s(K, "../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-es-0.42") : s(K, "../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-fr-0.22");
	return new Promise((e) => {
		let a = s(K, "../../../cobien_FrontEnd/app/.venv/bin/python3");
		console.log(`[ASR] Spawning bridge: ${a} ${r} ${i}`), q = d(a, [r, i]);
		let o = q, c = "";
		o.stdout.on("data", (e) => {
			let r = e.toString();
			c += r;
			let i = r.split("\n");
			for (let e of i) {
				let r = e.trim();
				if (r.includes("\"level\":")) try {
					let e = JSON.parse(r);
					typeof e.level == "number" && t && t(e.level);
				} catch {}
				else if (r.includes("\"partial\":")) try {
					let e = JSON.parse(r);
					typeof e.partial == "string" && n && n(e.partial);
				} catch {}
			}
		}), o.stderr.on("data", (e) => {
			console.error(`[ASR] Bridge Error: ${e}`);
		}), o.on("close", (t) => {
			console.log(`[ASR] Bridge closed with code ${t}`);
			try {
				let t = c.trim().split("\n"), n = "";
				for (let e = t.length - 1; e >= 0; e--) {
					let r = t[e].trim();
					if (r.startsWith("{") && r.endsWith("}") && r.includes("\"text\":")) {
						n = r;
						break;
					}
				}
				if (!n) {
					console.error("ASR Bridge: No text JSON found in output", c), e(null);
					return;
				}
				e(JSON.parse(n).text || null);
			} catch (t) {
				console.error("ASR Bridge parse error:", t, c), e(null);
			}
		});
	});
}
//#endregion
//#region electron/services/hardwareService.ts
var J = te(l);
async function Ye(e, t = !1) {
	try {
		return t ? await J(`pactl set-sink-volume @DEFAULT_SINK@ ${e}%`) : await J(`pactl set-sink-volume @DEFAULT_SINK@ ${`${e >= 0 ? "+" : ""}${e}%`}`), !0;
	} catch (e) {
		return console.error("Failed to adjust volume:", e), !1;
	}
}
async function Xe() {
	try {
		let { stdout: e } = await J("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(e.trim()) || 0;
	} catch (e) {
		return console.error("Failed to get volume:", e), 50;
	}
}
async function Ze(e) {
	try {
		let { stdout: t } = await J("xrandr --query | grep ' connected' | cut -d' ' -f1"), n = t.trim().split("\n");
		if (n.length === 0) return !1;
		for (let t of n) {
			let n = .4;
			if (e !== void 0) n = e;
			else {
				let { stdout: e } = await J(`xrandr --verbose --output ${t} | grep -i brightness`), r = parseFloat(e.split(":")[1].trim());
				n = r < .6 ? .7 : r < .9 ? 1 : .4;
			}
			await J(`xrandr --output ${t} --brightness ${n.toFixed(2)}`);
		}
		return !0;
	} catch (e) {
		return console.error("Failed to adjust brightness:", e), !1;
	}
}
//#endregion
//#region electron/services/wakeWordService.ts
var Y = null, X = !1;
function Qe(e, t) {
	if (X) return;
	X = !0;
	let n = s(t, "../../../cobien_FrontEnd/app/.venv/bin/python3"), r = s(t, "../public/python/asr_bridge.py"), i = s(t, "../../../cobien_FrontEnd/app/virtual_assistant/vosk_models/vosk-model-small-es-0.42");
	console.log("[WAKE] Starting detection for \"cobien\"..."), Y = d(n, [
		r,
		i,
		"--wake-word",
		"cobien"
	]), Y.stdout?.on("data", (t) => {
		let n = t.toString().split("\n");
		for (let t of n) if (t.includes("\"wake_word_detected\":")) {
			console.log("[WAKE] Keyword detected!"), e.webContents.send("asr:wake-word-detected"), $e();
			break;
		}
	}), Y.stderr?.on("data", (e) => {
		console.error(`[WAKE] Bridge Error: ${e}`);
	}), Y.on("close", (e) => {
		console.log(`[WAKE] Bridge closed with code ${e}`), X = !1, Y = null;
	});
}
function $e() {
	Y &&= (Y.kill(), null), X = !1;
}
//#endregion
//#region electron/main.ts
e.config();
var Z = typeof __dirname < "u" ? __dirname : o(c(import.meta.url)), Q = null, $ = s(Z, "../../../cobien_FrontEnd/app/config/config.default.json");
function et(e = "es", t = "male") {
	try {
		let n = s(Z, "../../../cobien_FrontEnd/app/config/config.default.json"), r = s(Z, "../../../cobien_FrontEnd/app/config/config.local.json"), i = JSON.parse(f.readFileSync(n, "utf-8")), a = {};
		try {
			a = JSON.parse(f.readFileSync(r, "utf-8"));
		} catch {}
		let o = {
			...i.services,
			...a.services
		}, c = s(Z, "../public/models/piper/bin/piper"), l = s(Z, "../public/models/piper/es_ES-davefx-medium.onnx"), u = o.tts_piper_bin || c, d = o[`tts_piper_model_${e}_${t}`] || o[`tts_piper_model_${e}`], p = "";
		if (d) if (d.startsWith("/") || d.includes(":") || d.startsWith("http")) p = d;
		else {
			let e = s(Z, "../../../cobien_FrontEnd/app", d), t = s(Z, "../public/models/piper", d);
			p = f.existsSync(e) ? e : f.existsSync(t) ? t : e;
		}
		else p = e === "fr" ? s(Z, "../public/models/piper/fr_FR-siwis-medium.onnx") : l;
		return {
			bin: u,
			model: p
		};
	} catch (e) {
		return console.error("Error reading piper config:", e), {
			bin: s(Z, "../public/models/piper/bin/piper"),
			model: s(Z, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
function tt() {
	r.handle("config:getWeather", async () => {
		try {
			let e = JSON.parse(await m.readFile($, "utf-8"));
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
			return JSON.parse(await m.readFile($, "utf-8")).settings || {};
		} catch {
			return {};
		}
	}), r.handle("config:saveWeather", async (e, t) => {
		try {
			let e = JSON.parse(await m.readFile($, "utf-8"));
			return e.settings.weather_city_catalog = t.catalog, e.settings.weather_cities = t.active, e.settings.weather_primary_city = t.primary, await m.writeFile($, JSON.stringify(e, null, 4)), !0;
		} catch (e) {
			return console.error("Error saving config:", e), !1;
		}
	}), r.handle("events:get", async () => await ie($)), r.handle("weather:fetch", async (e, t) => await ye(t)), r.handle("jokes:getRandom", async () => await Se("es")), r.handle("contacts:list", async () => await Ee()), r.handle("contacts:sync", async () => {
		let e = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await Oe(process.env.COBIEN_DEVICE_ID || "CoBien6", e, (JSON.parse(await m.readFile($, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), r.handle("contacts:requestCall", async (e, t) => {
		let n = process.env.COBIEN_NOTIFY_API_KEY || "";
		return await Ae(t, process.env.COBIEN_DEVICE_ID || "CoBien6", n, (JSON.parse(await m.readFile($, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), r.handle("contacts:openCall", async (e, t) => {
		let n = process.env.COBIEN_DEVICE_ID || "CoBien6", r = `${(JSON.parse(await m.readFile($, "utf-8")).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, "")}/videocall/?room=${encodeURIComponent(t)}&device=${encodeURIComponent(n)}`, { BrowserWindow: i } = await import("electron");
		return new i({
			width: 1024,
			height: 768,
			fullscreen: !0,
			webPreferences: {
				nodeIntegration: !1,
				contextIsolation: !0
			}
		}).loadURL(r), !0;
	}), r.handle("reminders:add", async (e, t, n) => await Ne(t, n)), r.handle("reminders:list", async () => await Pe()), r.handle("reminders:delete", async (e, t) => await Fe(t)), r.handle("events:addPersonal", async (e, t) => {
		let n = JSON.parse(await m.readFile($, "utf-8")).settings?.device_location || "Bilbao", r = process.env.COBIEN_DEVICE_ID || "CoBien6";
		return await ae({
			...t,
			location: n,
			deviceId: r
		});
	}), r.handle("events:delete", async (e, t) => await oe(t)), r.handle("board:fetch", async () => await ue()), r.handle("board:delete", async (e, t) => await de(t)), r.handle("board:read", async (e, t) => await fe(t)), r.handle("board:reply", async (e, t, n) => await pe(t, n)), r.handle("config:getSystemInfo", () => ({
		version: n.getVersion(),
		deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX"
	})), r.handle("app:restart", () => {
		n.relaunch(), n.exit();
	}), r.handle("app:exit", () => {
		n.quit();
	});
	let e = null;
	r.handle("tts:speak", async (t, n, r = "es", i = "male", a = "piper") => {
		if (console.log(`[TTS] Speaking (${r}/${i}) via ${a}: "${n}"`), e) {
			try {
				e.kill();
			} catch {}
			e = null;
		}
		let o = s(ee.tmpdir(), `tts_${Date.now()}.wav`), { bin: c, model: l } = et(r, i);
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
					let t = await m.readFile(o);
					await m.unlink(o), console.log(`[TTS] Generated WAV: ${t.length} bytes`), e(t);
				} catch (t) {
					console.error("[TTS] Error reading temp wav:", t), e(null);
				}
			});
			t.stdin?.write(n), t.stdin?.end();
		}) : (console.error("TTS: No Piper model configured."), null);
	}), r.handle("stt:listen", async (e, t) => await Je(t, (t) => {
		e.sender.send("asr:level", t);
	}, (t) => {
		e.sender.send("asr:partial", t);
	})), r.handle("hardware:adjustVolume", async (e, t, n = !1) => await Ye(t, n)), r.handle("hardware:adjustBrightness", async (e, t) => await Ze(t)), r.handle("hardware:getVolume", async () => await Xe()), r.handle("stt:abort", () => {
		qe();
	}), r.handle("asr:restartWakeWord", () => {
		Q && Qe(Q, Z);
	});
}
function nt() {
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
	}), tt();
	let e = (JSON.parse(f.readFileSync($, "utf-8")).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), r = process.env.COBIEN_NOTIFY_API_KEY || "";
	if (Oe(process.env.COBIEN_DEVICE_ID || "CoBien6", r, e).catch(console.error), nt(), Me((e) => {
		Q && Q.webContents.send("reminder:fire", e);
	}), Q) {
		let e = s(Z, "../../../cobien_FrontEnd/app/config/config.default.json"), t = s(Z, "../../../cobien_FrontEnd/app/config/config.local.json");
		ne(Q, e, t), Ge(Q), Qe(Q, Z);
	}
	n.on("activate", () => {
		t.getAllWindows().length === 0 && nt();
	});
}), n.on("window-all-closed", () => {
	Ke(), process.platform !== "darwin" && n.quit();
});
//#endregion
