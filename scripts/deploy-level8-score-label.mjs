import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ssh, quote, cloudHost, sshOptions } from './lib/cloud-ssh.mjs';

// A badge-only overlay of the running image; no local application source tree is deployed.
const directory = resolve('output/release/level8-score-label-20261115');
const stage = '/opt/fluentxverse/releases/level8-score-label-20261115';
const image = 'fluentxverse-cloud/api:level8-score-label-20261115';
const baseTag = 'fluentxverse-cloud/api:level8-score-label-baseline-20261115';
const path = '/app/src/services/lessonMaterial.service.ts';
const hash = value => createHash('sha256').update(value).digest('hex');
const rootSSH = (command, options = {}) => execFileSync('ssh', [...sshOptions, `root@${cloudHost}`, command], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
const save = (name, data) => writeFileSync(resolve(directory, name), JSON.stringify(data, null, 2), { mode: 0o600 });
const inspect = () => JSON.parse(ssh(`docker inspect fluentxverse-server --format ${quote('{"image":{{json .Image}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},"config":{{json (index .Config.Labels "com.docker.compose.project.config_files")}}}')}`));
const compose = info => `docker compose --project-name ${quote(info.project)} ${info.config.split(',').map(p => '-f ' + quote(p)).join(' ')}`;
const configurationHash = info => hash(rootSSH(`sha256sum ${info.config.split(',').map(quote).join(' ')}`));
const activeCheck = `import {db,closePool} from './src/db/postgres'; try {const r=await db\`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\`;if(r[0].n)throw Error('Active classroom connections; defer badge release');console.log(JSON.stringify({activeConnections:r[0].n}));}finally{await closePool();}`;
const badgeCheck = `import {getLevelBadge} from './src/services/lessonMaterial.service';if(getLevelBadge(8,'conversational-skills')!=='TOEIC 785–940'||getLevelBadge(8,'business-english')!=='INTERMEDIATE'||getLevelBadge(7,'conversational-skills')!=='INTERMEDIATE')throw Error('Badge regression');console.log(JSON.stringify({level8:getLevelBadge(8,'conversational-skills'),otherCoursesUnchanged:true}));`;

if (process.argv.includes('--prepare')) {
  mkdirSync(directory, { recursive: true });
  const info = inspect();
  const configHash = configurationHash(info);
  if (!info.project || info.service !== 'api' || !info.config) throw Error('Unexpected compose identity');
  if (ssh('docker diff fluentxverse-server').split('\n').some(l => / \/app\//.test(l))) throw Error('Writable app changes require separate review');
  const before = ssh(`docker exec fluentxverse-server cat ${quote(path)}`);
  let after = before;
  const changes = [
    ["| 'HIGH INTERMEDIATE';", "| 'HIGH INTERMEDIATE' | 'TOEIC 785–940';"],
    ['export function getLevelBadge(level: number): LevelBadge {', "export function getLevelBadge(level: number, course?: string): LevelBadge {\n  if (course === 'conversational-skills' && level === 8) return 'TOEIC 785–940';"],
    ['levelBadge: getLevelBadge(neo4j.isInt(props.level) ? props.level.toNumber() : props.level),', 'levelBadge: getLevelBadge(neo4j.isInt(props.level) ? props.level.toNumber() : props.level, props.course),'],
  ];
  for (const [from, to] of changes) {
    if (after.split(from).length !== 2) throw Error('Badge patch anchor changed');
    after = after.replace(from, to);
  }
  new Bun.Transpiler({ loader: 'ts' }).transformSync(after);
  const extract = source => new Function(new Bun.Transpiler({ loader: 'ts' }).transformSync(source.match(/export function getLevelBadge[\s\S]*?\n}/)[0].replace('export ', '')) + ';return getLevelBadge;')();
  const oldBadge = extract(before), newBadge = extract(after);
  for (let level = 1; level <= 10; level++) for (const course of [undefined, 'conversational-skills', 'business-english', 'workplace-communication', 'daily-dispatch']) {
    const expected = course === 'conversational-skills' && level === 8 ? 'TOEIC 785–940' : oldBadge(level, course);
    if (newBadge(level, course) !== expected) throw Error('Unexpected badge change');
  }
  writeFileSync(resolve(directory, 'before.ts'), before, { mode: 0o600 });
  writeFileSync(resolve(directory, 'after.ts'), after, { mode: 0o600 });
  ssh(`docker image tag ${quote(info.image)} ${quote(baseTag)}`);
  const dockerfile = `FROM ${baseTag}\nCOPY lessonMaterial.service.ts ${path}\n`;
  ssh(`mkdir -p ${quote(stage)}`);
  // Source is passed as data through stdin, never interpolated into shell code.
  const hostCode = `import json,sys,pathlib;p=json.load(sys.stdin);d=pathlib.Path(${JSON.stringify(stage)});f=d/'lessonMaterial.service.ts';assert not f.exists() or f.read_text()==p['after'],'Staged source changed';f.write_text(p['after']);(d/'Dockerfile').write_text(p['dockerfile']);(d/'override.json').write_text(json.dumps({'services':{'api':{'image':p['image']}}}))`;
  ssh(`python3 -c ${quote(hostCode)}`, { input: JSON.stringify({ after, dockerfile, image }) });
  console.log(ssh(`docker build --network=none --pull=false -t ${quote(image)} ${quote(stage)}`, { timeout: 120000 }));
  console.log(ssh(`docker run --rm --network none -e NODE_ENV=test --entrypoint bun ${quote(image)} -e ${quote(badgeCheck)}`));
  const candidateImage = JSON.parse(ssh(`docker image inspect ${quote(image)} --format '{{json .Id}}'`));
  save('manifest.json', { baseline: info, configHash, candidateImage, beforeHash: hash(before), afterHash: hash(after), image, stage, verified: true });
  console.log('Prepared and tested badge-only image.');
} else if (process.argv.includes('--deploy')) {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
  const actual = inspect();
  if (JSON.stringify(actual) !== JSON.stringify(manifest.baseline)) throw Error('Live image or compose identity changed');
  if (configurationHash(actual) !== manifest.configHash) throw Error('Compose file content changed');
  if (JSON.parse(ssh(`docker image inspect ${quote(image)} --format '{{json .Id}}'`)) !== manifest.candidateImage) throw Error('Prepared image tag changed');
  if (hash(ssh(`docker exec fluentxverse-server cat ${quote(path)}`)) !== manifest.beforeHash) throw Error('Live badge source changed');
  const after = readFileSync(resolve(directory, 'after.ts'), 'utf8');
  if (hash(after) !== manifest.afterHash || !manifest.verified) throw Error('Prepared source changed');
  console.log(ssh(`docker exec -i fluentxverse-server bun -e ${quote(activeCheck)}`));
  try {
    console.log(rootSSH(`${compose(actual)} -f ${quote(stage + '/override.json')} up -d --no-deps --wait --wait-timeout 60 api`, { timeout: 90000 }));
    console.log(ssh(`docker exec -i fluentxverse-server bun -e ${quote(badgeCheck)}`));
    if (hash(ssh(`docker exec fluentxverse-server cat ${quote(path)}`)) !== manifest.afterHash) throw Error('Live badge source mismatch');
    save('deployment.json', { verified: true, at: new Date().toISOString(), image, level8: 'TOEIC 785–940', lessonPublicationChanged: false });
  } catch (error) {
    console.log(rootSSH(`${compose(actual)} up -d --no-deps --wait --wait-timeout 60 api`, { timeout: 90000 }));
    throw error;
  }
} else throw Error('Use --prepare or --deploy');
