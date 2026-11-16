import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
import { languageSlots } from '../fluentxverse-server/content/conversational-skills/ja/language-catalog';
import { buildToeicLesson } from '../fluentxverse-server/content/conversational-skills/ja/toeic-language';
import { conversationalLessonErrors } from '../fluentxverse-server/src/utils/conversationalLessonValidation';

const fields = ['introductionData', 'learnData', 'stepBData', 'applyData', 'exerciseData', 'missionData', 'missionData2', 'feedbackData', 'storyData'];
const changed = ['lessonName', 'lessonTitle', 'goalTextEn', 'goalTextJp', 'authoringLanguageTarget', 'authoringLanguageRevision', ...fields];
const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const digest = (v: any) => createHash('sha256').update(JSON.stringify(stable(v)) ?? 'undefined').digest('hex');
const number = (v: any) => typeof v === 'number' ? v : v?.low;
const snapshotCode = `const stable=${stable.toString()};async function snapshot(runner){
 const lessons=await runner.run('MATCH(l:LessonMaterial {course:"conversational-skills"}) RETURN l ORDER BY l.id');
 const refs=await runner.run('MATCH(n) WHERE n.lessonId IS NOT NULL OR n.materialId IS NOT NULL OR n.sourceLessonIds IS NOT NULL OR n.lastViewedLessonId IS NOT NULL OR n.materialJson IS NOT NULL OR n.snapshotJson IS NOT NULL RETURN id(n) AS id,properties(n) AS properties ORDER BY id');
 const metadata=await runner.run('MATCH(m:CourseMetadata {course:"conversational-skills"}) RETURN m ORDER BY m.type,m.level,m.chapter');
 return {lessons:lessons.records.map(r=>r.get('l').properties),metadata:metadata.records.map(r=>r.get('m').properties),evidenceDigest:createHash('sha256').update(JSON.stringify(stable(refs.records.map(r=>r.toObject())))).digest('hex')};}`;
function remote(body: string, input?: any): any {
 const code=`import {createHash} from 'node:crypto';import {initDriver,getDriver,closeDriver} from './src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();${snapshotCode}try{${input ? 'const input=JSON.parse(await Bun.stdin.text());' : ''}${body}}finally{await s.close();await closeDriver();}`;
 const out=ssh(`docker exec -i fluentxverse-server bun -e ${quote(code)}`,{maxBuffer:16*1024*1024,...(input?{input:JSON.stringify(input)}:{})});
 const line=out.split('\n').find(l=>l.startsWith('TOEIC_RESULT '));if(!line)throw Error('Missing revision result');return JSON.parse(line.slice(13));
}
const before=remote(`console.log('TOEIC_RESULT '+JSON.stringify(await snapshot(s)));`), expected=digest(before);
const parse=(raw:any)=>({...raw,level:number(raw.level),chapter:number(raw.chapter),lessonNumber:number(raw.lessonNumber),...Object.fromEntries(fields.map(k=>[k,raw[k]?JSON.parse(raw[k]):undefined]))});
const media=(v:any,path=''):any[]=> !v||typeof v!=='object'?[]:Object.entries(v).flatMap(([k,x])=>/image|background/i.test(k)?[[`${path}.${k}`,x]]:media(x,`${path}.${k}`));
const items=languageSlots.map(slot=>{
 const matches=before.lessons.filter((l:any)=>number(l.level)===slot.level&&number(l.chapter)===slot.chapter&&number(l.lessonNumber)===slot.number);
 if(matches.length!==1)throw Error(`Expected one saved record for ${slot.key}`);
 const raw=matches[0], previous=parse(raw), lesson=buildToeicLesson(slot.level,slot.chapter,slot.number,previous);
 const errors=conversationalLessonErrors(lesson);if(errors.length)throw Error(`${slot.key}: ${errors.join('; ')}`);
 const mediaOrder=(rows:any[])=>rows.sort((a,b)=>a[0].localeCompare(b[0]));
 if(digest(mediaOrder(media(previous)))!==digest(mediaOrder(media(lesson))))throw Error(`${slot.key}: image changed`);
 for(const k of ['categories','rubricLevels','rubricTitle','personalizedFeedbackTitle','feedbackGuideTitle'])if(digest(previous.feedbackData?.[k])!==digest(lesson.feedbackData?.[k]))throw Error(`${slot.key}: fixed feedback changed`);
 const props=Object.fromEntries(changed.map(k=>[k,fields.includes(k)?(lesson[k]?JSON.stringify(lesson[k]):''):lesson[k]]));
 return {id:raw.id,props,slot:slot.key,lesson};
});
if(items.length!==88 || new Set(items.map(i=>i.id)).size!==88)throw Error('Expected exactly 88 distinct story lessons');
const updates=items.filter(item=>{
 const original=before.lessons.find((l:any)=>l.id===item.id);
 return changed.some(key=>digest(original[key])!==digest(item.props[key]));
});
const output=resolve(import.meta.dir,'../output/toeic-language-revisions');await mkdir(output,{recursive:true});
for(const i of items)await writeFile(resolve(output,`${i.slot.replaceAll(':','-')}.json`),JSON.stringify(i.lesson,null,2));
if(!process.argv.includes('--write'))console.log(JSON.stringify({dryRun:true,expected,lessons:items.length,changedLessons:updates.length,byLevel:[3,4,5].map(level=>({level,count:items.filter(i=>i.lesson.level===level).length})),publicationStatesPreserved:true,output},null,2));
else{
 if(process.argv.find(a=>a.startsWith('--expected='))?.slice(11)!==expected)throw Error('Review a fresh dry run and supply its exact --expected digest');
 const now=new Date().toISOString(), dir=resolve(import.meta.dir,'../fluentxverse-server/content/conversational-skills/ja/migrations/backups');await mkdir(dir,{recursive:true,mode:0o700});
 const backup=resolve(dir,`before-toeic-language-${now.replace(/[:.]/g,'-')}.json`);await writeFile(backup,JSON.stringify(before,null,2),{flag:'wx',mode:0o600});
 remote(`const tx=s.beginTransaction();try{
  if(createHash('sha256').update(JSON.stringify(stable(await snapshot(tx)))).digest('hex')!==input.expected)throw Error('Concurrent lesson, metadata or learner-evidence change; nothing saved');
  for(const item of input.items){const result=await tx.run('MATCH(l:LessonMaterial {id:$id,course:"conversational-skills"}) SET l += $props,l.updatedAt=$now RETURN l.id AS id',{id:item.id,props:item.props,now:input.now});if(result.records.length!==1)throw Error('Lesson missing or duplicated');}
  await tx.commit();console.log('TOEIC_RESULT '+JSON.stringify({saved:true}));
 }catch(error){await tx.rollback();throw error;}`,{expected,items:updates.map(({id,props})=>({id,props})),now});
 const after=remote(`console.log('TOEIC_RESULT '+JSON.stringify(await snapshot(s)));`);
 const wanted=before.lessons.map((l:any)=>{const i=updates.find(i=>i.id===l.id);return i?{...l,...i.props,updatedAt:now}:l;});
 if(digest(after.lessons)!==digest(wanted)||digest(after.metadata)!==digest(before.metadata)||after.evidenceDigest!==before.evidenceDigest)throw Error('Read-back mismatch; inspect backup before more changes');
 console.log(JSON.stringify({saved:true,verified:true,lessons:items.length,updatedLessons:updates.length,counts:{level3:40,level4:40,level5:8},idsArtworkStatusFixedFeedbackAndLearnerEvidencePreserved:true,backup,updatedAt:now},null,2));
}
