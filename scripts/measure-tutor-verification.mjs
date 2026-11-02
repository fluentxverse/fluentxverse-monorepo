import {ssh,quote} from './lib/cloud-ssh.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
if(!process.argv.includes('--send'))throw Error('Explicit --send required; one message to the authorized recipient');
const code=`
import{initDriver,getDriver,closeDriver}from './src/db/memgraph';
import{TutorEmailService,tutorConfirmationURL}from './src/services/auth.services/tutorEmail.service';
import{mailConfigs}from './src/services/mail/mailConfig';
import{sendTutorConfirmationMail}from './src/services/mail/mailProvider';
await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);
const s=getDriver().session();
try{
 const id='hd20u2EfF3mD',email='decentragri@gmail.com';
 const r=await s.run('MATCH(u:User {id:$id}) WHERE toLower(u.email)=$email RETURN u.id AS id',{id,email});
 if(r.records.length!==1)throw Error('Exact tutor match required');
 const account=mailConfigs().find(a=>a.address.toLowerCase()==='tutor@fluentxverse.com');if(!account)throw Error('Sender unavailable');
 const measurements={startedAt:new Date().toISOString()};
 const service=new TutorEmailService(async(recipient,token)=>{
  if(recipient!==email)throw Error('Recipient mismatch');
  const start=performance.now();measurements.smtpStartedAt=new Date().toISOString();
  const result=await sendTutorConfirmationMail(account,recipient,tutorConfirmationURL(token));
  measurements.smtpAcceptedAt=new Date().toISOString();measurements.smtpMs=Math.round(performance.now()-start);
  measurements.messageId=result.messageId;return result.messageId;
 });
 const start=performance.now(),result=await service.send(id);
 if(!result.sent)throw Error('No message sent; account may already be verified');
 console.log(JSON.stringify({...measurements,totalMs:Math.round(performance.now()-start),sent:true,recipient:email}));
}finally{await s.close();await closeDriver();}
`;
const result=ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(code));
console.log(result);
const directory=new URL('../output/verification/mail-performance/',import.meta.url);mkdirSync(directory,{recursive:true});
writeFileSync(new URL('confirmation-timing.json',directory),result,{mode:0o600});
