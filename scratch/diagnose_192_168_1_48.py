import paramiko
import sys
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('192.168.1.48', port=22, username='cobien', password='cobien', timeout=15)
    
    # 1. Damos un margen de 15 segundos adicionales para la inicialización
    time.sleep(15)
    
    commands = [
        'journalctl --user -u cobien-launcher.service -n 50 --no-pager',
        'ps -ef | grep -i cobien | grep -E "electron|node|vite" | grep -v grep || echo "Still no processes active"'
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
