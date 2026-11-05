import {execFileSync} from 'node:child_process';
import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
const remote='/opt/fluentxverse/releases/attendance-recovery-20261103',image='fluentxverse-cloud/api:attendance-recovery-grid-20261103',previous='fluentxverse-cloud/api:attendance-recovery-20261103';
root(`tar -xzf - -C ${remote}/api`,{input:execFileSync('tar',['-czf','-','-C','output/release/attendance-recovery-20261103/api','src/services/schedule.services/schedule.service.ts'])});
console.log(root(`docker build --network none -t ${image} ${remote}/api`));
console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/check.js`));
const py=`import json,subprocess\nfrom pathlib import Path\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!='${previous}':raise RuntimeError('API changed')\nfiles=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',');project=c['Config']['Labels']['com.docker.compose.project']\nargs=['docker','compose','-p',project]+[s for f in files for s in ['-f',f]]\np=Path('${remote}/grid.json');p.write_text(json.dumps({'services':{'api':{'image':'${image}'}}}))\ntry:subprocess.run(args+['-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True);raise\nprint('Grid correction deployed; existing configuration preserved')`;
console.log(root('python3 -c '+quote(py),{timeout:180000}));
