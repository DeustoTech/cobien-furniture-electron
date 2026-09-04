import paramiko, sys

def check_status(port, name):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('127.0.0.1', port=port, username='cobien', password='cobien', timeout=15)
    
    cmds = [
        'hostname',
        'nmcli -t -f NAME,TYPE,DEVICE,STATE connection show --active',
        'nmcli connection show "cobien" | grep -E "connection.autoconnect:|wifi-sec.key-mgmt:|wifi-sec.psk:"',
        'nmcli dev show 2>/dev/null | grep -E "DEVICE|TYPE|STATE|IP4.ADDRESS|IP4.GATEWAY|IP4.DNS|GENERAL.CONNECTION"',
        'resolvectl status 2>/dev/null | grep -E "DNS Server|Current DNS|Fallback"'
    ]
    
    sys.stdout.buffer.write(f"\n{'='*60}\n  VERIFICACION: {name} (port {port})\n{'='*60}\n".encode('utf-8'))
    for cmd in cmds:
        sys.stdout.buffer.write(f"\n>>> {cmd}\n".encode('utf-8'))
        stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        if out:
            sys.stdout.buffer.write((out + "\n").encode('utf-8'))
        sys.stdout.buffer.flush()
    client.close()

check_status(2221, 'COBIEN1')
check_status(2222, 'COBIEN2')
