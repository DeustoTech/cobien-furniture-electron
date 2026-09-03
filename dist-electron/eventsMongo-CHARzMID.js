import { t as e } from "./rolldown-runtime-CAFD8bLK.js";
import { app as t } from "electron";
import { join as n } from "node:path";
import { promises as r } from "node:fs";
import { MongoClient as i, ObjectId as a } from "mongodb";
//#region electron/services/eventsMongo.ts
var o = /* @__PURE__ */ e({
	addPersonalEvent: () => b,
	deleteEvent: () => S,
	getEvents: () => y,
	updatePersonalEvent: () => x
}), s = null, c = 0, l = 15e3, u = () => n(t.getPath("userData"), "events.local.json"), d = () => n(t.getPath("userData"), "events.pending.json");
async function f() {
	try {
		let e = await r.readFile(u(), "utf-8"), t = JSON.parse(e), n = (await m()).map((e) => {
			let t = e.audience || "all";
			return t = typeof t == "string" && t.toLowerCase() === "device" ? "device" : "public", {
				id: e.id || e._id?.toString() || String(Math.random()),
				date: e.date || "",
				title: e.title || e.titulo || "Sin título",
				description: e.description || e.descripcion || "Sin descripción",
				location: e.location || "",
				venue: e.venue || "",
				audience: t,
				color: t === "device" ? "#FF3B30" : "#1E90FF",
				target_device: e.target_device || "",
				created_by: e.created_by || "",
				all_day: e.all_day === !0 || e.all_day !== !1 && e.all_day !== "false" && !e.start_time,
				start_time: e.start_time || "",
				end_time: e.end_time || "",
				pending_sync: !0
			};
		}), i = [...t];
		for (let e of n) i.some((t) => t.id === e.id) || i.push(e);
		return i;
	} catch {
		return await m();
	}
}
async function p(e) {
	try {
		await r.writeFile(u(), JSON.stringify(e, null, 2));
	} catch (e) {
		console.error("[EVENTS] Error writing local cache:", e);
	}
}
async function m() {
	try {
		let e = await r.readFile(d(), "utf-8");
		return JSON.parse(e);
	} catch {
		return [];
	}
}
async function h(e) {
	try {
		await r.writeFile(d(), JSON.stringify(e, null, 2));
	} catch (e) {
		console.error("[EVENTS] Error writing pending events:", e);
	}
}
async function g() {
	if (s) return s;
	let e = process.env.MONGO_URI || "";
	if (!e) throw Error("MONGO_URI is missing");
	let t = new i(e, {
		serverSelectionTimeoutMS: 5e3,
		connectTimeoutMS: 5e3
	});
	try {
		return await t.connect(), s = t, s;
	} catch (e) {
		throw s = null, e;
	}
}
async function _() {
	let e = await m();
	if (e.length === 0) return;
	console.log(`[EVENTS] Found ${e.length} pending events to sync...`);
	let t = (await g()).db("LabasAppDB").collection("eventos"), n = [];
	for (let r of e) try {
		let [e, n, i] = r.date.split("-").map(Number), o = new Date(i, n - 1, e), s = {
			_id: new a(r.id),
			title: r.title,
			description: r.description,
			date: r.date,
			fecha_inicio: o,
			audience: "device",
			target_device: r.target_device,
			target_devices: [r.target_device],
			location: r.location,
			all_day: !0,
			created_by: r.target_device,
			created_at: /* @__PURE__ */ new Date()
		};
		await t.insertOne(s), console.log(`[EVENTS] Synced pending event: ${r.title}`);
	} catch (e) {
		e.code === 11e3 ? console.log(`[EVENTS] Event ${r.title} already exists in DB. Discarding from queue.`) : (console.warn(`[EVENTS] Failed to sync event ${r.title}, will retry next time:`, e.message || e), n.push(r));
	}
	await h(n);
}
async function v(e, t, n) {
	await _().catch((e) => {
		console.warn("[EVENTS] Failed to sync pending events:", e.message || e);
	});
	let r = [], i = [], a = !1;
	try {
		let e = (await g()).db("LabasAppDB"), o = e.collection("eventos"), s = await e.collection("devices").findOne({ device_id: t }) || {}, c = String(s.event_visibility_scope || "all").trim().toLowerCase(), l = [], u = s.event_regions || [];
		typeof u == "string" ? l = u.split(/\r?\n/).map((e) => e.trim().toLowerCase()).filter(Boolean) : Array.isArray(u) && (l = u.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
		let d = process.env.COBIEN_DEVICE_LOCATION || s.location || n.settings?.device_location || "Bilbao", f = {
			hidden: { $ne: !0 },
			$or: [{ $or: [
				{ audience: "all" },
				{ audience: { $exists: !1 } },
				{ audience: null }
			] }, {
				audience: "device",
				$or: [{ target_device: t }, { target_devices: t }]
			}]
		};
		r = await o.find(f).toArray();
		let p = d.trim().toLowerCase();
		i = r.map((e) => {
			let t = e.audience || "all";
			t = typeof t == "string" && t.toLowerCase() === "device" ? "device" : "public";
			let n = t === "device" ? "#FF3B30" : "#1E90FF";
			e.color && (n = e.color);
			let r = (e.location || "").trim();
			if (t === "public" && r) {
				let e = r.toLowerCase(), t = !1;
				if (t = e === p ? !0 : c === "region" ? (l.length > 0 ? l : p ? [p] : []).includes(e) : !0, !t) return null;
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
				location: r || d,
				venue: e.venue || "",
				audience: t,
				color: n,
				target_device: e.target_device || "",
				created_by: e.created_by || "",
				all_day: e.all_day === !0 || e.all_day !== !1 && e.all_day !== "false" && !e.start_time,
				start_time: e.start_time || "",
				end_time: e.end_time || ""
			};
		}).filter((e) => e !== null), a = !0;
	} catch (e) {
		console.warn("[EVENTS] MongoDB background fetch failed. Trying REST API fallback:", e.message || e), s = null;
		try {
			let e = (process.env.COBIEN_BACKEND_BASE_URL || n.services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""), r = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || n.services?.notify_api_key || "", o = process.env.COBIEN_DEVICE_LOCATION || n.settings?.device_location || "Bilbao", s = `${e}/pizarra/api/events/?device_id=${t}&location=${encodeURIComponent(o)}`, c = await fetch(s, {
				method: "GET",
				headers: { "X-API-KEY": r },
				signal: AbortSignal.timeout(5e3)
			});
			if (c.ok) {
				let e = await c.json();
				e.ok && Array.isArray(e.events) && (i = e.events.map((e) => {
					let t = e.audience || "all";
					return t = typeof t == "string" && t.toLowerCase() === "device" ? "device" : "public", {
						id: e.id || "",
						date: e.date || "",
						title: e.title || "Sin título",
						description: e.description || "",
						location: e.location || o,
						venue: e.venue || "",
						audience: t,
						color: t === "device" ? "#FF3B30" : "#1E90FF",
						target_device: e.target_device || "",
						created_by: e.created_by || "",
						all_day: e.all_day === !0 || e.all_day !== !1 && e.all_day !== "false" && !e.start_time,
						start_time: e.start_time || "",
						end_time: e.end_time || ""
					};
				}), a = !0);
			}
		} catch (e) {
			console.warn("[EVENTS] Background REST API fallback also failed:", e.message || e);
		}
	}
	if (a) {
		await p(i), console.log(`[EVENTS] Background fetch and cache update complete. Found ${i.length} events.`), c = Date.now();
		let { BrowserWindow: e } = await import("electron");
		e.getAllWindows().forEach((e) => {
			e.webContents.send("events:changed");
		});
	}
}
async function y(e) {
	let t = {}, n = "CoBien6";
	try {
		t = JSON.parse(await r.readFile(e, "utf-8")), n = process.env.COBIEN_DEVICE_ID || t.settings?.device_id || "CoBien6";
	} catch (e) {
		console.error("[EVENTS] Error loading settings config:", e);
	}
	let i = await f(), a = Date.now();
	return a - c > l ? (c = a, setTimeout(() => {
		v(e, n, t).catch(console.error);
	}, 10)) : console.log("[EVENTS] Skipping background fetch (rate-limited)"), i;
}
async function b(e) {
	let t = new a(), n = {
		id: t.toString(),
		title: e.title,
		description: e.description,
		date: e.date,
		audience: "device",
		target_device: e.deviceId,
		target_devices: [e.deviceId],
		location: e.location,
		all_day: !0,
		created_by: e.deviceId,
		created_at: /* @__PURE__ */ new Date()
	};
	try {
		let r = (await g()).db("LabasAppDB").collection("eventos"), [i, a, o] = e.date.split("-").map(Number), s = new Date(o, a - 1, i);
		if (isNaN(s.getTime())) return console.error("[EVENTS] Invalid date provided:", e.date), !1;
		let c = {
			_id: t,
			title: e.title,
			description: e.description,
			date: e.date,
			fecha_inicio: s,
			audience: "device",
			target_device: e.deviceId,
			target_devices: [e.deviceId],
			location: e.location,
			all_day: !0,
			created_by: e.deviceId,
			created_at: /* @__PURE__ */ new Date()
		};
		await r.insertOne(c), console.log(`[EVENTS] Personal event added to DB: ${e.title}`);
		let l = await f();
		return l.push(n), await p(l), !0;
	} catch (t) {
		console.warn("[EVENTS] MongoDB offline/failed, queuing personal event for sync:", t.message || t), s = null;
		try {
			let t = await m();
			t.push(n), await h(t);
			let r = await f();
			return r.push(n), await p(r), console.log(`[EVENTS] Offline event saved locally: ${e.title}`), !0;
		} catch (e) {
			return console.error("[EVENTS] Failed to save offline event locally:", e), !1;
		}
	}
}
async function x(e) {
	let t = !1;
	try {
		let n = (await g()).db("LabasAppDB").collection("eventos"), r = a.isValid(e.id) ? new a(e.id) : e.id, i = await n.updateOne({ _id: r }, { $set: {
			title: e.title,
			description: e.description,
			location: e.location
		} });
		console.log(`[EVENTS] Personal event update query completed. Matched: ${i.matchedCount}, Modified: ${i.modifiedCount}`), t = i.matchedCount > 0;
	} catch (e) {
		console.warn("[EVENTS] MongoDB update query failed, falling back to local edit:", e.message || e), s = null;
	}
	let n = !1;
	try {
		let t = await f(), r = t.findIndex((t) => t.id === e.id);
		r !== -1 && (t[r].title = e.title, t[r].description = e.description, t[r].location = e.location, await p(t), n = !0);
	} catch (e) {
		console.error("[EVENTS] Failed to update local cache:", e);
	}
	let r = !1;
	try {
		let t = await m(), n = t.findIndex((t) => t.id === e.id);
		n !== -1 && (t[n].title = e.title, t[n].description = e.description, t[n].location = e.location, await h(t), r = !0, console.log(`[EVENTS] Offline pending event updated locally: ${e.title}`));
	} catch (e) {
		console.error("[EVENTS] Failed to update pending queue:", e);
	}
	return t || n || r;
}
async function S(e) {
	try {
		let t = await (await g()).db("LabasAppDB").collection("eventos").deleteOne({ _id: new a(e) });
		try {
			await p((await f()).filter((t) => t.id !== e));
		} catch (e) {
			console.error("[EVENTS] Failed to remove from local cache:", e);
		}
		return t.deletedCount > 0;
	} catch (e) {
		return console.error("[EVENTS] Error deleting event:", e), s = null, !1;
	}
}
//#endregion
export { x as a, y as i, S as n, o as r, b as t };
