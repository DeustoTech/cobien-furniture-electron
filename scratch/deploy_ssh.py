import paramiko, sys

def get_info(port, name):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('127.0.0.1', port=port, username='cobien', password='cobien', timeout=15)
    cmds = [
        'hostname',
        'nmcli -t -f NAME,TYPE,DEVICE,STATE connection show --active',
        'nmcli dev show 2>/dev/null | grep -E "DEVICE|TYPE|STATE|IP4.ADDRESS|IP4.GATEWAY|IP4.DNS|GENERAL.CONNECTION"',
        'resolvectl status 2>/dev/null | grep -E "DNS Server|Current DNS|Fallback"',
        'ip route show default',
        'cat /etc/systemd/resolved.conf 2>/dev/null | grep -v "^#" | grep -v "^$"',
        'ping -c3 -W2 8.8.8.8 2>&1 | tail -2',
        'ping -c3 -W2 1.1.1.1 2>&1 | tail -2',
        'curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s" --max-time 5 https://portal.co-bien.eu 2>&1',
    ]
    header = f"\n{'='*60}\n  {name} (port {port})\n{'='*60}\n"
    sys.stdout.buffer.write(header.encode())
    for cmd in cmds:
        sys.stdout.buffer.write(f"\n>>> {cmd}\n".encode())
        sys.stdout.buffer.flush()
        stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if out: sys.stdout.buffer.write((out + "\n").encode())
        sys.stdout.buffer.flush()
    client.close()

get_info(2221, 'COBIEN1')
get_info(2222, 'COBIEN2')
