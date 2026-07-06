import { t as e } from "./rolldown-runtime-CAFD8bLK.js";
import { app as t } from "electron";
import { dirname as n, join as r } from "node:path";
import { fileURLToPath as i } from "node:url";
import * as a from "node:fs";
import { promises as o } from "node:fs";
//#region electron/services/contactsService.ts
var s = /* @__PURE__ */ e({
	loadContacts: () => p,
	requestCall: () => v,
	syncContacts: () => h
}), c = typeof __dirname < "u" ? __dirname : n(i(import.meta.url)), l = r(t.getPath("userData"), "contacts"), u = r(l, "list_contacts.txt");
r(c, "../public/images/default_user.png");
function d(e) {
	return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function f(e) {
	let t = d(e);
	for (let e of [
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
		let n = r(l, t + e);
		if (a.existsSync(n)) return n;
	}
	return "";
}
async function p() {
	let e = [];
	try {
		let t = await o.readFile(u, "utf-8");
		for (let n of t.split("\n")) {
			if (!n.includes("=")) continue;
			let [t, r] = n.split("=", 2).map((e) => e.trim());
			if (!t) continue;
			let i = /^[A-Za-z0-9_. -]+$/.test(r ?? ""), a = f(t);
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
async function m(e, t, n) {
	try {
		let i = await fetch(e, {
			headers: { "X-Api-Key": n },
			signal: AbortSignal.timeout(5e3)
		});
		if (!i.ok) return null;
		let a = i.headers.get("Content-Type") || "", s = ".jpg";
		a.includes("png") ? s = ".png" : a.includes("webp") ? s = ".webp" : a.includes("gif") && (s = ".gif");
		let c = t + s, u = r(l, c), d = await i.arrayBuffer();
		return await o.writeFile(u, Buffer.from(d)), c;
	} catch (t) {
		return console.error(`[CONTACTS] Failed to download image ${e}:`, t), null;
	}
}
async function h(e, t, n) {
	try {
		a.existsSync(l) || a.mkdirSync(l, { recursive: !0 });
		let r = `${g(n, "/")}/pizarra/api/contacts/?device_id=${e}`, i = await fetch(r, {
			headers: { "X-Api-Key": t },
			signal: AbortSignal.timeout(5e3)
		});
		if (!i.ok) throw Error(`API returned ${i.status}`);
		let s = await i.json(), c = Array.isArray(s) ? s : s.contacts || [], f = [], p = 0;
		for (let e of c) {
			let r = (e.display_name || e.name || "").trim(), i = (e.user_name || e.username || "").trim(), a = (e.image_url || e.image || "").trim();
			if (!(!r || !i) && (f.push({
				display: r,
				user: i
			}), a)) {
				let e = a;
				a.startsWith("/") && (e = g(n, "/") + "/" + _(a, "/")), await m(e, d(r), t) && p++;
			}
		}
		let h = f.map((e) => `${e.display}=${e.user}`).join("\n") + "\n";
		return await o.writeFile(u, h), console.log(`[CONTACTS] Sync complete. ${f.length} contacts, ${p} images.`), {
			count: f.length,
			images: p
		};
	} catch (e) {
		return console.error("[CONTACTS] Sync failed:", e), {
			count: 0,
			images: 0
		};
	}
}
function g(e, t) {
	let n = e;
	for (; n.endsWith(t);) n = n.slice(0, -t.length);
	return n;
}
function _(e, t) {
	let n = e;
	for (; n.startsWith(t);) n = n.slice(t.length);
	return n;
}
async function v(e, t, n, r) {
	if (!e || !/^[A-Za-z0-9_. -]+$/.test(e)) return {
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
		let i = `${g(r, "/")}/pizarra/api/notify/`, a = await fetch(i, {
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
			signal: AbortSignal.timeout(5e3)
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
export { h as i, p as n, v as r, s as t };
