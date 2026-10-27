// Browser QA uses synthetic APIs; no notification reaches a real patron.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin='http://127.0.0.1:8080',output=resolve('../artifacts/notification-composer');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try {
 for(const [size,viewport] of Object.entries({desktop:{width:1440,height:1000},mobile:{width:390,height:844}})) for(const theme of ['light','dark']) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];let posted=null;
  await page.routeWebSocket('**/*',socket=>socket.close());
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;let body={};
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization'}});return;}
   if(path==='/api/notifications/my')body=[];
   else if(path==='/api/notifications/unread-count')body={unreadCount:0};
   else if(path.endsWith('/audience-count'))body={count:url.searchParams.get('audienceType')==='users'?url.searchParams.get('audienceUserIds').split(',').length:9};
   else if(path.endsWith('/recipients'))body={recipients:[{id:7,name:'Alex Rivera',role:'student',student_employee_id:'P-7'},{id:8,name:'Alex Santos',role:'alumni',student_employee_id:'P-8'}]};
   else if(path.endsWith('/email-preview'))body={inAppCount:9,emailCount:6,skippedCount:3,exclusions:{missingAddress:1,unverifiedAddress:1,incompleteSetup:1},enabled:true,reason:null,dailyLimit:300,securityReserve:50,usedToday:8,queuedRoutine:2,remainingRoutine:240,resetAt:'2026-10-28T00:00:00Z'};
   else if(path==='/api/admin/notifications'&&request.method()==='POST'){posted=request.postDataJSON();body={id:12};}
   else if(path==='/api/admin/notifications')body={notifications:[],counts:{manual:0,automatic:0,failed:0,all:0},pagination:{page:1,limit:20,total:0,totalPages:1}};
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'},body:JSON.stringify(body)});
  });
  await page.goto(`${origin}/scripts/notification-compose-qa.html`,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'New notification',exact:true}).first().click({timeout:60000});
  console.log(`${size}/${theme}: drawer opened`);
  const drawer=page.getByRole('dialog');
  await expect(drawer.getByRole('button',{name:'Send to 9 patrons'})).toBeDisabled();
  await page.locator('#notification-title').fill('Plan your library visit');
  await page.locator('#notification-body').fill('Check My Library before your next visit.\n\nReview your borrowed materials and return dates. Contact library staff if you need assistance.');
  await expect(drawer.getByRole('button',{name:'Send to 9 patrons'})).toBeEnabled();
  await expect(page.getByRole('heading',{name:'Plan your library visit'})).toBeVisible();
  const initial=await page.evaluate(()=>{
   const drawer=document.querySelector('.notification-compose-drawer'),form=drawer.querySelector('form'),preview=drawer.querySelector('aside'),footer=drawer.querySelector('footer'),button=drawer.querySelector('.notification-send'),input=drawer.querySelector('input');
   const box=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
   const style=getComputedStyle(button),placeholder=getComputedStyle(input,'::placeholder');
   return {drawer:box(drawer),form:box(form),preview:box(preview),footer:box(footer),button:{...box(button),background:style.backgroundColor,color:style.color},placeholder:{color:placeholder.color,background:getComputedStyle(input).backgroundColor},overflow:drawer.scrollWidth>drawer.clientWidth,overflowElements:[...drawer.querySelectorAll('*')].filter(element=>element.getBoundingClientRect().right>drawer.getBoundingClientRect().right+1).map(element=>({tag:element.tagName,cls:element.className,width:element.getBoundingClientRect().width})).slice(0,12)};
  });
  const luminance=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const foreground=luminance(initial.placeholder.color),background=luminance(initial.placeholder.background);
  initial.placeholder.contrast=(Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
  expect(initial.overflow).toBe(false);expect(initial.placeholder.contrast).toBeGreaterThanOrEqual(4.5);
  expect(initial.preview.bottom).toBeLessThanOrEqual(initial.footer.y+1);expect(initial.footer.bottom).toBeLessThanOrEqual(viewport.height+1);
  expect(initial.button.background).toBe('rgb(122, 0, 0)');expect(initial.button.color).toBe('rgb(255, 255, 255)');
  if(size==='desktop'){expect(Math.round(initial.drawer.width)).toBe(1040);expect(Math.round(initial.preview.width)).toBe(320);}
  console.log(`${size}/${theme}: layout and contrast passed`);
  await page.screenshot({path:resolve(output,`${size}-${theme}-content.png`)});
  await page.getByRole('button',{name:'Audience',exact:true}).click();await page.getByRole('button',{name:'Specific patrons',exact:true}).click();
  await page.getByLabel('Find patrons').fill('Alex');await page.getByRole('button',{name:/^Alex Rivera/}).click();await page.getByRole('button',{name:/^Alex Santos/}).click();await expect(drawer.getByRole('button',{name:'Send to 2 patrons'})).toBeEnabled();
  await page.getByRole('button',{name:'Delivery',exact:true}).click();await expect(page.getByRole('heading',{name:'Delivery'})).toBeFocused();
  expect(await drawer.evaluate(element=>element.scrollTop)).toBe(0);
  await expect(page.getByRole('heading',{name:'New notification',exact:true})).toBeVisible();
  await page.screenshot({path:resolve(output,`${size}-${theme}-delivery.png`)});
  await drawer.getByRole('button',{name:'Send to 2 patrons'}).click();const confirmation=page.getByRole('alertdialog');await expect(confirmation).toContainText('Alex Rivera, Alex Santos');await expect(confirmation).toContainText('2 in-app recipients');await confirmation.getByRole('button',{name:'Send to 2 patrons'}).click();
  await expect.poll(()=>posted?.audienceUserIds).toEqual([7,8]);await expect(drawer).toHaveCount(0);
  expect(errors).toEqual([]);report.push({size,theme,...initial});await page.close();
 }
 await writeFile(resolve(output,'layout-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
