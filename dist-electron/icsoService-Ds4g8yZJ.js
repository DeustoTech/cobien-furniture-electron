import { t as e } from "./rolldown-runtime-CAFD8bLK.js";
import { app as t } from "electron";
import { join as n } from "node:path";
import * as r from "node:fs";
import { promises as i } from "node:fs";
//#region electron/services/icsoService.ts
var a = /* @__PURE__ */ e({
	logImuEvent: () => T,
	logNavigation: () => w,
	logNotificationReceived: () => O,
	logProximityEvent: () => E,
	logScreenWakeup: () => k,
	logVideoCallEvent: () => D,
	resetLocalTelemetry: () => F,
	startIcsoSyncLoop: () => N,
	stopIcsoSyncLoop: () => P,
	syncIcsoToBackend: () => M,
	writeTxtLog: () => C
}), o = n(t.getPath("userData"), "logs"), s = n(o, "icso_log.txt"), c = n(o, "icso_log.json"), l = n(o, "icso_proximity_sensors.txt"), u = n(t.getPath("userData"), "icso_sync_state.json"), d = {
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
}, f = 24250, p = 53591, m = 58795, h = {
	1141: "north",
	1140: "south",
	1142: "east",
	1143: "west"
}, g = {
	north: "NORTH",
	south: "SOUTH",
	east: "EAST",
	west: "WEST"
}, _ = null;
function v() {
	r.existsSync(o) || r.mkdirSync(o, { recursive: !0 });
}
function y() {
	if (v(), !r.existsSync(c)) return JSON.parse(JSON.stringify(d));
	try {
		let e = r.readFileSync(c, "utf-8"), t = JSON.parse(e);
		return {
			page_views: {
				...d.page_views,
				...t.page_views
			},
			navigation_inputs: {
				...d.navigation_inputs,
				...t.navigation_inputs
			},
			imu: {
				...d.imu,
				...t.imu
			},
			video_calls: {
				...d.video_calls,
				...t.video_calls
			},
			board: {
				...d.board,
				...t.board
			},
			events: {
				...d.events,
				...t.events
			},
			screen_wakeup: {
				...d.screen_wakeup,
				...t.screen_wakeup
			},
			proximity: {
				north: {
					...d.proximity.north,
					...t.proximity?.north
				},
				south: {
					...d.proximity.south,
					...t.proximity?.south
				},
				east: {
					...d.proximity.east,
					...t.proximity?.east
				},
				west: {
					...d.proximity.west,
					...t.proximity?.west
				}
			}
		};
	} catch (e) {
		return console.error("[ICSO] Failed to load JSON state, falling back to defaults:", e), JSON.parse(JSON.stringify(d));
	}
}
function b(e) {
	v();
	try {
		r.writeFileSync(c, JSON.stringify(e, null, 4), "utf-8");
	} catch (e) {
		console.error("[ICSO] Failed to save JSON state:", e);
	}
}
function x() {
	let e = /* @__PURE__ */ new Date(), t = (e) => e.toString().padStart(2, "0");
	return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())} ${t(e.getHours())}:${t(e.getMinutes())}:${t(e.getSeconds())}`;
}
function S(e, t = 5 * 1024 * 1024) {
	try {
		if (!r.existsSync(e)) return;
		if (r.statSync(e).size > t) {
			let t = e + ".1";
			r.existsSync(t) && r.unlinkSync(t), r.renameSync(e, t);
		}
	} catch (t) {
		console.error(`[ICSO] Log rotation failed for ${e}:`, t);
	}
}
function C(e, t, n) {
	v();
	let i = x(), a = {
		touchscreen: "TOUCHSCREEN",
		home_button: "HOME BUTTON",
		vocal_assistant: "VOCAL ASSISTANT",
		rfid_cards: "RFID CARD",
		imu: "IMU",
		videocall: "VIDEO CALL",
		notification: "NOTIFICATION",
		wakeup: "SCREEN WAKEUP",
		proximity: "PROXIMITY"
	}, o = e.trim() || "SYSTEM", c = a[o] || o.toUpperCase(), u = "";
	if (t === void 0 && !a[o]) {
		u = `[${i}] ${o}`, S(s), r.appendFileSync(s, u + "\n", "utf-8");
		return;
	}
	let d = t || "";
	if (o === "rfid_cards" && d === "videocall" && (d = "videocall request"), o === "vocal_assistant" && (!d || d === "assistant_triggered")) u = `[${i}] ACTIVATION VOCAL ASSISTANT`;
	else if (o === "vocal_assistant" && d) {
		let e = (n || "").trim();
		u = e ? `[${i}] VOCAL ASSISTANT → ${d} (recognized: ${e})` : `[${i}] VOCAL ASSISTANT → ${d}`;
	} else u = o === "proximity" && d ? `[${i}] PROXIMITY → ${d}` : d ? `[${i}] VIA ${c} → ${d}` : `[${i}] ${c}`;
	let f = o === "proximity" ? l : s;
	S(f), r.appendFileSync(f, u + "\n", "utf-8");
}
function w(e, t) {
	let n = y(), r = e.replace(/^\//, "").replace(/-/g, "_");
	r === "call" && (r = "contacts");
	let i = n.page_views;
	i[r] !== void 0 && i[r]++;
	let a = n.navigation_inputs;
	a[t] !== void 0 && a[t]++, b(n), C(t, r || "home");
}
function T(e) {
	let t = y(), n = e || (t.imu.state === "idle" ? "movement_start" : "movement_stop");
	t.imu.state = n === "movement_start" ? "moving" : "idle", n === "movement_stop" && t.imu.movements++, b(t), C("imu", n === "movement_start" ? "moving" : "idle");
}
function E(e, t) {
	if (h[e] === void 0) return;
	let n = h[e], r = y(), i = !1, a = null;
	t === f ? (r.proximity[n].motion_detected++, i = !0, a = "MOTION") : t === p ? (r.proximity[n].approach_detected++, i = !0, a = "APPROACH") : t === m && (a = "MOTION_END"), i && b(r), a !== null && C("proximity", `${a} ${g[n]}`);
}
function D(e, t = 0) {
	let n = y();
	e === "request" ? n.video_calls.call_requests++ : e === "made" ? n.video_calls.calls_made++ : e === "ended" && (n.video_calls.last_duration_sec = t, n.video_calls.total_duration_sec += t), b(n), C("videocall", e);
}
function O(e) {
	let t = y();
	e === "photo" ? t.board.received_photos++ : e === "event" && t.events.added_events++, b(t), C("notification", e);
}
function k() {
	let e = y();
	e.screen_wakeup.wakeups++, b(e), C("wakeup");
}
async function A(e, t) {
	try {
		if (!r.existsSync(e)) return {
			lines: [],
			offset: 0
		};
		let n = await i.stat(e), a = t >= 0 && t <= n.size ? t : 0, o = await i.open(e, "r"), s = Buffer.alloc(n.size - a);
		return await o.read(s, 0, n.size - a, a), await o.close(), {
			lines: s.toString("utf-8").split("\n").map((e) => e.trim()).filter((e) => e.length > 0),
			offset: n.size
		};
	} catch (n) {
		return console.error("[ICSO] Failed to read lines from", e, n), {
			lines: [],
			offset: t
		};
	}
}
function j(e) {
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
async function M(e, t, n = !1) {
	let i = {}, a = {};
	try {
		let n = JSON.parse(r.readFileSync(e, "utf-8")), o = {};
		try {
			o = JSON.parse(r.readFileSync(t, "utf-8"));
		} catch {}
		i = {
			...n.services,
			...o.services
		}, a = {
			...n.settings,
			...o.settings
		};
	} catch (e) {
		console.error("[ICSO] Sync configuration read failed:", e);
		return;
	}
	let o = (i.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), d = (i.icso_telemetry_url || `${o}/pizarra/api/icso/telemetry/`).trim(), f = (i.icso_events_url || `${o}/pizarra/api/icso/events/`).trim(), p = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || i.notify_api_key || "", m = process.env.COBIEN_DEVICE_ID || a.device_id || "CoBien6";
	if (!m || !d || !f) return;
	let h = { "Content-Type": "application/json" };
	p && (h["X-API-KEY"] = p);
	let g = {
		txt_offset: 0,
		proximity_offset: 0,
		last_snapshot_sync_at: "",
		last_events_sync_at: "",
		last_error: ""
	};
	if (r.existsSync(u)) try {
		g = {
			...g,
			...JSON.parse(r.readFileSync(u, "utf-8"))
		};
	} catch {}
	let _ = (/* @__PURE__ */ new Date()).toISOString();
	if (n || r.existsSync(c)) try {
		let e = {
			device_id: m,
			captured_at: _,
			snapshot: y()
		}, t = await fetch(d, {
			method: "POST",
			headers: h,
			body: JSON.stringify(e)
		});
		if (!t.ok) throw Error(`Telemetry sync HTTP ${t.status}`);
		g.last_snapshot_sync_at = _;
	} catch (e) {
		console.error("[ICSO] Telemetry snapshot sync failed:", e.message || e), g.last_error = `Telemetry: ${e.message || e}`, r.writeFileSync(u, JSON.stringify(g, null, 4), "utf-8");
		return;
	}
	let { lines: v, offset: b } = await A(s, g.txt_offset), { lines: x, offset: S } = await A(l, g.proximity_offset), C = [];
	if (v.forEach((e) => {
		C.push({
			device_id: m,
			source: "icso_log",
			logged_at: j(e) || _,
			message: e
		});
	}), x.forEach((e) => {
		C.push({
			device_id: m,
			source: "icso_proximity",
			logged_at: j(e) || _,
			message: e
		});
	}), C.length > 0) try {
		let e = await fetch(f, {
			method: "POST",
			headers: h,
			body: JSON.stringify({
				device_id: m,
				sent_at: _,
				events: C
			})
		});
		if (!e.ok) throw Error(`Events sync HTTP ${e.status}`);
		g.txt_offset = b, g.proximity_offset = S, g.last_events_sync_at = _, g.last_error = "";
	} catch (e) {
		console.error("[ICSO] Events sync failed:", e.message || e), g.last_error = `Events: ${e.message || e}`;
	}
	r.writeFileSync(u, JSON.stringify(g, null, 4), "utf-8");
}
function N(e, t) {
	_ && clearInterval(_), M(e, t, !0), _ = setInterval(() => {
		M(e, t, !1);
	}, 300 * 1e3);
}
function P() {
	_ &&= (clearInterval(_), null);
}
function F() {
	b(d), console.log("[ICSO] Local telemetry snapshot reset to default state.");
}
//#endregion
export { E as a, N as c, O as i, P as l, T as n, k as o, w as r, D as s, a as t, C as u };
