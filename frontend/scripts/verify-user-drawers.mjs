// Visual QA uses isolated fixtures and never writes to a live backend.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin='http://127.0.0.1:4175',output=resolve('../artifacts/user-drawers');
await mkdir(output,{recursive:true});
const token=`preview.${Buffer.from(JSON.stringify({id:42,name:'Preview administrator',role:'super_admin',must_change_password:false})).toString('base64')}.preview`;
const patron={user_id:7,name:'Alexandra Rivera Santos — Information Systems',student_employee_id:'CARD-1',library_card_number:'CARD-1',student_number:'ST-1',role:'student',program_id:1,academic_term_id:1,year_level:'2nd Year',email:'alex@example.edu',is_active:1,active_loans:2,overdue_loans:1,unpaid_fines:1260,active_reservations:1};
const admin={user_id:42,name:'My Super Admin',student_employee_id:'super-one',username:'super-one',role:'super_admin',email:'desk@example.edu',email_verified_at:'2026-10-09T00:00:00Z',is_active:1};
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try {
 for(const [size,viewport] of Object.entries({desktop:{width:1366,height:768},tablet:{width:820,height:1180},mobile:{width:390,height:844}}))for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('WebSocket'))console.log('BROWSER',m.text());});
  await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.continue();let data={};
   if(path==='/api/auth/refresh')data={accessToken:token};
   else if(path==='/api/admin/users')data={rows:[patron,admin],pagination:{page:1,limit:25,total:2,totalPages:1},summary:{total:2,active:2,needsAttention:1,statuses:{active:2,inactive:0,archived:0,all:2},roles:{student:1,super_admin:1}}};
   else if(path==='/api/admin/academic-programs')data={programs:[{id:1,name:'Information Systems'}]};
   else if(path==='/api/admin/academic-terms')data={terms:[{id:1,name:'2026–2027',is_current:1,starts_on:'2026-08-01',ends_on:'2027-06-01'}]};
   else if(path==='/api/admin/departments')data={departments:[{id:1,name:'Library'}]};
   else if(path.endsWith('/availability'))data={available:true};
   else if(path.endsWith('/account-email'))data={deliveries:[{purpose:'verify_email',status:'accepted',requested_at:'2026-10-25T00:00:00Z',accepted_at:'2026-10-25T00:00:10Z'}]};
   else if(path.endsWith('/audience-count'))data={count:9};
   else if(path==='/api/notifications/my')data=[];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(origin+'/admin/manage',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Create user',exact:true}).click({timeout:45000}).catch(async error=>{console.log('PAGE',page.url(),(await page.locator('body').innerText()).slice(0,1600));await page.screenshot({path:resolve(output,'debug.png')});throw error;});
  let dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Create and send invitation'})).toBeDisabled();
  await page.screenshot({path:resolve(output,`${size}-${theme}-roles.png`)});
  await dialog.getByRole('radio',{name:'Scanner'}).check();
  await dialog.getByLabel('Full name',{exact:true}).fill('Library Desk');await dialog.getByLabel('Username',{exact:true}).fill('library.desk');await dialog.getByLabel('Email',{exact:true}).fill('desk@example.edu');
  await expect(dialog.getByRole('button',{name:'Create and send invitation'})).toBeEnabled();
  const primary=await dialog.getByRole('button',{name:'Create and send invitation'}).evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
  if(primary.background!=='rgb(122, 0, 0)'||primary.color!=='rgb(255, 255, 255)')throw new Error('Primary action colors: '+JSON.stringify(primary));
  const borderContrast=await dialog.getByLabel('Email',{exact:true}).evaluate(el=>{
    const l=color=>{const values=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
    const a=l(getComputedStyle(el).borderTopColor),b=l(getComputedStyle(el.closest('[role=dialog]')).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  if(borderContrast<3)throw new Error('Field border contrast: '+borderContrast);
  await dialog.getByLabel('Email',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(output,`${size}-${theme}-create.png`)});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Discard changes'}).click();
  await page.getByRole('button',{name:patron.name,exact:true}).click();dialog=page.getByRole('dialog');
  await page.screenshot({path:resolve(output,`${size}-${theme}-profile.png`)});
  await dialog.getByRole('tab',{name:'Borrowing',exact:true}).click();await page.screenshot({path:resolve(output,`${size}-${theme}-borrowing.png`)});
  await dialog.getByRole('tab',{name:'Access',exact:true}).click();await page.screenshot({path:resolve(output,`${size}-${theme}-access.png`)});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'My Super Admin',exact:true}).click();dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('tab',{name:'Borrowing',exact:true})).toHaveCount(0);
  await dialog.getByRole('tab',{name:'Access',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Role',exact:true})).toBeDisabled();
  await page.screenshot({path:resolve(output,`${size}-${theme}-self-access.png`)});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const footerVisible=await dialog.locator('footer').evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight+1 && r.top>=0;});
  report.push({size,theme,overflow,footerVisible,primary,borderContrast,errors});
  await page.goto(origin+'/scripts/notification-compose-qa.html');await page.getByRole('button',{name:'New notification',exact:true}).click();
  await page.screenshot({path:resolve(output,`${size}-${theme}-notification.png`)});
  console.log(size,theme,'verified');await page.close();
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 if(report.some(r=>r.overflow||!r.footerVisible||r.errors.length))throw new Error('Drawer layout checks failed; inspect report.json');
}finally{await browser.close();}
