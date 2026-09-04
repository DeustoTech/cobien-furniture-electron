import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to 192.168.1.48...")
    client.connect('192.168.1.48', port=22, username='cobien', password='cobien', timeout=15)
    print("Connected!")

    # 1. Update the environment file path in systemd service if needed
    service_path = "/home/cobien/.config/systemd/user/cobien-launcher.service"
    print("Fixing EnvironmentFile in systemd service file...")
    cmd_systemd = f'sed -i "s|EnvironmentFile=-/home/cobien/cobien/cobien-furniture-app-launcher/cobien.env|EnvironmentFile=-/home/cobien/cobien.env|g" {service_path}'
    stdin, stdout, stderr = client.exec_command(cmd_systemd)
    stdout.read()
    
    # 2. Patch the launcher script using SFTP directly (local modification)
    launcher_path = "/home/cobien/cobien/cobien-furniture-app-launcher/cobien-launcher.sh"
    print("Patching launcher script via SFTP...")
    
    sftp = client.open_sftp()
    
    # Read remote file
    with sftp.open(launcher_path, 'rb') as f:
        content_bytes = f.read()
    
    content = content_bytes.decode('utf-8', errors='replace')
    
    replacements = [
        (
            'usb_card="$(pactl list short cards 2>/dev/null | awk \'tolower($0) ~ /usb/ {print $2; exit}\')"',
            'usb_card="$( (timeout 2 pactl list short cards 2>/dev/null || true) | awk \'tolower($0) ~ /usb/ {print $2; exit}\')"'
        ),
        (
            'hda_source="$(pactl list short sources 2>/dev/null | awk \'tolower($0) ~ /hda|pci/ && tolower($0) ~ /input/ {print $2; exit}\')"',
            'hda_source="$( (timeout 2 pactl list short sources 2>/dev/null || true) | awk \'tolower($0) ~ /hda|pci/ && tolower($0) ~ /input/ {print $2; exit}\')"'
        ),
        (
            'fallback_source="$(pactl list short sources 2>/dev/null | awk \'tolower($0) ~ /input/ && tolower($0) !~ /usb/ {print $2; exit}\')"',
            'fallback_source="$( (timeout 2 pactl list short sources 2>/dev/null || true) | awk \'tolower($0) ~ /input/ && tolower($0) !~ /usb/ {print $2; exit}\')"'
        )
    ]
    
    modified = False
    for src, dst in replacements:
        if src in content:
            content = content.replace(src, dst)
            print(f"Successfully replaced: {src[:40]}...")
            modified = True
        elif dst in content:
            print(f"Already replaced: {dst[:40]}...")
        else:
            print(f"Warning: Could not find pattern: {src[:40]}...")
            
    if modified:
        # Write modified content back
        with sftp.open(launcher_path, 'wb') as f:
            f.write(content.encode('utf-8'))
        print("Launcher patched successfully.")
    else:
        print("No changes made to launcher script.")
        
    sftp.close()

    # 3. Reload systemd, restart service, and verify
    print("Reloading systemd, restarting service and verifying status...")
    commands = [
        'systemctl --user daemon-reload',
        'systemctl --user restart cobien-launcher.service',
        'sleep 10',
        'systemctl --user status cobien-launcher.service | head -25',
        'ps -ef | grep -i cobien | grep -E "electron|node|vite" | grep -v grep || echo "No active Electron/Node/Vite processes"'
    ]

    for cmd in commands:
        sys.stdout.buffer.write(f"\n>>> {cmd}\n".encode('utf-8'))
        sys.stdout.buffer.flush()
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if out:
            sys.stdout.buffer.write((out + "\n").encode('utf-8'))
        if err:
            sys.stdout.buffer.write(("ERR: " + err + "\n").encode('utf-8'))
        sys.stdout.buffer.flush()

except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
