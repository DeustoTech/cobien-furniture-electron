import sounddevice as sd
import json

try:
    devices = sd.query_devices()
    print(json.dumps(devices, default=str, indent=2))
    print("\nDefault input device index:", sd.default.device[0])
except Exception as e:
    print(f"Error: {e}")
