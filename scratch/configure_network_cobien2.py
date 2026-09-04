import paramiko
import sys
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('127.0.0.1', port=2222, username='cobien', password='cobien', timeout=15)
    
    # 1. Comprobamos si ya existe una conexión guardada con el nombre "cobien" para no duplicarla
    stdin, stdout, stderr = client.exec_command('nmcli connection show "cobien"')
    exists = stdout.channel.recv_exit_status() == 0
    
    commands = []
    if exists:
        sys.stdout.buffer.write(b"Conexion 'cobien' ya existente, actualizando clave y parametros...\n")
        commands.append('sudo nmcli connection modify "cobien" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "Cobien2026"')
    else:
        sys.stdout.buffer.write(b"Creando nueva conexion 'cobien'...\n")
        # Creamos el perfil de conexión inalámbrica sin necesitar estar al alcance en este preciso instante
        commands.append(
            'sudo nmcli connection add type wifi con-name "cobien" ssid "cobien" -- '
            'wifi-sec.key-mgmt wpa-psk wifi-sec.psk "Cobien2026"'
        )
    
    # Aseguramos que autoconecte cuando esté en rango
    commands.append('sudo nmcli connection modify "cobien" connection.autoconnect yes')
    
    # Ejecutamos con privilegios usando sudo PTY
    for cmd in commands:
        sys.stdout.buffer.write(f"\n>>> {cmd}\n".encode('utf-8'))
        stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=30)
        time.sleep(0.5)
        stdin.write('cobien\n')
        stdin.flush()
        
        out = stdout.read().decode('utf-8', errors='replace').strip()
        lines = [l for l in out.split('\n') if 'password' not in l.lower() and 'cobien' not in l]
        clean_out = '\n'.join(lines).strip()
        if clean_out:
            sys.stdout.buffer.write((clean_out + "\n").encode('utf-8'))
        sys.stdout.buffer.flush()

    # Intentamos levantarla (si por algún motivo el SSID vuelve a estar disponible de fondo)
    sys.stdout.buffer.write(b"\n>>> Intentando activar conexion 'cobien'...\n")
    client.exec_command('nmcli connection up "cobien"')

except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
