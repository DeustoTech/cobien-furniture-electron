import paramiko
import sys
import time

PROJECT = '/home/cobien/cobien/cobien-furniture-electron'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to 192.168.1.48...")
    client.connect('192.168.1.48', port=22, username='cobien', password='cobien', timeout=15)
    print("Connected!")

    commands = [
        f'cd {PROJECT} && git pull --ff-only 2>&1',
        f'cd {PROJECT} && npm run build 2>&1 | tail -25',
        'systemctl --user restart cobien-launcher.service 2>&1',
        'sleep 3',
        'systemctl --user status cobien-launcher.service 2>&1 | head -15',
        'ps aux | grep -i electron | grep -v grep || echo "No electron processes active!"'
    ]

    for cmd in commands:
        sys.stdout.buffer.write(f"\n>>> {cmd}\n".encode('utf-8'))
        sys.stdout.buffer.flush()
        stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
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
