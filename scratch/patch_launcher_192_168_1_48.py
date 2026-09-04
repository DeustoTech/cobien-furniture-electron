import paramiko
import json
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('192.168.1.48', port=22, username='cobien', password='cobien', timeout=15)
    print("Connected!")

    # Modificamos los comandos para que usen un timeout de 2 segundos.
    # Así, si pipewire-pulse está bloqueado, pactl terminará y no congelará el launcher.
    patch_data = {
        "replacements": [
            {
                "search": 'usb_card="$( (pactl list short cards 2>/dev/null || true) | awk \'tolower($0) ~ /usb/ {print $2; exit}\')"',
                "replace": 'usb_card="$( (timeout 2 pactl list short cards 2>/dev/null || true) | awk \'tolower($0) ~ /usb/ {print $2; exit}\')"'
            },
            {
                "search": 'hda_source="$( (pactl list short sources 2>/dev/null || true) | awk \'tolower($0) ~ /hda|pci/ && tolower($0) ~ /input/ {print $2; exit}\')"',
                "replace": 'hda_source="$( (timeout 2 pactl list short sources 2>/dev/null || true) | awk \'tolower($0) ~ /hda|pci/ && tolower($0) ~ /input/ {print $2; exit}\')"'
            },
            {
                "search": 'fallback_source="$( (pactl list short sources 2>/dev/null || true) | awk \'tolower($0) ~ /input/ && tolower($0) !~ /usb/ {print $2; exit}\')"',
                "replace": 'fallback_source="$( (timeout 2 pactl list short sources 2>/dev/null || true) | awk \'tolower($0) ~ /input/ && tolower($0) !~ /usb/ {print $2; exit}\')"'
            }
        ]
    }

    # Escribimos los reemplazos
    stdin, stdout, stderr = client.exec_command("cat << 'EOF' > /tmp/patches.json\n" + json.dumps(patch_data, indent=4) + "\nEOF\n")
    stdout.read()

    # Parcheamos el script
    python_patch_script = """
import json
filepath = "/home/cobien/cobien/cobien-furniture-app-launcher/cobien-launcher.sh"
with open("/tmp/patches.json", "r", encoding="utf-8") as f:
    patch_data = json.load(f)

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

for item in patch_data["replacements"]:
    search_str = item["search"]
    replace_str = item["replace"]
    if search_str in content:
        content = content.replace(search_str, replace_str)
        print(f"Replaced with timeout: {search_str[:30]}...")
    else:
        print(f"Not found: {search_str[:30]}...")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
"""

    stdin, stdout, stderr = client.exec_command("cat << 'EOF' > /tmp/patch_launcher.py\n" + python_patch_script + "\nEOF\n")
    stdout.read()

    stdin, stdout, stderr = client.exec_command("python3 /tmp/patch_launcher.py")
    out = stdout.read().decode('utf-8').strip()
    if out:
         sys.stdout.buffer.write((out + "\n").encode('utf-8'))
    sys.stdout.buffer.flush()

    # Reiniciamos el servicio y comprobamos
    commands = [
        'systemctl --user restart cobien-launcher.service',
        'sleep 12',
        'systemctl --user status cobien-launcher.service | head -15',
        'ps -ef | grep -i cobien | grep -E "electron|node|vite" | grep -v grep || echo "Still no processes"'
    ]

    for cmd in commands:
        sys.stdout.buffer.write(f"\n>>> {cmd}\n".encode('utf-8'))
        sys.stdout.buffer.flush()
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        if out:
            sys.stdout.buffer.write((out + "\n").encode('utf-8'))
        sys.stdout.buffer.flush()

except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
