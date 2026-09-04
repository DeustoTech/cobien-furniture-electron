import paramiko
import sys
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to 192.168.1.48...")
    client.connect('192.168.1.48', port=22, username='cobien', password='cobien', timeout=15)
    print("Connected!")

    # 1. Update the local git repo of launcher on the remote machine
    commands = [
        'cd /home/cobien/cobien/cobien-furniture-app-launcher && git fetch origin && git reset --hard origin/master',
    ]

    for cmd in commands:
        print(f"\n>>> {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if out:
            print(out)
        if err:
            print("ERR:", err)

    # 2. Run the installer (commented out for fast service restart check)
    # install_cmd = 'sudo COBIEN_ALLOW_SYSTEM_PROVISIONING=yes COBIEN_NON_INTERACTIVE=1 COBIEN_AUTO_CONFIRM=1 COBIEN_AUTO_REBOOT_AFTER_SETUP=0 bash /home/cobien/cobien/cobien-furniture-app-launcher/setup-cobien-furniture-environment.sh'
    # print(f"\n>>> {install_cmd}")
    # stdin, stdout, stderr = client.exec_command(install_cmd, get_pty=True)
    
    # # Wait a bit for the sudo password prompt and write the password
    # time.sleep(1)
    # stdin.write('cobien\n')
    # stdin.flush()

    # # Read output line by line as it prints so we can see installation progress
    # while not stdout.channel.exit_status_ready():
    #     if stdout.channel.recv_ready():
    #         raw = stdout.channel.recv(1024)
    #         sys.stdout.buffer.write(raw)
    #         sys.stdout.buffer.flush()
    #     time.sleep(0.1)
        
    # # Read remaining
    # raw = stdout.read()
    # sys.stdout.buffer.write(raw)
    # sys.stdout.buffer.flush()

    # 3. Start service and check status
    print("\nStarting launcher service...")
    client.exec_command('systemctl --user start cobien-launcher.service')
    print("Waiting 12s for initialization...")
    time.sleep(12)
    
    verify_cmd = 'systemctl --user status cobien-launcher.service | head -30'
    print(f"\n>>> {verify_cmd}")
    stdin, stdout, stderr = client.exec_command(verify_cmd)
    sys.stdout.buffer.write(stdout.read())
    sys.stdout.buffer.flush()

    proc_cmd = 'ps -ef | grep -i cobien | grep -E "electron|node|vite" | grep -v grep || echo "No active processes"'
    print(f"\n>>> {proc_cmd}")
    stdin, stdout, stderr = client.exec_command(proc_cmd)
    sys.stdout.buffer.write(stdout.read())
    sys.stdout.buffer.flush()

except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
