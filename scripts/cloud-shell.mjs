import { spawn } from 'node:child_process';
import { cloudHost, sshOptions } from './lib/cloud-ssh.mjs';

const root=process.argv[2]==='--root';
const command=process.argv.slice(root?3:2);
const child=spawn('ssh',[...sshOptions,`${root?'root':'fluentxverse-deploy'}@${cloudHost}`,...command],{stdio:'inherit'});
child.on('error',()=>{process.stderr.write('Private cloud SSH could not start.\n');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
