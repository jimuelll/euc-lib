// Isolated fixtures: no requests reach a live backend.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4187','--strictPort'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
await new Promise((ready,reject)=>{server.stdout.on('data',chunk=>{if(String(chunk).includes('Local:'))ready();});server.stderr.on('data',chunk=>process.stderr.write(chunk));server.on('error',reject);server.on('exit',code=>reject(new Error('Preview exited: '+code)));});
const output=resolve('../artifacts/staff-form');await mkdir(output,{recursive:true});
const token=`preview.${Buffer.from(JSON.stringify({id:42,name:'Preview administrator',role:'super_admin',must_change_password:false})).toString('base64')}.preview`;
const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{
 for(const [size,viewport] of Object.entries({desktop:{width:1366,height:900},mobile:{width:390,height:844}})){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});
 await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;let data={};
 if(path==='/api/auth/refresh')data={accessToken:token};
 else if(path==='/api/admin/users')data={rows:[],pagination:{page:1,limit:25,total:0,totalPages:1}};
 else if(path==='/api/admin/academic-programs')data={programs:[{id:1,name:'Information Systems'}]};
 else if(path==='/api/admin/academic-terms')data={terms:[{id:1,name:'2026�2027',is_current:1,starts_on:'2026-08-01',ends_on:'2027-06-01'}]};
 else if(path==='/api/admin/departments')data={departments:[]};
 else if(path.endsWith('/availability'))data={available:true};
 else if(path==='/api/notifications/my')data=[];
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:4187/admin/manage');
 await page.getByRole('button',{name:'Create user',exact:true}).click({timeout:60000}).catch(async error=>{console.log(page.url(),(await page.locator('body').innerText()).slice(0,1500));await page.screenshot({path:resolve(output,'debug.png')});throw error;});
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('radio',{name:'Student',exact:true}).check();
 const fields=()=>dialog.locator('input:not([type=radio]),select,textarea,[role=combobox]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')||el.id||el.tagName));
 const student=await fields();
 await dialog.getByRole('radio',{name:'Staff',exact:true}).check();
 expect(await fields()).toEqual(student);
 await expect(dialog.getByLabel('Library card number',{exact:true})).toBeVisible();
 await expect(dialog.getByLabel('Student number',{exact:true})).toBeVisible();
 await expect(dialog.getByLabel('Username',{exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('combobox',{name:'Academic term'})).toHaveCount(1);
 await dialog.getByLabel('Full name',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(output,`${size}-identity.png`)});
 await dialog.getByLabel('Email',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(output,`${size}-contact.png`)});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 expect(overflow).toBe(false);report.push({size,matchingFields:true,overflow});await page.close();
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.kill();}

