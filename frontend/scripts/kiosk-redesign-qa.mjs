import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const output=new URL('../.cache/kiosk-redesign/after-v2/',import.meta.url);await mkdir(output,{recursive:true});
process.env.VITE_BASE_URL='http://127.0.0.1:5176';
const server=await createServer({server:{host:'127.0.0.1',port:5176,strictPort:true,hmr:false}});await server.listen();let browser;
const book={id:14,title:'Library discovery and research',author:'Sample Author',material_type:'book',available:2,registered_copies:3,canReserve:true};const evidence=[];
const scannerSizes=[[1920,1080],[1440,900],[1280,720],[1024,768],[390,900],[390,520]];
async function capture(page,role,state,sizes){for(const [width,height]of sizes){await page.setViewportSize({width,height});await page.screenshot({path:fileURLToPath(new URL(`${role}${state?'-'+state:''}-${width}${height===520?'-short':''}.png`,output)),fullPage:true,animations:state==='success'||state==='error'||state==='notice'?'allow':'disabled'});const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));assert.ok(dimensions.scrollWidth<=width+1,`${role} ${state} horizontal overflow ${JSON.stringify(dimensions)}`);if(role==='scanner')assert.ok(dimensions.scrollHeight<=Math.max(520,height)+1,`${state} vertical overflow ${JSON.stringify(dimensions)}`);evidence.push({role,state,...dimensions});}}
try{
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 for(const role of ['scanner','opac']){
  const context=await browser.newContext({permissions:['camera']}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{localStorage.setItem('theme','dark');});
  const token='header.'+Buffer.from(JSON.stringify({id:42,name:role==='scanner'?'Development Scanner':'Development OPAC',role,must_change_password:false,email_verified:false})).toString('base64')+'.signature';
  await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.continue();requests.push(path);let body={};
   if(path==='/api/auth/refresh')body={accessToken:token};else if(path==='/api/catalogue/schema')body=[];
   else if(path==='/api/catalogue/search')body={rows:[book],pagination:{page:1,limit:20,total:1,totalPages:1},facets:{format:{all:1,book:1,thesis:0},availability:{all:1,available:1,unavailable:0},categories:[]}};
   else if(path.endsWith('/recommendations'))body={rows:[{...book,id:15,title:'Related research methods',reason:'Shared subject: Research',source:'ai',availability_status:'available'}]};
   else if(path==='/api/attendance/scan'){const {scannedId,type}=route.request().postDataJSON();if(scannedId==='MISSING'){await route.fulfill({status:404,json:{message:'ID not recognised — user not found'}});return;}if(scannedId==='DUPLICATE'){await route.fulfill({status:409,json:{message:'Maria Santos is already timed out for today.',code:'ALREADY_TIMED_OUT',user:{name:'Maria Santos',student_employee_id:'A001'},type:'check_out'}});return;}body={user:{name:'Maria Santos',student_employee_id:scannedId},type};}
   await route.fulfill({json:body});
  });
  await page.goto('http://127.0.0.1:5176'+(role==='scanner'?'/scan-qr':'/catalogue'),{waitUntil:'networkidle'});await page.getByRole('heading',{name:role==='scanner'?'Attendance Scanner':'Library catalogue',exact:true}).waitFor();
  if(role==='opac'){await page.getByRole('button',{name:book.title,exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:/^Reserve/}).count(),0);}
  await capture(page,role,'',role==='scanner'?scannerSizes:[[1440,900],[390,900]]);
  assert.equal(await page.locator('header nav').count(),0);assert.equal(await page.locator('header img').evaluate(el=>getComputedStyle(el).height),'32px');assert.equal(await page.locator('header>.container').evaluate(el=>getComputedStyle(el).height),'56px');
  await page.setViewportSize({width:1440,height:900});if(role==='scanner')await contrast(page,'dark');
  await page.getByRole('button',{name:'Toggle theme'}).click();if(role==='scanner')await contrast(page,'light');await capture(page,role,'light',[[1440,900]]);await page.getByRole('button',{name:'Toggle theme'}).click();
  await page.getByRole('button',{name:/Account menu/}).click();await page.getByRole('menuitem',{name:'Sign out'}).waitFor();await page.keyboard.press('Escape');
  if(role==='scanner'){
   await page.getByRole('button',{name:'Time in Arrival'}).click();await page.getByLabel('Camera live',{exact:true}).waitFor();
   const originalTrack=await page.locator('video').evaluate(video=>video.srcObject.getVideoTracks()[0].id);
   await capture(page,role,'live',scannerSizes);
   await page.setViewportSize({width:1440,height:900});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
   for(const [id,state]of [['A001','success'],['A002','success'],['MISSING','error'],['DUPLICATE','notice']]){
    console.log('Verifying scanner result',id,state);if(id==='A002')await page.getByRole('button',{name:'Time out',exact:true}).click();
    await page.getByLabel('Scan library ID').focus();await page.keyboard.type(id);await page.keyboard.press('Enter');await page.locator(`[data-scan-state="${state}"]`).waitFor();await page.locator('.kiosk-countdown-track>span').evaluate(el=>el.getAnimations().forEach(animation=>animation.pause()));
    await capture(page,role,state,[[1440,900],[390,900],[390,520]]);await page.clock.fastForward(4500);await page.getByLabel('Camera live',{exact:true}).waitFor();
    assert.equal(await page.locator('video').evaluate(video=>video.srcObject.getVideoTracks()[0].id),originalTrack);
   }
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.kiosk-scan-line').evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
   await page.setViewportSize({width:1440,height:900});await page.locator('video').evaluate(video=>window.__kioskTracks=video.srcObject.getTracks());await page.getByRole('button',{name:'Stop',exact:true}).click();await page.getByRole('button',{name:'Time in Arrival'}).waitFor();assert.equal(await page.evaluate(()=>window.__kioskTracks.every(track=>track.readyState==='ended')),true);
   await page.getByRole('button',{name:'Time out Departure'}).click();await page.getByLabel('Camera live',{exact:true}).waitFor();await page.clock.fastForward(61000);await page.getByRole('button',{name:'Time in Arrival'}).waitFor();
   await page.getByRole('button',{name:'Time in Arrival'}).click();await page.getByLabel('Camera live',{exact:true}).waitFor();await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});await page.getByRole('button',{name:'Time in Arrival'}).waitFor();await page.evaluate(()=>delete document.visibilityState);
   await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Permission denied','NotAllowedError');};});await page.getByRole('button',{name:'Time in Arrival'}).click();await page.getByRole('heading',{name:'Camera unavailable'}).waitFor();assert.equal(await page.locator('.kiosk-manual-form').count(),0);await capture(page,role,'camera-error',[[1440,900],[390,900]]);
   await page.getByRole('button',{name:'Enter ID manually',exact:true}).click();await page.getByLabel('Scan library ID').fill('MANUAL');await page.getByLabel('Scan library ID').press('Enter');await page.locator('[data-scan-state="success"]').waitFor();await page.clock.fastForward(4500);await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Time out Departure'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('euc-kiosk-attendance-mode')),'check_in');
  }
  assert.deepEqual(errors,[]);assert.ok(requests.every(path=>path==='/api/auth/refresh'||role==='scanner'&&path==='/api/attendance/scan'||role==='opac'&&path.startsWith('/api/catalogue/')),JSON.stringify(requests));await context.close();
 }
 await writeFile(new URL('verification.json',output),JSON.stringify(evidence,null,2));console.log('Kiosk v2 checks passed: one-screen desktop/mobile layouts, public header styling, one-tap camera, queue continuity, result reset, Stop/inactivity/hidden-tab cleanup, manual fallback, themes, reduced motion, and unchanged OPAC restrictions.');
}finally{await browser?.close();await server.close();}
async function contrast(page,theme){const checks=await page.evaluate(()=>{const rgb=value=>{const parts=value.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [parts[0],parts[1],parts[2],parts[3]??1];};const background=el=>{const color=rgb(getComputedStyle(el).backgroundColor);if(color[3]>=1)return color;const parent=el.parentElement?background(el.parentElement):[255,255,255,1];return [0,1,2].map(index=>color[index]*color[3]+parent[index]*(1-color[3]));};const light=color=>{const values=color.slice(0,3).map(value=>{const channel=value/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});return .2126*values[0]+.7152*values[1]+.0722*values[2];};return [...document.querySelectorAll('.kiosk-title-block>p,.kiosk-clock>span,.kiosk-choose-hint strong,.kiosk-choose-hint>span,.kiosk-panel-header>span,.kiosk-session-note,.kiosk-footer span')].filter(el=>el.getBoundingClientRect().height).map(el=>{const a=light(rgb(getComputedStyle(el).color)),b=light(background(el));return {text:el.textContent.trim(),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});});for(const check of checks)assert.ok(check.ratio>=4.5,`${theme}: ${check.text} contrast ${check.ratio}`);evidence.push({theme,contrast:checks});}
