import { BrowserWindow, app, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import * as fsSync from "node:fs";
import { promises } from "node:fs";
import * as os from "node:os";
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
			const data = JSON.parse(await promises.readFile(configPath, "utf-8"));
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
			const data = JSON.parse(await promises.readFile(configPath, "utf-8"));
			data.settings.weather_city_catalog = payload.catalog;
			data.settings.weather_cities = payload.active;
			data.settings.weather_primary_city = payload.primary;
			await promises.writeFile(configPath, JSON.stringify(data, null, 4));
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
					const buffer = await promises.readFile(tempWav);
					await promises.unlink(tempWav);
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
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
