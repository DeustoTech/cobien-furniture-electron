import { t as __exportAll } from "./rolldown-runtime-CiIaOW0V.js";
import { app } from "electron";
import { join } from "node:path";
import { promises } from "node:fs";
import { MongoClient, ObjectId } from "mongodb";
//#region electron/services/eventsMongo.ts
var eventsMongo_exports = /* @__PURE__ */ __exportAll({
	addPersonalEvent: () => addPersonalEvent,
	deleteEvent: () => deleteEvent,
	getEvents: () => getEvents,
	updatePersonalEvent: () => updatePersonalEvent
});
var cachedClient = null;
var lastFetchTime = 0;
var FETCH_COOLDOWN_MS = 15e3;
var getCachePath = () => join(app.getPath("userData"), "events.local.json");
var getPendingPath = () => join(app.getPath("userData"), "events.pending.json");
async function readLocalCache() {
	try {
		const cachedData = await promises.readFile(getCachePath(), "utf-8");
		const cachedList = JSON.parse(cachedData);
		const normalizedPending = (await readPendingEvents()).map((event) => {
			let audience = event.audience || "all";
			if (typeof audience === "string" && audience.toLowerCase() === "device") audience = "device";
			else audience = "public";
			return {
				id: event.id || event._id?.toString() || String(Math.random()),
				date: event.date || "",
				title: event.title || event.titulo || "Sin título",
				description: event.description || event.descripcion || "Sin descripción",
				location: event.location || "",
				venue: event.venue || "",
				audience,
				color: audience === "device" ? "#FF3B30" : "#1E90FF",
				target_device: event.target_device || "",
				created_by: event.created_by || "",
				all_day: event.all_day === true || event.all_day !== false && event.all_day !== "false" && !event.start_time,
				start_time: event.start_time || "",
				end_time: event.end_time || "",
				pending_sync: true
			};
		});
		const merged = [...cachedList];
		for (const p of normalizedPending) if (!merged.some((e) => e.id === p.id)) merged.push(p);
		return merged;
	} catch (e) {
		return await readPendingEvents();
	}
}
async function writeLocalCache(events) {
	try {
		await promises.writeFile(getCachePath(), JSON.stringify(events, null, 2));
	} catch (e) {
		console.error("[EVENTS] Error writing local cache:", e);
	}
}
async function readPendingEvents() {
	try {
		const data = await promises.readFile(getPendingPath(), "utf-8");
		return JSON.parse(data);
	} catch (e) {
		return [];
	}
}
async function writePendingEvents(events) {
	try {
		await promises.writeFile(getPendingPath(), JSON.stringify(events, null, 2));
	} catch (e) {
		console.error("[EVENTS] Error writing pending events:", e);
	}
}
async function getClient() {
	if (cachedClient) return cachedClient;
	const uri = process.env.MONGO_URI || "";
	if (!uri) throw new Error("MONGO_URI is missing");
	const client = new MongoClient(uri, {
		serverSelectionTimeoutMS: 5e3,
		connectTimeoutMS: 5e3
	});
	try {
		await client.connect();
		cachedClient = client;
		return cachedClient;
	} catch (err) {
		cachedClient = null;
		throw err;
	}
}
async function syncPendingEvents() {
	const pending = await readPendingEvents();
	if (pending.length === 0) return;
	console.log(`[EVENTS] Found ${pending.length} pending events to sync...`);
	const collection = (await getClient()).db("LabasAppDB").collection("eventos");
	const remaining = [];
	for (const event of pending) try {
		const [day, month, year] = event.date.split("-").map(Number);
		const dateObj = new Date(year, month - 1, day);
		const doc = {
			_id: new ObjectId(event.id),
			title: event.title,
			description: event.description,
			date: event.date,
			fecha_inicio: dateObj,
			audience: "device",
			target_device: event.target_device,
			target_devices: [event.target_device],
			location: event.location,
			all_day: true,
			created_by: event.target_device,
			created_at: /* @__PURE__ */ new Date()
		};
		await collection.insertOne(doc);
		console.log(`[EVENTS] Synced pending event: ${event.title}`);
	} catch (e) {
		if (e.code === 11e3) console.log(`[EVENTS] Event ${event.title} already exists in DB. Discarding from queue.`);
		else {
			console.warn(`[EVENTS] Failed to sync event ${event.title}, will retry next time:`, e.message || e);
			remaining.push(event);
		}
	}
	await writePendingEvents(remaining);
}
async function fetchAndUpdateEvents(configPath, deviceId, defaultData) {
	await syncPendingEvents().catch((err) => {
		console.warn("[EVENTS] Failed to sync pending events:", err.message || err);
	});
	let rawEvents = [];
	let fetchedEvents = [];
	let success = false;
	try {
		const db = (await getClient()).db("LabasAppDB");
		const collection = db.collection("eventos");
		const deviceDoc = await db.collection("devices").findOne({ device_id: deviceId }) || {};
		const visibilityScope = String(deviceDoc.event_visibility_scope || "all").trim().toLowerCase();
		let eventRegions = [];
		const rawRegions = deviceDoc.event_regions || [];
		if (typeof rawRegions === "string") eventRegions = rawRegions.split(/\r?\n/).map((r) => r.trim().toLowerCase()).filter(Boolean);
		else if (Array.isArray(rawRegions)) eventRegions = rawRegions.map((r) => String(r).trim().toLowerCase()).filter(Boolean);
		const locationName = process.env.COBIEN_DEVICE_LOCATION || deviceDoc.location || defaultData.settings?.device_location || "Bilbao";
		const query = { $or: [{ $or: [
			{ audience: "all" },
			{ audience: { $exists: false } },
			{ audience: null }
		] }, {
			audience: "device",
			$or: [{ target_device: deviceId }, { target_devices: deviceId }]
		}] };
		rawEvents = await collection.find(query).toArray();
		const normalizedLocation = locationName.trim().toLowerCase();
		fetchedEvents = rawEvents.map((event) => {
			let audience = event.audience || "all";
			if (typeof audience === "string" && audience.toLowerCase() === "device") audience = "device";
			else audience = "public";
			let color = audience === "device" ? "#FF3B30" : "#1E90FF";
			if (event.color) color = event.color;
			let loc = (event.location || "").trim();
			if (audience === "public" && loc) {
				const locLower = loc.toLowerCase();
				let visible = false;
				if (locLower === normalizedLocation) visible = true;
				else if (visibilityScope === "region") visible = (eventRegions.length > 0 ? eventRegions : normalizedLocation ? [normalizedLocation] : []).includes(locLower);
				else visible = true;
				if (!visible) return null;
			}
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
				venue: event.venue || "",
				audience,
				color,
				target_device: event.target_device || "",
				created_by: event.created_by || "",
				all_day: event.all_day === true || event.all_day !== false && event.all_day !== "false" && !event.start_time,
				start_time: event.start_time || "",
				end_time: event.end_time || ""
			};
		}).filter((e) => e !== null);
		success = true;
	} catch (e) {
		console.warn("[EVENTS] MongoDB background fetch failed. Trying REST API fallback:", e.message || e);
		cachedClient = null;
		try {
			const baseUrl = (process.env.COBIEN_BACKEND_BASE_URL || defaultData.services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
			const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || defaultData.services?.notify_api_key || "";
			const locationName = process.env.COBIEN_DEVICE_LOCATION || defaultData.settings?.device_location || "Bilbao";
			const url = `${baseUrl}/pizarra/api/events/?device_id=${deviceId}&location=${encodeURIComponent(locationName)}`;
			const res = await fetch(url, {
				method: "GET",
				headers: { "X-API-KEY": apiKey },
				signal: AbortSignal.timeout(5e3)
			});
			if (res.ok) {
				const data = await res.json();
				if (data.ok && Array.isArray(data.events)) {
					fetchedEvents = data.events.map((evt) => {
						let audience = evt.audience || "all";
						if (typeof audience === "string" && audience.toLowerCase() === "device") audience = "device";
						else audience = "public";
						return {
							id: evt.id || "",
							date: evt.date || "",
							title: evt.title || "Sin título",
							description: evt.description || "",
							location: evt.location || locationName,
							venue: evt.venue || "",
							audience,
							color: audience === "device" ? "#FF3B30" : "#1E90FF",
							target_device: evt.target_device || "",
							created_by: evt.created_by || "",
							all_day: evt.all_day === true || evt.all_day !== false && evt.all_day !== "false" && !evt.start_time,
							start_time: evt.start_time || "",
							end_time: evt.end_time || ""
						};
					});
					success = true;
				}
			}
		} catch (restError) {
			console.warn("[EVENTS] Background REST API fallback also failed:", restError.message || restError);
		}
	}
	if (success) {
		await writeLocalCache(fetchedEvents);
		console.log(`[EVENTS] Background fetch and cache update complete. Found ${fetchedEvents.length} events.`);
		lastFetchTime = Date.now();
		const { BrowserWindow } = await import("electron");
		BrowserWindow.getAllWindows().forEach((win) => {
			win.webContents.send("events:changed");
		});
	}
}
async function getEvents(configPath) {
	let defaultData = {};
	let deviceId = "CoBien6";
	try {
		defaultData = JSON.parse(await promises.readFile(configPath, "utf-8"));
		deviceId = process.env.COBIEN_DEVICE_ID || defaultData.settings?.device_id || "CoBien6";
	} catch (e) {
		console.error("[EVENTS] Error loading settings config:", e);
	}
	const cachedEvents = await readLocalCache();
	const now = Date.now();
	if (now - lastFetchTime > FETCH_COOLDOWN_MS) {
		lastFetchTime = now;
		setTimeout(() => {
			fetchAndUpdateEvents(configPath, deviceId, defaultData).catch(console.error);
		}, 10);
	} else console.log("[EVENTS] Skipping background fetch (rate-limited)");
	return cachedEvents;
}
async function addPersonalEvent(payload) {
	const newEventId = new ObjectId();
	const doc = {
		id: newEventId.toString(),
		title: payload.title,
		description: payload.description,
		date: payload.date,
		audience: "device",
		target_device: payload.deviceId,
		target_devices: [payload.deviceId],
		location: payload.location,
		all_day: true,
		created_by: payload.deviceId,
		created_at: /* @__PURE__ */ new Date()
	};
	try {
		const collection = (await getClient()).db("LabasAppDB").collection("eventos");
		const [day, month, year] = payload.date.split("-").map(Number);
		const dateObj = new Date(year, month - 1, day);
		if (isNaN(dateObj.getTime())) {
			console.error("[EVENTS] Invalid date provided:", payload.date);
			return false;
		}
		const mongoDoc = {
			_id: newEventId,
			title: payload.title,
			description: payload.description,
			date: payload.date,
			fecha_inicio: dateObj,
			audience: "device",
			target_device: payload.deviceId,
			target_devices: [payload.deviceId],
			location: payload.location,
			all_day: true,
			created_by: payload.deviceId,
			created_at: /* @__PURE__ */ new Date()
		};
		await collection.insertOne(mongoDoc);
		console.log(`[EVENTS] Personal event added to DB: ${payload.title}`);
		const cache = await readLocalCache();
		cache.push(doc);
		await writeLocalCache(cache);
		return true;
	} catch (e) {
		console.warn("[EVENTS] MongoDB offline/failed, queuing personal event for sync:", e.message || e);
		cachedClient = null;
		try {
			const pending = await readPendingEvents();
			pending.push(doc);
			await writePendingEvents(pending);
			const cache = await readLocalCache();
			cache.push(doc);
			await writeLocalCache(cache);
			console.log(`[EVENTS] Offline event saved locally: ${payload.title}`);
			return true;
		} catch (localError) {
			console.error("[EVENTS] Failed to save offline event locally:", localError);
			return false;
		}
	}
}
async function updatePersonalEvent(payload) {
	let matchedInDb = false;
	try {
		const collection = (await getClient()).db("LabasAppDB").collection("eventos");
		const queryId = ObjectId.isValid(payload.id) ? new ObjectId(payload.id) : payload.id;
		const result = await collection.updateOne({ _id: queryId }, { $set: {
			title: payload.title,
			description: payload.description,
			location: payload.location
		} });
		console.log(`[EVENTS] Personal event update query completed. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
		matchedInDb = result.matchedCount > 0;
	} catch (e) {
		console.warn("[EVENTS] MongoDB update query failed, falling back to local edit:", e.message || e);
		cachedClient = null;
	}
	let updatedLocal = false;
	try {
		const cache = await readLocalCache();
		const idx = cache.findIndex((e) => e.id === payload.id);
		if (idx !== -1) {
			cache[idx].title = payload.title;
			cache[idx].description = payload.description;
			cache[idx].location = payload.location;
			await writeLocalCache(cache);
			updatedLocal = true;
		}
	} catch (err) {
		console.error("[EVENTS] Failed to update local cache:", err);
	}
	let updatedPending = false;
	try {
		const pending = await readPendingEvents();
		const pIdx = pending.findIndex((e) => e.id === payload.id);
		if (pIdx !== -1) {
			pending[pIdx].title = payload.title;
			pending[pIdx].description = payload.description;
			pending[pIdx].location = payload.location;
			await writePendingEvents(pending);
			updatedPending = true;
			console.log(`[EVENTS] Offline pending event updated locally: ${payload.title}`);
		}
	} catch (err) {
		console.error("[EVENTS] Failed to update pending queue:", err);
	}
	return matchedInDb || updatedLocal || updatedPending;
}
async function deleteEvent(id) {
	try {
		const result = await (await getClient()).db("LabasAppDB").collection("eventos").deleteOne({ _id: new ObjectId(id) });
		try {
			await writeLocalCache((await readLocalCache()).filter((e) => e.id !== id));
		} catch (err) {
			console.error("[EVENTS] Failed to remove from local cache:", err);
		}
		return result.deletedCount > 0;
	} catch (e) {
		console.error("[EVENTS] Error deleting event:", e);
		cachedClient = null;
		return false;
	}
}
//#endregion
export { updatePersonalEvent as a, getEvents as i, deleteEvent as n, eventsMongo_exports as r, addPersonalEvent as t };
