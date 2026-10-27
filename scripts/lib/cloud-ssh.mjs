import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';

export const cloudHost = '185.184.223.23';
export const sshOptions = ['-i', join(homedir(), '.ssh/fluentxverse-cloud/id_deploy'), '-o', 'IdentitiesOnly=yes',
  '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${join(homedir(), '.ssh/fluentxverse-cloud/known_hosts')}`,
  '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];
const transportPath = join(homedir(), '.ssh/fluentxverse-cloud/transport.json');
if (existsSync(transportPath)) {
  const transport = JSON.parse(readFileSync(transportPath, 'utf8'));
  if ((statSync(transportPath).mode & 0o077) !== 0 || transport.mode !== 'wireguard' || transport.host !== '10.78.24.1' || transport.hostKeyAlias !== cloudHost) throw Error('Invalid private cloud SSH transport configuration.');
  sshOptions.push('-o', `Hostname=${transport.host}`, '-o', `HostKeyAlias=${cloudHost}`);
}
export const cloudTarget = `fluentxverse-deploy@${cloudHost}`;
export const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
export const ssh = (command, options = {}) => execFileSync('ssh', [...sshOptions, cloudTarget, command],
  { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
