import { a as e, c as t, i as n, l as r, n as i, o as a, r as o, s, u as c } from "./icsoService-Ds4g8yZJ.js";
import { a as l, i as u, n as d, t as f } from "./eventsMongo-CHARzMID.js";
import { i as p, n as m, r as h } from "./contactsService-Cva3scBa.js";
import ee from "dotenv";
import { BrowserWindow as g, app as _, ipcMain as v, net as y, protocol as b, session as te } from "electron";
import { exec as x, execFile as ne, execSync as re } from "node:child_process";
import { basename as ie, dirname as ae, join as S } from "node:path";
import { fileURLToPath as oe } from "node:url";
import * as C from "node:fs";
import { promises as w } from "node:fs";
import * as T from "node:os";
import * as se from "node:dns";
import * as ce from "node:net";
import le from "mqtt";
import { promisify as ue } from "node:util";
//#region electron/services/backendSync.ts
var E = "home", de = null, fe = null, pe = null;
function me(e) {
	de = e;
}
async function he(e, t) {
	return O(e, t);
}
async function ge(e, t, n) {
	v.handle("app:route-changed", (e, t, n) => {
		E = t;
		try {
			o(t, n || "touchscreen");
		} catch (e) {
			console.error("[SYNC] Failed to log navigation:", e);
		}
	});
	let r = parseInt(process.env.COBIEN_DEVICE_HEARTBEAT_INTERVAL_SEC || "300", 10);
	(isNaN(r) || r < 120) && (r = 300), console.log(`[SYNC] Heartbeat interval set to ${r}s`), fe = setInterval(() => O(t, n), r * 1e3);
	let i = parseInt(process.env.COBIEN_DEVICE_POLL_INTERVAL_SEC || "10", 10);
	(isNaN(i) || i < 5) && (i = 10), console.log(`[SYNC] Notification polling interval set to ${i}s`), pe = setInterval(() => we(e, t, n), i * 1e3), O(t, n), we(e, t, n);
}
function _e() {
	fe &&= (clearInterval(fe), null), pe &&= (clearInterval(pe), null), console.log("[SYNC] Backend sync stopped.");
}
async function ve(e, t) {
	try {
		let n = JSON.parse(await w.readFile(e, "utf-8")), r = {};
		try {
			r = JSON.parse(await w.readFile(t, "utf-8"));
		} catch {}
		return {
			services: {
				...n.services,
				...r.services
			},
			settings: {
				...n.settings,
				...r.settings
			}
		};
	} catch {
		return {
			services: {},
			settings: {}
		};
	}
}
function ye(e, t) {
	return new Promise((n) => {
		x(t ? `pgrep -x "${e}"` : `pgrep -f "${e}"`, (e) => {
			n(!e);
		});
	});
}
function be(e, t, n) {
	return new Promise((r) => {
		let i = new ce.Socket(), a = !1;
		i.setTimeout(n), i.once("connect", () => {
			a || (a = !0, i.destroy(), r(!0));
		}), i.once("timeout", () => {
			a || (a = !0, i.destroy(), r(!1));
		}), i.once("error", () => {
			a || (a = !0, i.destroy(), r(!1));
		}), i.connect(e, t);
	});
}
async function D(e) {
	try {
		return (await w.readFile(e, "utf-8")).trim();
	} catch {
		return "";
	}
}
async function xe() {
	try {
		return await ye("mosquitto", !0) ? await be(1883, "localhost", 2e3) ? "ok" : "warn" : "error";
	} catch {
		return "unknown";
	}
}
async function Se() {
	try {
		return await ye("cobien_bridge", !1) ? await be(1883, "localhost", 2e3) ? "ok" : "warn" : "error";
	} catch {
		return "unknown";
	}
}
function Ce(e) {
	return !e || e.operstate !== "up" ? "error" : e.rx_packets + e.tx_packets > 0 ? "ok" : "warn";
}
async function O(e, t) {
	let { services: n, settings: r } = await ve(e, t), i = n.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/", a = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || n.notify_api_key || "", o = process.env.COBIEN_DEVICE_ID || r.device_id || "CoBien6", s = null;
	try {
		let e = await D("/sys/class/net/can0/operstate");
		if (e) {
			let t = await D("/sys/class/net/can0/carrier"), n = parseInt(await D("/sys/class/net/can0/statistics/rx_packets") || "0", 10), r = parseInt(await D("/sys/class/net/can0/statistics/tx_packets") || "0", 10), i = parseInt(await D("/sys/class/net/can0/statistics/rx_errors") || "0", 10), a = parseInt(await D("/sys/class/net/can0/statistics/tx_errors") || "0", 10);
			s = {
				present: !0,
				operstate: e,
				carrier: t,
				rx_packets: isNaN(n) ? 0 : n,
				tx_packets: isNaN(r) ? 0 : r,
				rx_errors: isNaN(i) ? 0 : i,
				tx_errors: isNaN(a) ? 0 : a
			};
		}
	} catch {}
	let c = await xe(), l = await Se(), u = Ce(s), d = "";
	try {
		d = await new Promise((e) => {
			x("rustdesk --get-id", (t, n) => {
				e(t ? "" : n.trim());
			});
		});
	} catch {}
	let f = {
		device_id: o,
		screen: E,
		sent_at: (/* @__PURE__ */ new Date()).toISOString(),
		software_version: `Electron-v${_.getVersion()}`,
		rustdesk_id: d,
		...de === null ? {} : { network_speed_kbps: de },
		services_status: {
			app: "ok",
			mosquitto: c,
			mqtt_can_bridge: l,
			can_interface: u,
			checked_at: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
	s && (f.can_status = s);
	try {
		let e = await fetch(i, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": a
			},
			body: JSON.stringify(f)
		});
		e.ok ? console.log(`[HEARTBEAT] Sent (Screen: ${E})`) : console.warn(`[HEARTBEAT] Failed with status: ${e.status}`);
	} catch {
		console.error("[HEARTBEAT] Network error");
	}
}
async function we(e, t, r) {
	let { services: i, settings: a } = await ve(t, r), o = i.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/", s = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || i.notify_api_key || "", c = process.env.COBIEN_DEVICE_ID || a.device_id || "CoBien6";
	try {
		let a = await fetch(`${o}?device_id=${c}`, {
			method: "GET",
			headers: { "X-API-KEY": s }
		});
		if (a.ok) {
			let o = (await a.json()).notifications || [];
			if (o.length > 0) {
				console.log(`[POLL] Received ${o.length} notifications`);
				let a = !1;
				o.forEach((o) => {
					e && !e.isDestroyed() && e.webContents.send("backend:notification", o);
					let l = (o.type || "").toLowerCase();
					if ((l === "new_event" || l === "events_reload") && (a = !0, l === "new_event")) try {
						n("event");
					} catch (e) {
						console.error("[POLL] Failed to log remote event received:", e);
					}
					if (l === "force_update") {
						console.log("[POLL] Force update notification received. Triggering manual update...");
						let e = process.env.COBIEN_RUNTIME_STATE_DIR || S(T.homedir(), ".local/state/cobien/runtime"), t = S(e, "manual_update_reload.flag");
						w.mkdir(e, { recursive: !0 }).then(() => w.writeFile(t, JSON.stringify({ requested_at: (/* @__PURE__ */ new Date()).toISOString() }))).then(() => {
							console.log(`[POLL] Created manual update reload flag at: ${t}`), x("systemctl --user start cobien-update.service", (e, t, n) => {
								e ? console.error("[POLL] Failed to start update service:", e) : console.log("[POLL] Update service started successfully:", t);
							});
						}).catch((e) => {
							console.error("[POLL] Failed to prepare manual update reload flag:", e);
						});
					} else if (l === "restart") console.log("[POLL] Restart notification received. Rebooting device..."), x("systemctl reboot -i || echo cobien | sudo -S systemctl reboot -i || echo cobien | sudo -S reboot -f || reboot", (e, t, n) => {
						e ? console.error("[POLL] Failed to reboot device:", e) : console.log("[POLL] Reboot command executed successfully:", t);
					});
					else if (l === "contacts_updated") {
						console.log("[POLL] Contacts updated notification received. Syncing contacts...");
						let t = (i.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
						import("./contactsService-Cva3scBa.js").then((e) => e.t).then(({ syncContacts: n }) => {
							n(c, s, t).then(() => {
								e && !e.isDestroyed() && e.webContents.send("contacts:updated");
							}).catch((e) => console.error("[POLL] Failed to sync contacts on notification:", e));
						}).catch((e) => console.error("[POLL] Failed to dynamically import contactsService:", e));
					} else l === "icso_reset" && (console.log("[POLL] ICSO reset notification received. Resetting local telemetry..."), import("./icsoService-Ds4g8yZJ.js").then((e) => e.t).then(({ resetLocalTelemetry: e, syncIcsoToBackend: n }) => {
						e(), n(t, r, !0);
					}).catch((e) => console.error("[POLL] Failed to reset local telemetry:", e)));
				}), a && (console.log("[POLL] Event notification received. Refreshing local events cache..."), import("./eventsMongo-CHARzMID.js").then((e) => e.r).then(({ getEvents: e }) => {
					e(t).catch((e) => console.error("[POLL] Failed to background-refresh events:", e));
				}).catch((e) => console.error("[POLL] Failed to dynamically import eventsMongo:", e)));
			}
		}
	} catch {}
}
//#endregion
//#region electron/services/boardService.ts
var Te = "board_cache";
async function Ee() {
	let e = S(_.getPath("userData"), Te);
	try {
		await w.access(e);
	} catch {
		await w.mkdir(e, { recursive: !0 });
	}
	return e;
}
async function De(e, t, n) {
	if (!e) return "";
	e.startsWith("/") && (e = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}${e}`);
	try {
		let r = await Ee(), i = ".png";
		(e.includes(".jpg") || e.includes(".jpeg")) && (i = ".jpg");
		let a = S(r, `${t}_${n}${i}`);
		try {
			return await w.access(a), `cobien-media://${a}`;
		} catch {}
		let o = {};
		process.env.COBIEN_NOTIFY_API_KEY && (o["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
		let s = await fetch(e, {
			headers: o,
			signal: AbortSignal.timeout(15e3)
		});
		if (!s.ok) throw Error(`Failed to fetch image: ${s.statusText}`);
		if (s.body) {
			let e = await s.arrayBuffer(), t = Buffer.from(e);
			return await w.writeFile(a, t), `cobien-media://${a}`;
		}
		return "";
	} catch (t) {
		return console.error(`[BOARD] Failed to cache image ${e}:`, t), "";
	}
}
async function Oe() {
	let e = process.env.COBIEN_DEVICE_ID || "CoBien6", t = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/?recipient=${e}`, n = {};
	process.env.COBIEN_NOTIFY_API_KEY && (n["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		let e = await fetch(t, {
			headers: n,
			signal: AbortSignal.timeout(12e3)
		});
		if (!e.ok) throw Error(`API returned ${e.statusText}`);
		let r = (await e.json()).messages || [];
		return await Promise.all(r.map(async (e) => {
			let t = "", n = "";
			return (e.image || e.image_url) && (t = await De(e.image || e.image_url, "img", e.id)), e.author_avatar_url && (n = await De(e.author_avatar_url, "avatar", e.id)), {
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
async function ke(e) {
	let t = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${e}/delete/`, n = {};
	process.env.COBIEN_NOTIFY_API_KEY && (n["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		return (await fetch(t, {
			method: "POST",
			headers: n,
			signal: AbortSignal.timeout(12e3)
		})).ok;
	} catch (e) {
		return console.error("[BOARD] Failed to delete message:", e), !1;
	}
}
async function Ae(e) {
	let t = process.env.COBIEN_DEVICE_ID || "CoBien6", n = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${e}/read/`, r = { "Content-Type": "application/json" };
	process.env.COBIEN_NOTIFY_API_KEY && (r["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		return (await fetch(n, {
			method: "POST",
			headers: r,
			body: JSON.stringify({ device_id: t }),
			signal: AbortSignal.timeout(12e3)
		})).ok;
	} catch (e) {
		return console.error("[BOARD] Failed to mark message read:", e), !1;
	}
}
async function je(e, t) {
	let n = process.env.COBIEN_DEVICE_ID || "CoBien6", r = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${e}/reply/`, i = { "Content-Type": "application/json" };
	process.env.COBIEN_NOTIFY_API_KEY && (i["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY);
	try {
		return (await fetch(r, {
			method: "POST",
			headers: i,
			body: JSON.stringify({
				device_id: n,
				reply_text: t
			}),
			signal: AbortSignal.timeout(12e3)
		})).ok;
	} catch (e) {
		return console.error("[BOARD] Failed to submit reply:", e), !1;
	}
}
//#endregion
//#region electron/services/weatherService.ts
var Me = {
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
}, Ne = {
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
function k(e, t = !0) {
	return !t && e <= 1 ? "/svg/noche.svg" : Me[e] ?? "/svg/nubes.svg";
}
function A(e, t = "es") {
	return (Ne[t] || Ne.es)[e] ?? (t === "en" ? "Unknown condition" : t === "fr" ? "Condition inconnue" : "Condición desconocida");
}
function Pe(e) {
	let t = new Date(e).getHours(), n = t < 12 ? "a.m." : "p.m.";
	return `${t % 12 || 12} ${n}`;
}
async function Fe(e) {
	let t = process.env.OWM_API_KEY ?? "";
	try {
		let t = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e)}`, n = await fetch(t, {
			headers: { "User-Agent": "CoBien6-Furniture" },
			signal: AbortSignal.timeout(4e3)
		});
		if (!n.ok) throw Error(`Nominatim returned status ${n.status}`);
		let r = await n.json();
		if (!r.length) throw Error("No Nominatim results");
		return {
			lat: parseFloat(r[0].lat),
			lon: parseFloat(r[0].lon),
			tz: "auto"
		};
	} catch (n) {
		if (console.warn("[WEATHER] Nominatim geocode failed, trying OWM fallback:", n), t) try {
			let n = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(e)}&limit=1&appid=${t}`, r = await fetch(n, { signal: AbortSignal.timeout(4e3) });
			if (!r.ok) throw Error(`OWM Geo returned status ${r.status}`);
			let i = await r.json();
			if (i && i.length > 0) return {
				lat: i[0].lat,
				lon: i[0].lon,
				tz: "auto"
			};
		} catch (e) {
			console.error("[WEATHER] OWM geocode fallback also failed:", e);
		}
		return null;
	}
}
function j(e) {
	let t = e.substring(0, 2), n = e.endsWith("n");
	switch (t) {
		case "01": return n ? "/svg/noche.svg" : "/images/sol.png";
		case "02":
		case "03": return "/svg/parcial.svg";
		case "04": return "/svg/nubes.svg";
		case "09":
		case "10":
		case "11": return t === "11" ? "/images/tormenta.png" : "/images/lluvia.png";
		case "13": return "/svg/nieve.svg";
		case "50": return "/images/neblina.png";
		default: return "/svg/nubes.svg";
	}
}
async function Ie(e, t = "es") {
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
	}, r = process.env.OWM_API_KEY ?? "";
	try {
		let i = await Fe(e);
		if (!i) return n.error = "Ciudad no encontrada", n;
		let { lat: a, lon: o, tz: s } = i;
		try {
			let e = [
				`https://api.open-meteo.com/v1/forecast?latitude=${a}&longitude=${o}`,
				`&timezone=${encodeURIComponent(s)}`,
				"&current=temperature_2m,weathercode,is_day",
				"&hourly=temperature_2m,weathercode",
				"&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,wind_speed_10m_max",
				"&forecast_days=7"
			].join(""), i = await fetch(e, { signal: AbortSignal.timeout(4e3) });
			if (!i.ok) throw Error(`Open-Meteo returned status ${i.status}`);
			let c = await i.json(), l = c.current?.weathercode ?? 0, u = (c.current?.is_day ?? 1) === 1;
			if (n.temp = `${Math.round(c.current?.temperature_2m ?? 0)}°`, n.icon = k(l, u), r) try {
				let e = `https://api.openweathermap.org/data/2.5/weather?lat=${a}&lon=${o}&appid=${r}&units=metric&lang=${t}`;
				n.description = (await (await fetch(e, { signal: AbortSignal.timeout(4e3) })).json()).weather?.[0]?.description ?? A(l, t), n.description = n.description.charAt(0).toUpperCase() + n.description.slice(1);
			} catch {
				n.description = A(l, t);
			}
			else n.description = A(l, t);
			let d = Math.round(c.daily?.temperature_2m_min?.[0] ?? 0), f = Math.round(c.daily?.temperature_2m_max?.[0] ?? 0);
			n.tempMin = `Min ${d}°`, n.tempMax = `Max ${f}°`, n.todayPop = c.daily?.precipitation_probability_max?.[0] ?? 0, n.todayWind = Math.round(c.daily?.wind_speed_10m_max?.[0] ?? 0);
			let p = (/* @__PURE__ */ new Date()).getHours(), m = c.hourly?.time ?? [], h = c.hourly?.temperature_2m ?? [], ee = c.hourly?.weathercode ?? [], g = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), _ = m.findIndex((e) => e.startsWith(g) && new Date(e).getHours() >= p);
			_ < 0 && (_ = 0), n.hourly = m.slice(_, _ + 12).map((e, t) => {
				let n = new Date(e).getHours();
				return {
					time: Pe(e),
					icon: k(ee[_ + t] ?? 0, n >= 6 && n < 20),
					temp: `${Math.round(h[_ + t] ?? 0)}°`
				};
			});
			let v = c.daily?.time ?? [], y = c.daily?.temperature_2m_max ?? [], b = c.daily?.temperature_2m_min ?? [], te = c.daily?.weathercode ?? [], x = c.daily?.precipitation_probability_max ?? [], ne = c.daily?.wind_speed_10m_max ?? [];
			n.daily = v.slice(1, 7).map((e, n) => {
				let r = new Date(e), i = r.getDate(), a = t === "en" ? "en-US" : t === "fr" ? "fr-FR" : "es-ES", o = r.toLocaleDateString(a, { month: "long" }), s = r.toLocaleDateString(a, { weekday: "long" });
				return {
					name: s.charAt(0).toUpperCase() + s.slice(1),
					date: t === "en" ? `${o} ${i}` : `${i} de ${o}`,
					icon: k(te[n + 1] ?? 0),
					tmin: `${Math.round(b[n + 1] ?? 0)}°`,
					tmax: `${Math.round(y[n + 1] ?? 0)}°`,
					pop: x[n + 1] ?? 0,
					wind: Math.round(ne[n + 1] ?? 0)
				};
			});
		} catch (e) {
			if (!r) throw e;
			console.warn("[WEATHER] Open-Meteo failed, executing OpenWeatherMap fallback:", e.message || e);
			let i = `https://api.openweathermap.org/data/2.5/weather?lat=${a}&lon=${o}&appid=${r}&units=metric&lang=${t}`, s = `https://api.openweathermap.org/data/2.5/forecast?lat=${a}&lon=${o}&appid=${r}&units=metric&lang=${t}`, [c, l] = await Promise.all([fetch(i, { signal: AbortSignal.timeout(4e3) }), fetch(s, { signal: AbortSignal.timeout(4e3) })]);
			if (!c.ok) throw Error(`OWM current weather returned status ${c.status}`);
			if (!l.ok) throw Error(`OWM forecast returned status ${l.status}`);
			let u = await c.json(), d = await l.json();
			n.temp = `${Math.round(u.main.temp)}°`, n.icon = j(u.weather[0].icon), n.description = u.weather[0].description, n.description = n.description.charAt(0).toUpperCase() + n.description.slice(1), n.tempMin = `Min ${Math.round(u.main.temp_min)}°`, n.tempMax = `Max ${Math.round(u.main.temp_max)}°`, n.todayPop = 0, n.todayWind = Math.round(u.wind.speed * 3.6), n.hourly = d.list.slice(0, 4).map((e) => ({
				time: Pe(e.dt_txt),
				icon: j(e.weather[0].icon),
				temp: `${Math.round(e.main.temp)}°`
			}));
			let f = {}, p = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			for (let e of d.list) {
				let t = e.dt_txt.slice(0, 10);
				if (t === p) {
					n.todayPop === 0 && e.pop !== void 0 && (n.todayPop = Math.round(e.pop * 100));
					continue;
				}
				f[t] || (f[t] = []), f[t].push(e);
			}
			n.daily = Object.keys(f).sort().slice(0, 6).map((e) => {
				let n = f[e], r = 999, i = -999, a = 0, o = 0, s = n[Math.floor(n.length / 2)];
				for (let e of n) e.main.temp_min < r && (r = e.main.temp_min), e.main.temp_max > i && (i = e.main.temp_max), e.pop && e.pop > a && (a = e.pop), e.wind && e.wind.speed > o && (o = e.wind.speed), e.dt_txt.endsWith("12:00:00") && (s = e);
				let c = new Date(e), l = t === "en" ? "en-US" : t === "fr" ? "fr-FR" : "es-ES", u = c.toLocaleDateString(l, { weekday: "long" }), d = c.toLocaleDateString(l, { month: "long" }), p = c.getDate();
				return {
					name: u.charAt(0).toUpperCase() + u.slice(1),
					date: t === "en" ? `${d} ${p}` : `${p} de ${d}`,
					icon: j(s.weather[0].icon),
					tmin: `${Math.round(r)}°`,
					tmax: `${Math.round(i)}°`,
					pop: Math.round(a * 100),
					wind: Math.round(o * 3.6)
				};
			});
		}
		return n;
	} catch (e) {
		return console.error("[WEATHER] fetchWeatherBundle error:", e), n.error = String(e), n;
	}
}
//#endregion
//#region electron/services/jokesService.ts
var Le = S(typeof __dirname < "u" ? __dirname : ae(oe(import.meta.url)), "../public/data/jokes"), M = {}, Re = {};
async function ze(e = "es") {
	try {
		let t = e === "fr" ? "jokes_fr.json" : e === "en" ? "jokes_en.json" : "jokes_es.json", n = await w.readFile(S(Le, t), "utf-8"), r = JSON.parse(n), i = [];
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
async function Be(e = "es") {
	let t = [
		"es",
		"en",
		"fr"
	].includes(e) ? e : "es";
	(!M[t] || M[t].length === 0) && (M[t] = await ze(t));
	let n = M[t];
	if (n.length === 0) return t === "en" ? "No jokes available." : t === "fr" ? "Aucune blague disponible." : "No hay chistes disponibles.";
	let r = Re[t] || "", i = n.length > 1 ? n.filter((e) => e !== r) : n, a = i[Math.floor(Math.random() * i.length)];
	return Re[t] = a, a;
}
//#endregion
//#region electron/services/remindersService.ts
var Ve = null, N = /* @__PURE__ */ new Map(), He = null;
function Ue() {
	return Ve ||= S(_.getPath("userData"), "reminders.json"), Ve;
}
async function P() {
	try {
		let e = await w.readFile(Ue(), "utf-8");
		return JSON.parse(e);
	} catch {
		return [];
	}
}
async function F(e) {
	await w.writeFile(Ue(), JSON.stringify(e, null, 2), "utf-8");
}
function We(e) {
	let t = new Date(e.datetime).getTime() - Date.now();
	if (t <= 0) return;
	let n = setTimeout(async () => {
		N.delete(e.id), He?.(e), await F((await P()).filter((t) => t.id !== e.id));
	}, t);
	N.set(e.id, n);
}
async function Ge(e) {
	He = e;
	let t = await P(), n = /* @__PURE__ */ new Date(), r = [];
	for (let e of t) new Date(e.datetime) > n && (We(e), r.push(e));
	await F(r), console.log(`[REMINDERS] ${r.length} reminders scheduled`);
}
async function Ke(e, t) {
	let n = {
		id: `rem_${Date.now()}`,
		message: e,
		datetime: t
	}, r = await P();
	return r.push(n), await F(r), We(n), n;
}
async function qe() {
	let e = await P(), t = /* @__PURE__ */ new Date();
	return e.filter((e) => new Date(e.datetime) > t);
}
async function Je(e) {
	let t = await P(), n = t.filter((t) => t.id !== e);
	if (n.length === t.length) return !1;
	await F(n);
	let r = N.get(e);
	return r && (clearTimeout(r), N.delete(e)), !0;
}
//#endregion
//#region electron/services/mqttService.ts
var I = "rfid/read", L = "sensors/update", R = "app/nav", Ye = "events/reload", Xe = "board/reload", Ze = "weather/reload", Qe = "proximity/update", $e = "imu/update", et = [
	I,
	L,
	R,
	Ye,
	Xe,
	Ze,
	"rfid/actions_reload",
	Qe,
	$e
], tt = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
}, z = {}, nt = 5e3, rt = null, it = 0, at = !1, B = null, V = null;
function H(e) {
	!V || V.isDestroyed() || V.webContents.send("mqtt:event", e);
}
function ot(e) {
	let t;
	try {
		t = e?.data?.id === void 0 ? parseInt(e.id ?? 0) : parseInt(e.data.id);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Date.now();
	if (t === rt && n - it < nt) {
		console.log(`[MQTT] RFID debounce ignored: ${t}`);
		return;
	}
	if (rt = t, it = n, console.log(`[MQTT] RFID card: ${t}`), at) {
		H({
			topic: I,
			type: "rfid",
			cardId: t
		});
		return;
	}
	let r = z[t];
	H(r ? {
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
function st(e) {
	let t;
	try {
		t = e?.data?.PIC === void 0 ? parseInt(e.PIC ?? 0) : parseInt(e.data.PIC);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = tt[t];
	n ? (console.log(`[MQTT] Button PIC=${t} → ${n.target}`), H({
		topic: L,
		type: "nav",
		target: n.target,
		source: n.source
	})) : console.warn(`[MQTT] Unknown button PIC: ${t}`);
}
function ct(e) {
	H({
		topic: R,
		...e
	});
}
async function U() {
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
		z = n, console.log(`[MQTT] Loaded ${Object.keys(z).length} RFID actions`);
	} catch (e) {
		console.error("[MQTT] Failed to load RFID config:", e);
	}
}
function lt(t) {
	let n = 0, r = 0;
	try {
		n = t?.data?.can_id === void 0 ? parseInt(t.can_id ?? 0) : parseInt(t.data.can_id), r = t?.data?.event === void 0 ? parseInt(t.event ?? 0) : parseInt(t.data.event);
	} catch {}
	n && r && e(n, r);
}
function ut(e) {
	i();
}
function dt(e) {
	V = e, U();
	let t = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${t}`), B = le.connect(t, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: !0
	}), B.on("connect", () => {
		console.log("[MQTT] Connected");
		for (let e of et) B.subscribe(e, { qos: 0 }, (t) => {
			t ? console.error(`[MQTT] Subscribe error on ${e}:`, t) : console.log(`[MQTT] Subscribed: ${e}`);
		});
		H({
			topic: "mqtt/status",
			type: "status",
			connected: !0
		});
	}), B.on("message", (e, t) => {
		let r = {};
		try {
			r = JSON.parse(t.toString());
		} catch {
			r = {};
		}
		switch (e) {
			case I:
				ot(r);
				break;
			case L:
				st(r);
				break;
			case R:
				ct(r);
				break;
			case Ye:
				H({
					topic: e,
					type: "reload",
					target: "events"
				});
				break;
			case Xe:
				try {
					n("photo");
				} catch (e) {
					console.error("[MQTT] Failed to log photo received:", e);
				}
				H({
					topic: e,
					type: "reload",
					target: "board"
				});
				break;
			case Ze:
				H({
					topic: e,
					type: "reload",
					target: "weather"
				});
				break;
			case Qe:
				lt(r);
				break;
			case $e:
				ut(r);
				break;
			case "rfid/actions_reload":
				U();
				break;
			default: console.log(`[MQTT] Unhandled topic: ${e}`);
		}
	}), B.on("error", (e) => {
		console.warn("[MQTT] Error:", e.message), H({
			topic: "mqtt/status",
			type: "status",
			connected: !1,
			error: e.message
		});
	}), B.on("offline", () => {
		console.warn("[MQTT] Offline — will retry"), H({
			topic: "mqtt/status",
			type: "status",
			connected: !1
		});
	}), B.on("reconnect", () => {
		console.log("[MQTT] Reconnecting...");
	});
}
function ft() {
	B && (B.end(!0), B = null, console.log("[MQTT] Disconnected"));
}
var pt = {
	all: 0,
	square: 1,
	diamond: 2,
	plus: 3,
	X: 4,
	only_center: 5
}, mt = {
	on: 0,
	off: 1,
	blink: 2,
	fading_blink: 3
};
function ht(e, t) {
	let n = pt[e] ?? 0, r = mt[t] ?? 0;
	return n << 4 | r;
}
function gt(e) {
	if (!B || !B.connected) {
		console.warn("[MQTT] Client not connected, cannot publish button config");
		return;
	}
	if (e.PIC1) {
		let t = e.PIC1, n = {
			PIC: 1,
			shape_mode: ht(t.shape || "all", t.mode || "on"),
			color: t.color || "#ffffff",
			intensity: t.intensity === void 0 ? 255 : parseInt(t.intensity, 10)
		};
		B.publish("button/config", JSON.stringify(n)), console.log("[MQTT] Published button config for PIC1:", n);
	}
	if (e.PIC2) {
		let t = e.PIC2, n = {
			PIC: 2,
			shape_mode: ht(t.shape || "all", t.mode || "on"),
			color: t.color || "#ffffff",
			intensity: t.intensity === void 0 ? 255 : parseInt(t.intensity, 10)
		};
		B.publish("button/config", JSON.stringify(n)), console.log("[MQTT] Published button config for PIC2:", n);
	}
}
var _t = {
	OFF: 1,
	ON: 0,
	BLINK: 2,
	FADING_BLINK: 3
};
function vt(e) {
	if (!B || !B.connected) {
		console.warn("[MQTT] Client not connected, cannot publish notification LED");
		return;
	}
	let t = _t[(e.mode || "ON").toUpperCase()] ?? 0, n = {
		group: 7,
		color: e.color || "#FFFFFF",
		intensity: e.intensity === void 0 ? 255 : parseInt(e.intensity, 10),
		mode: t
	};
	B.publish("ledstrip/config", JSON.stringify(n)), console.log("[MQTT] Published notification LED config:", n);
}
function yt() {
	if (!B || !B.connected) {
		console.warn("[MQTT] Client not connected, cannot turn off notification LED");
		return;
	}
	let e = {
		group: 7,
		color: "#000000",
		intensity: 0,
		mode: 1
	};
	B.publish("ledstrip/config", JSON.stringify(e)), console.log("[MQTT] Published LED turn-off config:", e);
}
function bt(e) {
	if (at = e === 1, !B || !B.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID init");
		return;
	}
	let t = { mode: e };
	B.publish("rfid/init", JSON.stringify(t)), console.log("[MQTT] Published RFID init:", t);
}
function xt(e, t) {
	if (!B || !B.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID config");
		return;
	}
	let n = {
		id: e,
		action: t
	};
	B.publish("rfid/config", JSON.stringify(n)), console.log("[MQTT] Published RFID config:", n);
}
function St() {
	if (!B || !B.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID reload");
		return;
	}
	let e = {
		action: "reload",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	};
	B.publish("rfid/actions_reload", JSON.stringify(e)), console.log("[MQTT] Published RFID actions reload:", e), U();
}
//#endregion
//#region electron/services/hardwareService.ts
var W = ue(x);
async function Ct(e, t = !1) {
	try {
		return t ? await W(`pactl set-sink-volume @DEFAULT_SINK@ ${e}%`) : await W(`pactl set-sink-volume @DEFAULT_SINK@ ${`${e >= 0 ? "+" : ""}${e}%`}`), !0;
	} catch (e) {
		return console.error("Failed to adjust volume:", e), !1;
	}
}
async function wt() {
	try {
		let { stdout: e } = await W("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(e.trim()) || 0;
	} catch (e) {
		return console.error("Failed to get volume:", e), 50;
	}
}
async function Tt(e) {
	try {
		let { stdout: t } = await W("xrandr --query | grep ' connected' | cut -d' ' -f1"), n = t.trim().split("\n");
		if (n.length === 0) return !1;
		for (let t of n) {
			let n = .4;
			if (e !== void 0) n = e;
			else {
				let { stdout: e } = await W(`xrandr --verbose --output ${t} | grep -i brightness`), r = parseFloat(e.split(":")[1].trim());
				n = r < .6 ? .7 : r < .9 ? 1 : .4;
			}
			await W(`xrandr --output ${t} --brightness ${n.toFixed(2)}`);
		}
		return !0;
	} catch (e) {
		return console.error("Failed to adjust brightness:", e), !1;
	}
}
//#endregion
//#region electron/services/logsSyncService.ts
var G = S(_.getPath("userData"), "logs"), Et = S(_.getPath("userData"), "logs_sync_state.json"), Dt = 120 * 1024, Ot = 1500, kt = [
	{
		log_type: "app",
		prefix: "cobien-app"
	},
	{
		log_type: "can_bus",
		prefix: "can-bus"
	},
	{
		log_type: "mqtt_can_bridge",
		prefix: "mqtt-can-bridge"
	}
], K = null;
function At() {
	C.existsSync(G) || C.mkdirSync(G, { recursive: !0 });
}
function jt() {
	if (!C.existsSync(Et)) return {
		last_sync_at: "",
		last_error: "",
		files: {}
	};
	try {
		let e = C.readFileSync(Et, "utf-8"), t = JSON.parse(e);
		return {
			last_sync_at: t.last_sync_at || "",
			last_error: t.last_error || "",
			files: t.files || {}
		};
	} catch {
		return {
			last_sync_at: "",
			last_error: "",
			files: {}
		};
	}
}
function Mt(e) {
	try {
		C.writeFileSync(Et, JSON.stringify(e, null, 4), "utf-8");
	} catch (e) {
		console.error("[SUPPORT LOGS] Failed to save sync state:", e);
	}
}
function Nt(e) {
	try {
		let t = C.statSync(e);
		return `${Math.floor(t.mtimeMs)}:${t.size}`;
	} catch {
		return "";
	}
}
function Pt() {
	let e = /* @__PURE__ */ new Date(), t = /* @__PURE__ */ new Date();
	return t.setDate(e.getDate() - 1), [e, t];
}
function Ft(e) {
	let t = (e) => e.toString().padStart(2, "0");
	return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())}`;
}
function It(e) {
	let t = (e) => e.toString().padStart(2, "0");
	return `${e.getFullYear()}${t(e.getMonth() + 1)}${t(e.getDate())}`;
}
async function Lt(e) {
	try {
		let t = (await w.stat(e)).size, n = Math.max(0, t - Dt), r = await w.open(e, "r"), i = Buffer.alloc(t - n);
		await r.read(i, 0, t - n, n), await r.close();
		let a = i.toString("utf-8");
		if (n > 0) {
			let e = a.indexOf("\n");
			e >= 0 && (a = a.substring(e + 1));
		}
		let o = a.split("\n").map((e) => e.trim()).filter((e) => e.length > 0), s = n > 0 || o.length > Ot;
		return o.length > Ot && (o = o.slice(-Ot)), {
			content: o.join("\n").trim(),
			line_count: o.length,
			byte_count: t,
			truncated: s
		};
	} catch {
		return {
			content: "",
			line_count: 0,
			byte_count: 0,
			truncated: !1
		};
	}
}
async function Rt(e, t, n = !1) {
	At();
	let r = {}, i = {};
	try {
		let n = JSON.parse(C.readFileSync(e, "utf-8")), a = {};
		try {
			a = JSON.parse(C.readFileSync(t, "utf-8"));
		} catch {}
		r = {
			...n.services,
			...a.services
		}, i = {
			...n.settings,
			...a.settings
		};
	} catch (e) {
		console.error("[SUPPORT LOGS] Configuration read failed:", e);
		return;
	}
	let a = (r.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), o = (r.device_logs_ingest_url || `${a}/pizarra/api/device/logs/ingest/`).trim(), s = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || r.notify_api_key || "", c = process.env.COBIEN_DEVICE_ID || i.device_id || "CoBien6";
	if (!c || !o) return;
	let l = { "Content-Type": "application/json" };
	s && (l["X-API-KEY"] = s);
	let u = jt(), d = u.files || {}, f = { ...d }, p = [], m = (/* @__PURE__ */ new Date()).toISOString(), h = Pt();
	for (let e of kt) for (let [t, r] of h.entries()) {
		let i = Ft(r), a = `${e.log_type}:${i}`, o = "";
		if (e.log_type === "app") if (t === 0) o = S(G, "app.log");
		else {
			let e = S(G, "app.log.1");
			o = C.existsSync(e) ? e : S(G, `cobien-app-${It(r)}.log`);
		}
		else {
			let n = S(G, `${e.prefix}-${It(r)}.log`);
			if (C.existsSync(n)) o = n;
			else if (t === 0) {
				let t = e.log_type === "can_bus" ? [
					"can-bus.log",
					"can_bus.log",
					"can.log",
					"can-bus.txt",
					"can_bus.txt"
				] : [
					"mqtt-can-bridge.log",
					"mqtt_can_bridge.log",
					"bridge.log",
					"mqtt-can-bridge.txt"
				];
				for (let e of t) {
					let t = S(G, e);
					if (C.existsSync(t)) {
						o = t;
						break;
					}
				}
			}
		}
		if (!o || !C.existsSync(o)) {
			delete f[a];
			continue;
		}
		let s = Nt(o);
		if (!n && d[a] === s) continue;
		let c = await Lt(o);
		c.line_count > 0 && (p.push({
			log_type: e.log_type,
			log_date: i,
			filename: ie(o),
			content: c.content,
			line_count: c.line_count,
			byte_count: c.byte_count,
			truncated: c.truncated,
			sent_at: m
		}), f[a] = s);
	}
	if (p.length !== 0) try {
		let e = await fetch(o, {
			method: "POST",
			headers: l,
			body: JSON.stringify({
				device_id: c,
				sent_at: m,
				logs: p
			})
		});
		if (!e.ok) throw Error(`Ingest HTTP status ${e.status}`);
		u.files = f, u.last_sync_at = m, u.last_error = "", Mt(u), console.log(`[SUPPORT LOGS] Successfully ingested ${p.length} support logs`);
	} catch (e) {
		console.error("[SUPPORT LOGS] Failed to sync support logs:", e.message || e), u.last_error = e.message || e, Mt(u);
	}
}
function zt(e, t) {
	K && clearInterval(K), Rt(e, t, !0), K = setInterval(() => {
		Rt(e, t, !1);
	}, 300 * 1e3);
}
function Bt() {
	K &&= (clearInterval(K), null);
}
//#endregion
//#region electron/main.ts
ee.config();
var Vt = process.argv.find((e) => e.startsWith("--vite-dev-url="));
Vt && (process.env.VITE_DEV_SERVER_URL = Vt.split("=")[1]), b.registerSchemesAsPrivileged([{
	scheme: "cobien-media",
	privileges: {
		secure: !0,
		standard: !0,
		supportFetchAPI: !0,
		bypassCSP: !0,
		corsEnabled: !0,
		stream: !0
	}
}]);
var q = typeof __dirname < "u" ? __dirname : ae(oe(import.meta.url)), J = null, Y = "CoBien_WiFi_5G", Ht = 0, X = S(q, "../config/config.default.json"), Z = "";
function Ut(e = "es", t = "male") {
	try {
		let n = S(q, "../config/config.default.json"), r = S(_.getPath("userData"), "config.local.json"), i = JSON.parse(C.readFileSync(n, "utf-8")), a = {};
		try {
			a = JSON.parse(C.readFileSync(r, "utf-8"));
		} catch {}
		let o = {
			...i.services,
			...a.services
		}, s = S(q, "../public/models/piper/bin/piper"), c = S(q, "../public/models/piper/es_ES-davefx-medium.onnx"), l = o.tts_piper_bin || s, u = o[`tts_piper_model_${e}_${t}`] || o[`tts_piper_model_${e}`], d = "";
		if (u) if (u.startsWith("/") || u.includes(":") || u.startsWith("http")) d = u;
		else {
			let e = S(q, "../public/models/piper", u);
			d = (C.existsSync(e), e);
		}
		else d = e === "fr" ? S(q, "../public/models/piper/fr_FR-siwis-medium.onnx") : e === "en" ? S(q, "../public/models/piper/en_US-amy-medium.onnx") : c;
		return {
			bin: l,
			model: d
		};
	} catch (e) {
		return console.error("Error reading piper config:", e), {
			bin: S(q, "../public/models/piper/bin/piper"),
			model: S(q, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
var Wt = null;
async function Gt() {
	return new Promise((e) => {
		let t = 0, n = Date.now(), r = !1, i = setTimeout(() => {
			if (r) return;
			r = !0;
			let i = (Date.now() - n) / 1e3;
			e(t > 0 && i > 0 ? Math.round(t * 8 / i / 1e3) : null);
		}, 8e3);
		try {
			let a = y.request("https://speed.cloudflare.com/__down?bytes=512000");
			a.on("response", (a) => {
				a.on("data", (e) => {
					t += e.length;
				}), a.on("end", () => {
					if (r) return;
					r = !0, clearTimeout(i);
					let a = (Date.now() - n) / 1e3;
					e(a > 0 ? Math.round(t * 8 / a / 1e3) : null);
				}), a.on("error", () => {
					r || (r = !0, clearTimeout(i), e(null));
				});
			}), a.on("error", () => {
				r || (r = !0, clearTimeout(i), e(null));
			}), a.end();
		} catch {
			r || (r = !0, clearTimeout(i), e(null));
		}
	});
}
function Kt() {
	async function e() {
		let e = {};
		try {
			e = JSON.parse(await w.readFile(X, "utf-8"));
		} catch (e) {
			console.error("Error reading default config:", e);
		}
		let t = {};
		if (Z) try {
			t = JSON.parse(await w.readFile(Z, "utf-8"));
		} catch {}
		return {
			...e,
			...t,
			settings: {
				...e.settings || {},
				...t.settings || {}
			},
			notifications: {
				...e.notifications || {},
				...t.notifications || {}
			},
			services: {
				...e.services || {},
				...t.services || {}
			}
		};
	}
	async function t(e) {
		let t = !1;
		try {
			let n = JSON.parse(await w.readFile(X, "utf-8"));
			e(n), await w.writeFile(X, JSON.stringify(n, null, 4)), t = !0;
		} catch {}
		let n = [];
		if (Z && n.push(Z), process.platform === "linux") {
			let e = process.env.COBIEN_CONFIG_DIR || S(process.env.XDG_CONFIG_HOME || S(T.homedir(), ".config"), "cobien");
			n.push(S(e, "config.local.json"));
		}
		let r = Array.from(new Set(n)), i = !1;
		for (let t of r) try {
			await w.mkdir(ae(t), { recursive: !0 });
			let n = {};
			try {
				n = JSON.parse(await w.readFile(t, "utf-8"));
			} catch {}
			e(n), await w.writeFile(t, JSON.stringify(n, null, 4)), i = !0;
		} catch (e) {
			console.error(`[CONFIG] Error writing config to ${t}:`, e);
		}
		return r.length === 0 && console.warn("[CONFIG] No local config paths determined, cannot persist settings locally"), t || i;
	}
	v.handle("network:is-online", async () => {
		let e = (e) => new Promise((t) => {
			let n = setTimeout(() => t(!1), 3e3);
			se.lookup(e, (e) => {
				clearTimeout(n), t(!e);
			});
		});
		return await e("google.com") ? !0 : e("one.one.one.one");
	}), v.handle("config:getWeather", async () => {
		try {
			let t = await e();
			return {
				catalog: t.settings?.weather_city_catalog || [],
				active: t.settings?.weather_cities || [],
				primary: t.settings?.weather_primary_city || ""
			};
		} catch (e) {
			return console.error("Error reading config:", e), {
				catalog: [],
				active: [],
				primary: ""
			};
		}
	}), v.handle("config:getSettings", async () => {
		try {
			return (await e()).settings || {};
		} catch {
			return {};
		}
	}), v.handle("config:saveGeneralSettings", async (e, n) => {
		try {
			return await t((e) => {
				e.settings ||= {}, n.wakeWordEnabled !== void 0 && (e.settings.wake_word_enabled = n.wakeWordEnabled), n.pinEnabled !== void 0 && (e.settings.settings_pin_enabled = n.pinEnabled), n.idleTimeout !== void 0 && (e.settings.idle_timeout_sec = n.idleTimeout);
			});
		} catch (e) {
			return console.error("Error saving general settings:", e), !1;
		}
	}), v.handle("config:saveEmotionPromptTime", async (e, n) => {
		try {
			return await t((e) => {
				e.settings ||= {}, e.settings.emotionPromptTime = n;
			});
		} catch (e) {
			return console.error("Error saving emotion prompt time:", e), !1;
		}
	}), v.handle("config:submitEmotion", async (e, t) => {
		try {
			let e = process.env.COBIEN_DEVICE_ID || "CoBienX", n = process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu";
			return (await fetch(`${n}/api/emociones/api/diario/`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					device_id: e,
					emocion: t
				}),
				signal: AbortSignal.timeout(5e3)
			})).ok;
		} catch (e) {
			return console.error("Error submitting emotion:", e), !1;
		}
	}), v.handle("config:saveWeather", async (e, n) => {
		try {
			return await t((e) => {
				e.settings ||= {}, e.settings.weather_city_catalog = n.catalog, e.settings.weather_cities = n.active, e.settings.weather_primary_city = n.primary;
			});
		} catch (e) {
			return console.error("Error saving config:", e), !1;
		}
	}), v.handle("config:saveButtonColors", async (e, n) => {
		try {
			let e = await t((e) => {
				e.settings ||= {}, e.settings.button_colors = n;
			});
			return gt(n), e;
		} catch (e) {
			return console.error("Error saving button colors:", e), !1;
		}
	}), v.handle("config:getNotifications", async () => {
		try {
			return (await e()).notifications || {};
		} catch {
			return {};
		}
	}), v.handle("config:saveNotifications", async (e, n) => {
		try {
			return await t((e) => {
				e.notifications = n;
			});
		} catch (e) {
			return console.error("Error saving notifications config:", e), !1;
		}
	}), v.handle("config:getRfidActions", async () => {
		try {
			return (await e()).settings?.rfid_actions || {};
		} catch (e) {
			return console.error("Error reading RFID actions:", e), {};
		}
	}), v.handle("config:initRfidConfigMode", async () => (bt(1), !0)), v.handle("config:cancelRfidConfigMode", async () => (bt(0), !0)), v.handle("config:saveRfidAction", async (e, n, r, i = "") => {
		try {
			let e = await t((e) => {
				e.settings ||= {}, e.settings.rfid_actions || (e.settings.rfid_actions = {}), e.settings.rfid_actions[String(n)] = {
					action: r,
					extra: i
				};
			});
			return xt(n, {
				day_events: 2,
				weather: 3,
				videocall: 5
			}[r] ?? 2), St(), await U(), e;
		} catch (e) {
			return console.error("Error saving RFID action:", e), !1;
		}
	}), v.handle("config:deleteRfidAction", async (e, n) => {
		try {
			let e = await t((e) => {
				e.settings?.rfid_actions && delete e.settings.rfid_actions[String(n)];
			});
			return St(), await U(), e;
		} catch (e) {
			return console.error("Error deleting RFID action:", e), !1;
		}
	}), v.handle("config:getRingtones", async () => {
		try {
			let e = S(_.getAppPath(), "public", "audio", "ringtones"), t = S(_.getAppPath(), "dist", "audio", "ringtones"), n = e;
			try {
				await w.access(t), n = t;
			} catch {}
			let r = await w.readdir(n), i = [
				".mp3",
				".wav",
				".ogg",
				".flac",
				".m4a",
				".aac"
			];
			return r.filter((e) => i.some((t) => e.toLowerCase().endsWith(t)));
		} catch (e) {
			return console.error("Error reading ringtones:", e), [];
		}
	}), v.handle("config:triggerNotificationLed", async (t, n) => {
		try {
			let t = (await e()).notifications?.[n];
			return t ? (vt(t), !0) : !1;
		} catch (e) {
			return console.error("Error triggering notification LED:", e), !1;
		}
	}), v.handle("config:turnOffNotificationLed", async () => {
		try {
			return yt(), !0;
		} catch (e) {
			return console.error("Error turning off notification LED:", e), !1;
		}
	}), v.handle("config:simulateNotification", async (e, t) => {
		try {
			let e = {};
			if (t === "videollamada") e = {
				type: "videocall",
				from: "Test Caller",
				room: "test-room"
			};
			else if (t === "nuevo_evento") e = {
				type: "new_event",
				title: "Reunión de prueba",
				date: "2026-06-25"
			};
			else if (t === "nueva_foto") e = {
				type: "new_message",
				from: "Test Sender"
			};
			else return !1;
			return J && !J.isDestroyed() ? (J.webContents.send("backend:notification", e), !0) : !1;
		} catch (e) {
			return console.error("Error simulating notification:", e), !1;
		}
	});
	let r = (e) => {
		let t = e.split("\n"), n = [];
		for (let e of t) {
			if (!e.trim()) continue;
			let t = e.split(/(?<!\\):/);
			if (t.length < 4) continue;
			let r = t[0].replace(/\\:/g, ":").trim();
			if (!r) continue;
			let i = parseInt(t[1], 10) || 0, a = t[2].replace(/\\:/g, ":").trim(), o = t[3].trim().toLowerCase(), s = o === "yes" || o === "*" || o === "sí" || o === "si", c = n.find((e) => e.ssid === r);
			c ? (s && (c.active = !0), i > c.signal && (c.signal = i, c.security = a)) : n.push({
				ssid: r,
				signal: i,
				security: a,
				active: s
			});
		}
		return n;
	};
	v.handle("config:scanWifi", async () => {
		let e = await (async () => {
			let e = "/tmp/host_wifi_list.txt";
			try {
				if (C.existsSync(e)) {
					let t = await w.readFile(e, "utf-8");
					if (t.trim()) return r(t);
				}
			} catch (e) {
				console.error("Failed to read host wifi list:", e);
			}
			return new Promise((e) => {
				x("nmcli device wifi rescan", () => {
					x("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list", (t, n) => {
						if (t || !n) {
							e([]);
							return;
						}
						e(r(n));
					});
				});
			});
		})();
		return e.length === 0 && (e = [
			{
				ssid: "CoBien_WiFi_5G",
				signal: 95,
				security: "WPA2",
				active: Y === "CoBien_WiFi_5G"
			},
			{
				ssid: "Deusto_Guest",
				signal: 72,
				security: "WPA2",
				active: Y === "Deusto_Guest"
			},
			{
				ssid: "Euskaltel_WiFi",
				signal: 50,
				security: "WPA/WPA2",
				active: Y === "Euskaltel_WiFi"
			},
			{
				ssid: "Library_Public",
				signal: 45,
				security: "",
				active: Y === "Library_Public"
			},
			{
				ssid: "IoT_Sensors",
				signal: 30,
				security: "WPA2",
				active: Y === "IoT_Sensors"
			}
		]), e;
	}), v.handle("config:connectWifi", async (e, t, n) => {
		Ht = Date.now();
		let i = async () => {
			let e = "/tmp/host_wifi_list.txt";
			try {
				if (C.existsSync(e)) {
					let t = await w.readFile(e, "utf-8");
					if (t.trim()) return r(t);
				}
			} catch (e) {
				console.error("Failed to read host wifi list:", e);
			}
			return new Promise((e) => {
				x("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list", (t, n) => {
					if (t || !n) {
						e([]);
						return;
					}
					e(r(n));
				});
			});
		}, a = async (e, t) => await new Promise((t) => {
			x("nmcli -t -f NAME connection show", (n, r) => {
				if (n || !r) {
					t(!1);
					return;
				}
				t(r.split("\n").map((e) => e.trim()).includes(e));
			});
		}) && (console.log(`[WIFI] Connection profile for "${e}" already exists. Attempting to bring it up...`), await new Promise((t) => {
			x(`nmcli connection up "${e.replace(/"/g, "\\\"")}"`, (n, r, i) => {
				n ? (console.warn(`[WIFI] Failed to bring up existing connection "${e}":`, n, i), t(!1)) : (console.log(`[WIFI] Successfully brought up existing connection "${e}".`), t(!0));
			});
		})) ? !0 : (console.log(`[WIFI] Creating/updating connection for "${e}"...`), new Promise((n) => {
			let r = `nmcli device wifi connect "${e.replace(/"/g, "\\\"")}"`;
			t && (r += ` password "${t.replace(/"/g, "\\\"")}"`), x(r, (e, t, r) => {
				e ? (console.error("Error connecting to wifi:", e, r), n(!1)) : n(!0);
			});
		})), o = () => new Promise((e) => {
			x("nmcli -t -f TYPE device", (t, n) => {
				if (t || !n) {
					e(!1);
					return;
				}
				e(n.split("\n").some((e) => e.trim() === "wifi"));
			});
		}), s = await i();
		if (!await o() || !s.some((e) => e.ssid === t)) return console.log(`[WIFI] Simulating connection to mock/real network (no physical wifi interface or mock network): ${t}`), await new Promise((e) => setTimeout(e, 2e3)), n === "fail" || n === "error" ? !1 : (Y = t, !0);
		{
			console.log(`[WIFI] Connecting to real network: ${t}`);
			let e = await a(t, n);
			return e && (Y = ""), e;
		}
	}), v.handle("config:getCurrentWifi", async () => await (() => {
		let e = "/tmp/host_wifi_list.txt";
		try {
			if (C.existsSync(e)) {
				let t = C.readFileSync(e, "utf-8");
				if (t.trim()) {
					let e = r(t).find((e) => e.active);
					if (e) return Promise.resolve(e.ssid);
				}
			}
		} catch (e) {
			console.error("Failed to read host active wifi:", e);
		}
		return new Promise((e) => {
			x("nmcli -t -f NAME,TYPE connection show --active", (t, n) => {
				if (t || !n) {
					e(null);
					return;
				}
				let r = n.split("\n");
				for (let t of r) {
					let n = t.split(/(?<!\\):/);
					if (n.length >= 2 && n[1].trim() === "802-11-wireless") {
						e(n[0].replace(/\\:/g, ":").trim());
						return;
					}
				}
				e(null);
			});
		});
	})() || Y), v.handle("events:get", async () => await u(X)), v.handle("weather:fetch", async (e, t, n = "es") => await Ie(t, n)), v.handle("jokes:getRandom", async (e, t = "es") => await Be(t)), v.handle("contacts:list", async () => await m()), v.handle("contacts:sync", async () => {
		let t = process.env.COBIEN_NOTIFY_API_KEY || "", n = process.env.COBIEN_DEVICE_ID;
		if (!n) throw console.error("ERROR: COBIEN_DEVICE_ID not set."), Error("COBIEN_DEVICE_ID not set");
		return await p(n, t, ((await e()).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), v.handle("contacts:requestCall", async (t, n) => {
		try {
			s("request");
		} catch (e) {
			console.error("[MAIN] Failed to log call request:", e);
		}
		let r = process.env.COBIEN_NOTIFY_API_KEY || "", i = process.env.COBIEN_DEVICE_ID;
		if (!i) throw console.error("ERROR: COBIEN_DEVICE_ID not set."), Error("COBIEN_DEVICE_ID not set");
		return await h(n, i, r, ((await e()).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), v.handle("contacts:openCall", async (e, t) => {
		try {
			s("made");
		} catch (e) {
			console.error("[MAIN] Failed to log call made:", e);
		}
		let n = process.env.COBIEN_DEVICE_ID;
		if (!n) throw console.error("ERROR: COBIEN_DEVICE_ID not set."), Error("COBIEN_DEVICE_ID not set");
		let r = process.env.COBIEN_VIDEOCALL_DEVICE_API_KEY || "", i = process.env.COBIEN_DEVICE_VIDEOCALL_SESSION_URL || "https://portal.co-bien.eu/api/device-videocall-session/", a = process.env.COBIEN_PORTAL_VIDEOCALL_DEVICE_URL || "https://portal.co-bien.eu/videocall/device/", o = process.env.COBIEN_PORTAL_CALL_ANSWERED_URL || "https://portal.co-bien.eu/api/call-answered/", c = `${process.env.COBIEN_PORTAL_VIDEOCALL_URL || "https://portal.co-bien.eu/videocall/"}?room=${encodeURIComponent(t)}&device=${encodeURIComponent(n)}`;
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
					c = `${a}#token=${encodeURIComponent(t)}&room=${encodeURIComponent(n)}&identity=${encodeURIComponent(r)}`, console.log("[VIDEOCALL] Generated Twilio token URL successfully");
				}
			} else console.warn(`[VIDEOCALL] Device session request failed with status: ${e.status}`);
		} catch (e) {
			console.error("[VIDEOCALL] Error request session:", e);
		}
		let { BrowserWindow: l } = await import("electron"), u = new l({
			width: 1024,
			height: 768,
			fullscreen: !0,
			webPreferences: {
				nodeIntegration: !1,
				contextIsolation: !0
			}
		}), d = Date.now(), f = () => {
			if (!u.isDestroyed()) try {
				let e = Math.round((Date.now() - d) / 1e3);
				try {
					s("ended", e);
				} catch (e) {
					console.error("[MAIN] Failed to log call ended:", e);
				}
				u.hide(), J && !J.isDestroyed() && (J.show(), J.focus()), u.loadURL("about:blank"), setTimeout(() => {
					u.isDestroyed() || u.close();
				}, 500);
			} catch (e) {
				console.error("[VIDEOCALL] Error during clean close:", e);
			}
		};
		return u.on("closed", () => {
			J && !J.isDestroyed() && (J.show(), J.focus());
		}), u.loadURL(c), u.webContents.on("will-navigate", (e, t) => {
			t.startsWith("cobien://call-ended") && (e.preventDefault(), f());
		}), u.webContents.on("did-start-navigation", (e, t) => {
			t.startsWith("cobien://call-ended") && (e.preventDefault(), f());
		}), u.webContents.on("will-frame-navigate", (e) => {
			e.url.startsWith("cobien://call-ended") && (e.preventDefault(), f());
		}), !0;
	}), v.handle("reminders:add", async (e, t, n) => await Ke(t, n)), v.handle("reminders:list", async () => await qe()), v.handle("reminders:delete", async (e, t) => await Je(t)), v.handle("events:addPersonal", async (t, r) => {
		let i = await e(), a = process.env.COBIEN_DEVICE_LOCATION || i.settings?.device_location || "Bilbao", o = process.env.COBIEN_DEVICE_ID || "CoBien6", s = r.location || a;
		try {
			n("event");
		} catch (e) {
			console.error("[MAIN] Failed to log event creation:", e);
		}
		return await f({
			...r,
			location: s,
			deviceId: o
		});
	}), v.handle("events:updatePersonal", async (e, t) => await l(t)), v.handle("events:delete", async (e, t) => await d(t)), v.handle("board:fetch", async () => await Oe()), v.handle("board:delete", async (e, t) => await ke(t)), v.handle("board:read", async (e, t) => await Ae(t)), v.handle("board:reply", async (e, t, n) => await je(t, n)), v.handle("config:getSystemInfo", async () => {
		let e = "";
		try {
			e = await new Promise((e) => {
				x("rustdesk --get-id", (t, n) => {
					e(t ? "" : n.trim());
				});
			});
		} catch {}
		return {
			version: _.getVersion(),
			deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX",
			contactsPath: S(_.getPath("userData"), "contacts/list_contacts.txt"),
			defaultLanguage: process.env.COBIEN_APP_LANGUAGE || "en",
			rustdeskId: e,
			networkSpeedKbps: Wt
		};
	}), v.handle("config:measureNetworkSpeed", async () => {
		let e = await Gt();
		return Wt = e, me(e), Z && he(X, Z).catch(() => {}), e;
	}), v.handle("icso:logVocalAssistant", (e, t, n) => {
		try {
			return c("vocal_assistant", t, n), !0;
		} catch (e) {
			return console.error("[MAIN] Failed to log vocal assistant action:", e), !1;
		}
	}), v.handle("icso:logScreenWakeup", () => {
		try {
			return a(), !0;
		} catch (e) {
			return console.error("[MAIN] Failed to log screen wakeup:", e), !1;
		}
	}), v.handle("app:restart", () => {
		console.log("[Main] Restarting application via window reload..."), process.env.VITE_DEV_SERVER_URL ? J && !J.isDestroyed() && J.loadURL(process.env.VITE_DEV_SERVER_URL) : J && !J.isDestroyed() ? J.loadFile(S(q, "../dist/index.html")) : (_.relaunch(), _.exit(0));
	}), v.handle("app:reboot-system", () => {
		console.log("[Main] System reboot requested from GUI..."), x("systemctl reboot -i || reboot || sudo reboot", (e) => {
			e && console.error("[Main] Failed to execute reboot command:", e);
		});
	}), v.handle("app:exit", () => {
		_.quit();
	}), v.handle("app:update", async () => {
		console.log("[Main] Manual update requested from GUI.");
		let e = process.env.COBIEN_RUNTIME_STATE_DIR || S(T.homedir(), ".local/state/cobien/runtime"), t = S(e, "manual_update_reload.flag");
		try {
			await w.mkdir(e, { recursive: !0 }), await w.writeFile(t, JSON.stringify({ requested_at: (/* @__PURE__ */ new Date()).toISOString() })), console.log(`[Main] Created manual update reload flag at: ${t}`);
		} catch (e) {
			console.error("[Main] Failed to write manual update reload flag:", e.message || e);
		}
		return new Promise((e, t) => {
			let n = "systemctl --user start cobien-update.service";
			console.log(`[Main] Executing update command: ${n}`), x(n, (n, r, i) => {
				n ? (console.error("[Main] Failed to start update service:", n), t(n)) : (console.log("[Main] Update service started successfully:", r), e(!0));
			});
		});
	}), v.handle("app:uninstall", async () => {
		let e = T.userInfo().username, t = S(T.homedir(), "cobien/cobien-furniture-app-launcher/uninstall-cobien-furniture-environment.sh");
		return console.log(`[Uninstall] Target script path: ${t} (resolving for user: ${e})`), new Promise((n, r) => {
			let i = `echo "cobien" | sudo -S systemd-run --system --collect --setenv=COBIEN_SETUP_USER=${e} --setenv=COBIEN_NON_INTERACTIVE=1 --setenv=COBIEN_AUTO_CONFIRM=1 --setenv=COBIEN_AUTO_REBOOT_AFTER_UNINSTALL=1 bash "${t}"`;
			console.log(`[Uninstall] Running command: ${i}`), x(i, (e, t, i) => {
				e ? (console.error("[Uninstall] Script error:", e), console.error("[Uninstall] Script stderr:", i), r(e)) : (console.log("[Uninstall] Script stdout:", t), n(!0));
			});
		});
	});
	let i = null;
	v.handle("tts:stop", () => {
		if (i) {
			try {
				i.kill();
			} catch {}
			i = null;
		}
	}), v.handle("tts:speak", async (e, t, n = "es", r = "male", a = "piper") => {
		if (console.log(`[TTS] Speaking (${n}/${r}) via ${a}: "${t}"`), i) {
			try {
				i.kill();
			} catch {}
			i = null;
		}
		let o = S(T.tmpdir(), `tts_${Date.now()}.wav`), { bin: s, model: c } = Ut(n, r);
		return console.log(`[TTS] Piper Config: bin=${s}, model=${c}`), c ? new Promise((e) => {
			let n = ne(s, [
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
					let t = await w.readFile(o);
					await w.unlink(o), console.log(`[TTS] Generated WAV: ${t.length} bytes`), e(t);
				} catch (t) {
					console.error("[TTS] Error reading temp wav:", t), e(null);
				}
			});
			n.stdin?.write(t), n.stdin?.end();
		}) : (console.error("TTS: No Piper model configured."), null);
	}), v.handle("hardware:adjustVolume", async (e, t, n = !1) => await Ct(t, n)), v.handle("hardware:adjustBrightness", async (e, t) => await Tt(t)), v.handle("hardware:getVolume", async () => await wt()), v.handle("logs:getTypes", () => [
		"app",
		"icso",
		"can",
		"bridge"
	]), v.handle("logs:getTail", async (e, t) => {
		let n = S(_.getPath("userData"), "logs"), r = "";
		if (t === "app" ? r = S(n, "app.log") : t === "icso" ? r = S(n, "icso_log.txt") : t === "can" ? r = Zt(n, [
			"can-bus",
			"can_bus",
			"can"
		]) : t === "bridge" && (r = Zt(n, [
			"mqtt-can-bridge",
			"mqtt_can_bridge",
			"bridge"
		])), !r || !C.existsSync(r)) return `(sin datos en el log de tipo: ${t})`;
		try {
			return C.readFileSync(r, "utf-8").split("\n").slice(-250).join("\n");
		} catch (e) {
			return `Error al leer logs: ${e.message}`;
		}
	});
}
function qt() {
	J = new g({
		width: 1024,
		height: 768,
		fullscreen: !0,
		webPreferences: {
			preload: S(q, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), J.setBackgroundColor("#ffffff"), J.webContents.on("render-process-gone", (e, t) => {
		console.error(`[STABILITY] Render process gone: ${t.reason} (exitCode=${t.exitCode})`), setTimeout(() => {
			J && !J.isDestroyed() && (console.log("[STABILITY] Reloading window after renderer crash..."), process.env.VITE_DEV_SERVER_URL ? J.loadURL(process.env.VITE_DEV_SERVER_URL) : J.loadFile(S(q, "../dist/index.html")));
		}, 2e3);
	}), J.webContents.on("unresponsive", () => {
		console.warn("[STABILITY] Renderer became unresponsive. Will reload if still unresponsive in 5s..."), setTimeout(() => {
			J && !J.isDestroyed() && (J.webContents.isCurrentlyAudible() || !0) && (console.warn("[STABILITY] Forcing reload after unresponsive timeout."), J.webContents.reload());
		}, 5e3);
	}), J.webContents.on("responsive", () => {
		console.log("[STABILITY] Renderer became responsive again.");
	}), process.env.VITE_DEV_SERVER_URL ? (J.loadURL(process.env.VITE_DEV_SERVER_URL), J.webContents.on("did-fail-load", (e, t, n, r) => {
		process.env.VITE_DEV_SERVER_URL && r.startsWith(process.env.VITE_DEV_SERVER_URL) && (console.log(`[Main] Failed to load dev URL (error: ${n}). Retrying in 1s...`), setTimeout(() => {
			J && !J.isDestroyed() && J.loadURL(process.env.VITE_DEV_SERVER_URL);
		}, 1e3));
	})) : (J.loadFile(S(q, "../dist/index.html")), J.webContents.on("did-fail-load", (e, t, n) => {
		console.error(`[STABILITY] Failed to load production HTML (error: ${n}). Retrying in 2s...`), setTimeout(() => {
			J && !J.isDestroyed() && J.loadFile(S(q, "../dist/index.html"));
		}, 2e3);
	}));
}
var Q = process.env.COBIEN_DISABLE_GPU === "1" || process.env.DISABLE_GPU === "1";
if (!Q) try {
	let e = re("systemd-detect-virt", { encoding: "utf-8" }).trim();
	e && e !== "none" && (console.log(`[GPU] Virtual machine detected (${e}). Disabling hardware acceleration.`), Q = !0);
} catch {}
if (!Q) try {
	let e = T.homedir(), t = [process.env.COBIEN_LOCAL_CONFIG_PATH || S(e, ".config", "cobien", "config.local.json"), S(e, ".config", "cobien-furniture-electron", "config.local.json")];
	for (let e of t) if (C.existsSync(e)) {
		let t = C.readFileSync(e, "utf-8");
		if (JSON.parse(t)?.settings?.disable_gpu === !0) {
			console.log(`[GPU] disable_gpu=true found in local config (${e}). Disabling hardware acceleration.`), Q = !0;
			break;
		}
	}
} catch {}
if (!Q) try {
	(C.existsSync("/dev/dri") ? C.readdirSync("/dev/dri").filter((e) => e.startsWith("card")) : []).length === 0 && (console.log("[GPU] No DRI card devices found. Disabling hardware acceleration."), Q = !0);
} catch {}
Q && (_.disableHardwareAcceleration(), _.commandLine.appendSwitch("disable-gpu")), _.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,VaapiVideoEncoder"), _.commandLine.appendSwitch("password-store", "basic"), _.commandLine.appendSwitch("no-sandbox"), _.commandLine.appendSwitch("disable-gpu-sandbox");
function Jt() {
	process.stdout.on("error", () => {}), process.stderr.on("error", () => {});
	let e = S(_.getPath("userData"), "logs");
	C.existsSync(e) || C.mkdirSync(e, { recursive: !0 });
	let t = S(e, "app.log"), n = C.createWriteStream(t, {
		flags: "a",
		encoding: "utf-8"
	}), r = 0;
	try {
		r = C.statSync(t).size;
	} catch {
		r = 0;
	}
	let i = 5 * 1024 * 1024, a = () => {
		try {
			n.end();
			let e = t + ".1";
			C.existsSync(e) && C.unlinkSync(e), C.existsSync(t) && C.renameSync(t, e), n = C.createWriteStream(t, {
				flags: "a",
				encoding: "utf-8"
			}), r = 0;
		} catch {}
	}, o = process.stdout.write.bind(process.stdout);
	process.stdout.write = (e, t, s) => {
		let c = e ? e.length : 0;
		r += c, r > i && a();
		try {
			n.write(e);
		} catch {}
		try {
			return o(e, t, s);
		} catch (e) {
			return s && s(e), !0;
		}
	};
	let s = process.stderr.write.bind(process.stderr);
	process.stderr.write = (e, t, o) => {
		let c = e ? e.length : 0;
		r += c, r > i && a();
		try {
			n.write(e);
		} catch {}
		try {
			return s(e, t, o);
		} catch (e) {
			return o && o(e), !0;
		}
	};
}
_.whenReady().then(() => {
	Jt(), process.on("uncaughtException", (e) => {
		console.error("[FATAL] Uncaught exception (process kept alive):", e);
	}), process.on("unhandledRejection", (e) => {
		console.error("[FATAL] Unhandled promise rejection (process kept alive):", e);
	}), te.defaultSession.setPermissionRequestHandler((e, t, n) => {
		[
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(t) ? n(!0) : n(!1);
	}), te.defaultSession.setPermissionCheckHandler((e, t, n) => [
		"media",
		"geolocation",
		"notifications",
		"midiSysex",
		"openExternal"
	].includes(t)), b.handle("cobien-media", (e) => {
		try {
			let t = new URL(e.url), n = decodeURIComponent(t.pathname);
			return t.hostname && t.hostname !== "localhost" && (n = "/" + decodeURIComponent(t.hostname) + n), y.fetch("file://" + n);
		} catch (t) {
			return console.error("[PROTOCOL] Failed to parse custom media URL:", e.url, t), new Response("Invalid URL", { status: 400 });
		}
	});
	let e = S(_.getPath("userData"), "config.local.json");
	Z = e, Kt(), t(X, e), a(), zt(X, e);
	let n = JSON.parse(C.readFileSync(X, "utf-8")), r = {};
	try {
		C.existsSync(e) && (r = JSON.parse(C.readFileSync(e, "utf-8")));
	} catch {}
	let i = {
		...n.services,
		...r.services
	}, o = {
		...n.settings,
		...r.settings
	}, s = (i.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), c = process.env.COBIEN_NOTIFY_API_KEY || i.notify_api_key || "", l = process.env.COBIEN_DEVICE_ID || o.device_id || "CoBienX";
	!process.env.COBIEN_DEVICE_ID && !o.device_id && console.error("WARNING: COBIEN_DEVICE_ID not set. Using fallback \"CoBienX\". The app will start but some features may not work correctly."), p(l, c, s).catch(console.error);
	let u = parseInt(process.env.COBIEN_CONTACTS_SYNC_INTERVAL_SEC || "300", 10);
	u < 60 && (u = 300), u > 0 && (Yt = setInterval(() => {
		console.log("[CONTACTS] Periodic sync started"), p(l, c, s).then(() => {
			J && !J.isDestroyed() && J.webContents.send("contacts:updated");
		}).catch(console.error);
	}, u * 1e3)), qt(), $ = Xt(), Ge((e) => {
		J && !J.isDestroyed() && J.webContents.send("reminder:fire", e);
	}), J && (ge(J, X, e), dt(J)), _.on("activate", () => {
		g.getAllWindows().length === 0 && qt();
	});
});
var Yt = null, $ = null;
function Xt() {
	return setInterval(async () => {
		try {
			let e = T.homedir(), t = S(_.getAppPath(), "config.default.json"), n = process.env.COBIEN_LOCAL_CONFIG_PATH || S(e, ".config", "cobien", "config.local.json"), r = !1;
			try {
				let e = {};
				C.existsSync(t) && (e = JSON.parse(C.readFileSync(t, "utf-8")));
				let i = {};
				C.existsSync(n) && (i = JSON.parse(C.readFileSync(n, "utf-8"))), r = {
					...e.settings,
					...i.settings
				}.enable_wifi_watchdog === !0;
			} catch {}
			if (!r || await new Promise((e) => {
				x("nmcli -t -f CONNECTIVITY networking", (t, n) => {
					if (!t && n && n.trim() === "full") {
						e(!0);
						return;
					}
					e(!1);
				});
			}) || !await new Promise((e) => {
				x("nmcli -t -f TYPE device", (t, n) => {
					if (t || !n) {
						e(!1);
						return;
					}
					e(n.split("\n").some((e) => e.trim() === "wifi"));
				});
			}) || await new Promise((e) => {
				x("nmcli -t -f TYPE,STATE device", (t, n) => {
					if (t || !n) {
						e(!1);
						return;
					}
					e(n.split("\n").map((e) => e.trim()).some((e) => {
						let [t, n] = e.split(":");
						return t === "wifi" && n === "connected";
					}));
				});
			}) || Date.now() - Ht < 120 * 1e3) return;
			await new Promise((e) => {
				x("nmcli -t -f SSID device wifi list", (t, n) => {
					if (t || !n) {
						e(!1);
						return;
					}
					e(n.split("\n").map((e) => e.trim()).includes("cobien"));
				});
			}) && (console.log("[WIFI-WATCHDOG] Device is offline, and \"cobien\" SSID is in range. Auto-connecting to default Wi-Fi..."), x("nmcli device wifi connect \"cobien\" password \"Cobien2026\"", (e, t, n) => {
				e ? console.error("[WIFI-WATCHDOG] Failed to auto-connect to cobien Wi-Fi:", e, n) : console.log("[WIFI-WATCHDOG] Successfully auto-connected to cobien Wi-Fi.");
			}));
		} catch (e) {
			console.error("[WIFI-WATCHDOG] Error in watchdog loop:", e);
		}
	}, 30 * 1e3);
}
function Zt(e, t) {
	if (!C.existsSync(e)) return "";
	try {
		let n = C.readdirSync(e), r = [];
		for (let i of n) for (let n of t) i.startsWith(n) && (i.endsWith(".log") || i.endsWith(".txt")) && r.push(S(e, i));
		return r.length === 0 ? "" : (r.sort((e, t) => C.statSync(t).mtimeMs - C.statSync(e).mtimeMs), r[0]);
	} catch {
		return "";
	}
}
_.on("window-all-closed", () => {
	ft(), _e(), r(), Bt(), Yt &&= (clearInterval(Yt), null), $ &&= (clearInterval($), null), process.platform !== "darwin" && _.quit();
});
//#endregion
