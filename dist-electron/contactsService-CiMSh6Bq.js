import { t as __exportAll } from "./rolldown-runtime-CiIaOW0V.js";
import { app } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fsSync from "node:fs";
import { promises } from "node:fs";
//#region electron/services/contactsService.ts
var contactsService_exports = /* @__PURE__ */ __exportAll({
	loadContacts: () => loadContacts,
	requestCall: () => requestCall,
	syncContacts: () => syncContacts
});
var _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var CONTACTS_DIR = join(app.getPath("userData"), "contacts");
var CONTACTS_FILE = join(CONTACTS_DIR, "list_contacts.txt");
join(_dirname, "../public/images/default_user.png");
function normalizeName(name) {
	return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findContactImage(displayName) {
	const base = normalizeName(displayName);
	for (const ext of [
		".png",
		".jpg",
		".jpeg",
		".webp",
		".gif",
		".PNG",
		".JPG",
		".JPEG",
		".WEBP",
		".GIF"
	]) {
		const p = join(CONTACTS_DIR, base + ext);
		if (fsSync.existsSync(p)) return p;
	}
	return "";
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
			signal: AbortSignal.timeout(5e3)
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
			signal: AbortSignal.timeout(5e3)
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
			signal: AbortSignal.timeout(5e3)
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
export { syncContacts as i, loadContacts as n, requestCall as r, contactsService_exports as t };
