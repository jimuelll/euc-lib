import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const output = new URL('../.cache/catalogue-panel-polish/', import.meta.url);
await mkdir(output, { recursive: true });
const titles = ['Mushoku Tensei: Jobless Reincarnation', 'Berserk: The Complete Illustrated Collection and Companion', 'A Very Long Catalogue Title With Three or Four Lines About Literature and Life', 'Attack on Titan, Vol. 1', 'Reincarnation and Other Stories'];
const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#fffdf8"/><rect x="12" y="12" width="176" height="276" fill="#7a0000"/><text x="25" y="150" fill="#fffdf8" font-size="28">BERSERK</text></svg>');
const rows = Array.from({length: 13}, (_, i) => ({id: i + 1, title: titles[i % titles.length], author: i % 2 ? 'Kentaro Miura' : 'Rifujin na Magonote', category: 'Literature', isbn: '9781234567890', material_type: 'book', available: i % 4 ? 1 : 0, registered_copies: 1, canReserve: true, image_url: i % 3 === 1 ? cover : i % 3 === 2 ? '/broken-cover.jpg' : null}));
const recommendations = Array.from({length: 8}, (_, i) => ({...rows[i], id: i + 101, available: i === 4 ? 0 : 5, total_copies: 5, registered_copies: 5, reason: i % 4 === 0 ? 'Related catalogue title' : i % 4 === 1 ? 'Same author: Kentaro Miura' : i % 4 === 2 ? 'Shared subject: Fiction' : 'Similar category: Fiction', source: i % 2 ? 'rule' : 'ai', availability_status: i === 4 ? 'unavailable' : 'available'}));
process.env.VITE_BASE_URL = 'http://127.0.0.1:5174';
const server = await createServer({server:{host:'127.0.0.1',port:5174,hmr:false}});
await server.listen();
const browser = await chromium.launch({headless: true, channel: "chrome"});
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
const mockApi = async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith('/api/')) { await route.continue(); return; }
  let body = {};
  if (path.endsWith('/catalogue/search')) body = {rows, pagination: {page:1,limit:20,total:13,totalPages:1}, facets:{format:{all:13,book:13,thesis:0},availability:{all:13,available:9,unavailable:4},categories:[{value:'Literature',count:13}]}};
  else if (path.endsWith('/catalogue/schema')) body = [];
  else if (path.endsWith('/recommendations')) body = {material_type:'book',rows:recommendations};
  else if (path.includes('/auth/')) { await route.fulfill({status:401,json:{message:'Not signed in'}}); return; }
  await route.fulfill({json:body});
};
await page.route('**/api/**', mockApi);
await page.route('**/broken-cover.jpg',route=>route.fulfill({status:404,body:''}));
const evidence = [];
const headingByViewport = new Map();
for (const theme of ['light', 'dark']) {
  for (const width of [1280, 375]) {
    for (const view of ['grid', 'list']) {
      await page.setViewportSize({width,height:1000});
      await page.goto(`http://127.0.0.1:5174/catalogue?view=${view}`);
      await page.locator('.catalogue-record').first().waitFor();
      await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.classList.toggle('light',theme==='light');},theme);
      await page.evaluate(()=>document.fonts.ready);
      const edges=await page.evaluate(()=>{
        const heading=document.querySelector('.catalogue-heading').getBoundingClientRect();
        const layout=document.querySelector('.catalogue-layout').getBoundingClientRect();
        return {headingLeft:heading.left,headingRight:heading.right,layoutLeft:layout.left,layoutRight:layout.right};
      });
      assert.ok(Math.abs(edges.headingLeft-edges.layoutLeft)<1 && Math.abs(edges.headingRight-edges.layoutRight)<1,'Heading and content share page gutters');
      const headingKey=`${theme}-${width}`;
      if (headingByViewport.has(headingKey)) assert.deepEqual(edges,headingByViewport.get(headingKey),'Switching views preserves heading and page width');
      else headingByViewport.set(headingKey,edges);
      const columns = width === 1280 ? 4 : 2;
      const sourceIndices = view === 'grid' ? [0, columns - 1, rows.length - 1] : [0, rows.length - 1];
      for (const index of sourceIndices) {
        console.log('Verifying',theme,width,view,index);
        const trigger = view === 'grid' ? page.locator('.catalogue-cover-similar').nth(index) : page.locator('.is-list > article > .catalogue-record-copy .catalogue-similar-action').nth(index);
        await trigger.focus(); await trigger.press('Enter');
        const panel=page.locator('.catalogue-similar');
        await panel.locator('.catalogue-compact-card').first().waitFor();
        await page.locator('.catalogue-cover img').evaluateAll(images=>images.forEach(img=>img.loading='eager'));
        await page.waitForFunction(()=>[...document.querySelectorAll('.catalogue-cover img')].every(img=>img.complete && img.naturalWidth>0));
        await page.mouse.move(0,0);
        const cardCount=await panel.locator('.catalogue-compact-card').count();
        const frames=await page.locator('.catalogue-cover').evaluateAll(els=>els.map(el=>{
          const frame=el.getBoundingClientRect(),art=el.querySelector('.catalogue-cover-art').getBoundingClientRect();
          return {border:getComputedStyle(el).borderTopWidth,style:getComputedStyle(el).borderTopStyle,inset:art.left-frame.left,active:!!el.closest('.is-grid > .is-expanded')};
        }));
        frames.forEach(frame=>{assert.equal(frame.border,frame.active?'2px':'1px');assert.equal(frame.style,'solid');assert.ok(frame.inset>=3,'Cover artwork is inset inside its frame');});
        assert.equal(cardCount,width === 1280 ? 4 : 2);
        const metrics=await panel.evaluate(el=>{
          const cards=[...el.querySelectorAll('.catalogue-compact-card')];
          return {height:el.getBoundingClientRect().height,covers:cards.map(card=>{const r=card.querySelector('.catalogue-cover').getBoundingClientRect();return {width:r.width,height:r.height};}),footers:cards.map(card=>card.querySelector('.catalogue-record-side').getBoundingClientRect().top)};
        });

        for(const cover of metrics.covers) {assert.ok(cover.width<=160);assert.ok(Math.abs(cover.width/cover.height-2/3)<.01);assert.ok(Math.abs(cover.width-128)<1);}
        const layout=await panel.evaluate(el=>{
          const grid=el.querySelector('.catalogue-recommendation-cards');
          const cards=[...grid.children];
          const source=el.closest('.catalogue-records').querySelector(':scope > .catalogue-record.is-expanded');
          const main=[...el.closest('.catalogue-records').children].filter(el=>el.matches('article'));
          const gridView=el.closest('.catalogue-records').classList.contains('is-grid');
          const anchor=gridView?source:source.querySelector('.catalogue-cover');
          const a=anchor.getBoundingClientRect(),p=el.getBoundingClientRect(),pseudo=getComputedStyle(el,'::before');
          return {template:getComputedStyle(grid).gridTemplateColumns,mainTemplate:gridView?getComputedStyle(el.closest('.catalogue-records')).gridTemplateColumns:null,
            cardLefts:cards.map(card=>card.getBoundingClientRect().left),mainLefts:main.slice(0,cards.length).map(card=>card.getBoundingClientRect().left),
            connector: p.left+parseFloat(getComputedStyle(el).borderLeftWidth)+parseFloat(pseudo.left)+5,anchor:a.left+a.width/2,
            footers:cards.map(card=>{const footer=card.querySelector('.catalogue-record-side'),status=footer.querySelector('.catalogue-status'),button=footer.querySelector('a'),s=status.getBoundingClientRect(),f=footer.getBoundingClientRect();return {direction:getComputedStyle(footer).flexDirection,statusDirection:getComputedStyle(status).flexDirection,statusOverflow:status.scrollWidth>status.clientWidth+1,margin:getComputedStyle(footer).marginTop,button:button?{top:button.getBoundingClientRect().top,width:button.getBoundingClientRect().width}:null,statusBottom:s.bottom,width:f.width,hasReason:!!card.querySelector('.catalogue-compact-reason')};}),
            mainDirections:main.map(card=>getComputedStyle(card.querySelector(':scope > .catalogue-record-side')).flexDirection)};
        });
        if(view==='grid') {
          assert.equal(layout.template,layout.mainTemplate,'Shared grid template');
          layout.cardLefts.forEach((left,i)=>assert.ok(Math.abs(left-layout.mainLefts[i])<1,'Panel cards align with main columns'));
          layout.mainDirections.forEach(direction=>assert.equal(direction,width<480?'column':'row','Main footers fit the available card width'));
        }
        assert.ok(Math.abs(layout.connector-layout.anchor)<1,'Connector centres on source card / thumbnail');
        const reserveTops=layout.footers.filter(footer=>footer.button).map(footer=>footer.button.top);
        assert.ok(Math.max(...reserveTops)-Math.min(...reserveTops)<1,'Reserve buttons align across the row');
        const padding=await panel.locator('.catalogue-compact-card').first().evaluate(el=>({left:parseFloat(getComputedStyle(el).paddingLeft),top:parseFloat(getComputedStyle(el).paddingTop)}));
        assert.ok(padding.left>=12 && padding.top>=16,'Cards have generous internal padding');
        const divider=await panel.locator('.library-recommendation-heading').evaluate(el=>({width:getComputedStyle(el).borderBottomWidth,style:getComputedStyle(el).borderBottomStyle}));
        assert.deepEqual(divider,{width:'1px',style:'solid'},'Divider separates the panel header from the books');
        const outlines=await page.locator('.catalogue-reserve-action').evaluateAll(els=>els.map(el=>({border:getComputedStyle(el).borderTopColor,text:getComputedStyle(el).color,width:getComputedStyle(el).borderTopWidth})));
        outlines.forEach(style=>{assert.equal(style.border,style.text,'Reserve outline retains the action colour');assert.equal(style.width,'1px');});
        for(const footer of layout.footers) {
          assert.equal(footer.direction,'column');assert.equal(footer.statusDirection,'row');assert.equal(footer.statusOverflow,false);
          
          if(footer.button) {assert.ok(footer.button.top-footer.statusBottom>=7);assert.ok(Math.abs(footer.button.width-footer.width)<1);}
        }
        assert.equal(await panel.getByText('Related catalogue title',{exact:true}).count(),0);
        assert.equal(await panel.getByText('Includes AI selections, ranked by relevance',{exact:true}).count(),1);
        assert.equal(await panel.locator('.catalogue-ai-marker').count(),width===1280?2:1);
        evidence.push({theme,width,view,source:index,layout});
        const placeholders=await panel.locator('.catalogue-cover-fallback').evaluateAll(els=>els.map(el=>({label:el.getAttribute('aria-label'),text:el.textContent,overflow:getComputedStyle(el).overflow})));
        placeholders.forEach(placeholder=>{assert.equal(placeholder.overflow,'hidden');assert.ok(!placeholder.text.includes(placeholder.label.replace('Cover not available: ','')));});
        if(view==='list') assert.equal(await page.locator('.is-list > article > .catalogue-cover .catalogue-cover-fallback em').first().evaluate(el=>getComputedStyle(el).display),'none');
        assert.equal(await panel.getByText('Back to source book',{exact:true}).count(),0);
        assert.equal(await panel.locator('.library-recommendation-pagination > span').textContent(),width===1280?'Page 1 of 2':'Page 1 of 4');
        if(view==='grid') {
          const cover=await trigger.locator('..').boundingBox(), button=await trigger.boundingBox();
          assert.ok(button.x+button.width<cover.x+cover.width*.95 && button.y+button.height<cover.y+cover.height*.95,'Icon inside inner frame');
          const notch=await panel.evaluate(el=>{const style=getComputedStyle(el,'::before');return {width:style.width,height:style.height};});
          assert.deepEqual(notch,{width:'10px',height:'10px'});
        }
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.mouse.move(0,0);
        await page.screenshot({path:fileURLToPath(new URL(`${theme}-${width}-${view}-${index===0?'first':index===rows.length-1?'last':'last-column'}.png`,output)),fullPage:true});
        if(index===0) await panel.screenshot({path:fileURLToPath(new URL(`${theme}-${width}-${view}-panel.png`,output))});
        const order=[];
        for(let i=0;i<24;i++) {await page.keyboard.press('Tab');const label=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent);order.push(label);if(label==='Next recommendations')break;}
        assert.ok(order.includes('Close similar books'));assert.ok(order.includes('Next recommendations'));
        await page.keyboard.press('Escape');
        assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
        await trigger.press('Enter');
        await panel.getByRole('button',{name:'Close similar books'}).click();
        assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        evidence[evidence.length-1]={...evidence[evidence.length-1],height:metrics.height,cards:cardCount,covers:metrics.covers,focusReturn:true,tabOrder:order};
      }
    }
  }
}
// Resize an open source from the last desktop column into a two-column layout.
await page.setViewportSize({width:1280,height:1000});
await page.goto('http://127.0.0.1:5174/catalogue?view=grid');
const resizeTrigger=page.locator('.catalogue-cover-similar').nth(3);
await resizeTrigger.focus();await resizeTrigger.press('Enter');
await page.locator('.catalogue-recommendation-cards').waitFor();
await page.setViewportSize({width:375,height:1000});
await page.waitForFunction(()=>{
 const panel=document.querySelector('.catalogue-similar'),source=document.querySelector('.is-grid > article.is-expanded');
 const a=source.getBoundingClientRect(),p=panel.getBoundingClientRect(),style=getComputedStyle(panel,'::before');
 return Math.abs(p.left+1+parseFloat(style.left)+5-a.left-a.width/2)<1 && getComputedStyle(panel.querySelector('.catalogue-recommendation-cards')).gridTemplateColumns.split(' ').length===2;
});
await page.keyboard.press('Escape');
assert.equal(await resizeTrigger.evaluate(el=>el===document.activeElement),true);
await writeFile(new URL('verification.json',output),JSON.stringify({fixtures:true,evidence},null,2));
await browser.close();await server.close();
console.log('Catalogue panel polish QA passed: 20 screenshots, aligned columns, stacked footers, specific reasons, AI badges/disclosure, connector resize and focus return.');
