import paramiko
import sys
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('192.168.1.48', port=22, username='cobien', password='cobien', timeout=15)
    print("Connected!")

    # 1. Reemplazamos la ruta del EnvironmentFile en el servicio systemd
    # 2. Hacemos systemctl --user daemon-reload
    # 3. Reiniciamos el launcher
    # 4. Esperamos 5 segundos y revisamos si hay procesos de Electron/Node y el estado de systemd
    commands = [
        'sed -i "s|EnvironmentFile=-/home/cobien/cobien/cobien-furniture-app-launcher/cobien.env|EnvironmentFile=-/home/cobien/cobien.env|g" /home/cobien/.config/systemd/user/cobien-launcher.service',
        'systemctl --user daemon-reload',
        'systemctl --user restart cobien-launcher.service',
        'sleep 5',
        'systemctl --user status cobien-launcher.service | head -15',
        'ps -ef | grep -i cobien | grep -E "electron|node" | grep -v grep || echo "Still no electron/node processes!"'
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
