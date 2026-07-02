import { a as updatePersonalEvent, i as getEvents, n as deleteEvent, t as addPersonalEvent } from "./eventsMongo-sybqAXGV.js";
import { i as syncContacts, n as loadContacts, r as requestCall } from "./contactsService-CiMSh6Bq.js";
import dotenv from "dotenv";
import { BrowserWindow, app, ipcMain, net, protocol, session } from "electron";
import { exec, execFile, execSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import { promises } from "node:fs";
import * as os from "node:os";
import * as dns from "node:dns";
import * as net$1 from "node:net";
import mqtt from "mqtt";
import { promisify } from "node:util";
//#region electron/services/icsoService.ts
var logDir$1 = join(app.getPath("userData"), "logs");
var LOG_TXT = join(logDir$1, "icso_log.txt");
var LOG_JSON = join(logDir$1, "icso_log.json");
var LOG_PROXIMITY_TXT = join(logDir$1, "icso_proximity_sensors.txt");
var SYNC_STATE_PATH$1 = join(app.getPath("userData"), "icso_sync_state.json");
var DEFAULT_STATE = {
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
};
var EVENT_MOTION_START = 24250;
var EVENT_APPROACH = 53591;
var EVENT_MOTION_END = 58795;
var SENSOR_MAP = {
	1141: "north",
	1140: "south",
	1142: "east",
	1143: "west"
};
var LABEL_MAP = {
	"north": "NORTH",
	"south": "SOUTH",
	"east": "EAST",
	"west": "WEST"
};
var syncTimer$1 = null;
function ensureLogsDir$1() {
	if (!fs.existsSync(logDir$1)) fs.mkdirSync(logDir$1, { recursive: true });
}
function loadState() {
	ensureLogsDir$1();
	if (!fs.existsSync(LOG_JSON)) return JSON.parse(JSON.stringify(DEFAULT_STATE));
	try {
		const raw = fs.readFileSync(LOG_JSON, "utf-8");
		const parsed = JSON.parse(raw);
		return {
			page_views: {
				...DEFAULT_STATE.page_views,
				...parsed.page_views
			},
			navigation_inputs: {
				...DEFAULT_STATE.navigation_inputs,
				...parsed.navigation_inputs
			},
			imu: {
				...DEFAULT_STATE.imu,
				...parsed.imu
			},
			video_calls: {
				...DEFAULT_STATE.video_calls,
				...parsed.video_calls
			},
			board: {
				...DEFAULT_STATE.board,
				...parsed.board
			},
			events: {
				...DEFAULT_STATE.events,
				...parsed.events
			},
			screen_wakeup: {
				...DEFAULT_STATE.screen_wakeup,
				...parsed.screen_wakeup
			},
			proximity: {
				north: {
					...DEFAULT_STATE.proximity.north,
					...parsed.proximity?.north
				},
				south: {
					...DEFAULT_STATE.proximity.south,
					...parsed.proximity?.south
				},
				east: {
					...DEFAULT_STATE.proximity.east,
					...parsed.proximity?.east
				},
				west: {
					...DEFAULT_STATE.proximity.west,
					...parsed.proximity?.west
				}
			}
		};
	} catch (e) {
		console.error("[ICSO] Failed to load JSON state, falling back to defaults:", e);
		return JSON.parse(JSON.stringify(DEFAULT_STATE));
	}
}
function saveState(state) {
	ensureLogsDir$1();
	try {
		fs.writeFileSync(LOG_JSON, JSON.stringify(state, null, 4), "utf-8");
	} catch (e) {
		console.error("[ICSO] Failed to save JSON state:", e);
	}
}
function getFormattedTime() {
	const d = /* @__PURE__ */ new Date();
	const pad = (n) => n.toString().padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function ensureLogSizeLimit(filePath, maxSizeBytes = 5 * 1024 * 1024) {
	try {
		if (!fs.existsSync(filePath)) return;
		if (fs.statSync(filePath).size > maxSizeBytes) {
			const backupPath = filePath + ".1";
			if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
			fs.renameSync(filePath, backupPath);
		}
	} catch (e) {
		console.error(`[ICSO] Log rotation failed for ${filePath}:`, e);
	}
}
function writeTxtLog(source, target, recognized) {
	ensureLogsDir$1();
	const now = getFormattedTime();
	const labelMap = {
		touchscreen: "TOUCHSCREEN",
		home_button: "HOME BUTTON",
		vocal_assistant: "VOCAL ASSISTANT",
		rfid_cards: "RFID CARD",
		imu: "IMU",
		videocall: "VIDEO CALL",
		notification: "NOTIFICATION",
		wakeup: "SCREEN WAKEUP",
		proximity: "PROXIMITY"
	};
	const sourceStr = source.trim() || "SYSTEM";
	const label = labelMap[sourceStr] || sourceStr.toUpperCase();
	let line = "";
	if (target === void 0 && !labelMap[sourceStr]) {
		line = `[${now}] ${sourceStr}`;
		ensureLogSizeLimit(LOG_TXT);
		fs.appendFileSync(LOG_TXT, line + "\n", "utf-8");
		return;
	}
	let finalTarget = target || "";
	if (sourceStr === "rfid_cards" && finalTarget === "videocall") finalTarget = "videocall request";
	if (sourceStr === "vocal_assistant" && (!finalTarget || finalTarget === "assistant_triggered")) line = `[${now}] ACTIVATION VOCAL ASSISTANT`;
	else if (sourceStr === "vocal_assistant" && finalTarget) {
		const recog = (recognized || "").trim();
		line = recog ? `[${now}] VOCAL ASSISTANT → ${finalTarget} (recognized: ${recog})` : `[${now}] VOCAL ASSISTANT → ${finalTarget}`;
	} else if (sourceStr === "proximity" && finalTarget) line = `[${now}] PROXIMITY → ${finalTarget}`;
	else if (finalTarget) line = `[${now}] VIA ${label} → ${finalTarget}`;
	else line = `[${now}] ${label}`;
	const logPath = sourceStr === "proximity" ? LOG_PROXIMITY_TXT : LOG_TXT;
	ensureLogSizeLimit(logPath);
	fs.appendFileSync(logPath, line + "\n", "utf-8");
}
function logNavigation(target, source) {
	const state = loadState();
	const targetClean = target.replace(/^\//, "").replace(/-/g, "_");
	const pageViews = state.page_views;
	if (pageViews[targetClean] !== void 0) pageViews[targetClean]++;
	else if (target === "" || target === "/") {}
	const navInputs = state.navigation_inputs;
	if (navInputs[source] !== void 0) navInputs[source]++;
	saveState(state);
	writeTxtLog(source, targetClean || "home");
}
function logImuEvent(eventType) {
	const state = loadState();
	const finalEvent = eventType || (state.imu.state === "idle" ? "movement_start" : "movement_stop");
	state.imu.state = finalEvent === "movement_start" ? "moving" : "idle";
	if (finalEvent === "movement_stop") state.imu.movements++;
	saveState(state);
	writeTxtLog("imu", finalEvent === "movement_start" ? "moving" : "idle");
}
function logProximityEvent(canId, eventCode) {
	if (SENSOR_MAP[canId] === void 0) return;
	const position = SENSOR_MAP[canId];
	const state = loadState();
	let changed = false;
	let logLabel = null;
	if (eventCode === EVENT_MOTION_START) {
		state.proximity[position].motion_detected++;
		changed = true;
		logLabel = "MOTION";
	} else if (eventCode === EVENT_APPROACH) {
		state.proximity[position].approach_detected++;
		changed = true;
		logLabel = "APPROACH";
	} else if (eventCode === EVENT_MOTION_END) logLabel = "MOTION_END";
	if (changed) saveState(state);
	if (logLabel !== null) writeTxtLog("proximity", `${logLabel} ${LABEL_MAP[position]}`);
}
function logScreenWakeup() {
	const state = loadState();
	state.screen_wakeup.wakeups++;
	saveState(state);
	writeTxtLog("wakeup");
}
async function readNewLines(filePath, prevOffset) {
	try {
		if (!fs.existsSync(filePath)) return {
			lines: [],
			offset: 0
		};
		const stat = await promises.stat(filePath);
		let offset = prevOffset >= 0 && prevOffset <= stat.size ? prevOffset : 0;
		const fd = await promises.open(filePath, "r");
		const buffer = Buffer.alloc(stat.size - offset);
		await fd.read(buffer, 0, stat.size - offset, offset);
		await fd.close();
		return {
			lines: buffer.toString("utf-8").split("\n").map((l) => l.trim()).filter((l) => l.length > 0),
			offset: stat.size
		};
	} catch (e) {
		console.error("[ICSO] Failed to read lines from", filePath, e);
		return {
			lines: [],
			offset: prevOffset
		};
	}
}
function parseTimestampFromLine(line) {
	if (!line.startsWith("[")) return "";
	const closing = line.indexOf("]");
	if (closing <= 1) return "";
	const raw = line.substring(1, closing).trim();
	try {
		const parts = raw.split(" ");
		const dateParts = parts[0].split("-");
		const timeParts = parts[1].split(":");
		return new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2])).toISOString();
	} catch (e) {
		return "";
	}
}
async function syncIcsoToBackend(configPath, localConfigPath, forceSnapshot = false) {
	let services = {};
	let settings = {};
	try {
		const defaultData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(fs.readFileSync(localConfigPath, "utf-8"));
		} catch (e) {}
		services = {
			...defaultData.services,
			...localData.services
		};
		settings = {
			...defaultData.settings,
			...localData.settings
		};
	} catch (e) {
		console.error("[ICSO] Sync configuration read failed:", e);
		return;
	}
	const backendBase = (services.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
	const telemetryUrl = (services.icso_telemetry_url || `${backendBase}/pizarra/api/icso/telemetry/`).trim();
	const eventsUrl = (services.icso_events_url || `${backendBase}/pizarra/api/icso/events/`).trim();
	const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || "CoBien6";
	if (!deviceId) return;
	if (!telemetryUrl || !eventsUrl) return;
	const headers = { "Content-Type": "application/json" };
	if (apiKey) headers["X-API-KEY"] = apiKey;
	let syncState = {
		txt_offset: 0,
		proximity_offset: 0,
		last_snapshot_sync_at: "",
		last_events_sync_at: "",
		last_error: ""
	};
	if (fs.existsSync(SYNC_STATE_PATH$1)) try {
		syncState = {
			...syncState,
			...JSON.parse(fs.readFileSync(SYNC_STATE_PATH$1, "utf-8"))
		};
	} catch (e) {}
	const now = (/* @__PURE__ */ new Date()).toISOString();
	if (forceSnapshot || fs.existsSync(LOG_JSON)) try {
		const payload = {
			device_id: deviceId,
			captured_at: now,
			snapshot: loadState()
		};
		const res = await fetch(telemetryUrl, {
			method: "POST",
			headers,
			body: JSON.stringify(payload)
		});
		if (!res.ok) throw new Error(`Telemetry sync HTTP ${res.status}`);
		syncState.last_snapshot_sync_at = now;
	} catch (err) {
		console.error("[ICSO] Telemetry snapshot sync failed:", err.message || err);
		syncState.last_error = `Telemetry: ${err.message || err}`;
		fs.writeFileSync(SYNC_STATE_PATH$1, JSON.stringify(syncState, null, 4), "utf-8");
		return;
	}
	const { lines: txtLines, offset: txtOffset } = await readNewLines(LOG_TXT, syncState.txt_offset);
	const { lines: proximityLines, offset: proximityOffset } = await readNewLines(LOG_PROXIMITY_TXT, syncState.proximity_offset);
	const events = [];
	txtLines.forEach((line) => {
		events.push({
			device_id: deviceId,
			source: "icso_log",
			logged_at: parseTimestampFromLine(line) || now,
			message: line
		});
	});
	proximityLines.forEach((line) => {
		events.push({
			device_id: deviceId,
			source: "icso_proximity",
			logged_at: parseTimestampFromLine(line) || now,
			message: line
		});
	});
	if (events.length > 0) try {
		const res = await fetch(eventsUrl, {
			method: "POST",
			headers,
			body: JSON.stringify({
				device_id: deviceId,
				sent_at: now,
				events
			})
		});
		if (!res.ok) throw new Error(`Events sync HTTP ${res.status}`);
		syncState.txt_offset = txtOffset;
		syncState.proximity_offset = proximityOffset;
		syncState.last_events_sync_at = now;
		syncState.last_error = "";
	} catch (err) {
		console.error("[ICSO] Events sync failed:", err.message || err);
		syncState.last_error = `Events: ${err.message || err}`;
	}
	fs.writeFileSync(SYNC_STATE_PATH$1, JSON.stringify(syncState, null, 4), "utf-8");
}
function startIcsoSyncLoop(configPath, localConfigPath) {
	if (syncTimer$1) clearInterval(syncTimer$1);
	syncIcsoToBackend(configPath, localConfigPath, true);
	syncTimer$1 = setInterval(() => {
		syncIcsoToBackend(configPath, localConfigPath, false);
	}, 300 * 1e3);
}
function stopIcsoSyncLoop() {
	if (syncTimer$1) {
		clearInterval(syncTimer$1);
		syncTimer$1 = null;
	}
}
//#endregion
//#region electron/services/backendSync.ts
var currentScreen = "home";
var lastNetworkSpeedKbps = null;
var heartbeatIntervalId = null;
var pollIntervalId = null;
/** Called from main.ts after a speed measurement so heartbeat picks it up. */
function setNetworkSpeed(kbps) {
	lastNetworkSpeedKbps = kbps;
}
/** Fire a heartbeat immediately (e.g. after updating speed). */
async function triggerHeartbeat(configPath, localConfigPath) {
	return sendHeartbeat(configPath, localConfigPath);
}
async function startBackendSync(mainWindow, configPath, localConfigPath) {
	ipcMain.handle("app:route-changed", (event, routeName) => {
		currentScreen = routeName;
		try {
			logNavigation(routeName, "touchscreen");
		} catch (e) {
			console.error("[SYNC] Failed to log navigation:", e);
		}
	});
	let heartbeatIntervalSec = parseInt(process.env.COBIEN_DEVICE_HEARTBEAT_INTERVAL_SEC || "300", 10);
	if (isNaN(heartbeatIntervalSec) || heartbeatIntervalSec < 120) heartbeatIntervalSec = 300;
	console.log(`[SYNC] Heartbeat interval set to ${heartbeatIntervalSec}s`);
	heartbeatIntervalId = setInterval(() => sendHeartbeat(configPath, localConfigPath), heartbeatIntervalSec * 1e3);
	let pollIntervalSec = parseInt(process.env.COBIEN_DEVICE_POLL_INTERVAL_SEC || "10", 10);
	if (isNaN(pollIntervalSec) || pollIntervalSec < 5) pollIntervalSec = 10;
	console.log(`[SYNC] Notification polling interval set to ${pollIntervalSec}s`);
	pollIntervalId = setInterval(() => pollNotifications(mainWindow, configPath, localConfigPath), pollIntervalSec * 1e3);
	sendHeartbeat(configPath, localConfigPath);
	pollNotifications(mainWindow, configPath, localConfigPath);
}
function stopBackendSync() {
	if (heartbeatIntervalId) {
		clearInterval(heartbeatIntervalId);
		heartbeatIntervalId = null;
	}
	if (pollIntervalId) {
		clearInterval(pollIntervalId);
		pollIntervalId = null;
	}
	console.log("[SYNC] Backend sync stopped.");
}
async function getConfig(configPath, localConfigPath) {
	try {
		const defaultData = JSON.parse(await promises.readFile(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(await promises.readFile(localConfigPath, "utf-8"));
		} catch (e) {}
		return {
			services: {
				...defaultData.services,
				...localData.services
			},
			settings: {
				...defaultData.settings,
				...localData.settings
			}
		};
	} catch (e) {
		return {
			services: {},
			settings: {}
		};
	}
}
function isProcessRunning(pattern, exact) {
	return new Promise((resolve) => {
		exec(exact ? `pgrep -x "${pattern}"` : `pgrep -f "${pattern}"`, (error) => {
			resolve(!error);
		});
	});
}
function checkTcpPort(port, host, timeoutMs) {
	return new Promise((resolve) => {
		const socket = new net$1.Socket();
		let resolved = false;
		socket.setTimeout(timeoutMs);
		socket.once("connect", () => {
			if (!resolved) {
				resolved = true;
				socket.destroy();
				resolve(true);
			}
		});
		socket.once("timeout", () => {
			if (!resolved) {
				resolved = true;
				socket.destroy();
				resolve(false);
			}
		});
		socket.once("error", () => {
			if (!resolved) {
				resolved = true;
				socket.destroy();
				resolve(false);
			}
		});
		socket.connect(port, host);
	});
}
async function readSysFile(path) {
	try {
		return (await promises.readFile(path, "utf-8")).trim();
	} catch (e) {
		return "";
	}
}
async function checkMosquitto() {
	try {
		if (!await isProcessRunning("mosquitto", true)) return "error";
		return await checkTcpPort(1883, "localhost", 2e3) ? "ok" : "warn";
	} catch (e) {
		return "unknown";
	}
}
async function checkBridge() {
	try {
		if (!await isProcessRunning("cobien_bridge", false)) return "error";
		return await checkTcpPort(1883, "localhost", 2e3) ? "ok" : "warn";
	} catch (e) {
		return "unknown";
	}
}
function checkCan(canStatus) {
	if (!canStatus || canStatus.operstate !== "up") return "error";
	return canStatus.rx_packets + canStatus.tx_packets > 0 ? "ok" : "warn";
}
async function sendHeartbeat(configPath, localConfigPath) {
	const { services, settings } = await getConfig(configPath, localConfigPath);
	const url = services.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/";
	const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || "CoBien6";
	let canStatus = null;
	try {
		const operstate = await readSysFile("/sys/class/net/can0/operstate");
		if (operstate) {
			const carrier = await readSysFile("/sys/class/net/can0/carrier");
			const rxPackets = parseInt(await readSysFile("/sys/class/net/can0/statistics/rx_packets") || "0", 10);
			const txPackets = parseInt(await readSysFile("/sys/class/net/can0/statistics/tx_packets") || "0", 10);
			const rxErrors = parseInt(await readSysFile("/sys/class/net/can0/statistics/rx_errors") || "0", 10);
			const txErrors = parseInt(await readSysFile("/sys/class/net/can0/statistics/tx_errors") || "0", 10);
			canStatus = {
				present: true,
				operstate,
				carrier,
				rx_packets: isNaN(rxPackets) ? 0 : rxPackets,
				tx_packets: isNaN(txPackets) ? 0 : txPackets,
				rx_errors: isNaN(rxErrors) ? 0 : rxErrors,
				tx_errors: isNaN(txErrors) ? 0 : txErrors
			};
		}
	} catch (e) {}
	const mosquittoStatus = await checkMosquitto();
	const bridgeStatus = await checkBridge();
	const canInterfaceStatus = checkCan(canStatus);
	let rustdeskId = "";
	try {
		rustdeskId = await new Promise((resolve) => {
			exec("rustdesk --get-id", (error, stdout) => {
				if (error) resolve("");
				else resolve(stdout.trim());
			});
		});
	} catch (e) {}
	const payload = {
		device_id: deviceId,
		screen: currentScreen,
		sent_at: (/* @__PURE__ */ new Date()).toISOString(),
		software_version: `Electron-v${app.getVersion()}`,
		rustdesk_id: rustdeskId,
		...lastNetworkSpeedKbps !== null ? { network_speed_kbps: lastNetworkSpeedKbps } : {},
		services_status: {
			app: "ok",
			mosquitto: mosquittoStatus,
			mqtt_can_bridge: bridgeStatus,
			can_interface: canInterfaceStatus,
			checked_at: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
	if (canStatus) payload.can_status = canStatus;
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": apiKey
			},
			body: JSON.stringify(payload)
		});
		if (!res.ok) console.warn(`[HEARTBEAT] Failed with status: ${res.status}`);
		else console.log(`[HEARTBEAT] Sent (Screen: ${currentScreen})`);
	} catch (e) {
		console.error(`[HEARTBEAT] Network error`);
	}
}
async function pollNotifications(mainWindow, configPath, localConfigPath) {
	const { services, settings } = await getConfig(configPath, localConfigPath);
	const url = services.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/";
	const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || "CoBien6";
	try {
		const res = await fetch(`${url}?device_id=${deviceId}`, {
			method: "GET",
			headers: { "X-API-KEY": apiKey }
		});
		if (res.ok) {
			const notifications = (await res.json()).notifications || [];
			if (notifications.length > 0) {
				console.log(`[POLL] Received ${notifications.length} notifications`);
				let reloadEvents = false;
				notifications.forEach((notif) => {
					if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("backend:notification", notif);
					const type = (notif.type || "").toLowerCase();
					if (type === "new_event" || type === "events_reload") reloadEvents = true;
					if (type === "force_update") {
						console.log("[POLL] Force update notification received. Triggering manual update...");
						const runtimeStateDir = process.env.COBIEN_RUNTIME_STATE_DIR || join(os.homedir(), ".local/state/cobien/runtime");
						const flagPath = join(runtimeStateDir, "manual_update_reload.flag");
						promises.mkdir(runtimeStateDir, { recursive: true }).then(() => promises.writeFile(flagPath, JSON.stringify({ requested_at: (/* @__PURE__ */ new Date()).toISOString() }))).then(() => {
							console.log(`[POLL] Created manual update reload flag at: ${flagPath}`);
							exec("systemctl --user start cobien-update.service", (error, stdout, stderr) => {
								if (error) console.error("[POLL] Failed to start update service:", error);
								else console.log("[POLL] Update service started successfully:", stdout);
							});
						}).catch((err) => {
							console.error("[POLL] Failed to prepare manual update reload flag:", err);
						});
					} else if (type === "restart") {
						console.log("[POLL] Restart notification received. Rebooting device...");
						exec("systemctl reboot -i || echo cobien | sudo -S systemctl reboot -i || echo cobien | sudo -S reboot -f || reboot", (error, stdout, stderr) => {
							if (error) console.error("[POLL] Failed to reboot device:", error);
							else console.log("[POLL] Reboot command executed successfully:", stdout);
						});
					} else if (type === "contacts_updated") {
						console.log("[POLL] Contacts updated notification received. Syncing contacts...");
						const baseUrl = (services.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
						import("./contactsService-CiMSh6Bq.js").then((n) => n.t).then(({ syncContacts }) => {
							syncContacts(deviceId, apiKey, baseUrl).then(() => {
								if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("contacts:updated");
							}).catch((err) => console.error("[POLL] Failed to sync contacts on notification:", err));
						}).catch((err) => console.error("[POLL] Failed to dynamically import contactsService:", err));
					}
				});
				if (reloadEvents) {
					console.log("[POLL] Event notification received. Refreshing local events cache...");
					import("./eventsMongo-sybqAXGV.js").then((n) => n.r).then(({ getEvents }) => {
						getEvents(configPath).catch((err) => console.error("[POLL] Failed to background-refresh events:", err));
					}).catch((err) => console.error("[POLL] Failed to dynamically import eventsMongo:", err));
				}
			}
		}
	} catch (e) {}
}
//#endregion
//#region electron/services/boardService.ts
var CACHE_DIR_NAME = "board_cache";
async function getCacheDir() {
	const dir = join(app.getPath("userData"), CACHE_DIR_NAME);
	try {
		await promises.access(dir);
	} catch {
		await promises.mkdir(dir, { recursive: true });
	}
	return dir;
}
async function downloadAndCacheImage(url, prefix, id) {
	if (!url) return "";
	if (url.startsWith("/")) url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}${url}`;
	try {
		const dir = await getCacheDir();
		let ext = ".png";
		if (url.includes(".jpg") || url.includes(".jpeg")) ext = ".jpg";
		const targetPath = join(dir, `${prefix}_${id}${ext}`);
		try {
			await promises.access(targetPath);
			return `cobien-media://${targetPath}`;
		} catch {}
		const headers = {};
		if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(15e3)
		});
		if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
		if (res.body) {
			const arrayBuffer = await res.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			await promises.writeFile(targetPath, buffer);
			return `cobien-media://${targetPath}`;
		}
		return "";
	} catch (e) {
		console.error(`[BOARD] Failed to cache image ${url}:`, e);
		return "";
	}
}
async function fetchMessages() {
	const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/?recipient=${deviceId}`;
	const headers = {};
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(4e3)
		});
		if (!res.ok) throw new Error(`API returned ${res.statusText}`);
		const messages = (await res.json()).messages || [];
		return await Promise.all(messages.map(async (msg) => {
			let imagePath = "";
			let avatarPath = "";
			if (msg.image || msg.image_url) imagePath = await downloadAndCacheImage(msg.image || msg.image_url, "img", msg.id);
			if (msg.author_avatar_url) avatarPath = await downloadAndCacheImage(msg.author_avatar_url, "avatar", msg.id);
			return {
				id: msg.id,
				author: msg.author_name || msg.author || "—",
				author_avatar: avatarPath,
				text: msg.text || "",
				image: imagePath,
				created_at_human: msg.created_at_human || "",
				read_by: (msg.read_by || []).map((r) => r.device_id),
				quick_replies: msg.quick_replies || [],
				quick_reply_selected: msg.quick_reply_selected || null
			};
		}));
	} catch (e) {
		console.error("[BOARD] Failed to fetch messages:", e);
		return [];
	}
}
async function deleteMessage(id) {
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${id}/delete/`;
	const headers = {};
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		return (await fetch(url, {
			method: "POST",
			headers,
			signal: AbortSignal.timeout(4e3)
		})).ok;
	} catch (e) {
		console.error("[BOARD] Failed to delete message:", e);
		return false;
	}
}
async function markMessageRead(id) {
	const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${id}/read/`;
	const headers = { "Content-Type": "application/json" };
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		return (await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({ device_id: deviceId }),
			signal: AbortSignal.timeout(4e3)
		})).ok;
	} catch (e) {
		console.error("[BOARD] Failed to mark message read:", e);
		return false;
	}
}
async function submitQuickReply(id, replyText) {
	const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
	const url = `${process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu"}/pizarra/api/messages/${id}/reply/`;
	const headers = { "Content-Type": "application/json" };
	if (process.env.COBIEN_NOTIFY_API_KEY) headers["X-API-KEY"] = process.env.COBIEN_NOTIFY_API_KEY;
	try {
		return (await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({
				device_id: deviceId,
				reply_text: replyText
			}),
			signal: AbortSignal.timeout(4e3)
		})).ok;
	} catch (e) {
		console.error("[BOARD] Failed to submit reply:", e);
		return false;
	}
}
//#endregion
//#region electron/services/weatherService.ts
var WMO_ICON_MAP = {
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
};
var WMO_DESC = {
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
function wmoIcon(code, isDay = true) {
	if (!isDay && code <= 1) return "/svg/noche.svg";
	return WMO_ICON_MAP[code] ?? "/svg/nubes.svg";
}
function wmoDesc(code, lang = "es") {
	return (WMO_DESC[lang] || WMO_DESC["es"])[code] ?? (lang === "en" ? "Unknown condition" : lang === "fr" ? "Condition inconnue" : "Condición desconocida");
}
function amPmLabel(isoHour) {
	const h = new Date(isoHour).getHours();
	const label = h < 12 ? "a.m." : "p.m.";
	return `${h % 12 || 12} ${label}`;
}
async function geocodeCity(cityName) {
	const owmKey = process.env.OWM_API_KEY ?? "";
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`;
		const res = await fetch(url, {
			headers: { "User-Agent": "CoBien6-Furniture" },
			signal: AbortSignal.timeout(4e3)
		});
		if (!res.ok) throw new Error(`Nominatim returned status ${res.status}`);
		const data = await res.json();
		if (!data.length) throw new Error("No Nominatim results");
		return {
			lat: parseFloat(data[0].lat),
			lon: parseFloat(data[0].lon),
			tz: "auto"
		};
	} catch (e) {
		console.warn("[WEATHER] Nominatim geocode failed, trying OWM fallback:", e);
		if (owmKey) try {
			const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${owmKey}`;
			const res = await fetch(url, { signal: AbortSignal.timeout(4e3) });
			if (!res.ok) throw new Error(`OWM Geo returned status ${res.status}`);
			const data = await res.json();
			if (data && data.length > 0) return {
				lat: data[0].lat,
				lon: data[0].lon,
				tz: "auto"
			};
		} catch (owmErr) {
			console.error("[WEATHER] OWM geocode fallback also failed:", owmErr);
		}
		return null;
	}
}
function owmIconToLocal(owmIcon) {
	const prefix = owmIcon.substring(0, 2);
	const isNight = owmIcon.endsWith("n");
	switch (prefix) {
		case "01": return isNight ? "/svg/noche.svg" : "/images/sol.png";
		case "02":
		case "03": return "/svg/parcial.svg";
		case "04": return "/svg/nubes.svg";
		case "09":
		case "10":
		case "11": return prefix === "11" ? "/images/tormenta.png" : "/images/lluvia.png";
		case "13": return "/svg/nieve.svg";
		case "50": return "/images/neblina.png";
		default: return "/svg/nubes.svg";
	}
}
async function fetchWeatherBundle(cityName, lang = "es") {
	const base = {
		city: cityName,
		temp: "—°",
		description: lang === "en" ? "Not available" : lang === "fr" ? "Non disponible" : "No disponible",
		icon: "/svg/nubes.svg",
		tempMin: lang === "en" ? "Min —°" : lang === "fr" ? "Min —°" : "Min —°",
		tempMax: lang === "en" ? "Max —°" : lang === "fr" ? "Max —°" : "Max —°",
		todayPop: 0,
		todayWind: 0,
		hourly: [],
		daily: []
	};
	const owmKey = process.env.OWM_API_KEY ?? "";
	try {
		const geo = await geocodeCity(cityName);
		if (!geo) {
			base.error = "Ciudad no encontrada";
			return base;
		}
		const { lat, lon, tz } = geo;
		try {
			const omUrl = [
				`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`,
				`&timezone=${encodeURIComponent(tz)}`,
				`&current=temperature_2m,weathercode,is_day`,
				`&hourly=temperature_2m,weathercode`,
				`&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,wind_speed_10m_max`,
				`&forecast_days=7`
			].join("");
			const omRes = await fetch(omUrl, { signal: AbortSignal.timeout(4e3) });
			if (!omRes.ok) throw new Error(`Open-Meteo returned status ${omRes.status}`);
			const om = await omRes.json();
			const currentCode = om.current?.weathercode ?? 0;
			const isDay = (om.current?.is_day ?? 1) === 1;
			base.temp = `${Math.round(om.current?.temperature_2m ?? 0)}°`;
			base.icon = wmoIcon(currentCode, isDay);
			if (owmKey) try {
				const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=${lang}`;
				base.description = (await (await fetch(owmUrl, { signal: AbortSignal.timeout(4e3) })).json()).weather?.[0]?.description ?? wmoDesc(currentCode, lang);
				base.description = base.description.charAt(0).toUpperCase() + base.description.slice(1);
			} catch {
				base.description = wmoDesc(currentCode, lang);
			}
			else base.description = wmoDesc(currentCode, lang);
			const todayMin = Math.round(om.daily?.temperature_2m_min?.[0] ?? 0);
			const todayMax = Math.round(om.daily?.temperature_2m_max?.[0] ?? 0);
			base.tempMin = `Min ${todayMin}°`;
			base.tempMax = `Max ${todayMax}°`;
			base.todayPop = om.daily?.precipitation_probability_max?.[0] ?? 0;
			base.todayWind = Math.round(om.daily?.wind_speed_10m_max?.[0] ?? 0);
			const nowHour = (/* @__PURE__ */ new Date()).getHours();
			const hourlyTimes = om.hourly?.time ?? [];
			const hourlyTemps = om.hourly?.temperature_2m ?? [];
			const hourlyCodes = om.hourly?.weathercode ?? [];
			const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			let startIdx = hourlyTimes.findIndex((t) => t.startsWith(todayStr) && new Date(t).getHours() >= nowHour);
			if (startIdx < 0) startIdx = 0;
			base.hourly = hourlyTimes.slice(startIdx, startIdx + 12).map((t, i) => {
				const h = new Date(t).getHours();
				return {
					time: amPmLabel(t),
					icon: wmoIcon(hourlyCodes[startIdx + i] ?? 0, h >= 6 && h < 20),
					temp: `${Math.round(hourlyTemps[startIdx + i] ?? 0)}°`
				};
			});
			const dailyTimes = om.daily?.time ?? [];
			const dailyMaxArr = om.daily?.temperature_2m_max ?? [];
			const dailyMinArr = om.daily?.temperature_2m_min ?? [];
			const dailyCodesArr = om.daily?.weathercode ?? [];
			const dailyPopArr = om.daily?.precipitation_probability_max ?? [];
			const dailyWindArr = om.daily?.wind_speed_10m_max ?? [];
			base.daily = dailyTimes.slice(1, 7).map((t, i) => {
				const d = new Date(t);
				const day = d.getDate();
				const localeStr = lang === "en" ? "en-US" : lang === "fr" ? "fr-FR" : "es-ES";
				const month = d.toLocaleDateString(localeStr, { month: "long" });
				const dayName = d.toLocaleDateString(localeStr, { weekday: "long" });
				return {
					name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
					date: lang === "en" ? `${month} ${day}` : `${day} de ${month}`,
					icon: wmoIcon(dailyCodesArr[i + 1] ?? 0),
					tmin: `${Math.round(dailyMinArr[i + 1] ?? 0)}°`,
					tmax: `${Math.round(dailyMaxArr[i + 1] ?? 0)}°`,
					pop: dailyPopArr[i + 1] ?? 0,
					wind: Math.round(dailyWindArr[i + 1] ?? 0)
				};
			});
		} catch (omError) {
			if (!owmKey) throw omError;
			console.warn("[WEATHER] Open-Meteo failed, executing OpenWeatherMap fallback:", omError.message || omError);
			const owmCurrentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=${lang}`;
			const owmForecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${owmKey}&units=metric&lang=${lang}`;
			const [currentRes, forecastRes] = await Promise.all([fetch(owmCurrentUrl, { signal: AbortSignal.timeout(4e3) }), fetch(owmForecastUrl, { signal: AbortSignal.timeout(4e3) })]);
			if (!currentRes.ok) throw new Error(`OWM current weather returned status ${currentRes.status}`);
			if (!forecastRes.ok) throw new Error(`OWM forecast returned status ${forecastRes.status}`);
			const owmCurrent = await currentRes.json();
			const owmForecast = await forecastRes.json();
			base.temp = `${Math.round(owmCurrent.main.temp)}°`;
			base.icon = owmIconToLocal(owmCurrent.weather[0].icon);
			base.description = owmCurrent.weather[0].description;
			base.description = base.description.charAt(0).toUpperCase() + base.description.slice(1);
			base.tempMin = `Min ${Math.round(owmCurrent.main.temp_min)}°`;
			base.tempMax = `Max ${Math.round(owmCurrent.main.temp_max)}°`;
			base.todayPop = 0;
			base.todayWind = Math.round(owmCurrent.wind.speed * 3.6);
			base.hourly = owmForecast.list.slice(0, 4).map((item) => {
				return {
					time: amPmLabel(item.dt_txt),
					icon: owmIconToLocal(item.weather[0].icon),
					temp: `${Math.round(item.main.temp)}°`
				};
			});
			const dailyGroups = {};
			const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			for (const item of owmForecast.list) {
				const dayStr = item.dt_txt.slice(0, 10);
				if (dayStr === todayStr) {
					if (base.todayPop === 0 && item.pop !== void 0) base.todayPop = Math.round(item.pop * 100);
					continue;
				}
				if (!dailyGroups[dayStr]) dailyGroups[dayStr] = [];
				dailyGroups[dayStr].push(item);
			}
			base.daily = Object.keys(dailyGroups).sort().slice(0, 6).map((dayStr) => {
				const items = dailyGroups[dayStr];
				let tmin = 999;
				let tmax = -999;
				let maxPop = 0;
				let maxWind = 0;
				let midItem = items[Math.floor(items.length / 2)];
				for (const it of items) {
					if (it.main.temp_min < tmin) tmin = it.main.temp_min;
					if (it.main.temp_max > tmax) tmax = it.main.temp_max;
					if (it.pop && it.pop > maxPop) maxPop = it.pop;
					if (it.wind && it.wind.speed > maxWind) maxWind = it.wind.speed;
					if (it.dt_txt.endsWith("12:00:00")) midItem = it;
				}
				const d = new Date(dayStr);
				const localeStr = lang === "en" ? "en-US" : lang === "fr" ? "fr-FR" : "es-ES";
				const dayName = d.toLocaleDateString(localeStr, { weekday: "long" });
				const month = d.toLocaleDateString(localeStr, { month: "long" });
				const dayNum = d.getDate();
				return {
					name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
					date: lang === "en" ? `${month} ${dayNum}` : `${dayNum} de ${month}`,
					icon: owmIconToLocal(midItem.weather[0].icon),
					tmin: `${Math.round(tmin)}°`,
					tmax: `${Math.round(tmax)}°`,
					pop: Math.round(maxPop * 100),
					wind: Math.round(maxWind * 3.6)
				};
			});
		}
		return base;
	} catch (e) {
		console.error("[WEATHER] fetchWeatherBundle error:", e);
		base.error = String(e);
		return base;
	}
}
//#endregion
//#region electron/services/jokesService.ts
/**
* jokesService.ts — Load and serve random jokes from legacy cobien_FrontEnd dataset
*/
var JOKES_DIR = join(typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url)), "../public/data/jokes");
var cachedJokes = {};
var lastJokes = {};
async function loadJokes(lang = "es") {
	try {
		const file = lang === "fr" ? "jokes_fr.json" : lang === "en" ? "jokes_en.json" : "jokes_es.json";
		const raw = await promises.readFile(join(JOKES_DIR, file), "utf-8");
		const data = JSON.parse(raw);
		const jokes = [];
		for (const catJokes of Object.values(data)) if (Array.isArray(catJokes)) {
			for (const joke of catJokes) if (typeof joke === "string" && joke.trim()) jokes.push(joke.trim());
			else if (typeof joke === "object" && joke !== null) {
				const j = joke;
				if (j.text) jokes.push(String(j.text).trim());
				else if (j.setup && j.punchline) jokes.push(`${j.setup.trim()} — ${j.punchline.trim()}`);
			}
		}
		return jokes.filter(Boolean);
	} catch (e) {
		console.error("[JOKES] Error loading jokes:", e);
		if (lang === "en") return [
			"Why don't scientists trust atoms? Because they make up everything!",
			"What do you call a fake noodle? An Impasta.",
			"Why did the scarecrow win an award? Because he was outstanding in his field."
		];
		return [
			"¿Qué le dice un jardinero a otro? Nos vemos cuando podamos.",
			"¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.",
			"¿Cuál es el colmo de un electricista? Que su mujer se llame Luz."
		];
	}
}
async function getRandomJoke(lang = "es") {
	const normLang = [
		"es",
		"en",
		"fr"
	].includes(lang) ? lang : "es";
	if (!cachedJokes[normLang] || cachedJokes[normLang].length === 0) cachedJokes[normLang] = await loadJokes(normLang);
	const jokes = cachedJokes[normLang];
	if (jokes.length === 0) return normLang === "en" ? "No jokes available." : normLang === "fr" ? "Aucune blague disponible." : "No hay chistes disponibles.";
	const lastJoke = lastJokes[normLang] || "";
	const available = jokes.length > 1 ? jokes.filter((j) => j !== lastJoke) : jokes;
	const joke = available[Math.floor(Math.random() * available.length)];
	lastJokes[normLang] = joke;
	return joke;
}
//#endregion
//#region electron/services/remindersService.ts
/**
* remindersService.ts — Persistent reminder scheduling
* Mirrors cobien_FrontEnd/app/reminders/reminders.py
*/
var _dataPath = null;
var timers = /* @__PURE__ */ new Map();
var notifyCallback = null;
function getDataPath() {
	if (!_dataPath) _dataPath = join(app.getPath("userData"), "reminders.json");
	return _dataPath;
}
async function readAll() {
	try {
		const raw = await promises.readFile(getDataPath(), "utf-8");
		return JSON.parse(raw);
	} catch {
		return [];
	}
}
async function writeAll(reminders) {
	await promises.writeFile(getDataPath(), JSON.stringify(reminders, null, 2), "utf-8");
}
function schedule(reminder) {
	const ms = new Date(reminder.datetime).getTime() - Date.now();
	if (ms <= 0) return;
	const t = setTimeout(async () => {
		timers.delete(reminder.id);
		notifyCallback?.(reminder);
		await writeAll((await readAll()).filter((r) => r.id !== reminder.id));
	}, ms);
	timers.set(reminder.id, t);
}
async function loadPendingReminders(onFire) {
	notifyCallback = onFire;
	const all = await readAll();
	const now = /* @__PURE__ */ new Date();
	const pending = [];
	for (const r of all) if (new Date(r.datetime) > now) {
		schedule(r);
		pending.push(r);
	}
	await writeAll(pending);
	console.log(`[REMINDERS] ${pending.length} reminders scheduled`);
}
async function addReminder(message, isoDatetime) {
	const reminder = {
		id: `rem_${Date.now()}`,
		message,
		datetime: isoDatetime
	};
	const all = await readAll();
	all.push(reminder);
	await writeAll(all);
	schedule(reminder);
	return reminder;
}
async function listReminders() {
	const all = await readAll();
	const now = /* @__PURE__ */ new Date();
	return all.filter((r) => new Date(r.datetime) > now);
}
async function deleteReminder(id) {
	const all = await readAll();
	const filtered = all.filter((r) => r.id !== id);
	if (filtered.length === all.length) return false;
	await writeAll(filtered);
	const t = timers.get(id);
	if (t) {
		clearTimeout(t);
		timers.delete(id);
	}
	return true;
}
//#endregion
//#region electron/services/mqttService.ts
/**
* mqttService.ts — MQTT sensor bridge for CoBien furniture
*
* Mirrors cobien_FrontEnd/app/mqtt_publisher.py logic:
*
* Topics subscribed (from hardware/broker):
*   rfid/read       → RFID card tap → navigate/videocall/weather
*   sensors/update  → Capacitive buttons (PIC id) → navigate to screen
*   app/nav         → Already processed nav commands (from legacy Python bridge)
*   events/reload   → Force events screen refresh
*   board/reload    → Force board screen refresh
*   weather/reload  → Force weather refresh
*
* All events are forwarded to the renderer via IPC: 'mqtt:event'
* Payload shape: { topic: string, type: string, target: string, extra?: any }
*/
var TOPIC_RFID = "rfid/read";
var TOPIC_SENSORS = "sensors/update";
var TOPIC_APP_NAV = "app/nav";
var TOPIC_EVENTS_RELOAD = "events/reload";
var TOPIC_BOARD_RELOAD = "board/reload";
var TOPIC_WEATHER_RELOAD = "weather/reload";
var TOPIC_PROXIMITY = "proximity/update";
var TOPIC_IMU = "imu/update";
var SUBSCRIBED_TOPICS = [
	TOPIC_RFID,
	TOPIC_SENSORS,
	TOPIC_APP_NAV,
	TOPIC_EVENTS_RELOAD,
	TOPIC_BOARD_RELOAD,
	TOPIC_WEATHER_RELOAD,
	"rfid/actions_reload",
	TOPIC_PROXIMITY,
	TOPIC_IMU
];
var BUTTON_ACTIONS = {
	1: {
		target: "main",
		source: "home_button"
	},
	2: {
		target: "voice_cmd",
		source: "vocal_assistant"
	}
};
var rfidActions = {};
var RFID_DEBOUNCE_MS = 5e3;
var lastRfidId = null;
var lastRfidAt = 0;
var isConfigModeActive = false;
var client = null;
var mainWindowRef = null;
function send(payload) {
	if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
	mainWindowRef.webContents.send("mqtt:event", payload);
}
function handleRfid(raw) {
	let cardId;
	try {
		cardId = raw?.data?.id !== void 0 ? parseInt(raw.data.id) : parseInt(raw.id ?? 0);
	} catch {
		cardId = 0;
	}
	if (!cardId) return;
	const now = Date.now();
	if (cardId === lastRfidId && now - lastRfidAt < RFID_DEBOUNCE_MS) {
		console.log(`[MQTT] RFID debounce ignored: ${cardId}`);
		return;
	}
	lastRfidId = cardId;
	lastRfidAt = now;
	console.log(`[MQTT] RFID card: ${cardId}`);
	if (isConfigModeActive) {
		send({
			topic: TOPIC_RFID,
			type: "rfid",
			cardId
		});
		return;
	}
	const action = rfidActions[cardId];
	if (action) send({
		topic: TOPIC_APP_NAV,
		type: "nav",
		source: "rfid",
		...action
	});
	else send({
		topic: TOPIC_RFID,
		type: "rfid",
		cardId
	});
}
function handleSensors(raw) {
	let picId;
	try {
		picId = raw?.data?.PIC !== void 0 ? parseInt(raw.data.PIC) : parseInt(raw.PIC ?? 0);
	} catch {
		picId = 0;
	}
	if (!picId) return;
	const action = BUTTON_ACTIONS[picId];
	if (action) {
		console.log(`[MQTT] Button PIC=${picId} → ${action.target}`);
		send({
			topic: TOPIC_SENSORS,
			type: "nav",
			target: action.target,
			source: action.source
		});
	} else console.warn(`[MQTT] Unknown button PIC: ${picId}`);
}
function handleAppNav(raw) {
	send({
		topic: TOPIC_APP_NAV,
		...raw
	});
}
async function loadRfidActions() {
	const { promises: fs } = await import("node:fs");
	const { join, dirname } = await import("node:path");
	const { app } = await import("electron");
	const configPath = join(app.getPath("userData"), "config.local.json");
	try {
		const mappings = JSON.parse(await fs.readFile(configPath, "utf-8")).settings?.rfid_actions || {};
		const newActions = {};
		for (const [idStr, payload] of Object.entries(mappings)) {
			const id = parseInt(idStr);
			if (isNaN(id)) continue;
			const p = payload;
			const action = p?.action || "day_events";
			const extra = p?.extra || "";
			if (action === "weather") newActions[id] = {
				target: "weather",
				extra: { name: extra }
			};
			else if (action === "videocall") newActions[id] = {
				target: "videocall",
				extra: { to_user: extra }
			};
			else newActions[id] = { target: "day_events" };
		}
		rfidActions = newActions;
		console.log(`[MQTT] Loaded ${Object.keys(rfidActions).length} RFID actions`);
	} catch (e) {
		console.error("[MQTT] Failed to load RFID config:", e);
	}
}
function handleProximity(raw) {
	let canId = 0;
	let eventCode = 0;
	try {
		canId = raw?.data?.can_id !== void 0 ? parseInt(raw.data.can_id) : parseInt(raw.can_id ?? 0);
		eventCode = raw?.data?.event !== void 0 ? parseInt(raw.data.event) : parseInt(raw.event ?? 0);
	} catch {}
	if (canId && eventCode) logProximityEvent(canId, eventCode);
}
function handleImu(raw) {
	logImuEvent();
}
function startMqtt(win) {
	mainWindowRef = win;
	loadRfidActions();
	const url = `mqtt://${process.env.COBIEN_MQTT_LOCAL_BROKER || "localhost"}:${parseInt(process.env.COBIEN_MQTT_LOCAL_PORT || "1883", 10)}`;
	console.log(`[MQTT] Connecting to ${url}`);
	client = mqtt.connect(url, {
		clientId: `cobien-electron-${Date.now()}`,
		connectTimeout: 5e3,
		reconnectPeriod: 1e4,
		clean: true
	});
	client.on("connect", () => {
		console.log("[MQTT] Connected");
		for (const topic of SUBSCRIBED_TOPICS) client.subscribe(topic, { qos: 0 }, (err) => {
			if (err) console.error(`[MQTT] Subscribe error on ${topic}:`, err);
			else console.log(`[MQTT] Subscribed: ${topic}`);
		});
		send({
			topic: "mqtt/status",
			type: "status",
			connected: true
		});
	});
	client.on("message", (topic, message) => {
		let payload = {};
		try {
			payload = JSON.parse(message.toString());
		} catch {
			payload = {};
		}
		switch (topic) {
			case TOPIC_RFID:
				handleRfid(payload);
				break;
			case TOPIC_SENSORS:
				handleSensors(payload);
				break;
			case TOPIC_APP_NAV:
				handleAppNav(payload);
				break;
			case TOPIC_EVENTS_RELOAD:
				send({
					topic,
					type: "reload",
					target: "events"
				});
				break;
			case TOPIC_BOARD_RELOAD:
				send({
					topic,
					type: "reload",
					target: "board"
				});
				break;
			case TOPIC_WEATHER_RELOAD:
				send({
					topic,
					type: "reload",
					target: "weather"
				});
				break;
			case TOPIC_PROXIMITY:
				handleProximity(payload);
				break;
			case TOPIC_IMU:
				handleImu(payload);
				break;
			case "rfid/actions_reload":
				loadRfidActions();
				break;
			default: console.log(`[MQTT] Unhandled topic: ${topic}`);
		}
	});
	client.on("error", (err) => {
		console.warn("[MQTT] Error:", err.message);
		send({
			topic: "mqtt/status",
			type: "status",
			connected: false,
			error: err.message
		});
	});
	client.on("offline", () => {
		console.warn("[MQTT] Offline — will retry");
		send({
			topic: "mqtt/status",
			type: "status",
			connected: false
		});
	});
	client.on("reconnect", () => {
		console.log("[MQTT] Reconnecting...");
	});
}
function stopMqtt() {
	if (client) {
		client.end(true);
		client = null;
		console.log("[MQTT] Disconnected");
	}
}
var SHAPES = {
	"all": 0,
	"square": 1,
	"diamond": 2,
	"plus": 3,
	"X": 4,
	"only_center": 5
};
var MODES = {
	"on": 0,
	"off": 1,
	"blink": 2,
	"fading_blink": 3
};
function encodeShapeMode(shape, mode) {
	const shapeCode = SHAPES[shape] ?? 0;
	const modeCode = MODES[mode] ?? 0;
	return shapeCode << 4 | modeCode;
}
function publishButtonConfig(buttonColors) {
	if (!client || !client.connected) {
		console.warn("[MQTT] Client not connected, cannot publish button config");
		return;
	}
	if (buttonColors.PIC1) {
		const pic1 = buttonColors.PIC1;
		const payload1 = {
			PIC: 1,
			shape_mode: encodeShapeMode(pic1.shape || "all", pic1.mode || "on"),
			color: pic1.color || "#ffffff",
			intensity: pic1.intensity !== void 0 ? parseInt(pic1.intensity, 10) : 255
		};
		client.publish("button/config", JSON.stringify(payload1));
		console.log("[MQTT] Published button config for PIC1:", payload1);
	}
	if (buttonColors.PIC2) {
		const pic2 = buttonColors.PIC2;
		const payload2 = {
			PIC: 2,
			shape_mode: encodeShapeMode(pic2.shape || "all", pic2.mode || "on"),
			color: pic2.color || "#ffffff",
			intensity: pic2.intensity !== void 0 ? parseInt(pic2.intensity, 10) : 255
		};
		client.publish("button/config", JSON.stringify(payload2));
		console.log("[MQTT] Published button config for PIC2:", payload2);
	}
}
var NOTIF_MODES = {
	"OFF": 1,
	"ON": 0,
	"BLINK": 2,
	"FADING_BLINK": 3
};
function publishNotificationLed(params) {
	if (!client || !client.connected) {
		console.warn("[MQTT] Client not connected, cannot publish notification LED");
		return;
	}
	const modeInt = NOTIF_MODES[(params.mode || "ON").toUpperCase()] ?? 0;
	const payload = {
		group: 7,
		color: params.color || "#FFFFFF",
		intensity: params.intensity !== void 0 ? parseInt(params.intensity, 10) : 255,
		mode: modeInt
	};
	client.publish("ledstrip/config", JSON.stringify(payload));
	console.log("[MQTT] Published notification LED config:", payload);
}
function turnOffNotificationLed() {
	if (!client || !client.connected) {
		console.warn("[MQTT] Client not connected, cannot turn off notification LED");
		return;
	}
	const payload = {
		group: 7,
		color: "#000000",
		intensity: 0,
		mode: 1
	};
	client.publish("ledstrip/config", JSON.stringify(payload));
	console.log("[MQTT] Published LED turn-off config:", payload);
}
function publishRfidInit(mode) {
	isConfigModeActive = mode === 1;
	if (!client || !client.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID init");
		return;
	}
	const payload = { mode };
	client.publish("rfid/init", JSON.stringify(payload));
	console.log("[MQTT] Published RFID init:", payload);
}
function publishRfidConfig(cardId, actionCode) {
	if (!client || !client.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID config");
		return;
	}
	const payload = {
		id: cardId,
		action: actionCode
	};
	client.publish("rfid/config", JSON.stringify(payload));
	console.log("[MQTT] Published RFID config:", payload);
}
function publishRfidReload() {
	if (!client || !client.connected) {
		console.warn("[MQTT] Client not connected, cannot publish RFID reload");
		return;
	}
	const payload = {
		action: "reload",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	};
	client.publish("rfid/actions_reload", JSON.stringify(payload));
	console.log("[MQTT] Published RFID actions reload:", payload);
	loadRfidActions();
}
//#endregion
//#region electron/services/hardwareService.ts
var execAsync = promisify(exec);
async function adjustVolume(value, isAbsolute = false) {
	try {
		if (isAbsolute) await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${value}%`);
		else await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${`${value >= 0 ? "+" : ""}${value}%`}`);
		return true;
	} catch (e) {
		console.error("Failed to adjust volume:", e);
		return false;
	}
}
async function getVolume() {
	try {
		const { stdout } = await execAsync("pactl get-sink-volume @DEFAULT_SINK@ | grep -Po '\\d+(?=%)' | head -n 1");
		return parseInt(stdout.trim()) || 0;
	} catch (e) {
		console.error("Failed to get volume:", e);
		return 50;
	}
}
async function adjustBrightness(value) {
	try {
		const { stdout } = await execAsync("xrandr --query | grep ' connected' | cut -d' ' -f1");
		const outputs = stdout.trim().split("\n");
		if (outputs.length === 0) return false;
		for (const output of outputs) {
			let next = .4;
			if (value !== void 0) next = value;
			else {
				const { stdout: verbose } = await execAsync(`xrandr --verbose --output ${output} | grep -i brightness`);
				const current = parseFloat(verbose.split(":")[1].trim());
				if (current < .6) next = .7;
				else if (current < .9) next = 1;
				else next = .4;
			}
			await execAsync(`xrandr --output ${output} --brightness ${next.toFixed(2)}`);
		}
		return true;
	} catch (e) {
		console.error("Failed to adjust brightness:", e);
		return false;
	}
}
//#endregion
//#region electron/services/logsSyncService.ts
var logDir = join(app.getPath("userData"), "logs");
var SYNC_STATE_PATH = join(app.getPath("userData"), "logs_sync_state.json");
var MAX_BYTES_PER_FILE = 120 * 1024;
var MAX_LINES_PER_FILE = 1500;
var LOG_SPECS = [
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
];
var syncTimer = null;
function ensureLogsDir() {
	if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
}
function loadSyncState() {
	if (!fs.existsSync(SYNC_STATE_PATH)) return {
		last_sync_at: "",
		last_error: "",
		files: {}
	};
	try {
		const raw = fs.readFileSync(SYNC_STATE_PATH, "utf-8");
		const parsed = JSON.parse(raw);
		return {
			last_sync_at: parsed.last_sync_at || "",
			last_error: parsed.last_error || "",
			files: parsed.files || {}
		};
	} catch (e) {
		return {
			last_sync_at: "",
			last_error: "",
			files: {}
		};
	}
}
function saveSyncState(state) {
	try {
		fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 4), "utf-8");
	} catch (e) {
		console.error("[SUPPORT LOGS] Failed to save sync state:", e);
	}
}
function getFingerprint(filePath) {
	try {
		const stat = fs.statSync(filePath);
		return `${Math.floor(stat.mtimeMs)}:${stat.size}`;
	} catch (e) {
		return "";
	}
}
function getTargetDates() {
	const today = /* @__PURE__ */ new Date();
	const yesterday = /* @__PURE__ */ new Date();
	yesterday.setDate(today.getDate() - 1);
	return [today, yesterday];
}
function formatDate(date) {
	const pad = (n) => n.toString().padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function formatDateFilenameSuffix(date) {
	const pad = (n) => n.toString().padStart(2, "0");
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}
async function tailContent(filePath) {
	try {
		const fileSize = (await promises.stat(filePath)).size;
		const start = Math.max(0, fileSize - MAX_BYTES_PER_FILE);
		const fd = await promises.open(filePath, "r");
		const buffer = Buffer.alloc(fileSize - start);
		await fd.read(buffer, 0, fileSize - start, start);
		await fd.close();
		let raw = buffer.toString("utf-8");
		if (start > 0) {
			const firstNewline = raw.indexOf("\n");
			if (firstNewline >= 0) raw = raw.substring(firstNewline + 1);
		}
		let lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
		const truncated = start > 0 || lines.length > MAX_LINES_PER_FILE;
		if (lines.length > MAX_LINES_PER_FILE) lines = lines.slice(-MAX_LINES_PER_FILE);
		return {
			content: lines.join("\n").trim(),
			line_count: lines.length,
			byte_count: fileSize,
			truncated
		};
	} catch (e) {
		return {
			content: "",
			line_count: 0,
			byte_count: 0,
			truncated: false
		};
	}
}
async function syncSupportLogs(configPath, localConfigPath, force = false) {
	ensureLogsDir();
	let services = {};
	let settings = {};
	try {
		const defaultData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(fs.readFileSync(localConfigPath, "utf-8"));
		} catch (e) {}
		services = {
			...defaultData.services,
			...localData.services
		};
		settings = {
			...defaultData.settings,
			...localData.settings
		};
	} catch (e) {
		console.error("[SUPPORT LOGS] Configuration read failed:", e);
		return;
	}
	const backendBase = (services.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
	const logsUrl = (services.device_logs_ingest_url || `${backendBase}/pizarra/api/device/logs/ingest/`).trim();
	const apiKey = process.env.COBIEN_NOTIFY_API_KEY || process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || "CoBien6";
	if (!deviceId) return;
	if (!logsUrl) return;
	const headers = { "Content-Type": "application/json" };
	if (apiKey) headers["X-API-KEY"] = apiKey;
	const state = loadSyncState();
	const previousFiles = state.files || {};
	const currentFiles = { ...previousFiles };
	const logsToSync = [];
	const nowStr = (/* @__PURE__ */ new Date()).toISOString();
	const dates = getTargetDates();
	for (const spec of LOG_SPECS) for (const [index, dateObj] of dates.entries()) {
		const dateStr = formatDate(dateObj);
		const fileKey = `${spec.log_type}:${dateStr}`;
		let targetFile = "";
		if (spec.log_type === "app") if (index === 0) targetFile = join(logDir, "app.log");
		else {
			const appLog1 = join(logDir, "app.log.1");
			if (fs.existsSync(appLog1)) targetFile = appLog1;
			else targetFile = join(logDir, `cobien-app-${formatDateFilenameSuffix(dateObj)}.log`);
		}
		else {
			const withSuffix = join(logDir, `${spec.prefix}-${formatDateFilenameSuffix(dateObj)}.log`);
			if (fs.existsSync(withSuffix)) targetFile = withSuffix;
			else if (index === 0) {
				const genericNames = spec.log_type === "can_bus" ? [
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
				for (const name of genericNames) {
					const p = join(logDir, name);
					if (fs.existsSync(p)) {
						targetFile = p;
						break;
					}
				}
			}
		}
		if (!targetFile || !fs.existsSync(targetFile)) {
			delete currentFiles[fileKey];
			continue;
		}
		const fp = getFingerprint(targetFile);
		if (!force && previousFiles[fileKey] === fp) continue;
		const tail = await tailContent(targetFile);
		if (tail.line_count > 0) {
			logsToSync.push({
				log_type: spec.log_type,
				log_date: dateStr,
				filename: basename(targetFile),
				content: tail.content,
				line_count: tail.line_count,
				byte_count: tail.byte_count,
				truncated: tail.truncated,
				sent_at: nowStr
			});
			currentFiles[fileKey] = fp;
		}
	}
	if (logsToSync.length === 0) return;
	try {
		const res = await fetch(logsUrl, {
			method: "POST",
			headers,
			body: JSON.stringify({
				device_id: deviceId,
				sent_at: nowStr,
				logs: logsToSync
			})
		});
		if (!res.ok) throw new Error(`Ingest HTTP status ${res.status}`);
		state.files = currentFiles;
		state.last_sync_at = nowStr;
		state.last_error = "";
		saveSyncState(state);
		console.log(`[SUPPORT LOGS] Successfully ingested ${logsToSync.length} support logs`);
	} catch (err) {
		console.error("[SUPPORT LOGS] Failed to sync support logs:", err.message || err);
		state.last_error = err.message || err;
		saveSyncState(state);
	}
}
function startLogsSyncLoop(configPath, localConfigPath) {
	if (syncTimer) clearInterval(syncTimer);
	syncSupportLogs(configPath, localConfigPath, true);
	syncTimer = setInterval(() => {
		syncSupportLogs(configPath, localConfigPath, false);
	}, 300 * 1e3);
}
function stopLogsSyncLoop() {
	if (syncTimer) {
		clearInterval(syncTimer);
		syncTimer = null;
	}
}
//#endregion
//#region electron/main.ts
dotenv.config();
var devUrlArg = process.argv.find((arg) => arg.startsWith("--vite-dev-url="));
if (devUrlArg) process.env.VITE_DEV_SERVER_URL = devUrlArg.split("=")[1];
protocol.registerSchemesAsPrivileged([{
	scheme: "cobien-media",
	privileges: {
		secure: true,
		standard: true,
		supportFetchAPI: true,
		bypassCSP: true,
		corsEnabled: true,
		stream: true
	}
}]);
var _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var mainWindow = null;
var activeMockSSID = "CoBien_WiFi_5G";
var lastManualConnectTime = 0;
var configPath = join(_dirname, "../config/config.default.json");
var _localConfigPath = "";
function getPiperConfig(lang = "es", gender = "male") {
	try {
		const configPath = join(_dirname, "../config/config.default.json");
		const localPath = join(app.getPath("userData"), "config.local.json");
		const defaultData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(fs.readFileSync(localPath, "utf-8"));
		} catch (e) {}
		const services = {
			...defaultData.services,
			...localData.services
		};
		const internalBin = join(_dirname, "../public/models/piper/bin/piper");
		const defaultModel = join(_dirname, "../public/models/piper/es_ES-davefx-medium.onnx");
		const bin = services.tts_piper_bin || internalBin;
		let modelName = services[`tts_piper_model_${lang}_${gender}`] || services[`tts_piper_model_${lang}`];
		let model = "";
		if (modelName) if (modelName.startsWith("/") || modelName.includes(":") || modelName.startsWith("http")) model = modelName;
		else {
			const elPath = join(_dirname, "../public/models/piper", modelName);
			if (fs.existsSync(elPath)) model = elPath;
			else model = elPath;
		}
		else if (lang === "fr") model = join(_dirname, "../public/models/piper/fr_FR-siwis-medium.onnx");
		else if (lang === "en") model = join(_dirname, "../public/models/piper/en_US-amy-medium.onnx");
		else model = defaultModel;
		return {
			bin,
			model
		};
	} catch (e) {
		console.error("Error reading piper config:", e);
		return {
			bin: join(_dirname, "../public/models/piper/bin/piper"),
			model: join(_dirname, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
var lastMeasuredSpeed = null;
/**
* Download ~500 KB from a stable CDN and return the speed in kbps.
* Uses Electron's net.request so it goes through the Chromium network stack
* (proxy settings, SSL, etc. are all handled automatically).
* Returns null on error or timeout.
*/
async function measureNetworkSpeed() {
	const TEST_URL = "https://speed.cloudflare.com/__down?bytes=512000";
	const TIMEOUT_MS = 8e3;
	return new Promise((resolve) => {
		let byteCount = 0;
		const startMs = Date.now();
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			const elapsedSec = (Date.now() - startMs) / 1e3;
			if (byteCount > 0 && elapsedSec > 0) resolve(Math.round(byteCount * 8 / elapsedSec / 1e3));
			else resolve(null);
		}, TIMEOUT_MS);
		try {
			const request = net.request(TEST_URL);
			request.on("response", (response) => {
				response.on("data", (chunk) => {
					byteCount += chunk.length;
				});
				response.on("end", () => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					const elapsedSec = (Date.now() - startMs) / 1e3;
					if (elapsedSec > 0) resolve(Math.round(byteCount * 8 / elapsedSec / 1e3));
					else resolve(null);
				});
				response.on("error", () => {
					if (!settled) {
						settled = true;
						clearTimeout(timer);
						resolve(null);
					}
				});
			});
			request.on("error", () => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(null);
				}
			});
			request.end();
		} catch {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				resolve(null);
			}
		}
	});
}
function setupIPC() {
	async function readMergedConfig() {
		let defaultData = {};
		try {
			defaultData = JSON.parse(await promises.readFile(configPath, "utf-8"));
		} catch (e) {
			console.error("Error reading default config:", e);
		}
		let localData = {};
		if (_localConfigPath) try {
			localData = JSON.parse(await promises.readFile(_localConfigPath, "utf-8"));
		} catch (e) {}
		return {
			...defaultData,
			...localData,
			settings: {
				...defaultData.settings || {},
				...localData.settings || {}
			},
			notifications: {
				...defaultData.notifications || {},
				...localData.notifications || {}
			},
			services: {
				...defaultData.services || {},
				...localData.services || {}
			}
		};
	}
	async function writeConfig(updater) {
		let defaultSuccess = false;
		try {
			const defaultData = JSON.parse(await promises.readFile(configPath, "utf-8"));
			updater(defaultData);
			await promises.writeFile(configPath, JSON.stringify(defaultData, null, 4));
			defaultSuccess = true;
		} catch (e) {}
		const targetPaths = [];
		if (_localConfigPath) targetPaths.push(_localConfigPath);
		if (process.platform === "linux") {
			const globalCobienDir = process.env.COBIEN_CONFIG_DIR || join(process.env.XDG_CONFIG_HOME || join(os.homedir(), ".config"), "cobien");
			targetPaths.push(join(globalCobienDir, "config.local.json"));
		}
		const uniquePaths = Array.from(new Set(targetPaths));
		let localSuccess = false;
		for (const targetPath of uniquePaths) try {
			await promises.mkdir(dirname(targetPath), { recursive: true });
			let localData = {};
			try {
				localData = JSON.parse(await promises.readFile(targetPath, "utf-8"));
			} catch (e) {}
			updater(localData);
			await promises.writeFile(targetPath, JSON.stringify(localData, null, 4));
			localSuccess = true;
		} catch (e) {
			console.error(`[CONFIG] Error writing config to ${targetPath}:`, e);
		}
		if (uniquePaths.length === 0) console.warn("[CONFIG] No local config paths determined, cannot persist settings locally");
		return defaultSuccess || localSuccess;
	}
	ipcMain.handle("network:is-online", async () => {
		const dnsCheck = (host) => {
			return new Promise((resolve) => {
				const timer = setTimeout(() => resolve(false), 3e3);
				dns.lookup(host, (err) => {
					clearTimeout(timer);
					resolve(!err);
				});
			});
		};
		if (await dnsCheck("google.com")) return true;
		return dnsCheck("one.one.one.one");
	});
	ipcMain.handle("config:getWeather", async () => {
		try {
			const data = await readMergedConfig();
			return {
				catalog: data.settings?.weather_city_catalog || [],
				active: data.settings?.weather_cities || [],
				primary: data.settings?.weather_primary_city || ""
			};
		} catch (e) {
			console.error("Error reading config:", e);
			return {
				catalog: [],
				active: [],
				primary: ""
			};
		}
	});
	ipcMain.handle("config:getSettings", async () => {
		try {
			return (await readMergedConfig()).settings || {};
		} catch (e) {
			return {};
		}
	});
	ipcMain.handle("config:saveEmotionPromptTime", async (event, time) => {
		try {
			return await writeConfig((data) => {
				if (!data.settings) data.settings = {};
				data.settings.emotionPromptTime = time;
			});
		} catch (e) {
			console.error("Error saving emotion prompt time:", e);
			return false;
		}
	});
	ipcMain.handle("config:submitEmotion", async (event, emotion) => {
		try {
			const deviceId = process.env.COBIEN_DEVICE_ID || "CoBienX";
			const baseUrl = process.env.COBIEN_BACKEND_BASE_URL || "https://portal.co-bien.eu";
			return (await fetch(`${baseUrl}/emociones/api/diario/`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					device_id: deviceId,
					emocion: emotion
				}),
				signal: AbortSignal.timeout(5e3)
			})).ok;
		} catch (e) {
			console.error("Error submitting emotion:", e);
			return false;
		}
	});
	ipcMain.handle("config:saveWeather", async (event, payload) => {
		try {
			return await writeConfig((data) => {
				if (!data.settings) data.settings = {};
				data.settings.weather_city_catalog = payload.catalog;
				data.settings.weather_cities = payload.active;
				data.settings.weather_primary_city = payload.primary;
			});
		} catch (e) {
			console.error("Error saving config:", e);
			return false;
		}
	});
	ipcMain.handle("config:saveButtonColors", async (event, payload) => {
		try {
			const success = await writeConfig((data) => {
				if (!data.settings) data.settings = {};
				data.settings.button_colors = payload;
			});
			publishButtonConfig(payload);
			return success;
		} catch (e) {
			console.error("Error saving button colors:", e);
			return false;
		}
	});
	ipcMain.handle("config:getNotifications", async () => {
		try {
			return (await readMergedConfig()).notifications || {};
		} catch (e) {
			return {};
		}
	});
	ipcMain.handle("config:saveNotifications", async (event, payload) => {
		try {
			return await writeConfig((data) => {
				data.notifications = payload;
			});
		} catch (e) {
			console.error("Error saving notifications config:", e);
			return false;
		}
	});
	ipcMain.handle("config:getRfidActions", async () => {
		try {
			return (await readMergedConfig()).settings?.rfid_actions || {};
		} catch (e) {
			console.error("Error reading RFID actions:", e);
			return {};
		}
	});
	ipcMain.handle("config:initRfidConfigMode", async () => {
		publishRfidInit(1);
		return true;
	});
	ipcMain.handle("config:cancelRfidConfigMode", async () => {
		publishRfidInit(0);
		return true;
	});
	ipcMain.handle("config:saveRfidAction", async (event, cardId, action, extra = "") => {
		try {
			const success = await writeConfig((data) => {
				if (!data.settings) data.settings = {};
				if (!data.settings.rfid_actions) data.settings.rfid_actions = {};
				data.settings.rfid_actions[String(cardId)] = {
					action,
					extra
				};
			});
			publishRfidConfig(cardId, {
				day_events: 2,
				weather: 3,
				videocall: 5
			}[action] ?? 2);
			publishRfidReload();
			await loadRfidActions();
			return success;
		} catch (e) {
			console.error("Error saving RFID action:", e);
			return false;
		}
	});
	ipcMain.handle("config:deleteRfidAction", async (event, cardId) => {
		try {
			const success = await writeConfig((data) => {
				if (data.settings?.rfid_actions) delete data.settings.rfid_actions[String(cardId)];
			});
			publishRfidReload();
			await loadRfidActions();
			return success;
		} catch (e) {
			console.error("Error deleting RFID action:", e);
			return false;
		}
	});
	ipcMain.handle("config:getRingtones", async () => {
		try {
			const devPath = join(app.getAppPath(), "public", "audio", "ringtones");
			const prodPath = join(app.getAppPath(), "dist", "audio", "ringtones");
			let ringtonesDir = devPath;
			try {
				await promises.access(prodPath);
				ringtonesDir = prodPath;
			} catch {}
			const files = await promises.readdir(ringtonesDir);
			const supported = [
				".mp3",
				".wav",
				".ogg",
				".flac",
				".m4a",
				".aac"
			];
			return files.filter((f) => supported.some((ext) => f.toLowerCase().endsWith(ext)));
		} catch (e) {
			console.error("Error reading ringtones:", e);
			return [];
		}
	});
	ipcMain.handle("config:triggerNotificationLed", async (event, type) => {
		try {
			const notif = (await readMergedConfig()).notifications?.[type];
			if (notif) {
				publishNotificationLed(notif);
				return true;
			}
			return false;
		} catch (e) {
			console.error("Error triggering notification LED:", e);
			return false;
		}
	});
	ipcMain.handle("config:turnOffNotificationLed", async () => {
		try {
			turnOffNotificationLed();
			return true;
		} catch (e) {
			console.error("Error turning off notification LED:", e);
			return false;
		}
	});
	ipcMain.handle("config:simulateNotification", async (event, type) => {
		try {
			let notif = {};
			if (type === "videollamada") notif = {
				type: "videocall",
				from: "Test Caller",
				room: "test-room"
			};
			else if (type === "nuevo_evento") notif = {
				type: "new_event",
				title: "Reunión de prueba",
				date: "2026-06-25"
			};
			else if (type === "nueva_foto") notif = {
				type: "new_message",
				from: "Test Sender"
			};
			else return false;
			if (mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.webContents.send("backend:notification", notif);
				return true;
			}
			return false;
		} catch (e) {
			console.error("Error simulating notification:", e);
			return false;
		}
	});
	const parseNmcliOutput = (stdout) => {
		const lines = stdout.split("\n");
		const results = [];
		for (const line of lines) {
			if (!line.trim()) continue;
			const parts = line.split(/(?<!\\):/);
			if (parts.length < 4) continue;
			const ssid = parts[0].replace(/\\:/g, ":").trim();
			if (!ssid) continue;
			const signal = parseInt(parts[1], 10) || 0;
			const security = parts[2].replace(/\\:/g, ":").trim();
			const activeVal = parts[3].trim().toLowerCase();
			const active = activeVal === "yes" || activeVal === "*" || activeVal === "sí" || activeVal === "si";
			const existing = results.find((r) => r.ssid === ssid);
			if (existing) {
				if (active) existing.active = true;
				if (signal > existing.signal) {
					existing.signal = signal;
					existing.security = security;
				}
			} else results.push({
				ssid,
				signal,
				security,
				active
			});
		}
		return results;
	};
	ipcMain.handle("config:scanWifi", async () => {
		const runScanWifi = async () => {
			const hostScanFile = "/tmp/host_wifi_list.txt";
			try {
				if (fs.existsSync(hostScanFile)) {
					const content = await promises.readFile(hostScanFile, "utf-8");
					if (content.trim()) return parseNmcliOutput(content);
				}
			} catch (err) {
				console.error("Failed to read host wifi list:", err);
			}
			return new Promise((resolve) => {
				exec("nmcli device wifi rescan", () => {
					exec("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list", (error, stdout) => {
						if (error || !stdout) {
							resolve([]);
							return;
						}
						resolve(parseNmcliOutput(stdout));
					});
				});
			});
		};
		let list = await runScanWifi();
		if (list.length === 0) list = [
			{
				ssid: "CoBien_WiFi_5G",
				signal: 95,
				security: "WPA2",
				active: activeMockSSID === "CoBien_WiFi_5G"
			},
			{
				ssid: "Deusto_Guest",
				signal: 72,
				security: "WPA2",
				active: activeMockSSID === "Deusto_Guest"
			},
			{
				ssid: "Euskaltel_WiFi",
				signal: 50,
				security: "WPA/WPA2",
				active: activeMockSSID === "Euskaltel_WiFi"
			},
			{
				ssid: "Library_Public",
				signal: 45,
				security: "",
				active: activeMockSSID === "Library_Public"
			},
			{
				ssid: "IoT_Sensors",
				signal: 30,
				security: "WPA2",
				active: activeMockSSID === "IoT_Sensors"
			}
		];
		return list;
	});
	ipcMain.handle("config:connectWifi", async (event, ssid, password) => {
		lastManualConnectTime = Date.now();
		const runScanWifi = async () => {
			const hostScanFile = "/tmp/host_wifi_list.txt";
			try {
				if (fs.existsSync(hostScanFile)) {
					const content = await promises.readFile(hostScanFile, "utf-8");
					if (content.trim()) return parseNmcliOutput(content);
				}
			} catch (err) {
				console.error("Failed to read host wifi list:", err);
			}
			return new Promise((resolve) => {
				exec("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE device wifi list", (error, stdout) => {
					if (error || !stdout) {
						resolve([]);
						return;
					}
					resolve(parseNmcliOutput(stdout));
				});
			});
		};
		const runConnectWifi = async (targetSsid, pass) => {
			if (await new Promise((resolve) => {
				exec("nmcli -t -f NAME connection show", (error, stdout) => {
					if (error || !stdout) {
						resolve(false);
						return;
					}
					resolve(stdout.split("\n").map((n) => n.trim()).includes(targetSsid));
				});
			})) {
				console.log(`[WIFI] Connection profile for "${targetSsid}" already exists. Attempting to bring it up...`);
				if (await new Promise((resolve) => {
					exec(`nmcli connection up "${targetSsid.replace(/"/g, "\\\"")}"`, (error, stdout, stderr) => {
						if (error) {
							console.warn(`[WIFI] Failed to bring up existing connection "${targetSsid}":`, error, stderr);
							resolve(false);
						} else {
							console.log(`[WIFI] Successfully brought up existing connection "${targetSsid}".`);
							resolve(true);
						}
					});
				})) return true;
			}
			console.log(`[WIFI] Creating/updating connection for "${targetSsid}"...`);
			return new Promise((resolve) => {
				let cmd = `nmcli device wifi connect "${targetSsid.replace(/"/g, "\\\"")}"`;
				if (pass) cmd += ` password "${pass.replace(/"/g, "\\\"")}"`;
				exec(cmd, (error, stdout, stderr) => {
					if (error) {
						console.error("Error connecting to wifi:", error, stderr);
						resolve(false);
					} else resolve(true);
				});
			});
		};
		const hasWifiDevice = () => {
			return new Promise((resolve) => {
				exec("nmcli -t -f TYPE device", (error, stdout) => {
					if (error || !stdout) {
						resolve(false);
						return;
					}
					resolve(stdout.split("\n").some((line) => line.trim() === "wifi"));
				});
			});
		};
		const realList = await runScanWifi();
		if (!await hasWifiDevice() || !realList.some((r) => r.ssid === ssid)) {
			console.log(`[WIFI] Simulating connection to mock/real network (no physical wifi interface or mock network): ${ssid}`);
			await new Promise((resolve) => setTimeout(resolve, 2e3));
			if (password === "fail" || password === "error") return false;
			activeMockSSID = ssid;
			return true;
		} else {
			console.log(`[WIFI] Connecting to real network: ${ssid}`);
			const success = await runConnectWifi(ssid, password);
			if (success) activeMockSSID = "";
			return success;
		}
	});
	ipcMain.handle("config:getCurrentWifi", async () => {
		const runGetActiveWifi = () => {
			const hostScanFile = "/tmp/host_wifi_list.txt";
			try {
				if (fs.existsSync(hostScanFile)) {
					const content = fs.readFileSync(hostScanFile, "utf-8");
					if (content.trim()) {
						const activeItem = parseNmcliOutput(content).find((item) => item.active);
						if (activeItem) return Promise.resolve(activeItem.ssid);
					}
				}
			} catch (err) {
				console.error("Failed to read host active wifi:", err);
			}
			return new Promise((resolve) => {
				exec("nmcli -t -f NAME,TYPE connection show --active", (error, stdout) => {
					if (error || !stdout) {
						resolve(null);
						return;
					}
					const lines = stdout.split("\n");
					for (const line of lines) {
						const parts = line.split(/(?<!\\):/);
						if (parts.length >= 2 && parts[1].trim() === "802-11-wireless") {
							resolve(parts[0].replace(/\\:/g, ":").trim());
							return;
						}
					}
					resolve(null);
				});
			});
		};
		const active = await runGetActiveWifi();
		if (active) return active;
		return activeMockSSID;
	});
	ipcMain.handle("events:get", async () => {
		return await getEvents(configPath);
	});
	ipcMain.handle("weather:fetch", async (_, cityName, lang = "es") => {
		return await fetchWeatherBundle(cityName, lang);
	});
	ipcMain.handle("jokes:getRandom", async (_, lang = "es") => {
		return await getRandomJoke(lang);
	});
	ipcMain.handle("contacts:list", async () => {
		return await loadContacts();
	});
	ipcMain.handle("contacts:sync", async () => {
		const apiKey = process.env.COBIEN_NOTIFY_API_KEY || "";
		const deviceId = process.env.COBIEN_DEVICE_ID;
		if (!deviceId) {
			console.error("ERROR: COBIEN_DEVICE_ID not set.");
			throw new Error("COBIEN_DEVICE_ID not set");
		}
		return await syncContacts(deviceId, apiKey, ((await readMergedConfig()).services?.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	});
	ipcMain.handle("contacts:requestCall", async (_, userName) => {
		const apiKey = process.env.COBIEN_NOTIFY_API_KEY || "";
		const deviceId = process.env.COBIEN_DEVICE_ID;
		if (!deviceId) {
			console.error("ERROR: COBIEN_DEVICE_ID not set.");
			throw new Error("COBIEN_DEVICE_ID not set");
		}
		return await requestCall(userName, deviceId, apiKey, ((await readMergedConfig()).services?.portal_base_url || "https://portal.co-bien.eu").replace(/\/$/, ""));
	});
	ipcMain.handle("contacts:openCall", async (_, userName) => {
		const deviceId = process.env.COBIEN_DEVICE_ID;
		if (!deviceId) {
			console.error("ERROR: COBIEN_DEVICE_ID not set.");
			throw new Error("COBIEN_DEVICE_ID not set");
		}
		const deviceApiKey = process.env.COBIEN_VIDEOCALL_DEVICE_API_KEY || "";
		const sessionUrl = process.env.COBIEN_DEVICE_VIDEOCALL_SESSION_URL || "https://portal.co-bien.eu/api/device-videocall-session/";
		const devicePortalUrl = process.env.COBIEN_PORTAL_VIDEOCALL_DEVICE_URL || "https://portal.co-bien.eu/videocall/device/";
		const answeredUrl = process.env.COBIEN_PORTAL_CALL_ANSWERED_URL || "https://portal.co-bien.eu/api/call-answered/";
		let targetUrl = `${process.env.COBIEN_PORTAL_VIDEOCALL_URL || "https://portal.co-bien.eu/videocall/"}?room=${encodeURIComponent(userName)}&device=${encodeURIComponent(deviceId)}`;
		if (deviceApiKey) try {
			console.log(`[VIDEOCALL] Fetching device session for room: ${userName}, device: ${deviceId}`);
			const sessionRes = await fetch(sessionUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-DEVICE-ID": deviceId,
					"X-DEVICE-KEY": deviceApiKey
				},
				body: JSON.stringify({
					device_id: deviceId,
					room: userName
				}),
				signal: AbortSignal.timeout(8e3)
			});
			if (sessionRes.ok) {
				const { token, room_name, identity, call_answered_url } = await sessionRes.json();
				if (token) {
					const targetAnsweredUrl = call_answered_url || answeredUrl;
					try {
						console.log(`[VIDEOCALL] Notifying call answered to: ${targetAnsweredUrl}`);
						await fetch(targetAnsweredUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								room: room_name,
								device: identity
							}),
							signal: AbortSignal.timeout(5e3)
						});
					} catch (err) {
						console.error("[VIDEOCALL] Failed to notify backend call answered:", err);
					}
					targetUrl = `${devicePortalUrl}#token=${encodeURIComponent(token)}&room=${encodeURIComponent(room_name)}&identity=${encodeURIComponent(identity)}`;
					console.log("[VIDEOCALL] Generated Twilio token URL successfully");
				}
			} else console.warn(`[VIDEOCALL] Device session request failed with status: ${sessionRes.status}`);
		} catch (err) {
			console.error("[VIDEOCALL] Error request session:", err);
		}
		const { BrowserWindow: BW } = await import("electron");
		const callWin = new BW({
			width: 1024,
			height: 768,
			fullscreen: true,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true
			}
		});
		const closeWindowCleanly = () => {
			if (callWin.isDestroyed()) return;
			try {
				callWin.hide();
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.show();
					mainWindow.focus();
				}
				callWin.loadURL("about:blank");
				setTimeout(() => {
					if (!callWin.isDestroyed()) callWin.close();
				}, 500);
			} catch (e) {
				console.error("[VIDEOCALL] Error during clean close:", e);
			}
		};
		callWin.on("closed", () => {
			if (mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.show();
				mainWindow.focus();
			}
		});
		callWin.loadURL(targetUrl);
		callWin.webContents.on("will-navigate", (event, url) => {
			if (url.startsWith("cobien://call-ended")) {
				event.preventDefault();
				closeWindowCleanly();
			}
		});
		callWin.webContents.on("did-start-navigation", (event, url) => {
			if (url.startsWith("cobien://call-ended")) {
				event.preventDefault();
				closeWindowCleanly();
			}
		});
		callWin.webContents.on("will-frame-navigate", (event) => {
			if (event.url.startsWith("cobien://call-ended")) {
				event.preventDefault();
				closeWindowCleanly();
			}
		});
		return true;
	});
	ipcMain.handle("reminders:add", async (_, message, isoDatetime) => {
		return await addReminder(message, isoDatetime);
	});
	ipcMain.handle("reminders:list", async () => {
		return await listReminders();
	});
	ipcMain.handle("reminders:delete", async (_, id) => {
		return await deleteReminder(id);
	});
	ipcMain.handle("events:addPersonal", async (_, payload) => {
		const data = await readMergedConfig();
		const defaultLocation = process.env.COBIEN_DEVICE_LOCATION || data.settings?.device_location || "Bilbao";
		const deviceId = process.env.COBIEN_DEVICE_ID || "CoBien6";
		const location = payload.location || defaultLocation;
		return await addPersonalEvent({
			...payload,
			location,
			deviceId
		});
	});
	ipcMain.handle("events:updatePersonal", async (_, payload) => {
		return await updatePersonalEvent(payload);
	});
	ipcMain.handle("events:delete", async (_, id) => {
		return await deleteEvent(id);
	});
	ipcMain.handle("board:fetch", async () => await fetchMessages());
	ipcMain.handle("board:delete", async (_, id) => await deleteMessage(id));
	ipcMain.handle("board:read", async (_, id) => await markMessageRead(id));
	ipcMain.handle("board:reply", async (_, id, text) => await submitQuickReply(id, text));
	ipcMain.handle("config:getSystemInfo", async () => {
		let rustdeskId = "";
		try {
			rustdeskId = await new Promise((resolve) => {
				exec("rustdesk --get-id", (error, stdout) => {
					if (error) resolve("");
					else resolve(stdout.trim());
				});
			});
		} catch (e) {}
		return {
			version: app.getVersion(),
			deviceId: process.env.COBIEN_DEVICE_ID || "CoBienX",
			contactsPath: join(app.getPath("userData"), "contacts/list_contacts.txt"),
			defaultLanguage: process.env.COBIEN_APP_LANGUAGE || "en",
			rustdeskId,
			networkSpeedKbps: lastMeasuredSpeed
		};
	});
	ipcMain.handle("config:measureNetworkSpeed", async () => {
		const kbps = await measureNetworkSpeed();
		lastMeasuredSpeed = kbps;
		setNetworkSpeed(kbps);
		if (_localConfigPath) triggerHeartbeat(configPath, _localConfigPath).catch(() => {});
		return kbps;
	});
	ipcMain.handle("app:restart", () => {
		console.log("[Main] Restarting application via window reload...");
		if (process.env.VITE_DEV_SERVER_URL) {
			if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		} else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadFile(join(_dirname, "../dist/index.html"));
		else {
			app.relaunch();
			app.exit(0);
		}
	});
	ipcMain.handle("app:reboot-system", () => {
		console.log("[Main] System reboot requested from GUI...");
		exec("systemctl reboot -i || reboot || sudo reboot", (err) => {
			if (err) console.error("[Main] Failed to execute reboot command:", err);
		});
	});
	ipcMain.handle("app:exit", () => {
		app.quit();
	});
	ipcMain.handle("app:update", async () => {
		console.log("[Main] Manual update requested from GUI.");
		const runtimeStateDir = process.env.COBIEN_RUNTIME_STATE_DIR || join(os.homedir(), ".local/state/cobien/runtime");
		const flagPath = join(runtimeStateDir, "manual_update_reload.flag");
		try {
			await promises.mkdir(runtimeStateDir, { recursive: true });
			await promises.writeFile(flagPath, JSON.stringify({ requested_at: (/* @__PURE__ */ new Date()).toISOString() }));
			console.log(`[Main] Created manual update reload flag at: ${flagPath}`);
		} catch (e) {
			console.error("[Main] Failed to write manual update reload flag:", e.message || e);
		}
		return new Promise((resolve, reject) => {
			const cmd = "systemctl --user start cobien-update.service";
			console.log(`[Main] Executing update command: ${cmd}`);
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
					console.error(`[Main] Failed to start update service:`, error);
					reject(error);
				} else {
					console.log(`[Main] Update service started successfully:`, stdout);
					resolve(true);
				}
			});
		});
	});
	ipcMain.handle("app:uninstall", async () => {
		const username = os.userInfo().username;
		const scriptPath = join(os.homedir(), "cobien/cobien-furniture-app-launcher/uninstall-cobien-furniture-environment.sh");
		console.log(`[Uninstall] Target script path: ${scriptPath} (resolving for user: ${username})`);
		return new Promise((resolve, reject) => {
			const cmd = `echo "cobien" | sudo -S systemd-run --system --collect --setenv=COBIEN_SETUP_USER=${username} --setenv=COBIEN_NON_INTERACTIVE=1 --setenv=COBIEN_AUTO_CONFIRM=1 --setenv=COBIEN_AUTO_REBOOT_AFTER_UNINSTALL=1 bash "${scriptPath}"`;
			console.log(`[Uninstall] Running command: ${cmd}`);
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
					console.error(`[Uninstall] Script error:`, error);
					console.error(`[Uninstall] Script stderr:`, stderr);
					reject(error);
				} else {
					console.log(`[Uninstall] Script stdout:`, stdout);
					resolve(true);
				}
			});
		});
	});
	let currentTtsProcess = null;
	ipcMain.handle("tts:stop", () => {
		if (currentTtsProcess) {
			try {
				currentTtsProcess.kill();
			} catch (e) {}
			currentTtsProcess = null;
		}
	});
	ipcMain.handle("tts:speak", async (event, text, lang = "es", gender = "male", engine = "piper") => {
		console.log(`[TTS] Speaking (${lang}/${gender}) via ${engine}: "${text}"`);
		if (currentTtsProcess) {
			try {
				currentTtsProcess.kill();
			} catch (e) {}
			currentTtsProcess = null;
		}
		const tempWav = join(os.tmpdir(), `tts_${Date.now()}.wav`);
		const { bin, model } = getPiperConfig(lang, gender);
		console.log(`[TTS] Piper Config: bin=${bin}, model=${model}`);
		if (!model) {
			console.error("TTS: No Piper model configured.");
			return null;
		}
		return new Promise((resolve) => {
			const child = execFile(bin, [
				"--model",
				model,
				"--output_file",
				tempWav
			], async (error, stdout, stderr) => {
				if (error) {
					console.error("[TTS] Piper exec error:", error, stderr);
					resolve(null);
					return;
				}
				try {
					const buffer = await promises.readFile(tempWav);
					await promises.unlink(tempWav);
					console.log(`[TTS] Generated WAV: ${buffer.length} bytes`);
					resolve(buffer);
				} catch (e) {
					console.error("[TTS] Error reading temp wav:", e);
					resolve(null);
				}
			});
			child.stdin?.write(text);
			child.stdin?.end();
		});
	});
	ipcMain.handle("hardware:adjustVolume", async (_, value, isAbsolute = false) => {
		return await adjustVolume(value, isAbsolute);
	});
	ipcMain.handle("hardware:adjustBrightness", async (_, value) => {
		return await adjustBrightness(value);
	});
	ipcMain.handle("hardware:getVolume", async () => {
		return await getVolume();
	});
	ipcMain.handle("logs:getTypes", () => {
		return [
			"app",
			"icso",
			"can",
			"bridge"
		];
	});
	ipcMain.handle("logs:getTail", async (_, type) => {
		const logDir = join(app.getPath("userData"), "logs");
		let logFile = "";
		if (type === "app") logFile = join(logDir, "app.log");
		else if (type === "icso") logFile = join(logDir, "icso_log.txt");
		else if (type === "can") logFile = resolveLatestLogFile(logDir, [
			"can-bus",
			"can_bus",
			"can"
		]);
		else if (type === "bridge") logFile = resolveLatestLogFile(logDir, [
			"mqtt-can-bridge",
			"mqtt_can_bridge",
			"bridge"
		]);
		if (!logFile || !fs.existsSync(logFile)) return `(sin datos en el log de tipo: ${type})`;
		try {
			return fs.readFileSync(logFile, "utf-8").split("\n").slice(-250).join("\n");
		} catch (e) {
			return `Error al leer logs: ${e.message}`;
		}
	});
}
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1024,
		height: 768,
		fullscreen: true,
		webPreferences: {
			preload: join(_dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	mainWindow.setBackgroundColor("#ffffff");
	mainWindow.webContents.on("render-process-gone", (event, details) => {
		console.error(`[STABILITY] Render process gone: ${details.reason} (exitCode=${details.exitCode})`);
		setTimeout(() => {
			if (mainWindow && !mainWindow.isDestroyed()) {
				console.log("[STABILITY] Reloading window after renderer crash...");
				if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
				else mainWindow.loadFile(join(_dirname, "../dist/index.html"));
			}
		}, 2e3);
	});
	mainWindow.webContents.on("unresponsive", () => {
		console.warn("[STABILITY] Renderer became unresponsive. Will reload if still unresponsive in 5s...");
		setTimeout(() => {
			if (mainWindow && !mainWindow.isDestroyed()) {
				if (mainWindow.webContents.isCurrentlyAudible() || true) {
					console.warn("[STABILITY] Forcing reload after unresponsive timeout.");
					mainWindow.webContents.reload();
				}
			}
		}, 5e3);
	});
	mainWindow.webContents.on("responsive", () => {
		console.log("[STABILITY] Renderer became responsive again.");
	});
	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
			if (process.env.VITE_DEV_SERVER_URL && validatedURL.startsWith(process.env.VITE_DEV_SERVER_URL)) {
				console.log(`[Main] Failed to load dev URL (error: ${errorDescription}). Retrying in 1s...`);
				setTimeout(() => {
					if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
				}, 1e3);
			}
		});
	} else {
		mainWindow.loadFile(join(_dirname, "../dist/index.html"));
		mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
			console.error(`[STABILITY] Failed to load production HTML (error: ${errorDescription}). Retrying in 2s...`);
			setTimeout(() => {
				if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadFile(join(_dirname, "../dist/index.html"));
			}, 2e3);
		});
	}
}
var gpuDisabled = process.env.COBIEN_DISABLE_GPU === "1" || process.env.DISABLE_GPU === "1";
if (!gpuDisabled) try {
	const virt = execSync("systemd-detect-virt", { encoding: "utf-8" }).trim();
	if (virt && virt !== "none") {
		console.log(`[GPU] Virtual machine detected (${virt}). Disabling hardware acceleration.`);
		gpuDisabled = true;
	}
} catch (e) {}
if (!gpuDisabled) try {
	const homeDir = os.homedir();
	const possiblePaths = [process.env.COBIEN_LOCAL_CONFIG_PATH || join(homeDir, ".config", "cobien", "config.local.json"), join(homeDir, ".config", "cobien-furniture-electron", "config.local.json")];
	for (const p of possiblePaths) if (fs.existsSync(p)) {
		const raw = fs.readFileSync(p, "utf-8");
		if (JSON.parse(raw)?.settings?.disable_gpu === true) {
			console.log(`[GPU] disable_gpu=true found in local config (${p}). Disabling hardware acceleration.`);
			gpuDisabled = true;
			break;
		}
	}
} catch (e) {}
if (!gpuDisabled) try {
	if ((fs.existsSync("/dev/dri") ? fs.readdirSync("/dev/dri").filter((f) => f.startsWith("card")) : []).length === 0) {
		console.log("[GPU] No DRI card devices found. Disabling hardware acceleration.");
		gpuDisabled = true;
	}
} catch (e) {}
if (gpuDisabled) {
	app.disableHardwareAcceleration();
	app.commandLine.appendSwitch("disable-gpu");
}
app.commandLine.appendSwitch("disable-features", "VaapiVideoDecoder,VaapiVideoEncoder");
app.commandLine.appendSwitch("password-store", "basic");
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu-sandbox");
function setupLogRedirection() {
	const logDir = join(app.getPath("userData"), "logs");
	if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
	const logFile = join(logDir, "app.log");
	let logStream = fs.createWriteStream(logFile, {
		flags: "a",
		encoding: "utf-8"
	});
	let logSize = 0;
	try {
		logSize = fs.statSync(logFile).size;
	} catch (e) {
		logSize = 0;
	}
	const maxLogSize = 5 * 1024 * 1024;
	const rotateStream = () => {
		try {
			logStream.end();
			const backupFile = logFile + ".1";
			if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
			if (fs.existsSync(logFile)) fs.renameSync(logFile, backupFile);
			logStream = fs.createWriteStream(logFile, {
				flags: "a",
				encoding: "utf-8"
			});
			logSize = 0;
		} catch (e) {}
	};
	const originalWrite = process.stdout.write.bind(process.stdout);
	process.stdout.write = (chunk, encoding, callback) => {
		const len = chunk ? chunk.length : 0;
		logSize += len;
		if (logSize > maxLogSize) rotateStream();
		try {
			logStream.write(chunk);
		} catch (e) {}
		try {
			return originalWrite(chunk, encoding, callback);
		} catch (err) {
			if (callback) callback(err);
			return true;
		}
	};
	const originalErrWrite = process.stderr.write.bind(process.stderr);
	process.stderr.write = (chunk, encoding, callback) => {
		const len = chunk ? chunk.length : 0;
		logSize += len;
		if (logSize > maxLogSize) rotateStream();
		try {
			logStream.write(chunk);
		} catch (e) {}
		try {
			return originalErrWrite(chunk, encoding, callback);
		} catch (err) {
			if (callback) callback(err);
			return true;
		}
	};
}
app.whenReady().then(() => {
	setupLogRedirection();
	process.on("uncaughtException", (error) => {
		console.error("[FATAL] Uncaught exception (process kept alive):", error);
	});
	process.on("unhandledRejection", (reason) => {
		console.error("[FATAL] Unhandled promise rejection (process kept alive):", reason);
	});
	session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
		if ([
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(permission)) callback(true);
		else callback(false);
	});
	session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
		return [
			"media",
			"geolocation",
			"notifications",
			"midiSysex",
			"openExternal"
		].includes(permission);
	});
	protocol.handle("cobien-media", (request) => {
		try {
			const parsed = new URL(request.url);
			let filePath = decodeURIComponent(parsed.pathname);
			if (parsed.hostname && parsed.hostname !== "localhost") filePath = "/" + decodeURIComponent(parsed.hostname) + filePath;
			return net.fetch("file://" + filePath);
		} catch (e) {
			console.error("[PROTOCOL] Failed to parse custom media URL:", request.url, e);
			return new Response("Invalid URL", { status: 400 });
		}
	});
	const localConfigPath = join(app.getPath("userData"), "config.local.json");
	_localConfigPath = localConfigPath;
	setupIPC();
	startIcsoSyncLoop(configPath, localConfigPath);
	logScreenWakeup();
	startLogsSyncLoop(configPath, localConfigPath);
	const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	let localData = {};
	try {
		if (fs.existsSync(localConfigPath)) localData = JSON.parse(fs.readFileSync(localConfigPath, "utf-8"));
	} catch (e) {}
	const services = {
		...data.services,
		...localData.services
	};
	const settings = {
		...data.settings,
		...localData.settings
	};
	const baseUrl = (services.backend_base_url || "https://portal.co-bien.eu").replace(/\/$/, "");
	const apiKey = process.env.COBIEN_NOTIFY_API_KEY || services.notify_api_key || "";
	const deviceId = process.env.COBIEN_DEVICE_ID || settings.device_id || "CoBienX";
	if (!process.env.COBIEN_DEVICE_ID && !settings.device_id) console.error("WARNING: COBIEN_DEVICE_ID not set. Using fallback \"CoBienX\". The app will start but some features may not work correctly.");
	syncContacts(deviceId, apiKey, baseUrl).catch(console.error);
	let pollIntervalSec = parseInt(process.env.COBIEN_CONTACTS_SYNC_INTERVAL_SEC || "300", 10);
	if (pollIntervalSec < 60) pollIntervalSec = 300;
	if (pollIntervalSec > 0) contactsSyncIntervalId = setInterval(() => {
		console.log("[CONTACTS] Periodic sync started");
		syncContacts(deviceId, apiKey, baseUrl).then(() => {
			if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("contacts:updated");
		}).catch(console.error);
	}, pollIntervalSec * 1e3);
	createWindow();
	wifiWatchdogIntervalId = startWifiWatchdog();
	loadPendingReminders((reminder) => {
		if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("reminder:fire", reminder);
	});
	if (mainWindow) {
		startBackendSync(mainWindow, configPath, localConfigPath);
		startMqtt(mainWindow);
	}
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
var contactsSyncIntervalId = null;
var wifiWatchdogIntervalId = null;
function startWifiWatchdog() {
	return setInterval(async () => {
		try {
			const homeDir = os.homedir();
			const defaultPath = join(app.getAppPath(), "config.default.json");
			const localPath = process.env.COBIEN_LOCAL_CONFIG_PATH || join(homeDir, ".config", "cobien", "config.local.json");
			let enabled = false;
			try {
				let defaultData = {};
				if (fs.existsSync(defaultPath)) defaultData = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
				let localData = {};
				if (fs.existsSync(localPath)) localData = JSON.parse(fs.readFileSync(localPath, "utf-8"));
				enabled = {
					...defaultData.settings,
					...localData.settings
				}.enable_wifi_watchdog === true;
			} catch (e) {}
			if (!enabled) return;
			if (await new Promise((resolve) => {
				exec("nmcli -t -f CONNECTIVITY networking", (error, stdout) => {
					if (!error && stdout) {
						if (stdout.trim() === "full") {
							resolve(true);
							return;
						}
					}
					resolve(false);
				});
			})) return;
			if (!await new Promise((resolve) => {
				exec("nmcli -t -f TYPE device", (error, stdout) => {
					if (error || !stdout) {
						resolve(false);
						return;
					}
					resolve(stdout.split("\n").some((line) => line.trim() === "wifi"));
				});
			})) return;
			if (await new Promise((resolve) => {
				exec("nmcli -t -f TYPE,STATE device", (error, stdout) => {
					if (error || !stdout) {
						resolve(false);
						return;
					}
					resolve(stdout.split("\n").map((l) => l.trim()).some((line) => {
						const [type, state] = line.split(":");
						return type === "wifi" && state === "connected";
					}));
				});
			})) return;
			if (Date.now() - lastManualConnectTime < 120 * 1e3) return;
			if (await new Promise((resolve) => {
				exec("nmcli -t -f SSID device wifi list", (error, stdout) => {
					if (error || !stdout) {
						resolve(false);
						return;
					}
					resolve(stdout.split("\n").map((s) => s.trim()).includes("cobien"));
				});
			})) {
				console.log("[WIFI-WATCHDOG] Device is offline, and \"cobien\" SSID is in range. Auto-connecting to default Wi-Fi...");
				exec("nmcli device wifi connect \"cobien\" password \"Cobien2026\"", (err, stdout, stderr) => {
					if (err) console.error("[WIFI-WATCHDOG] Failed to auto-connect to cobien Wi-Fi:", err, stderr);
					else console.log("[WIFI-WATCHDOG] Successfully auto-connected to cobien Wi-Fi.");
				});
			}
		} catch (err) {
			console.error("[WIFI-WATCHDOG] Error in watchdog loop:", err);
		}
	}, 30 * 1e3);
}
function resolveLatestLogFile(logDir, prefixes) {
	if (!fs.existsSync(logDir)) return "";
	try {
		const files = fs.readdirSync(logDir);
		const candidates = [];
		for (const file of files) for (const prefix of prefixes) if (file.startsWith(prefix) && (file.endsWith(".log") || file.endsWith(".txt"))) candidates.push(join(logDir, file));
		if (candidates.length === 0) return "";
		candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
		return candidates[0];
	} catch (e) {
		return "";
	}
}
app.on("window-all-closed", () => {
	stopMqtt();
	stopBackendSync();
	stopIcsoSyncLoop();
	stopLogsSyncLoop();
	if (contactsSyncIntervalId) {
		clearInterval(contactsSyncIntervalId);
		contactsSyncIntervalId = null;
	}
	if (wifiWatchdogIntervalId) {
		clearInterval(wifiWatchdogIntervalId);
		wifiWatchdogIntervalId = null;
	}
	if (process.platform !== "darwin") app.quit();
});
//#endregion
