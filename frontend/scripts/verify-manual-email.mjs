// Browser smoke test with synthetic API responses. No requests reach a real backend.
import { chromium,expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const origin='http://127.0.0.1:4175';
const output=join(tmpdir(),'euc-manual-email-ui');await mkdir(output,{recursive:true});
const token=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({id:901,name:'Preview administrator',role:'admin',must_change_password:false,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.preview`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [name,viewport]of Object.entries({desktop:{width:1440,height:1100},mobile:{width:390,height:844}})){
  const page=await browser.newPage({viewport});let record=null,emailCount=28,posted=null;const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>console.error(`Preview request failed: ${new URL(request.url()).pathname} ${request.failure()?.errorText}`));
  await page.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;let body={};
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization'}});return;}
   if(path==='/api/auth/refresh')body={accessToken:token};
   else if(path==='/api/notifications/my')body=[];
   else if(path==='/api/notifications/unread-count')body={unreadCount:0};
   else if(path.endsWith('/audience-count'))body={count:30};
   else if(path.endsWith('/email-preview'))body={inAppCount:30,emailCount,skippedCount:30-emailCount,enabled:true,reason:null,dailyLimit:300,securityReserve:50,usedToday:180,queuedRoutine:60,remainingRoutine:10,resetAt:'2026-10-28T00:00:00Z'};
   else if(path.endsWith('/details'))body=[{...record,email_summary:{queued:20,processing:1,accepted:4,failed:1,unknown:1,cancelled:0}}];
   else if(path==='/api/admin/notifications'&&request.method()==='POST'){
    posted=request.postDataJSON();record={...posted,id:12,record_key:'notification:12',queue_id:null,audience_type:posted.audienceType,audience_role:posted.audienceRole,audience_user_id:posted.audienceUserId,created_at:new Date().toISOString(),scheduled_at:null,expires_at:null,creator_name:'Preview administrator',origin:'manual',delivery_status:'available',read_count:0,group_count:1,group_reads:0,email_requested:posted.sendEmail,email_expires_at:'2026-11-03T00:00:00Z'};body={id:12};
   }else if(path==='/api/admin/notifications')body={notifications:record?[record]:[],counts:{manual:record?1:0,automatic:0,failed:0,all:record?1:0},pagination:{page:1,limit:20,total:record?1:0,totalPages:1}};
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'},body:JSON.stringify(body)});
  });
  await page.goto(`${origin}/admin/notifications`,{waitUntil:'domcontentloaded'});
  console.log(`${name}: frontend loaded`);
  try {await page.getByRole('button',{name:'New notification',exact:true}).first().click({timeout:60000});}
  catch(error){console.error(JSON.stringify({url:page.url(),errors,body:await page.locator('body').innerText()}));await page.screenshot({path:join(output,`${name}-failure.png`)});throw error;}
  await expect(page.getByRole('checkbox',{name:'Also send by email'})).not.toBeChecked();
  await page.getByLabel('Title',{exact:true}).fill('New library hours');await page.getByLabel('Message',{exact:true}).fill('The library will close early on Friday. Please return borrowed materials before the deadline.');
  await page.getByRole('checkbox',{name:'Also send by email'}).check();await expect(page.getByText('This will email 28 users.')).toBeVisible();
  await page.getByRole('checkbox',{name:'Also send by email'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:join(output,`${name}-compose.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  emailCount=27;await page.getByRole('button',{name:'Send notification',exact:true}).click();
  const confirmation=page.getByRole('alertdialog');await expect(confirmation).toContainText('Recipient counts have changed');await expect(confirmation).toContainText('27 verified users');
  await confirmation.getByRole('button',{name:'Send notification',exact:true}).click();
  await expect.poll(()=>posted?.confirmedEmailCount).toBe(27);expect(posted.sendEmail).toBe(true);
  await page.locator('.notification-row').getByText('New library hours',{exact:true}).click();
  await expect(page.getByRole('region',{name:'Email delivery results'})).toContainText('Accepted by provider');
  await page.getByRole('region',{name:'Email delivery results'}).scrollIntoViewIfNeeded();await page.screenshot({path:join(output,`${name}-results.png`)});
  await page.getByRole('button',{name:'Notification actions',exact:true}).click();await page.getByRole('menuitem',{name:'Resend',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Also send by email'})).not.toBeChecked();
  expect(errors).toEqual([]);console.log(`${name}: opt-in, fresh confirmation, send, results and resend passed`);await page.close();
 }
 console.log(`Screenshots: ${output}`);
}finally{await browser.close();}
