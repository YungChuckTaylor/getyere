import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(process.env.MAPLE_TOOLS?path.resolve(process.env.MAPLE_TOOLS,'package.json'):new URL('../package.json',import.meta.url));
const {chromium:playwright}=require('playwright-core');
const chromiumModule=require('@sparticuz/chromium');
const bundledChromium=chromiumModule.default||chromiumModule;
const {default:AxeBuilder}=await import(require.resolve('@axe-core/playwright'));
import {fixes,questions} from '../data.mjs';
const base=process.env.MAPLE_BASE_URL||'http://127.0.0.1:4190';
const artifacts=process.env.MAPLE_QA_DIR||'/tmp/maple-qa';await fs.mkdir(artifacts,{recursive:true});
const browser=await playwright.launch({executablePath:process.env.CHROMIUM_PATH||await bundledChromium.executablePath(),args:bundledChromium.args.filter(a=>a!=='--single-process'),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();const errors=[],external=[],accessibility=[],responsive=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url());});
async function go(route='/'){await page.goto(`${base}/#${route}`);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);}
async function axe(label){const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze();if(results.violations.length)console.log('AXE VIOLATIONS',label,JSON.stringify(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));accessibility.push({label,violations:results.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});}
try{
 await go();await page.evaluate(()=>history.replaceState(null,'','?previewToken=fictional'+location.hash));assert.equal(await page.locator('main h1').count(),1);await axe('Home, desktop');
 await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});
 await page.locator('[data-pain="tools"]').click();await page.locator('#start-check').click();
 await axe('Tech Check question');
 assert.equal(await page.locator('#check-question button[type="submit"]').isDisabled(),true);
 // Choose a low-risk profile, prove navigation retains the first answer.
 await page.locator('input[value="2-10"]').check();await page.getByRole('button',{name:'Next question'}).click();
 assert.equal(await page.locator('input[value="tools"]').isChecked(),true);
 await page.locator('#back-question').click();assert.equal(await page.locator('input[value="2-10"]').isChecked(),true);
 await page.getByRole('button',{name:'Next question'}).click();
 for(let i=1;i<questions.length;i++){
  const q=questions[i];const value=q.id==='pain'?'tools':q.id==='budget'?'diy':q.options[0][0];
  await page.locator(`input[name="answer"][value="${value}"]`).check();
  await page.locator('#check-question button[type="submit"]').click();
 }
 assert.ok(await page.locator('.score-card strong').innerText().then(t=>t.includes('0')));
 assert.equal(await page.locator('.win-card').count(),3);assert.equal(await page.locator('#result-contact').count(),1);
 assert.match(await page.locator('.report-next').innerText(),/free checklist/);
 await axe('Results, desktop');
 await page.screenshot({path:path.join(artifacts,'results-desktop.png'),fullPage:true});
 const pdfPromise=page.waitForEvent('download');await page.locator('#download-report').click();const pdf=await pdfPromise;await pdf.saveAs(path.join(artifacts,'tech-check-results.pdf'));
 assert.ok((await fs.readFile(path.join(artifacts,'tech-check-results.pdf'),'ascii')).startsWith('%PDF-1.4'));
 await page.locator('#share-report').click();const shareURL=await page.locator('#share-url').inputValue();assert.ok(shareURL.includes('/report?v=1'));assert.ok(!shareURL.includes('team='));assert.ok(!shareURL.includes('previewToken'));assert.ok(!shareURL.includes('fictional'));
 await page.goto(shareURL);assert.equal(await page.locator('.win-card').count(),3);assert.match(await page.locator('.score-explainer').innerText(),/editable/);
 await page.reload();assert.equal(await page.locator('.win-card').count(),3);
 await page.locator('#restart-check').click();await page.locator('#start-check').click();assert.equal(await page.locator('#check-question button[type="submit"]').isDisabled(),true);
 await go('/report?v=1&s=999&w=bad&p=bad&d=bad');assert.match(await page.locator('main').innerText(),/incomplete or invalid/);
 await go('/fix-library');assert.equal(await page.locator('.fix-card').count(),10);
 await page.locator('#fix-search').fill('EXCEL');assert.equal(await page.locator('.fix-card').count(),1);
 await page.locator('#fix-search').fill('<script>alert(1)</script>');assert.equal(await page.locator('.fix-card').count(),0);assert.equal(await page.locator('main script').count(),0);
 await page.locator('#reset-library').click();assert.equal(await page.locator('.fix-card').count(),10);
 await page.locator('[data-category="Data & reporting"]').click();assert.equal(await page.locator('.fix-card').count(),3);
 await axe('Fix Library, filtered');
 for(const fix of fixes){await go(`/fix-library/${fix.id}`);assert.match(await page.locator('main').innerText(),/immediate action/);assert.equal(await page.locator('[data-download-fix]').count(),1);await axe(`Fix Library: ${fix.id}`);}

 const checklistPromise=page.waitForEvent('download');await page.locator('[data-download-fix]').click();const checklist=await checklistPromise;await checklist.saveAs(path.join(artifacts,'fix-checklist.txt'));
 await go('/pricing');await page.locator('#picker-pain').selectOption('stalled');await page.locator('#engagement-picker button').click();assert.match(await page.locator('#picker-result').innerText(),/Project Rescue/);
 await page.locator('#picker-pain').selectOption('incident');await page.locator('#engagement-picker button').click();assert.match(await page.locator('#picker-result').innerText(),/Do not wait/);assert.equal(await page.locator('#picker-result .price').count(),0);
 await axe('Pricing and urgent referral');
 await go('/fix-log');assert.match(await page.locator('.honest-empty').innerText(),/No client evidence/);await axe('Honest Fix Log');
 await go('/products');assert.equal(await page.locator('a[href="https://getyere.com"]').count(),1);await axe('Products');
 await go('/question');await page.locator('#contact-form-name').fill('Fictional tester');await page.locator('#contact-form-context').fill('A fictional workflow question for testing only.');await page.locator('input[name="safe"]').check();await page.locator('#contact-form button[type="submit"]').click();assert.equal(await page.locator('.draft-fallback').isVisible(),true);
 await axe('Question request and draft fallback');
 for(const route of ['/about','/not-a-fit','/contact','/trust','/missing']){await go(route);await axe(route);}
 const routes=['/','/tech-check','/fix-library','/fix-library/sharepoint-move','/pricing','/products','/fix-log','/not-a-fit','/question','/contact','/about','/trust','/products/cart-compare',new URL(shareURL).hash.slice(1)];
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  for(const route of routes){await go(route);const overflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));responsive.push({width,route,...overflow});assert.ok(overflow.scroll<=overflow.viewport+1,`Horizontal overflow at ${width}, ${route}: ${overflow.scroll}`);}
 }
 await page.setViewportSize({width:390,height:844});await go('/');await axe('Home, mobile');await page.screenshot({path:path.join(artifacts,'home-mobile.png')});
 await page.locator('.menu-toggle').click();assert.equal(await page.locator('#primary-nav').isVisible(),true);await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Fix Library'}).click();await page.locator('#fix-search').waitFor();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
 await axe('Fix Library, mobile');await page.locator('.menu-toggle').click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Fix Library'}).click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
 await go('/tech-check');await page.locator('#start-check').click();await axe('Tech Check question, mobile');
 await page.goto(shareURL);await page.locator('.win-card').first().waitFor();await axe('Shared results, mobile');
 await go('/question');await axe('Question, mobile');
 await go('/pricing');await axe('Pricing, mobile');
 await page.screenshot({path:path.join(artifacts,'pricing-mobile.png')});
 await context.close();
 const blocked=accessibility.filter(r=>r.violations.length);
 await fs.writeFile(path.join(artifacts,'browser-results.json'),JSON.stringify({errors,external,accessibility,responsive},null,2));
 console.log(JSON.stringify({browserErrors:errors,externalRequests:external,responsiveChecks:responsive.length,axeAudits:accessibility.length,axeFailures:blocked},null,2));
 assert.equal(errors.length,0,'Runtime exceptions');assert.equal(external.length,0,'Unexpected remote requests');assert.equal(blocked.length,0,'Accessibility violations');
}finally{await browser.close();}
