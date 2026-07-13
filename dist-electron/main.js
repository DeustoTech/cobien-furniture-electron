import { a as e, i as t, n, t as r } from "./eventsMongo-CEfPASGM.js";
import { i, n as a, r as o } from "./contactsService-BixNje6P.js";
import s from "dotenv";
import { BrowserWindow as c, app as l, ipcMain as u, net as d, protocol as f, session as p } from "electron";
import { exec as m, execFile as h, execSync as ee } from "node:child_process";
import { basename as g, dirname as _, join as v } from "node:path";
import { fileURLToPath as te } from "node:url";
import * as y from "node:fs";
import { promises as b } from "node:fs";
import * as x from "node:os";
import * as ne from "node:dns";
import * as re from "node:net";
import ie from "mqtt";
import { promisify as ae } from "node:util";
//#region electron/services/icsoService.ts
var S = v(l.getPath("userData"), "logs"), C = v(S, "icso_log.txt"), w = v(S, "icso_log.json"), oe = v(S, "icso_proximity_sensors.txt"), T = v(l.getPath("userData"), "icso_sync_state.json"), E = {
	page_views: {
		weather: 0,
		events: 0,
		day_events: 0,
		contacts: 0,
		board: 0
	},
	navigation_inputs: {
		touchscreen: 0,
		home_button: 0,
		vocal_assistant: 0,
		rfid_cards: 0
	},
	imu: {
		state: "idle",
		movements: 0
	},
	video_calls: {
		call_requests: 0,
		calls_made: 0,
		last_duration_sec: 0,
		total_duration_sec: 0
	},
	board: { received_photos: 0 },
	events: { added_events: 0 },
	screen_wakeup: { wakeups: 0 },
	proximity: {
		north: {
			motion_detected: 0,
			approach_detected: 0
		},
		south: {
			motion_detected: 0,
			approach_detected: 0
		},
		east: {
			motion_detected: 0,
			approach_detected: 0
		},
		west: {
			motion_detected: 0,
			approach_detected: 0
		}
	}
}, se = 24250, ce = 53591, le = 58795, ue = {
	1141: "north",
	1140: "south",
	1142: "east",
	1143: "west"
}, de = {
	north: "NORTH",
	south: "SOUTH",
	east: "EAST",
	west: "WEST"
}, D = null;
function fe() {
	y.existsSync(S) || y.mkdirSync(S, { recursive: !0 });
}
function O() {
	if (fe(), !y.existsSync(w)) return JSON.parse(JSON.stringify(E));
	try {
		let e = y.readFileSync(w, "utf-8"), t = JSON.parse(e);
		return {
			page_views: {
				...E.page_views,
				...t.page_views
			},
			navigation_inputs: {
				...E.navigation_inputs,
				...t.navigation_inputs
			},
			imu: {
				...E.imu,
				...t.imu
			},
			video_calls: {
				...E.video_calls,
				...t.video_calls
			},
			board: {
				...E.board,
				...t.board
			},
			events: {
				...E.events,
				...t.events
			},
			screen_wakeup: {
				...E.screen_wakeup,
				...t.screen_wakeup
			},
			proximity: {
				north: {
					...E.proximity.north,
					...t.proximity?.north
				},
				south: {
					...E.proximity.south,
					...t.proximity?.south
				},
				east: {
					...E.proximity.east,
					...t.proximity?.east
				},
				west: {
					...E.proximity.west,
					...t.proximity?.west
				}
			}
		};
	} catch (e) {
		return console.error("[ICSO] Failed to load JSON state, falling back to defaults:", e), JSON.parse(JSON.stringify(E));
	}
}
function k(e) {
	fe();
	try {
		y.writeFileSync(w, JSON.stringify(e, null, 4), "utf-8");
	} catch (e) {
		console.error("[ICSO] Failed to save JSON state:", e);
	}
}
function pe() {
	let e = /* @__PURE__ */ new Date(), t = (e) => e.toString().padStart(2, "0");
	return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())} ${t(e.getHours())}:${t(e.getMinutes())}:${t(e.getSeconds())}`;
}
function me(e, t = 5 * 1024 * 1024) {
	try {
		if (!y.existsSync(e)) return;
		if (y.statSync(e).size > t) {
			let t = e + ".1";
			y.existsSync(t) && y.unlinkSync(t), y.renameSync(e, t);
		}
	} catch (t) {
		console.error(`[ICSO] Log rotation failed for ${e}:`, t);
	}
}
function A(e, t, n) {
	fe();
	let r = pe(), i = {
		touchscreen: "TOUCHSCREEN",
		home_button: "HOME BUTTON",
		vocal_assistant: "VOCAL ASSISTANT",
		rfid_cards: "RFID CARD",
		imu: "IMU",
		videocall: "VIDEO CALL",
		notification: "NOTIFICATION",
		wakeup: "SCREEN WAKEUP",
		proximity: "PROXIMITY"
	}, a = e.trim() || "SYSTEM", o = i[a] || a.toUpperCase(), s = "";
	if (t === void 0 && !i[a]) {
		s = `[${r}] ${a}`, me(C), y.appendFileSync(C, s + "\n", "utf-8");
		return;
	}
	let c = t || "";
	if (a === "rfid_cards" && c === "videocall" && (c = "videocall request"), a === "vocal_assistant" && (!c || c === "assistant_triggered")) s = `[${r}] ACTIVATION VOCAL ASSISTANT`;
	else if (a === "vocal_assistant" && c) {
		let e = (n || "").trim();
		s = e ? `[${r}] VOCAL ASSISTANT → ${c} (recognized: ${e})` : `[${r}] VOCAL ASSISTANT → ${c}`;
	} else s = a === "proximity" && c ? `[${r}] PROXIMITY → ${c}` : c ? `[${r}] VIA ${o} → ${c}` : `[${r}] ${o}`;
	let l = a === "proximity" ? oe : C;
	me(l), y.appendFileSync(l, s + "\n", "utf-8");
}
function he(e, t) {
	let n = O(), r = e.replace(/^\//, "").replace(/-/g, "_");
	r === "call" && (r = "contacts");
	let i = n.page_views;
	i[r] !== void 0 && i[r]++;
	let a = n.navigation_inputs;
	a[t] !== void 0 && a[t]++, k(n), A(t, r || "home");
}
function ge(e) {
	let t = O(), n = e || (t.imu.state === "idle" ? "movement_start" : "movement_stop");
	t.imu.state = n === "movement_start" ? "moving" : "idle", n === "movement_stop" && t.imu.movements++, k(t), A("imu", n === "movement_start" ? "moving" : "idle");
}
function _e(e, t) {
	if (ue[e] === void 0) return;
	let n = ue[e], r = O(), i = !1, a = null;
	t === se ? (r.proximity[n].motion_detected++, i = !0, a = "MOTION") : t === ce ? (r.proximity[n].approach_detected++, i = !0, a = "APPROACH") : t === le && (a = "MOTION_END"), i && k(r), a !== null && A("proximity", `${a} ${de[n]}`);
}
function ve(e, t = 0) {
	let n = O();
	e === "request" ? n.video_calls.call_requests++ : e === "made" ? n.video_calls.calls_made++ : e === "ended" && (n.video_calls.last_duration_sec = t, n.video_calls.total_duration_sec += t), k(n), A("videocall", e);
}
function j(e) {
	let t = O();
	e === "photo" ? t.board.received_photos++ : e === "event" && t.events.added_events++, k(t), A("notification", e);
}
function ye() {
	let e = O();
	e.screen_wakeup.wakeups++, k(e), A("wakeup");
}
async function be(e, t) {
	try {
		if (!y.existsSync(e)) return {
			lines: [],
			offset: 0
		};
		let n = await b.stat(e), r = t >= 0 && t <= n.size ? t : 0, i = await b.open(e, "r"), a = Buffer.alloc(n.size - r);
		return await i.read(a, 0, n.size - r, r), await i.close(), {
			lines: a.toString("utf-8").split("\n").map((e) => e.trim()).filter((e) => e.length > 0),
			offset: n.size
		};
	} catch (n) {
		return console.error("[ICSO] Failed to read lines from", e, n), {
			lines: [],
			offset: t
		};
	}
}
function xe(e) {
	if (!e.startsWith("[")) return "";
	let t = e.indexOf("]");
	if (t <= 1) return "";
	let n = e.substring(1, t).trim();
	try {
		let e = n.split(" "), t = e[0].split("-"), r = e[1].split(":");
		return new Date(parseInt(t[0]), parseInt(t[1]) - 1, parseInt(t[2]), parseInt(r[0]), parseInt(r[1]), parseInt(r[2])).toISOString();
	} catch {
		return "";
	}
}
async function Se(e, t, n = !1) {
	let r = {}, i = {};
	try {
		let n = JSON.parse(y.readFileSync(e, "utf-8")), a = {};
		try {
			a = JSON.parse(y.readFileSync(t, "utf-8"));
		} catch {}
		r = {
			...n.services,
			...a.services
		}, i = {
			...n.settings,
			...a.settings
		};
	} catch (e) {
		console.error("[ICSO] Sync configuration read failed:", e);
		return;
	}
	let a = (r.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), o = (r.icso_telemetry_url || `${a}/pizarra/api/icso/telemetry/`).trim(), s = (r.icso_events_url || `${a}/pizarra/api/icso/events/`).trim(), c = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || r.notify_api_key || "", l = process.env.COBIEN_DEVICE_ID || i.device_id || "CoBien6";
	if (!l || !o || !s) return;
	let u = { "Content-Type": "application/json" };
	c && (u["X-API-KEY"] = c);
	let d = {
		txt_offset: 0,
		proximity_offset: 0,
		last_snapshot_sync_at: "",
		last_events_sync_at: "",
		last_error: ""
	};
	if (y.existsSync(T)) try {
		d = {
			...d,
			...JSON.parse(y.readFileSync(T, "utf-8"))
		};
	} catch {}
	let f = (/* @__PURE__ */ new Date()).toISOString();
	if (n || y.existsSync(w)) try {
		let e = {
			device_id: l,
			captured_at: f,
			snapshot: O()
		}, t = await fetch(o, {
			method: "POST",
			headers: u,
			body: JSON.stringify(e)
		});
		if (!t.ok) throw Error(`Telemetry sync HTTP ${t.status}`);
		d.last_snapshot_sync_at = f;
	} catch (e) {
		console.error("[ICSO] Telemetry snapshot sync failed:", e.message || e), d.last_error = `Telemetry: ${e.message || e}`, y.writeFileSync(T, JSON.stringify(d, null, 4), "utf-8");
		return;
	}
	let { lines: p, offset: m } = await be(C, d.txt_offset), { lines: h, offset: ee } = await be(oe, d.proximity_offset), g = [];
	if (p.forEach((e) => {
		g.push({
			device_id: l,
			source: "icso_log",
			logged_at: xe(e) || f,
			message: e
		});
	}), h.forEach((e) => {
		g.push({
			device_id: l,
			source: "icso_proximity",
			logged_at: xe(e) || f,
			message: e
		});
	}), g.length > 0) try {
		let e = await fetch(s, {
			method: "POST",
			headers: u,
			body: JSON.stringify({
				device_id: l,
				sent_at: f,
				events: g
			})
		});
		if (!e.ok) throw Error(`Events sync HTTP ${e.status}`);
		d.txt_offset = m, d.proximity_offset = ee, d.last_events_sync_at = f, d.last_error = "";
	} catch (e) {
		console.error("[ICSO] Events sync failed:", e.message || e), d.last_error = `Events: ${e.message || e}`;
	}
	y.writeFileSync(T, JSON.stringify(d, null, 4), "utf-8");
}
function Ce(e, t) {
	D && clearInterval(D), Se(e, t, !0), D = setInterval(() => {
		Se(e, t, !1);
	}, 300 * 1e3);
}
function we() {
	D &&= (clearInterval(D), null);
}
//#endregion
//#region electron/services/backendSync.ts
var Te = "home", Ee = null, De = null, Oe = null;
function ke(e) {
	Ee = e;
}
async function Ae(e, t) {
	return ze(e, t);
}
async function je(e, t, n) {
	u.handle("app:route-changed", (e, t, n) => {
		Te = t;
		try {
			he(t, n || "touchscreen");
		} catch (e) {
			console.error("[SYNC] Failed to log navigation:", e);
		}
	});
	let r = parseInt(process.env.COBIEN_DEVICE_HEARTBEAT_INTERVAL_SEC || "300", 10);
	(isNaN(r) || r < 120) && (r = 300), console.log(`[SYNC] Heartbeat interval set to ${r}s`), De = setInterval(() => ze(t, n), r * 1e3);
	let i = parseInt(process.env.COBIEN_DEVICE_POLL_INTERVAL_SEC || "10", 10);
	(isNaN(i) || i < 5) && (i = 10), console.log(`[SYNC] Notification polling interval set to ${i}s`), Oe = setInterval(() => Be(e, t, n), i * 1e3), ze(t, n), Be(e, t, n);
}
function Me() {
	De &&= (clearInterval(De), null), Oe &&= (clearInterval(Oe), null), console.log("[SYNC] Backend sync stopped.");
}
async function Ne(e, t) {
	try {
		let n = JSON.parse(await b.readFile(e, "utf-8")), r = {};
		try {
			r = JSON.parse(await b.readFile(t, "utf-8"));
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
function Pe(e, t) {
	return new Promise((n) => {
		m(t ? `pgrep -x "${e}"` : `pgrep -f "${e}"`, (e) => {
			n(!e);
		});
	});
}
function Fe(e, t, n) {
	return new Promise((r) => {
		let i = new re.Socket(), a = !1;
		i.setTimeout(n), i.once("connect", () => {
			a || (a = !0, i.destroy(), r(!0));
		}), i.once("timeout", () => {
			a || (a = !0, i.destroy(), r(!1));
		}), i.once("error", () => {
			a || (a = !0, i.destroy(), r(!1));
		}), i.connect(e, t);
	});
}
async function M(e) {
	try {
		return (await b.readFile(e, "utf-8")).trim();
	} catch {
		return "";
	}
}
async function Ie() {
	try {
		return await Pe("mosquitto", !0) ? await Fe(1883, "localhost", 2e3) ? "ok" : "warn" : "error";
	} catch {
		return "unknown";
	}
}
async function Le() {
	try {
		return await Pe("cobien_bridge", !1) ? await Fe(1883, "localhost", 2e3) ? "ok" : "warn" : "error";
	} catch {
		return "unknown";
	}
}
function Re(e) {
	return !e || e.operstate !== "up" ? "error" : e.rx_packets + e.tx_packets > 0 ? "ok" : "warn";
}
async function ze(e, t) {
	let { services: n, settings: r } = await Ne(e, t), i = n.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/", a = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || n.notify_api_key || "", o = process.env.COBIEN_DEVICE_ID || r.device_id || "CoBien6", s = null;
	try {
		let e = await M("/sys/class/net/can0/operstate");
		if (e) {
			let t = await M("/sys/class/net/can0/carrier"), n = parseInt(await M("/sys/class/net/can0/statistics/rx_packets") || "0", 10), r = parseInt(await M("/sys/class/net/can0/statistics/tx_packets") || "0", 10), i = parseInt(await M("/sys/class/net/can0/statistics/rx_errors") || "0", 10), a = parseInt(await M("/sys/class/net/can0/statistics/tx_errors") || "0", 10);
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
	let c = await Ie(), u = await Le(), d = Re(s), f = "";
	try {
		f = await new Promise((e) => {
			m("rustdesk --get-id", (t, n) => {
				e(t ? "" : n.trim());
			});
		});
	} catch {}
	let p = {
		device_id: o,
		screen: Te,
		sent_at: (/* @__PURE__ */ new Date()).toISOString(),
		software_version: `Electron-v${l.getVersion()}`,
		rustdesk_id: f,
		...Ee === null ? {} : { network_speed_kbps: Ee },
		services_status: {
			app: "ok",
			mosquitto: c,
			mqtt_can_bridge: u,
			can_interface: d,
			checked_at: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
	s && (p.can_status = s);
	try {
		let e = await fetch(i, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": a
			},
			body: JSON.stringify(p)
		});
		e.ok ? console.log(`[HEARTBEAT] Sent (Screen: ${Te})`) : console.warn(`[HEARTBEAT] Failed with status: ${e.status}`);
	} catch {
		console.error("[HEARTBEAT] Network error");
	}
}
async function Be(e, t, n) {
	let { services: r, settings: i } = await Ne(t, n), a = r.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/", o = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || r.notify_api_key || "", s = process.env.COBIEN_DEVICE_ID || i.device_id || "CoBien6";
	try {
		let n = await fetch(`${a}?device_id=${s}`, {
			method: "GET",
			headers: { "X-API-KEY": o }
		});
		if (n.ok) {
			let i = (await n.json()).notifications || [];
			if (i.length > 0) {
				console.log(`[POLL] Received ${i.length} notifications`);
				let n = !1;
				i.forEach((t) => {
					e && !e.isDestroyed() && e.webContents.send("backend:notification", t);
					let i = (t.type || "").toLowerCase();
					if ((i === "new_event" || i === "events_reload") && (n = !0, i === "new_event")) try {
						j("event");
					} catch (e) {
						console.error("[POLL] Failed to log remote event received:", e);
					}
					if (i === "force_update") {
						console.log("[POLL] Force update notification received. Triggering manual update...");
						let e = process.env.COBIEN_RUNTIME_STATE_DIR || v(x.homedir(), ".local/state/cobien/runtime"), t = v(e, "manual_update_reload.flag");
						b.mkdir(e, { recursive: !0 }).then(() => b.writeFile(t, JSON.stringify({ requested_at: (/* @__PURE__ */ new Date()).toISOString() }))).then(() => {
							console.log(`[POLL] Created manual update reload flag at: ${t}`), m("systemctl --user start cobien-update.service", (e, t, n) => {
								e ? console.error("[POLL] Failed to start update service:", e) : console.log("[POLL] Update service started successfully:", t);
							});
						}).catch((e) => {
							console.error("[POLL] Failed to prepare manual update reload flag:", e);
						});
					} else if (i === "restart") console.log("[POLL] Restart notification received. Rebooting device..."), m("systemctl reboot -i || echo cobien | sudo -S systemctl reboot -i || echo cobien | sudo -S reboot -f || reboot", (e, t, n) => {
						e ? console.error("[POLL] Failed to reboot device:", e) : console.log("[POLL] Reboot command executed successfully:", t);
					});
					else if (i === "contacts_updated") {
						console.log("[POLL] Contacts updated notification received. Syncing contacts...");
						let t = (r.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
						import("./contactsService-BixNje6P.js").then((e) => e.t).then(({ syncContacts: n }) => {
							n(s, o, t).then(() => {
								e && !e.isDestroyed() && e.webContents.send("contacts:updated");
							}).catch((e) => console.error("[POLL] Failed to sync contacts on notification:", e));
						}).catch((e) => console.error("[POLL] Failed to dynamically import contactsService:", e));
					}
				}), n && (console.log("[POLL] Event notification received. Refreshing local events cache..."), import("./eventsMongo-CEfPASGM.js").then((e) => e.r).then(({ getEvents: e }) => {
					e(t).catch((e) => console.error("[POLL] Failed to background-refresh events:", e));
				}).catch((e) => console.error("[POLL] Failed to dynamically import eventsMongo:", e)));
			}
		}
	} catch {}
}
//#endregion
//#region electron/services/boardService.ts
var Ve = "board_cache";
async function He() {
	let e = v(l.getPath("userData"), Ve);
	try {
		await b.access(e);
	} catch {
		await b.mkdir(e, { recursive: !0 });
	}
	return e;
}
async function Ue(e, t, n) {
	if (!e) return "";
	e.startsWith("/") && (e = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}${e}`);
	try {
		let r = await He(), i = ".png";
		(e.includes(".jpg") || e.includes(".jpeg")) && (i = ".jpg");
		let a = v(r, `${t}_${n}${i}`);
		try {
			return await b.access(a), `cobien-media://${a}`;
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
			return await b.writeFile(a, t), `cobien-media://${a}`;
		}
		return "";
	} catch (t) {
		return console.error(`[BOARD] Failed to cache image ${e}:`, t), "";
	}
}
async function We() {
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
			return (e.image || e.image_url) && (t = await Ue(e.image || e.image_url, "img", e.id)), e.author_avatar_url && (n = await Ue(e.author_avatar_url, "avatar", e.id)), {
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
async function Ge(e) {
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
async function Ke(e) {
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
async function qe(e, t) {
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
var Je = {
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
}, Ye = {
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
function Xe(e, t = !0) {
	return !t && e <= 1 ? "/svg/noche.svg" : Je[e] ?? "/svg/nubes.svg";
}
function N(e, t = "es") {
	return (Ye[t] || Ye.es)[e] ?? (t === "en" ? "Unknown condition" : t === "fr" ? "Condition inconnue" : "Condición desconocida");
}
function Ze(e) {
	let t = new Date(e).getHours(), n = t < 12 ? "a.m." : "p.m.";
	return `${t % 12 || 12} ${n}`;
}
async function Qe(e) {
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
function $e(e) {
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
async function et(e, t = "es") {
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
		let i = await Qe(e);
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
			if (n.temp = `${Math.round(c.current?.temperature_2m ?? 0)}°`, n.icon = Xe(l, u), r) try {
				let e = `https://api.openweathermap.org/data/2.5/weather?lat=${a}&lon=${o}&appid=${r}&units=metric&lang=${t}`;
				n.description = (await (await fetch(e, { signal: AbortSignal.timeout(4e3) })).json()).weather?.[0]?.description ?? N(l, t), n.description = n.description.charAt(0).toUpperCase() + n.description.slice(1);
			} catch {
				n.description = N(l, t);
			}
			else n.description = N(l, t);
			let d = Math.round(c.daily?.temperature_2m_min?.[0] ?? 0), f = Math.round(c.daily?.temperature_2m_max?.[0] ?? 0);
			n.tempMin = `Min ${d}°`, n.tempMax = `Max ${f}°`, n.todayPop = c.daily?.precipitation_probability_max?.[0] ?? 0, n.todayWind = Math.round(c.daily?.wind_speed_10m_max?.[0] ?? 0);
			let p = (/* @__PURE__ */ new Date()).getHours(), m = c.hourly?.time ?? [], h = c.hourly?.temperature_2m ?? [], ee = c.hourly?.weathercode ?? [], g = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), _ = m.findIndex((e) => e.startsWith(g) && new Date(e).getHours() >= p);
			_ < 0 && (_ = 0), n.hourly = m.slice(_, _ + 12).map((e, t) => {
				let n = new Date(e).getHours();
				return {
					time: Ze(e),
					icon: Xe(ee[_ + t] ?? 0, n >= 6 && n < 20),
					temp: `${Math.round(h[_ + t] ?? 0)}°`
				};
			});
			let v = c.daily?.time ?? [], te = c.daily?.temperature_2m_max ?? [], y = c.daily?.temperature_2m_min ?? [], b = c.daily?.weathercode ?? [], x = c.daily?.precipitation_probability_max ?? [], ne = c.daily?.wind_speed_10m_max ?? [];
			n.daily = v.slice(1, 7).map((e, n) => {
				let r = new Date(e), i = r.getDate(), a = t === "en" ? "en-US" : t === "fr" ? "fr-FR" : "es-ES", o = r.toLocaleDateString(a, { month: "long" }), s = r.toLocaleDateString(a, { weekday: "long" });
				return {
					name: s.charAt(0).toUpperCase() + s.slice(1),
					date: t === "en" ? `${o} ${i}` : `${i} de ${o}`,
					icon: Xe(b[n + 1] ?? 0),
					tmin: `${Math.round(y[n + 1] ?? 0)}°`,
					tmax: `${Math.round(te[n + 1] ?? 0)}°`,
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
			n.temp = `${Math.round(u.main.temp)}°`, n.icon = $e(u.weather[0].icon), n.description = u.weather[0].description, n.description = n.description.charAt(0).toUpperCase() + n.description.slice(1), n.tempMin = `Min ${Math.round(u.main.temp_min)}°`, n.tempMax = `Max ${Math.round(u.main.temp_max)}°`, n.todayPop = 0, n.todayWind = Math.round(u.wind.speed * 3.6), n.hourly = d.list.slice(0, 4).map((e) => ({
				time: Ze(e.dt_txt),
				icon: $e(e.weather[0].icon),
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
					icon: $e(s.weather[0].icon),
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
var tt = v(typeof __dirname < "u" ? __dirname : _(te(import.meta.url)), "../public/data/jokes"), P = {}, nt = {};
async function rt(e = "es") {
	try {
		let t = e === "fr" ? "jokes_fr.json" : e === "en" ? "jokes_en.json" : "jokes_es.json", n = await b.readFile(v(tt, t), "utf-8"), r = JSON.parse(n), i = [];
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
async function it(e = "es") {
	let t = [
		"es",
		"en",
		"fr"
	].includes(e) ? e : "es";
	(!P[t] || P[t].length === 0) && (P[t] = await rt(t));
	let n = P[t];
	if (n.length === 0) return t === "en" ? "No jokes available." : t === "fr" ? "Aucune blague disponible." : "No hay chistes disponibles.";
	let r = nt[t] || "", i = n.length > 1 ? n.filter((e) => e !== r) : n, a = i[Math.floor(Math.random() * i.length)];
	return nt[t] = a, a;
}
//#endregion
//#region electron/services/remindersService.ts
var at = null, F = /* @__PURE__ */ new Map(), ot = null;
function st() {
	return at ||= v(l.getPath("userData"), "reminders.json"), at;
}
async function I() {
	try {
		let e = await b.readFile(st(), "utf-8");
		return JSON.parse(e);
	} catch {
		return [];
	}
}
async function L(e) {
	await b.writeFile(st(), JSON.stringify(e, null, 2), "utf-8");
}
function ct(e) {
	let t = new Date(e.datetime).getTime() - Date.now();
	if (t <= 0) return;
	let n = setTimeout(async () => {
		F.delete(e.id), ot?.(e), await L((await I()).filter((t) => t.id !== e.id));
	}, t);
	F.set(e.id, n);
}
async function lt(e) {
	ot = e;
	let t = await I(), n = /* @__PURE__ */ new Date(), r = [];
	for (let e of t) new Date(e.datetime) > n && (ct(e), r.push(e));
	await L(r), console.log(`[REMINDERS] ${r.length} reminders scheduled`);
}
async function ut(e, t) {
	let n = {
		id: `rem_${Date.now()}`,
		message: e,
		datetime: t
	}, r = await I();
	return r.push(n), await L(r), ct(n), n;
}
async function dt() {
	let e = await I(), t = /* @__PURE__ */ new Date();
	return e.filter((e) => new Date(e.datetime) > t);
}
async function ft(e) {
	let t = await I(), n = t.filter((t) => t.id !== e);
	if (n.length === t.length) return !1;
	await L(n);
	let r = F.get(e);
	return r && (clearTimeout(r), F.delete(e)), !0;
}
//#endregion
//#region electron/services/mqttService.ts
var R = "rfid/read", z = "sensors/update", B = "app/nav", pt = "events/reload", mt = "board/reload", ht = "weather/reload", gt = "proximity/update", _t = "imu/update", vt = [
	R,
	z,
	B,
	pt,
	mt,
	ht,
	"rfid/actions_reload",
	gt,
	_t
], yt = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
}, bt = {}, xt = 5e3, St = null, Ct = 0, wt = !1, V = null, H = null;
function U(e) {
	!H || H.isDestroyed() || H.webContents.send("mqtt:event", e);
}
function Tt(e) {
	let t;
	try {
		t = e?.data?.id === void 0 ? parseInt(e.id ?? 0) : parseInt(e.data.id);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = Date.now();
	if (t === St && n - Ct < xt) {
		console.log(`[MQTT] RFID debounce ignored: ${t}`);
		return;
	}
	if (St = t, Ct = n, console.log(`[MQTT] RFID card: ${t}`), wt) {
		U({
			topic: R,
			type: "rfid",
			cardId: t
		});
		return;
	}
	let r = bt[t];
	U(r ? {
		topic: B,
		type: "nav",
		source: "rfid",
		...r
	} : {
		topic: R,
		type: "rfid",
		cardId: t
	});
}
function Et(e) {
	let t;
	try {
		t = e?.data?.PIC === void 0 ? parseInt(e.PIC ?? 0) : parseInt(e.data.PIC);
	} catch {
		t = 0;
	}
	if (!t) return;
	let n = yt[t];
	n ? (console.log(`[MQTT] Button PIC=${t} → ${n.target}`), U({
		topic: z,
		type: "nav",
		target: n.target,
		source: n.source
	})) : console.warn(`[MQTT] Unknown button PIC: ${t}`);
}
function Dt(e) {
	U({
		topic: B,
		...e
	});
}
async function W() {
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
		bt = n, console.log(`[MQTT] Loaded ${Object.keys(bt).length} RFID actions`);
	} catch (e) {
		console.error("[MQTT] Failed to load RFID config:", e);
	}
}
function Ot(e) {
	let t = 0, n = 0;
	try {
		t = e?.data?.can_id === void 0 ? parseInt(e.can_id ?? 0) : parseInt(e.data.can_id), n = e?.data?.event === void 0 ? parseInt(e.event ?? 0) : parseInt(e.data.event);
	} catch {}
	t && n && _e(t, n);
}
function kt(e) {
	ge();
}
function At(e) {
	H = e, W();
	let t = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${t}`), V = ie.connect(t, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: !0
	}), V.on("connect", () => {
		console.log("[MQTT] Connected");
		for (let e of vt) V.subscribe(e, { qos: 0 }, (t) => {
			t ? console.error(`[MQTT] Subscribe error on ${e}:`, t) : console.log(`[MQTT] Subscribed: ${e}`);
		});
		U({
			topic: "mqtt/status",
			type: "status",
			connected: !0
		});
	}), V.on("message", (e, t) => {
		let n = {};
		try {
			n = JSON.parse(t.toString());
		} catch {
			n = {};
		}
		switch (e) {
			case R:
				Tt(n);
				break;
			case z:
				Et(n);
				break;
			case B:
				Dt(n);
				break;
			case pt:
				U({
					topic: e,
					type: "reload",
					target: "events"
				});
				break;
			case mt:
				try {
					j("photo");
				} catch (e) {
					console.error("[MQTT] Failed to log photo received:", e);
				}
				U({
					topic: e,
					type: "reload",
					target: "board"
				});
				break;
			case ht:
				U({
					topic: e,
					type: "reload",
					target: "weather"
				});
				break;
			case gt:
				Ot(n);
				break;
			case _t:
				kt(n);
				break;
			case "rfid/actions_reload":
				W();
				break;
			default: console.log(`[MQTT] Unhandled topic: ${e}`);
		}
	}), V.on("error", (e) => {
		console.warn("[MQTT] Error:", e.message), U({
			topic: "mqtt/status",
			type: "status",
			connected: !1,
			error: e.message
		});
	}), V.on("offline", () => {
		console.warn("[MQTT] Offline — will retry"), U({
			topic: "mqtt/status",
			type: "status",
			connected: !1
		});
	}), V.on("reconnect", () => {
		console.log("[MQTT] Reconnecting...");
	});
}
function jt() {
	V && (V.end(!0), V = null, console.log("[MQTT] Disconnected"));
}
var Mt = {
	all: 0,
	square: 1,
	diamond: 2,
	plus: 3,
	X: 4,
	only_center: 5
}, Nt = {
	on: 0,
	off: 1,
	blink: 2,
	fading_blink: 3
};
function Pt(e, t) {
	let n = Mt[e] ?? 0, r = Nt[t] ?? 0;
	return n << 4 | r;
}
function Ft(e) {
	if (!V || !V.connected) {
		console.warn("[MQTT] Client not connected, cannot publish button config");
		return;
	}
	if (e.PIC1) {
		let t = e.PIC1, n = {
			PIC: 1,
			shape_mode: Pt(t.shape || "all", t.mode || "on"),
			color: t.color || "#ffffff",
			intensity: t.intensity === void 0 ? 255 : parseInt(t.intensity, 10)
		};
		V.publish("button/config", JSON.stringify(n)), console.log("[MQTT] Published button config for PIC1:", n);
	}
	if (e.PIC2) {
		let t = e.PIC2, n = {
			PIC: 2,
			shape_mode: Pt(t.shape || "all", t.mode || "on"),
			color: t.color || "#ffffff",
			intensity: t.intensity === void 0 ? 255 : parseInt(t.intensity, 10)
		};
		V.publish("button/config", JSON.stringify(n)), console.log("[MQTT] Published button config for PIC2:", n);
	}
}
var It = {
	OFF: 1,
	ON: 0,
	BLINK: 2,
	FADING_BLINK: 3
};
function Lt(e) {
	if (!V || !V.connected) {
		console.warn("[MQTT] Client not connected, cannot publish notification LED");
		return;
	}
	let t = It[(e.mode || "ON").toUpperCase()] ?? 0, n = {
		group: 7,
		color: e.color || "#FFFFFF",
		intensity: e.intensity === void 0 ? 255 : parseInt(e.intensity, 10),
		mode: t
	};
	V.publish("ledstrip/config", JSON.stringify(n)), console.log("[MQTT] Published notification LED config:", n);
}
function Rt() {
	if (!V || !V.connected) {
		console.warn("[MQTT] Client not connected, cannot turn off notification LED");
		return;
	}
	let e = {
		group: 7,
		color: "#000000",
		intensity: 0,
		mode: 1
	};
	V.publish("ledstrip/config", JSON.stringify(e)), console.log("[MQTT] Published LED turn-off config:", e);
}
function zt(e) {
	if (wt = e === 1, !V || !V.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID init");
		return;
	}
	let t = { mode: e };
	V.publish("rfid/init", JSON.stringify(t)), console.log("[MQTT] Published RFID init:", t);
}
function Bt(e, t) {
	if (!V || !V.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID config");
		return;
	}
	let n = {
		id: e,
		action: t
	};
	V.publish("rfid/config", JSON.stringify(n)), console.log("[MQTT] Published RFID config:", n);
}
function Vt() {
	if (!V || !V.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID reload");
		return;
	}
	let e = {
		action: "reload",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	};
	V.publish("rfid/actions_reload", JSON.stringify(e)), console.log("[MQTT] Published RFID actions reload:", e), W();
}
//#endregion
//#region electron/services/hardwareService.ts
var G = ae(m);
async function Ht(e, t = !1) {
	try {
		return t ? await G(`pactl set-sink-volume @DEFAULT_SINK@ ${e}%`) : await G(`pactl set-sink-volume @DEFAULT_SINK@ ${`${e >= 0 ? "+" : ""}${e}%`}`), !0;
	} catch (e) {
		return console.error("Failed to adjust volume:", e), !1;
	}
}
async function Ut() {
	try {
		let { stdout: e } = await G("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(e.trim()) || 0;
	} catch (e) {
		return console.error("Failed to get volume:", e), 50;
	}
}
async function Wt(e) {
	try {
		let { stdout: t } = await G("xrandr --query | grep ' connected' | cut -d' ' -f1"), n = t.trim().split("\n");
		if (n.length === 0) return !1;
		for (let t of n) {
			let n = .4;
			if (e !== void 0) n = e;
			else {
				let { stdout: e } = await G(`xrandr --verbose --output ${t} | grep -i brightness`), r = parseFloat(e.split(":")[1].trim());
				n = r < .6 ? .7 : r < .9 ? 1 : .4;
			}
			await G(`xrandr --output ${t} --brightness ${n.toFixed(2)}`);
		}
		return !0;
	} catch (e) {
		return console.error("Failed to adjust brightness:", e), !1;
	}
}
//#endregion
//#region electron/services/logsSyncService.ts
var K = v(l.getPath("userData"), "logs"), Gt = v(l.getPath("userData"), "logs_sync_state.json"), Kt = 120 * 1024, qt = 1500, Jt = [
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
], q = null;
function Yt() {
	y.existsSync(K) || y.mkdirSync(K, { recursive: !0 });
}
function Xt() {
	if (!y.existsSync(Gt)) return {
		last_sync_at: "",
		last_error: "",
		files: {}
	};
	try {
		let e = y.readFileSync(Gt, "utf-8"), t = JSON.parse(e);
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
function Zt(e) {
	try {
		y.writeFileSync(Gt, JSON.stringify(e, null, 4), "utf-8");
	} catch (e) {
		console.error("[SUPPORT LOGS] Failed to save sync state:", e);
	}
}
function Qt(e) {
	try {
		let t = y.statSync(e);
		return `${Math.floor(t.mtimeMs)}:${t.size}`;
	} catch {
		return "";
	}
}
function $t() {
	let e = /* @__PURE__ */ new Date(), t = /* @__PURE__ */ new Date();
	return t.setDate(e.getDate() - 1), [e, t];
}
function en(e) {
	let t = (e) => e.toString().padStart(2, "0");
	return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())}`;
}
function tn(e) {
	let t = (e) => e.toString().padStart(2, "0");
	return `${e.getFullYear()}${t(e.getMonth() + 1)}${t(e.getDate())}`;
}
async function nn(e) {
	try {
		let t = (await b.stat(e)).size, n = Math.max(0, t - Kt), r = await b.open(e, "r"), i = Buffer.alloc(t - n);
		await r.read(i, 0, t - n, n), await r.close();
		let a = i.toString("utf-8");
		if (n > 0) {
			let e = a.indexOf("\n");
			e >= 0 && (a = a.substring(e + 1));
		}
		let o = a.split("\n").map((e) => e.trim()).filter((e) => e.length > 0), s = n > 0 || o.length > qt;
		return o.length > qt && (o = o.slice(-qt)), {
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
async function rn(e, t, n = !1) {
	Yt();
	let r = {}, i = {};
	try {
		let n = JSON.parse(y.readFileSync(e, "utf-8")), a = {};
		try {
			a = JSON.parse(y.readFileSync(t, "utf-8"));
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
	let u = Xt(), d = u.files || {}, f = { ...d }, p = [], m = (/* @__PURE__ */ new Date()).toISOString(), h = $t();
	for (let e of Jt) for (let [t, r] of h.entries()) {
		let i = en(r), a = `${e.log_type}:${i}`, o = "";
		if (e.log_type === "app") if (t === 0) o = v(K, "app.log");
		else {
			let e = v(K, "app.log.1");
			o = y.existsSync(e) ? e : v(K, `cobien-app-${tn(r)}.log`);
		}
		else {
			let n = v(K, `${e.prefix}-${tn(r)}.log`);
			if (y.existsSync(n)) o = n;
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
					let t = v(K, e);
					if (y.existsSync(t)) {
						o = t;
						break;
					}
				}
			}
		}
		if (!o || !y.existsSync(o)) {
			delete f[a];
			continue;
		}
		let s = Qt(o);
		if (!n && d[a] === s) continue;
		let c = await nn(o);
		c.line_count > 0 && (p.push({
			log_type: e.log_type,
			log_date: i,
			filename: g(o),
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
		u.files = f, u.last_sync_at = m, u.last_error = "", Zt(u), console.log(`[SUPPORT LOGS] Successfully ingested ${p.length} support logs`);
	} catch (e) {
		console.error("[SUPPORT LOGS] Failed to sync support logs:", e.message || e), u.last_error = e.message || e, Zt(u);
	}
}
function an(e, t) {
	q && clearInterval(q), rn(e, t, !0), q = setInterval(() => {
		rn(e, t, !1);
	}, 300 * 1e3);
}
function on() {
	q &&= (clearInterval(q), null);
}
//#endregion
//#region electron/main.ts
s.config();
var sn = process.argv.find((e) => e.startsWith("--vite-dev-url="));
sn && (process.env.VITE_DEV_SERVER_URL = sn.split("=")[1]), f.registerSchemesAsPrivileged([{
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
var J = typeof __dirname < "u" ? __dirname : _(te(import.meta.url)), Y = null, X = "CoBien_WiFi_5G", cn = 0, Z = v(J, "../config/config.default.json"), Q = "";
function ln(e = "es", t = "male") {
	try {
		let n = v(J, "../config/config.default.json"), r = v(l.getPath("userData"), "config.local.json"), i = JSON.parse(y.readFileSync(n, "utf-8")), a = {};
		try {
			a = JSON.parse(y.readFileSync(r, "utf-8"));
		} catch {}
		let o = {
			...i.services,
			...a.services
		}, s = v(J, "../public/models/piper/bin/piper"), c = v(J, "../public/models/piper/es_ES-davefx-medium.onnx"), u = o.tts_piper_bin || s, d = o[`tts_piper_model_${e}_${t}`] || o[`tts_piper_model_${e}`], f = "";
		if (d) if (d.startsWith("/") || d.includes(":") || d.startsWith("http")) f = d;
		else {
			let e = v(J, "../public/models/piper", d);
			f = (y.existsSync(e), e);
		}
		else f = e === "fr" ? v(J, "../public/models/piper/fr_FR-siwis-medium.onnx") : e === "en" ? v(J, "../public/models/piper/en_US-amy-medium.onnx") : c;
		return {
			bin: u,
			model: f
		};
	} catch (e) {
		return console.error("Error reading piper config:", e), {
			bin: v(J, "../public/models/piper/bin/piper"),
			model: v(J, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
var un = null;
async function dn() {
	return new Promise((e) => {
		let t = 0, n = Date.now(), r = !1, i = setTimeout(() => {
			if (r) return;
			r = !0;
			let i = (Date.now() - n) / 1e3;
			e(t > 0 && i > 0 ? Math.round(t * 8 / i / 1e3) : null);
		}, 8e3);
		try {
			let a = d.request("https://speed.cloudflare.com/__down?bytes=512000");
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
function fn() {
	async function s() {
		let e = {};
		try {
			e = JSON.parse(await b.readFile(Z, "utf-8"));
		} catch (e) {
			console.error("Error reading default config:", e);
		}
		let t = {};
		if (Q) try {
			t = JSON.parse(await b.readFile(Q, "utf-8"));
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
	async function c(e) {
		let t = !1;
		try {
			let n = JSON.parse(await b.readFile(Z, "utf-8"));
			e(n), await b.writeFile(Z, JSON.stringify(n, null, 4)), t = !0;
		} catch {}
		let n = [];
		if (Q && n.push(Q), process.platform === "linux") {
			let e = process.env.COBIEN_CONFIG_DIR || v(process.env.XDG_CONFIG_HOME || v(x.homedir(), ".config"), "cobien");
			n.push(v(e, "config.local.json"));
		}
		let r = Array.from(new Set(n)), i = !1;
		for (let t of r) try {
			await b.mkdir(_(t), { recursive: !0 });
			let n = {};
			try {
				n = JSON.parse(await b.readFile(t, "utf-8"));
			} catch {}
			e(n), await b.writeFile(t, JSON.stringify(n, null, 4)), i = !0;
		} catch (e) {
			console.error(`[CONFIG] Error writing config to ${t}:`, e);
		}
		return r.length === 0 && console.warn("[CONFIG] No local config paths determined, cannot persist settings locally"), t || i;
	}
	u.handle("network:is-online", async () => {
		let e = (e) => new Promise((t) => {
			let n = setTimeout(() => t(!1), 3e3);
			ne.lookup(e, (e) => {
				clearTimeout(n), t(!e);
			});
		});
		return await e("google.com") ? !0 : e("one.one.one.one");
	}), u.handle("config:getWeather", async () => {
		try {
			let e = await s();
			return {
				catalog: e.settings?.weather_city_catalog || [],
				active: e.settings?.weather_cities || [],
				primary: e.settings?.weather_primary_city || ""
			};
		} catch (e) {
			return console.error("Error reading config:", e), {
				catalog: [],
				active: [],
				primary: ""
			};
		}
	}), u.handle("config:getSettings", async () => {
		try {
			return (await s()).settings || {};
		} catch {
			return {};
		}
	}), u.handle("config:saveGeneralSettings", async (e, t) => {
		try {
			return await c((e) => {
				e.settings ||= {}, t.wakeWordEnabled !== void 0 && (e.settings.wake_word_enabled = t.wakeWordEnabled), t.pinEnabled !== void 0 && (e.settings.settings_pin_enabled = t.pinEnabled), t.idleTimeout !== void 0 && (e.settings.idle_timeout_sec = t.idleTimeout);
			});
		} catch (e) {
			return console.error("Error saving general settings:", e), !1;
		}
	}), u.handle("config:saveEmotionPromptTime", async (e, t) => {
		try {
			return await c((e) => {
				e.settings ||= {}, e.settings.emotionPromptTime = t;
			});
		} catch (e) {
			return console.error("Error saving emotion prompt time:", e), !1;
		}
	}), u.handle("config:submitEmotion", async (e, t) => {
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
	}), u.handle("config:saveWeather", async (e, t) => {
		try {
			return await c((e) => {
				e.settings ||= {}, e.settings.weather_city_catalog = t.catalog, e.settings.weather_cities = t.active, e.settings.weather_primary_city = t.primary;
			});
		} catch (e) {
			return console.error("Error saving config:", e), !1;
		}
	}), u.handle("config:saveButtonColors", async (e, t) => {
		try {
			let e = await c((e) => {
				e.settings ||= {}, e.settings.button_colors = t;
			});
			return Ft(t), e;
		} catch (e) {
			return console.error("Error saving button colors:", e), !1;
		}
	}), u.handle("config:getNotifications", async () => {
		try {
			return (await s()).notifications || {};
		} catch {
			return {};
		}
	}), u.handle("config:saveNotifications", async (e, t) => {
		try {
			return await c((e) => {
				e.notifications = t;
			});
		} catch (e) {
			return console.error("Error saving notifications config:", e), !1;
		}
	}), u.handle("config:getRfidActions", async () => {
		try {
			return (await s()).settings?.rfid_actions || {};
		} catch (e) {
			return console.error("Error reading RFID actions:", e), {};
		}
	}), u.handle("config:initRfidConfigMode", async () => (zt(1), !0)), u.handle("config:cancelRfidConfigMode", async () => (zt(0), !0)), u.handle("config:saveRfidAction", async (e, t, n, r = "") => {
		try {
			let e = await c((e) => {
				e.settings ||= {}, e.settings.rfid_actions || (e.settings.rfid_actions = {}), e.settings.rfid_actions[String(t)] = {
					action: n,
					extra: r
				};
			});
			return Bt(t, {
				day_events: 2,
				weather: 3,
				videocall: 5
			}[n] ?? 2), Vt(), await W(), e;
		} catch (e) {
			return console.error("Error saving RFID action:", e), !1;
		}
	}), u.handle("config:deleteRfidAction", async (e, t) => {
		try {
			let e = await c((e) => {
				e.settings?.rfid_actions && delete e.settings.rfid_actions[String(t)];
			});
			return Vt(), await W(), e;
		} catch (e) {
			return console.error("Error deleting RFID action:", e), !1;
		}
	}), u.handle("config:getRingtones", async () => {
		try {
			let e = v(l.getAppPath(), "public", "audio", "ringtones"), t = v(l.getAppPath(), "dist", "audio", "ringtones"), n = e;
			try {
				await b.access(t), n = t;
			} catch {}
			let r = await b.readdir(n), i = [
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
	}), u.handle("config:triggerNotificationLed", async (e, t) => {
		try {
			let e = (await s()).notifications?.[t];
			return e ? (Lt(e), !0) : !1;
		} catch (e) {
			return console.error("Error triggering notification LED:", e), !1;
		}
	}), u.handle("config:turnOffNotificationLed", async () => {
		try {
			return Rt(), !0;
		} catch (e) {
			return console.error("Error turning off notification LED:", e), !1;
		}
	}), u.handle("config:simulateNotification", async (e, t) => {
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
			return Y && !Y.isDestroyed() ? (Y.webContents.send("backend:notification", e), !0) : !1;
		} catch (e) {
			return console.error("Error simulating notification:", e), !1;
		}
	});
	let d = (e) => {
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
	u.handle("config:scanWifi", async () => {
		let e = await (async () => {
			let e = "/tmp/host_wifi_list.txt";
			try {
				if (y.existsSync(e)) {
					let t = await b.readFile(e, "utf-8");
					if (t.trim()) return d(t);
				}
			} catch (e) {
				console.error("Failed to read host wifi list:", e);
			}
			return new Promise((e) => {
				m("nmcli device wifi rescan", () => {
					m("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list", (t, n) => {
						if (t || !n) {
							e([]);
							return;
						}
						e(d(n));
					});
				});
			});
		})();
		return e.length === 0 && (e = [
			{
				ssid: "CoBien_WiFi_5G",
				signal: 95,
				security: "WPA2",
				active: X === "CoBien_WiFi_5G"
			},
			{
				ssid: "Deusto_Guest",
				signal: 72,
				security: "WPA2",
				active: X === "Deusto_Guest"
			},
			{
				ssid: "Euskaltel_WiFi",
				signal: 50,
				security: "WPA/WPA2",
				active: X === "Euskaltel_WiFi"
			},
			{
				ssid: "Library_Public",
				signal: 45,
				security: "",
				active: X === "Library_Public"
			},
			{
				ssid: "IoT_Sensors",
				signal: 30,
				security: "WPA2",
				active: X === "IoT_Sensors"
			}
		]), e;
	}), u.handle("config:connectWifi", async (e, t, n) => {
		cn = Date.now();
		let r = async () => {
			let e = "/tmp/host_wifi_list.txt";
			try {
				if (y.existsSync(e)) {
					let t = await b.readFile(e, "utf-8");
					if (t.trim()) return d(t);
				}
			} catch (e) {
				console.error("Failed to read host wifi list:", e);
			}
			return new Promise((e) => {
				m("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list", (t, n) => {
					if (t || !n) {
						e([]);
						return;
					}
					e(d(n));
				});
			});
		}, i = async (e, t) => await new Promise((t) => {
			m("nmcli -t -f NAME connection show", (n, r) => {
				if (n || !r) {
					t(!1);
					return;
				}
				t(r.split("\n").map((e) => e.trim()).includes(e));
			});
		}) && (console.log(`[WIFI] Connection profile for "${e}" already exists. Attempting to bring it up...`), await new Promise((t) => {
			m(`nmcli connection up "${e.replace(/"/g, "\\\"")}"`, (n, r, i) => {
				n ? (console.warn(`[WIFI] Failed to bring up existing connection "${e}":`, n, i), t(!1)) : (console.log(`[WIFI] Successfully brought up existing connection "${e}".`), t(!0));
			});
		})) ? !0 : (console.log(`[WIFI] Creating/updating connection for "${e}"...`), new Promise((n) => {
			let r = `nmcli device wifi connect "${e.replace(/"/g, "\\\"")}"`;
			t && (r += ` password "${t.replace(/"/g, "\\\"")}"`), m(r, (e, t, r) => {
				e ? (console.error("Error connecting to wifi:", e, r), n(!1)) : n(!0);
			});
		})), a = () => new Promise((e) => {
			m("nmcli -t -f TYPE device", (t, n) => {
				if (t || !n) {
					e(!1);
					return;
				}
				e(n.split("\n").some((e) => e.trim() === "wifi"));
			});
		}), o = await r();
		if (!await a() || !o.some((e) => e.ssid === t)) return console.log(`[WIFI] Simulating connection to mock/real network (no physical wifi interface or mock network): ${t}`), await new Promise((e) => setTimeout(e, 2e3)), n === "fail" || n === "error" ? !1 : (X = t, !0);
		{
			console.log(`[WIFI] Connecting to real network: ${t}`);
			let e = await i(t, n);
			return e && (X = ""), e;
		}
	}), u.handle("config:getCurrentWifi", async () => await (() => {
		let e = "/tmp/host_wifi_list.txt";
		try {
			if (y.existsSync(e)) {
				let t = y.readFileSync(e, "utf-8");
				if (t.trim()) {
					let e = d(t).find((e) => e.active);
					if (e) return Promise.resolve(e.ssid);
				}
			}
		} catch (e) {
			console.error("Failed to read host active wifi:", e);
		}
		return new Promise((e) => {
			m("nmcli -t -f NAME,TYPE connection show --active", (t, n) => {
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
	})() || X), u.handle("events:get", async () => await t(Z)), u.handle("weather:fetch", async (e, t, n = "es") => await et(t, n)), u.handle("jokes:getRandom", async (e, t = "es") => await it(t)), u.handle("contacts:list", async () => await a()), u.handle("contacts:sync", async () => {
		let e = process.env.COBIEN_NOTIFY_API_KEY || "", t = process.env.COBIEN_DEVICE_ID;
		if (!t) throw console.error("ERROR: COBIEN_DEVICE_ID not set."), Error("COBIEN_DEVICE_ID not set");
		return await i(t, e, ((await s()).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), u.handle("contacts:requestCall", async (e, t) => {
		try {
			ve("request");
		} catch (e) {
			console.error("[MAIN] Failed to log call request:", e);
		}
		let n = process.env.COBIEN_NOTIFY_API_KEY || "", r = process.env.COBIEN_DEVICE_ID;
		if (!r) throw console.error("ERROR: COBIEN_DEVICE_ID not set."), Error("COBIEN_DEVICE_ID not set");
		return await o(t, r, n, ((await s()).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	}), u.handle("contacts:openCall", async (e, t) => {
		try {
			ve("made");
		} catch (e) {
			console.error("[MAIN] Failed to log call made:", e);
		}
		let n = process.env.COBIEN_DEVICE_ID;
		if (!n) throw console.error("ERROR: COBIEN_DEVICE_ID not set."), Error("COBIEN_DEVICE_ID not set");
		let r = process.env.COBIEN_VIDEOCALL_DEVICE_API_KEY || "", i = process.env.COBIEN_DEVICE_VIDEOCALL_SESSION_URL || "https://portal.co-bien.eu/api/device-videocall-session/", a = process.env.COBIEN_PORTAL_VIDEOCALL_DEVICE_URL || "https://portal.co-bien.eu/videocall/device/", o = process.env.COBIEN_PORTAL_CALL_ANSWERED_URL || "https://portal.co-bien.eu/api/call-answered/", s = `${process.env.COBIEN_PORTAL_VIDEOCALL_URL || "https://portal.co-bien.eu/videocall/"}?room=${encodeURIComponent(t)}&device=${encodeURIComponent(n)}`;
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
		}), u = Date.now(), d = () => {
			if (!l.isDestroyed()) try {
				let e = Math.round((Date.now() - u) / 1e3);
				try {
					ve("ended", e);
				} catch (e) {
					console.error("[MAIN] Failed to log call ended:", e);
				}
				l.hide(), Y && !Y.isDestroyed() && (Y.show(), Y.focus()), l.loadURL("about:blank"), setTimeout(() => {
					l.isDestroyed() || l.close();
				}, 500);
			} catch (e) {
				console.error("[VIDEOCALL] Error during clean close:", e);
			}
		};
		return l.on("closed", () => {
			Y && !Y.isDestroyed() && (Y.show(), Y.focus());
		}), l.loadURL(s), l.webContents.on("will-navigate", (e, t) => {
			t.startsWith("cobien://call-ended") && (e.preventDefault(), d());
		}), l.webContents.on("did-start-navigation", (e, t) => {
			t.startsWith("cobien://call-ended") && (e.preventDefault(), d());
		}), l.webContents.on("will-frame-navigate", (e) => {
			e.url.startsWith("cobien://call-ended") && (e.preventDefault(), d());
		}), !0;
	}), u.handle("reminders:add", async (e, t, n) => await ut(t, n)), u.handle("reminders:list", async () => await dt()), u.handle("reminders:delete", async (e, t) => await ft(t)), u.handle("events:addPersonal", async (e, t) => {
		let n = await s(), i = process.env.COBIEN_DEVICE_LOCATION || n.settings?.device_location || "Bilbao", a = process.env.COBIEN_DEVICE_ID || "CoBien6", o = t.location || i;
		try {
			j("event");
		} catch (e) {
			console.error("[MAIN] Failed to log event creation:", e);
		}
		return await r({
			...t,
			location: o,
			deviceId: a
		});
	}), u.handle("events:updatePersonal", async (t, n) => await e(n)), u.handle("events:delete", async (e, t) => await n(t)), u.handle("board:fetch", async () => await We()), u.handle("board:delete", async (e, t) => await Ge(t)), u.handle("board:read", async (e, t) => await Ke(t)), u.handle("board:reply", async (e, t, n) => await qe(t, n)), u.handle("config:getSystemInfo", async () => {
		let e = "";
		try {
			e = await new Promise((e) => {
				m("rustdesk --get-id", (t, n) => {
					e(t ? "" : n.trim());
				});
			});
		} catch {}
		return {
			version: l.getVersion(),
			deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX",
			contactsPath: v(l.getPath("userData"), "contacts/list_contacts.txt"),
			defaultLanguage: process.env.COBIEN_APP_LANGUAGE || "en",
			rustdeskId: e,
			networkSpeedKbps: un
		};
	}), u.handle("config:measureNetworkSpeed", async () => {
		let e = await dn();
		return un = e, ke(e), Q && Ae(Z, Q).catch(() => {}), e;
	}), u.handle("icso:logVocalAssistant", (e, t, n) => {
		try {
			return A("vocal_assistant", t, n), !0;
		} catch (e) {
			return console.error("[MAIN] Failed to log vocal assistant action:", e), !1;
		}
	}), u.handle("icso:logScreenWakeup", () => {
		try {
			return ye(), !0;
		} catch (e) {
			return console.error("[MAIN] Failed to log screen wakeup:", e), !1;
		}
	}), u.handle("app:restart", () => {
		console.log("[Main] Restarting application via window reload..."), process.env.VITE_DEV_SERVER_URL ? Y && !Y.isDestroyed() && Y.loadURL(process.env.VITE_DEV_SERVER_URL) : Y && !Y.isDestroyed() ? Y.loadFile(v(J, "../dist/index.html")) : (l.relaunch(), l.exit(0));
	}), u.handle("app:reboot-system", () => {
		console.log("[Main] System reboot requested from GUI..."), m("systemctl reboot -i || reboot || sudo reboot", (e) => {
			e && console.error("[Main] Failed to execute reboot command:", e);
		});
	}), u.handle("app:exit", () => {
		l.quit();
	}), u.handle("app:update", async () => {
		console.log("[Main] Manual update requested from GUI.");
		let e = process.env.COBIEN_RUNTIME_STATE_DIR || v(x.homedir(), ".local/state/cobien/runtime"), t = v(e, "manual_update_reload.flag");
		try {
			await b.mkdir(e, { recursive: !0 }), await b.writeFile(t, JSON.stringify({ requested_at: (/* @__PURE__ */ new Date()).toISOString() })), console.log(`[Main] Created manual update reload flag at: ${t}`);
		} catch (e) {
			console.error("[Main] Failed to write manual update reload flag:", e.message || e);
		}
		return new Promise((e, t) => {
			let n = "systemctl --user start cobien-update.service";
			console.log(`[Main] Executing update command: ${n}`), m(n, (n, r, i) => {
				n ? (console.error("[Main] Failed to start update service:", n), t(n)) : (console.log("[Main] Update service started successfully:", r), e(!0));
			});
		});
	}), u.handle("app:uninstall", async () => {
		let e = x.userInfo().username, t = v(x.homedir(), "cobien/cobien-furniture-app-launcher/uninstall-cobien-furniture-environment.sh");
		return console.log(`[Uninstall] Target script path: ${t} (resolving for user: ${e})`), new Promise((n, r) => {
			let i = `echo "cobien" | sudo -S systemd-run --system --collect --setenv=COBIEN_SETUP_USER=${e} --setenv=COBIEN_NON_INTERACTIVE=1 --setenv=COBIEN_AUTO_CONFIRM=1 --setenv=COBIEN_AUTO_REBOOT_AFTER_UNINSTALL=1 bash "${t}"`;
			console.log(`[Uninstall] Running command: ${i}`), m(i, (e, t, i) => {
				e ? (console.error("[Uninstall] Script error:", e), console.error("[Uninstall] Script stderr:", i), r(e)) : (console.log("[Uninstall] Script stdout:", t), n(!0));
			});
		});
	});
	let f = null;
	u.handle("tts:stop", () => {
		if (f) {
			try {
				f.kill();
			} catch {}
			f = null;
		}
	}), u.handle("tts:speak", async (e, t, n = "es", r = "male", i = "piper") => {
		if (console.log(`[TTS] Speaking (${n}/${r}) via ${i}: "${t}"`), f) {
			try {
				f.kill();
			} catch {}
			f = null;
		}
		let a = v(x.tmpdir(), `tts_${Date.now()}.wav`), { bin: o, model: s } = ln(n, r);
		return console.log(`[TTS] Piper Config: bin=${o}, model=${s}`), s ? new Promise((e) => {
			let n = h(o, [
				"--model",
				s,
				"--output_file",
				a
			], async (t, n, r) => {
				if (t) {
					console.error("[TTS] Piper exec error:", t, r), e(null);
					return;
				}
				try {
					let t = await b.readFile(a);
					await b.unlink(a), console.log(`[TTS] Generated WAV: ${t.length} bytes`), e(t);
				} catch (t) {
					console.error("[TTS] Error reading temp wav:", t), e(null);
				}
			});
			n.stdin?.write(t), n.stdin?.end();
		}) : (console.error("TTS: No Piper model configured."), null);
	}), u.handle("hardware:adjustVolume", async (e, t, n = !1) => await Ht(t, n)), u.handle("hardware:adjustBrightness", async (e, t) => await Wt(t)), u.handle("hardware:getVolume", async () => await Ut()), u.handle("logs:getTypes", () => [
		"app",
		"icso",
		"can",
		"bridge"
	]), u.handle("logs:getTail", async (e, t) => {
		let n = v(l.getPath("userData"), "logs"), r = "";
		if (t === "app" ? r = v(n, "app.log") : t === "icso" ? r = v(n, "icso_log.txt") : t === "can" ? r = vn(n, [
			"can-bus",
			"can_bus",
			"can"
		]) : t === "bridge" && (r = vn(n, [
			"mqtt-can-bridge",
			"mqtt_can_bridge",
			"bridge"
		])), !r || !y.existsSync(r)) return `(sin datos en el log de tipo: ${t})`;
		try {
			return y.readFileSync(r, "utf-8").split("\n").slice(-250).join("\n");
		} catch (e) {
			return `Error al leer logs: ${e.message}`;
		}
	});
}
function pn() {
	Y = new c({
		width: 1024,
		height: 768,
		fullscreen: !0,
		webPreferences: {
			preload: v(J, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0
		}
	}), Y.setBackgroundColor("#ffffff"), Y.webContents.on("render-process-gone", (e, t) => {
		console.error(`[STABILITY] Render process gone: ${t.reason} (exitCode=${t.exitCode})`), setTimeout(() => {
			Y && !Y.isDestroyed() && (console.log("[STABILITY] Reloading window after renderer crash..."), process.env.VITE_DEV_SERVER_URL ? Y.loadURL(process.env.VITE_DEV_SERVER_URL) : Y.loadFile(v(J, "../dist/index.html")));
		}, 2e3);
	}), Y.webContents.on("unresponsive", () => {
		console.warn("[STABILITY] Renderer became unresponsive. Will reload if still unresponsive in 5s..."), setTimeout(() => {
			Y && !Y.isDestroyed() && (Y.webContents.isCurrentlyAudible() || !0) && (console.warn("[STABILITY] Forcing reload after unresponsive timeout."), Y.webContents.reload());
		}, 5e3);
	}), Y.webContents.on("responsive", () => {
		console.log("[STABILITY] Renderer became responsive again.");
	}), process.env.VITE_DEV_SERVER_URL ? (Y.loadURL(process.env.VITE_DEV_SERVER_URL), Y.webContents.on("did-fail-load", (e, t, n, r) => {
		process.env.VITE_DEV_SERVER_URL && r.startsWith(process.env.VITE_DEV_SERVER_URL) && (console.log(`[Main] Failed to load dev URL (error: ${n}). Retrying in 1s...`), setTimeout(() => {
			Y && !Y.isDestroyed() && Y.loadURL(process.env.VITE_DEV_SERVER_URL);
		}, 1e3));
	})) : (Y.loadFile(v(J, "../dist/index.html")), Y.webContents.on("did-fail-load", (e, t, n) => {
		console.error(`[STABILITY] Failed to load production HTML (error: ${n}). Retrying in 2s...`), setTimeout(() => {
			Y && !Y.isDestroyed() && Y.loadFile(v(J, "../dist/index.html"));
		}, 2e3);
	}));
}
var $ = process.env.COBIEN_DISABLE_GPU === "1" || process.env.DISABLE_GPU === "1";
if (!$) try {
	let e = ee("systemd-detect-virt", { encoding: "utf-8" }).trim();
	e && e !== "none" && (console.log(`[GPU] Virtual machine detected (${e}). Disabling hardware acceleration.`), $ = !0);
} catch {}
if (!$) try {
	let e = x.homedir(), t = [process.env.COBIEN_LOCAL_CONFIG_PATH || v(e, ".config", "cobien", "config.local.json"), v(e, ".config", "cobien-furniture-electron", "config.local.json")];
	for (let e of t) if (y.existsSync(e)) {
		let t = y.readFileSync(e, "utf-8");
		if (JSON.parse(t)?.settings?.disable_gpu === !0) {
			console.log(`[GPU] disable_gpu=true found in local config (${e}). Disabling hardware acceleration.`), $ = !0;
			break;
		}
	}
} catch {}
if (!$) try {
	(y.existsSync("/dev/dri") ? y.readdirSync("/dev/dri").filter((e) => e.startsWith("card")) : []).length === 0 && (console.log("[GPU] No DRI card devices found. Disabling hardware acceleration."), $ = !0);
} catch {}
$ && (l.disableHardwareAcceleration(), l.commandLine.appendSwitch("disable-gpu")), l.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,VaapiVideoEncoder"), l.commandLine.appendSwitch("password-store", "basic"), l.commandLine.appendSwitch("no-sandbox"), l.commandLine.appendSwitch("disable-gpu-sandbox");
function mn() {
	process.stdout.on("error", () => {}), process.stderr.on("error", () => {});
	let e = v(l.getPath("userData"), "logs");
	y.existsSync(e) || y.mkdirSync(e, { recursive: !0 });
	let t = v(e, "app.log"), n = y.createWriteStream(t, {
		flags: "a",
		encoding: "utf-8"
	}), r = 0;
	try {
		r = y.statSync(t).size;
	} catch {
		r = 0;
	}
	let i = 5 * 1024 * 1024, a = () => {
		try {
			n.end();
			let e = t + ".1";
			y.existsSync(e) && y.unlinkSync(e), y.existsSync(t) && y.renameSync(t, e), n = y.createWriteStream(t, {
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
l.whenReady().then(() => {
	mn(), process.on("uncaughtException", (e) => {
		console.error("[FATAL] Uncaught exception (process kept alive):", e);
	}), process.on("unhandledRejection", (e) => {
		console.error("[FATAL] Unhandled promise rejection (process kept alive):", e);
	}), p.defaultSession.setPermissionRequestHandler((e, t, n) => {
		[
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(t) ? n(!0) : n(!1);
	}), p.defaultSession.setPermissionCheckHandler((e, t, n) => [
		"media",
		"geolocation",
		"notifications",
		"midiSysex",
		"openExternal"
	].includes(t)), f.handle("cobien-media", (e) => {
		try {
			let t = new URL(e.url), n = decodeURIComponent(t.pathname);
			return t.hostname && t.hostname !== "localhost" && (n = "/" + decodeURIComponent(t.hostname) + n), d.fetch("file://" + n);
		} catch (t) {
			return console.error("[PROTOCOL] Failed to parse custom media URL:", e.url, t), new Response("Invalid URL", { status: 400 });
		}
	});
	let e = v(l.getPath("userData"), "config.local.json");
	Q = e, fn(), Ce(Z, e), ye(), an(Z, e);
	let t = JSON.parse(y.readFileSync(Z, "utf-8")), n = {};
	try {
		y.existsSync(e) && (n = JSON.parse(y.readFileSync(e, "utf-8")));
	} catch {}
	let r = {
		...t.services,
		...n.services
	}, a = {
		...t.settings,
		...n.settings
	}, o = (r.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), s = process.env.COBIEN_NOTIFY_API_KEY || r.notify_api_key || "", u = process.env.COBIEN_DEVICE_ID || a.device_id || "CoBienX";
	!process.env.COBIEN_DEVICE_ID && !a.device_id && console.error("WARNING: COBIEN_DEVICE_ID not set. Using fallback \"CoBienX\". The app will start but some features may not work correctly."), i(u, s, o).catch(console.error);
	let m = parseInt(process.env.COBIEN_CONTACTS_SYNC_INTERVAL_SEC || "300", 10);
	m < 60 && (m = 300), m > 0 && (hn = setInterval(() => {
		console.log("[CONTACTS] Periodic sync started"), i(u, s, o).then(() => {
			Y && !Y.isDestroyed() && Y.webContents.send("contacts:updated");
		}).catch(console.error);
	}, m * 1e3)), pn(), gn = _n(), lt((e) => {
		Y && !Y.isDestroyed() && Y.webContents.send("reminder:fire", e);
	}), Y && (je(Y, Z, e), At(Y)), l.on("activate", () => {
		c.getAllWindows().length === 0 && pn();
	});
});
var hn = null, gn = null;
function _n() {
	return setInterval(async () => {
		try {
			let e = x.homedir(), t = v(l.getAppPath(), "config.default.json"), n = process.env.COBIEN_LOCAL_CONFIG_PATH || v(e, ".config", "cobien", "config.local.json"), r = !1;
			try {
				let e = {};
				y.existsSync(t) && (e = JSON.parse(y.readFileSync(t, "utf-8")));
				let i = {};
				y.existsSync(n) && (i = JSON.parse(y.readFileSync(n, "utf-8"))), r = {
					...e.settings,
					...i.settings
				}.enable_wifi_watchdog === !0;
			} catch {}
			if (!r || await new Promise((e) => {
				m("nmcli -t -f CONNECTIVITY networking", (t, n) => {
					if (!t && n && n.trim() === "full") {
						e(!0);
						return;
					}
					e(!1);
				});
			}) || !await new Promise((e) => {
				m("nmcli -t -f TYPE device", (t, n) => {
					if (t || !n) {
						e(!1);
						return;
					}
					e(n.split("\n").some((e) => e.trim() === "wifi"));
				});
			}) || await new Promise((e) => {
				m("nmcli -t -f TYPE,STATE device", (t, n) => {
					if (t || !n) {
						e(!1);
						return;
					}
					e(n.split("\n").map((e) => e.trim()).some((e) => {
						let [t, n] = e.split(":");
						return t === "wifi" && n === "connected";
					}));
				});
			}) || Date.now() - cn < 120 * 1e3) return;
			await new Promise((e) => {
				m("nmcli -t -f SSID device wifi list", (t, n) => {
					if (t || !n) {
						e(!1);
						return;
					}
					e(n.split("\n").map((e) => e.trim()).includes("cobien"));
				});
			}) && (console.log("[WIFI-WATCHDOG] Device is offline, and \"cobien\" SSID is in range. Auto-connecting to default Wi-Fi..."), m("nmcli device wifi connect \"cobien\" password \"Cobien2026\"", (e, t, n) => {
				e ? console.error("[WIFI-WATCHDOG] Failed to auto-connect to cobien Wi-Fi:", e, n) : console.log("[WIFI-WATCHDOG] Successfully auto-connected to cobien Wi-Fi.");
			}));
		} catch (e) {
			console.error("[WIFI-WATCHDOG] Error in watchdog loop:", e);
		}
	}, 30 * 1e3);
}
function vn(e, t) {
	if (!y.existsSync(e)) return "";
	try {
		let n = y.readdirSync(e), r = [];
		for (let i of n) for (let n of t) i.startsWith(n) && (i.endsWith(".log") || i.endsWith(".txt")) && r.push(v(e, i));
		return r.length === 0 ? "" : (r.sort((e, t) => y.statSync(t).mtimeMs - y.statSync(e).mtimeMs), r[0]);
	} catch {
		return "";
	}
}
l.on("window-all-closed", () => {
	jt(), Me(), we(), on(), hn &&= (clearInterval(hn), null), gn &&= (clearInterval(gn), null), process.platform !== "darwin" && l.quit();
});
//#endregion
