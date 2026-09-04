import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('192.168.1.48', port=22, username='cobien', password='cobien', timeout=15)
    
    # Compare cobien.env files
    cmd = "ls -la /home/cobien/cobien.env /home/cobien/cobien/cobien-furniture-app-launcher/cobien.env 2>&1"
    print(f">>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    sys.stdout.buffer.write(stdout.read())
    sys.stdout.buffer.flush()
    
except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
