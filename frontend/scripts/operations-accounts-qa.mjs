import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const output=new URL('../.cache/operations-accounts/',import.meta.url);
await mkdir(output,{recursive:true});
process.env.VITE_BASE_URL='http://127.0.0.1:5175';
const server=await createServer({server:{host:'127.0.0.1',port:5175,strictPort:true,hmr:false}});
await server.listen();let browser;const evidence=[];
const book={id:14,title:'Library discovery and research',author:'Sample Author',material_type:'book',available:2,registered_copies:3,canReserve:true};
try {
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const role of ['scanner','opac','admin']) {
  const context=await browser.newContext(),page=await context.newPage(),errors=[],requests=[],sockets=[];
  page.on('console',message=>{if(message.type()==='error')console.log('BROWSER',role,message.text());});
  page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE ERROR',role,error.message);});page.on('websocket',socket=>{if(new URL(socket.url()).pathname==='/ws')sockets.push(socket.url());});
  const token='header.'+Buffer.from(JSON.stringify({id:42,name:'Library terminal',role,must_change_password:false,email_verified:false})).toString('base64')+'.signature';
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.continue();requests.push(path);let body={};
   if(path==='/api/auth/refresh')body={accessToken:token};
   else if(path==='/api/catalogue/schema')body=[];
   else if(path==='/api/catalogue/search')body={rows:[book],pagination:{page:1,limit:20,total:1,totalPages:1},facets:{format:{all:1,book:1,thesis:0},availability:{all:1,available:1,unavailable:0},categories:[]}};
   else if(path.endsWith('/recommendations'))body={rows:[{...book,id:15,title:'Related research methods',reason:'Shared subject: Research',source:'ai',availability_status:'available'}]};
   else if(path==='/api/admin/users')body={rows:[],pagination:{page:1,limit:25,total:0,totalPages:1}};
   else if(path==='/api/admin/users/availability')body={available:true};
   else if(path.includes('notifications'))body=path.includes('unread')?{unreadCount:0}:{notifications:[]};
   else if(path.includes('programs'))body={programs:[]};
   else if(path.includes('academic-terms'))body={terms:[]};
   else if(path.includes('departments'))body={departments:[]};
   await route.fulfill({json:body});
  });
  await page.goto('http://127.0.0.1:5175'+(role==='admin'?'/admin/manage':'/my-library'),{waitUntil:'networkidle'});
  if(role==='admin') {
   await page.getByRole('button',{name:'Create user',exact:true}).click();
   for(const width of [1280,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:fileURLToPath(new URL(`roles-${width}.png`,output)),fullPage:true});}
   await page.setViewportSize({width:1280,height:1000});
   await page.getByRole('radio',{name:'Library Operations',exact:true}).check();
   await page.getByRole('combobox',{name:'Operations type',exact:true}).click();await page.getByRole('option',{name:'OPAC',exact:true}).click();
   for(const [label,value]of [['Username','opac-terminal'],['Full name','Library catalog terminal'],['Password','terminal-password'],['Confirm password','terminal-password']])await page.getByLabel(label,{exact:true}).fill(value);
   assert.equal(await page.getByLabel('Email',{exact:true}).count(),0);await page.getByRole('button',{name:'Create account',exact:true}).waitFor();
  } else {
   const home=role==='scanner'?'/scan-qr':'/catalogue';try {await page.waitForURL('**'+home,{timeout:60000});} catch(error){await page.screenshot({path:fileURLToPath(new URL('failure.png',output)),fullPage:true});console.log('FAILURE STATE',JSON.stringify({url:page.url(),requests,errors,text:await page.locator('body').innerText()}));throw error;}assert.equal(new URL(page.url()).pathname,home);
   if(role==='opac'){await page.getByRole('button',{name:'View similar books for '+book.title,exact:true}).click();await page.getByText('Related research methods',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:/^Reserve/}).count(),0);}
   const homes=await page.locator('header a').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
   assert.equal(homes.length,1);assert.ok(homes.every(path=>path===home));assert.equal(sockets.length,0);
   assert.equal(await page.getByText(/Verify your email to receive library notices/).count(),0);
   assert.ok(requests.every(path=>path==='/api/auth/refresh'||role==='opac'&&path.startsWith('/api/catalogue/')),JSON.stringify(requests));
  }
  for(const width of [1280,390]){await page.setViewportSize({width,height:1000});const name=`${role}-${width}.png`;await page.screenshot({path:fileURLToPath(new URL(name,output)),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,`${role} ${width} overflow`);evidence.push({role,width,screenshot:name,requests:[...new Set(requests)]});}
  assert.deepEqual(errors,[],`${role} page errors`);await context.close();
 }
 await writeFile(new URL('verification.json',output),JSON.stringify(evidence,null,2));console.log('Operations QA passed: admin form, Scanner/OPAC isolation, desktop/mobile layout, no reservations or notification connections.');
} finally {await browser?.close();await server.close();}
