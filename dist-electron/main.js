import { promises } from "fs";
import { BrowserWindow, app, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import * as fsSync from "node:fs";
import { promises as promises$1 } from "node:fs";
import * as os from "node:os";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, { get: (a, b) => (typeof require !== "undefined" ? require : a)[b] }) : x)(function(x) {
	if (typeof require !== "undefined") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + x + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
});
//#endregion
//#region node_modules/dotenv/lib/main.js
var require_main = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs = __require("fs");
	var path = __require("path");
	var os$1 = __require("os");
	var crypto = __require("crypto");
	var TIPS = [
		"◈ encrypted .env [www.dotenvx.com]",
		"◈ secrets for agents [www.dotenvx.com]",
		"⌁ auth for agents [www.vestauth.com]",
		"⌘ custom filepath { path: '/custom/path/.env' }",
		"⌘ enable debugging { debug: true }",
		"⌘ override existing { override: true }",
		"⌘ suppress logs { quiet: true }",
		"⌘ multiple files { path: ['.env.local', '.env'] }"
	];
	function _getRandomTip() {
		return TIPS[Math.floor(Math.random() * TIPS.length)];
	}
	function parseBoolean(value) {
		if (typeof value === "string") return ![
			"false",
			"0",
			"no",
			"off",
			""
		].includes(value.toLowerCase());
		return Boolean(value);
	}
	function supportsAnsi() {
		return process.stdout.isTTY;
	}
	function dim(text) {
		return supportsAnsi() ? `\x1b[2m${text}\x1b[0m` : text;
	}
	var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;
	function parse(src) {
		const obj = {};
		let lines = src.toString();
		lines = lines.replace(/\r\n?/gm, "\n");
		let match;
		while ((match = LINE.exec(lines)) != null) {
			const key = match[1];
			let value = match[2] || "";
			value = value.trim();
			const maybeQuote = value[0];
			value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
			if (maybeQuote === "\"") {
				value = value.replace(/\\n/g, "\n");
				value = value.replace(/\\r/g, "\r");
			}
			obj[key] = value;
		}
		return obj;
	}
	function _parseVault(options) {
		options = options || {};
		const vaultPath = _vaultPath(options);
		options.path = vaultPath;
		const result = DotenvModule.configDotenv(options);
		if (!result.parsed) {
			const err = /* @__PURE__ */ new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
			err.code = "MISSING_DATA";
			throw err;
		}
		const keys = _dotenvKey(options).split(",");
		const length = keys.length;
		let decrypted;
		for (let i = 0; i < length; i++) try {
			const attrs = _instructions(result, keys[i].trim());
			decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
			break;
		} catch (error) {
			if (i + 1 >= length) throw error;
		}
		return DotenvModule.parse(decrypted);
	}
	function _warn(message) {
		console.error(`⚠ ${message}`);
	}
	function _debug(message) {
		console.log(`┆ ${message}`);
	}
	function _log(message) {
		console.log(`◇ ${message}`);
	}
	function _dotenvKey(options) {
		if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) return options.DOTENV_KEY;
		if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) return process.env.DOTENV_KEY;
		return "";
	}
	function _instructions(result, dotenvKey) {
		let uri;
		try {
			uri = new URL(dotenvKey);
		} catch (error) {
			if (error.code === "ERR_INVALID_URL") {
				const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
				err.code = "INVALID_DOTENV_KEY";
				throw err;
			}
			throw error;
		}
		const key = uri.password;
		if (!key) {
			const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Missing key part");
			err.code = "INVALID_DOTENV_KEY";
			throw err;
		}
		const environment = uri.searchParams.get("environment");
		if (!environment) {
			const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Missing environment part");
			err.code = "INVALID_DOTENV_KEY";
			throw err;
		}
		const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
		const ciphertext = result.parsed[environmentKey];
		if (!ciphertext) {
			const err = /* @__PURE__ */ new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
			err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
			throw err;
		}
		return {
			ciphertext,
			key
		};
	}
	function _vaultPath(options) {
		let possibleVaultPath = null;
		if (options && options.path && options.path.length > 0) if (Array.isArray(options.path)) {
			for (const filepath of options.path) if (fs.existsSync(filepath)) possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
		} else possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
		else possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
		if (fs.existsSync(possibleVaultPath)) return possibleVaultPath;
		return null;
	}
	function _resolveHome(envPath) {
		return envPath[0] === "~" ? path.join(os$1.homedir(), envPath.slice(1)) : envPath;
	}
	function _configVault(options) {
		const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || options && options.debug);
		const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || options && options.quiet);
		if (debug || !quiet) _log("loading env from encrypted .env.vault");
		const parsed = DotenvModule._parseVault(options);
		let processEnv = process.env;
		if (options && options.processEnv != null) processEnv = options.processEnv;
		DotenvModule.populate(processEnv, parsed, options);
		return { parsed };
	}
	function configDotenv(options) {
		const dotenvPath = path.resolve(process.cwd(), ".env");
		let encoding = "utf8";
		let processEnv = process.env;
		if (options && options.processEnv != null) processEnv = options.processEnv;
		let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || options && options.debug);
		let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || options && options.quiet);
		if (options && options.encoding) encoding = options.encoding;
		else if (debug) _debug("no encoding is specified (UTF-8 is used by default)");
		let optionPaths = [dotenvPath];
		if (options && options.path) if (!Array.isArray(options.path)) optionPaths = [_resolveHome(options.path)];
		else {
			optionPaths = [];
			for (const filepath of options.path) optionPaths.push(_resolveHome(filepath));
		}
		let lastError;
		const parsedAll = {};
		for (const path of optionPaths) try {
			const parsed = DotenvModule.parse(fs.readFileSync(path, { encoding }));
			DotenvModule.populate(parsedAll, parsed, options);
		} catch (e) {
			if (debug) _debug(`failed to load ${path} ${e.message}`);
			lastError = e;
		}
		const populated = DotenvModule.populate(processEnv, parsedAll, options);
		debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
		quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
		if (debug || !quiet) {
			const keysCount = Object.keys(populated).length;
			const shortPaths = [];
			for (const filePath of optionPaths) try {
				const relative = path.relative(process.cwd(), filePath);
				shortPaths.push(relative);
			} catch (e) {
				if (debug) _debug(`failed to load ${filePath} ${e.message}`);
				lastError = e;
			}
			_log(`injected env (${keysCount}) from ${shortPaths.join(",")} ${dim(`// tip: ${_getRandomTip()}`)}`);
		}
		if (lastError) return {
			parsed: parsedAll,
			error: lastError
		};
		else return { parsed: parsedAll };
	}
	function config(options) {
		if (_dotenvKey(options).length === 0) return DotenvModule.configDotenv(options);
		const vaultPath = _vaultPath(options);
		if (!vaultPath) {
			_warn(`you set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}`);
			return DotenvModule.configDotenv(options);
		}
		return DotenvModule._configVault(options);
	}
	function decrypt(encrypted, keyStr) {
		const key = Buffer.from(keyStr.slice(-64), "hex");
		let ciphertext = Buffer.from(encrypted, "base64");
		const nonce = ciphertext.subarray(0, 12);
		const authTag = ciphertext.subarray(-16);
		ciphertext = ciphertext.subarray(12, -16);
		try {
			const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
			aesgcm.setAuthTag(authTag);
			return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
		} catch (error) {
			const isRange = error instanceof RangeError;
			const invalidKeyLength = error.message === "Invalid key length";
			const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
			if (isRange || invalidKeyLength) {
				const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
				err.code = "INVALID_DOTENV_KEY";
				throw err;
			} else if (decryptionFailed) {
				const err = /* @__PURE__ */ new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
				err.code = "DECRYPTION_FAILED";
				throw err;
			} else throw error;
		}
	}
	function populate(processEnv, parsed, options = {}) {
		const debug = Boolean(options && options.debug);
		const override = Boolean(options && options.override);
		const populated = {};
		if (typeof parsed !== "object") {
			const err = /* @__PURE__ */ new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
			err.code = "OBJECT_REQUIRED";
			throw err;
		}
		for (const key of Object.keys(parsed)) if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
			if (override === true) {
				processEnv[key] = parsed[key];
				populated[key] = parsed[key];
			}
			if (debug) if (override === true) _debug(`"${key}" is already defined and WAS overwritten`);
			else _debug(`"${key}" is already defined and was NOT overwritten`);
		} else {
			processEnv[key] = parsed[key];
			populated[key] = parsed[key];
		}
		return populated;
	}
	var DotenvModule = {
		configDotenv,
		_configVault,
		_parseVault,
		config,
		decrypt,
		parse,
		populate
	};
	module.exports.configDotenv = DotenvModule.configDotenv;
	module.exports._configVault = DotenvModule._configVault;
	module.exports._parseVault = DotenvModule._parseVault;
	module.exports.config = DotenvModule.config;
	module.exports.decrypt = DotenvModule.decrypt;
	module.exports.parse = DotenvModule.parse;
	module.exports.populate = DotenvModule.populate;
	module.exports = DotenvModule;
}));
//#endregion
//#region node_modules/dotenv/lib/env-options.js
var require_env_options = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var options = {};
	if (process.env.DOTENV_CONFIG_ENCODING != null) options.encoding = process.env.DOTENV_CONFIG_ENCODING;
	if (process.env.DOTENV_CONFIG_PATH != null) options.path = process.env.DOTENV_CONFIG_PATH;
	if (process.env.DOTENV_CONFIG_QUIET != null) options.quiet = process.env.DOTENV_CONFIG_QUIET;
	if (process.env.DOTENV_CONFIG_DEBUG != null) options.debug = process.env.DOTENV_CONFIG_DEBUG;
	if (process.env.DOTENV_CONFIG_OVERRIDE != null) options.override = process.env.DOTENV_CONFIG_OVERRIDE;
	if (process.env.DOTENV_CONFIG_DOTENV_KEY != null) options.DOTENV_KEY = process.env.DOTENV_CONFIG_DOTENV_KEY;
	module.exports = options;
}));
//#endregion
//#region node_modules/dotenv/lib/cli-options.js
var require_cli_options = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var re = /^dotenv_config_(encoding|path|quiet|debug|override|DOTENV_KEY)=(.+)$/;
	module.exports = function optionMatcher(args) {
		const options = args.reduce(function(acc, cur) {
			const matches = cur.match(re);
			if (matches) acc[matches[1]] = matches[2];
			return acc;
		}, {});
		if (!("quiet" in options)) options.quiet = "true";
		return options;
	};
}));
//#endregion
//#region node_modules/dotenv/config.js
(function() {
	require_main().config(Object.assign({}, require_env_options(), require_cli_options()(process.argv)));
})();
//#endregion
//#region electron/services/backendSync.ts
var currentScreen = "home";
async function startBackendSync(mainWindow, configPath, localConfigPath) {
	ipcMain.handle("app:route-changed", (event, routeName) => {
		currentScreen = routeName;
	});
	setInterval(() => sendHeartbeat(configPath, localConfigPath), 6e4);
	setInterval(() => pollNotifications(mainWindow, configPath, localConfigPath), 5e3);
	sendHeartbeat(configPath, localConfigPath);
	pollNotifications(mainWindow, configPath, localConfigPath);
}
async function getConfig(configPath, localConfigPath) {
	try {
		const defaultData = JSON.parse(await promises.readFile(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(await promises.readFile(localConfigPath, "utf-8"));
		} catch (e) {}
		return {
			...defaultData.services,
			...localData.services
		};
	} catch (e) {
		return {};
	}
}
async function sendHeartbeat(configPath, localConfigPath) {
	const services = await getConfig(configPath, localConfigPath);
	const url = services.device_heartbeat_url || "https://portal.co-bien.eu/pizarra/api/devices/heartbeat/";
	const apiKey = process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": apiKey
			},
			body: JSON.stringify({
				device_id: "CoBien6",
				screen: currentScreen,
				sent_at: (/* @__PURE__ */ new Date()).toISOString(),
				software_version: "Electron-v1.0"
			})
		});
		if (!res.ok) console.warn(`[HEARTBEAT] Failed with status: ${res.status}`);
		else console.log(`[HEARTBEAT] Sent (Screen: ${currentScreen})`);
	} catch (e) {
		console.error(`[HEARTBEAT] Network error`);
	}
}
async function pollNotifications(mainWindow, configPath, localConfigPath) {
	const services = await getConfig(configPath, localConfigPath);
	const url = services.device_poll_url || "https://portal.co-bien.eu/pizarra/api/device/poll/";
	const apiKey = process.env.NOTIFY_API_KEY || services.notify_api_key || "";
	try {
		const res = await fetch(`${url}?device_id=CoBien6`, {
			method: "GET",
			headers: { "X-API-KEY": apiKey }
		});
		if (res.ok) {
			const notifications = (await res.json()).notifications || [];
			if (notifications.length > 0) {
				console.log(`[POLL] Received ${notifications.length} notifications`);
				notifications.forEach((notif) => {
					mainWindow.webContents.send("backend:notification", notif);
				});
			}
		}
	} catch (e) {}
}
//#endregion
//#region electron/main.ts
var _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var mainWindow = null;
function getPiperConfig() {
	try {
		const configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
		const localPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.local.json");
		const defaultData = JSON.parse(fsSync.readFileSync(configPath, "utf-8"));
		let localData = {};
		try {
			localData = JSON.parse(fsSync.readFileSync(localPath, "utf-8"));
		} catch (e) {}
		const services = {
			...defaultData.services,
			...localData.services
		};
		const internalBin = join(_dirname, "../public/models/piper/bin/piper");
		const internalModel = join(_dirname, "../public/models/piper/es_ES-davefx-medium.onnx");
		return {
			bin: services.tts_piper_bin || internalBin,
			model: services.tts_piper_model_es_male || services.tts_piper_model_es || internalModel
		};
	} catch (e) {
		console.error("Error reading piper config:", e);
		return {
			bin: join(_dirname, "../public/models/piper/bin/piper"),
			model: join(_dirname, "../public/models/piper/es_ES-davefx-medium.onnx")
		};
	}
}
function setupIPC() {
	const configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
	ipcMain.handle("config:getWeather", async () => {
		try {
			const data = JSON.parse(await promises$1.readFile(configPath, "utf-8"));
			return {
				catalog: data.settings.weather_city_catalog || [],
				active: data.settings.weather_cities || [],
				primary: data.settings.weather_primary_city || ""
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
	ipcMain.handle("config:saveWeather", async (event, payload) => {
		try {
			const data = JSON.parse(await promises$1.readFile(configPath, "utf-8"));
			data.settings.weather_city_catalog = payload.catalog;
			data.settings.weather_cities = payload.active;
			data.settings.weather_primary_city = payload.primary;
			await promises$1.writeFile(configPath, JSON.stringify(data, null, 4));
			return true;
		} catch (e) {
			console.error("Error saving config:", e);
			return false;
		}
	});
	ipcMain.handle("tts:speak", async (event, text) => {
		const { bin, model } = getPiperConfig();
		if (!model) {
			console.error("TTS: No Piper model configured.");
			return null;
		}
		const tempWav = join(os.tmpdir(), `tts_${Date.now()}.wav`);
		return new Promise((resolve, reject) => {
			const child = execFile(bin, [
				"--model",
				model,
				"--output_file",
				tempWav
			], async (error, stdout, stderr) => {
				if (error) {
					console.error("Piper TTS error:", error, stderr);
					resolve(null);
					return;
				}
				try {
					const buffer = await promises$1.readFile(tempWav);
					await promises$1.unlink(tempWav);
					resolve(buffer);
				} catch (e) {
					console.error("Error reading temp wav:", e);
					resolve(null);
				}
			});
			child.stdin?.write(text);
			child.stdin?.end();
		});
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
	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		mainWindow.webContents.openDevTools();
	} else mainWindow.loadFile(join(_dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
	setupIPC();
	createWindow();
	if (mainWindow) {
		const configPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.default.json");
		const localPath = join(_dirname, "../../../cobien_FrontEnd/app/config/config.local.json");
		startBackendSync(mainWindow, configPath, localPath);
	}
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
