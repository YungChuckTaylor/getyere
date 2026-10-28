import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, fixes, services } from '../data.mjs';
import { assess, recommend, serializeReport, parseSharedReport, searchFixes, reportLines, createReportPDF, createMailDraft } from '../engine.mjs';
const safest=()=>Object.fromEntries(questions.map(q=>[q.id,q.options[0][0]]));
const riskiest=()=>Object.fromEntries(questions.map(q=>[q.id,q.weight?q.options.at(-1)[0]:q.options[0][0]]));
test('all ten questions and complete Fix Library content exist',()=>{
 assert.equal(questions.length,10);assert.equal(fixes.length,10);assert.equal(new Set(fixes.map(f=>f.id)).size,10);
 for(const f of fixes){for(const field of ['title','short','immediate','cost','when','category'])assert.ok(f[field],`${f.id}: ${field}`);for(const field of ['symptoms','steps','template'])assert.ok(f[field].length>=2);}
 assert.equal(services.length,4);
});
test('score endpoints and deterministic top three',()=>{
 const low=assess(safest()),high=assess(riskiest());assert.equal(low.score,0);assert.equal(high.score,100);
 assert.deepEqual(low.priorities.map(w=>w.id),['backups','access','email']);assert.ok(low.priorities.every(w=>w.maintenance));
 assert.equal(high.priorities.length,3);assert.equal(high.unknowns,7);
});
test('a single partial backup answer contributes its weighted share',()=>{
 const a=safest();a.backups='untested';assert.equal(assess(a).score,Math.round(100*(.65*5)/23));
});
test('size, budget and headache do not inflate the risk score',()=>{
 const a=safest(),b={...a,team:'100+',budget:'diy',pain:'incident'};assert.equal(assess(a).score,assess(b).score);assert.equal(assess(b).recommendation.mode,'external');
});
test('unknown is attention, not a verified finding',()=>{
 const a=safest();a.mfa='unknown';const r=assess(a);assert.equal(r.unknowns,1);assert.equal(r.score,22);assert.equal(r.priorities[0].id,'access');
});
test('missing, inherited and invalid answers never silently score',()=>{
 assert.throws(()=>assess({}));assert.throws(()=>assess({...safest(),mfa:'<script>'}));assert.throws(()=>assess(Object.create(safest())));
});
test('engagement routing respects DIY, small budget, rescue and ongoing work',()=>{
 assert.equal(recommend({budget:'diy'}).mode,'diy');assert.equal(recommend({budget:'under-1000'}).serviceId,'tune-up');assert.equal(recommend({pain:'stalled'}).serviceId,'rescue');assert.equal(recommend({pain:'ongoing'}).serviceId,'fractional');assert.equal(recommend({pain:'training'}).serviceId,'fix-sprint');
});
test('active incidents and large-team fit checks do not promise packages',()=>{
 assert.equal(recommend({pain:'incident',budget:'diy'}).mode,'external');assert.equal(recommend({team:'100+'}).serviceId,null);assert.match(recommend({urgency:'today'}).note,/does not imply same-day/);
});
test('results-only sharing round-trips without original answers',()=>{
 const r=assess(riskiest()),serialized=serializeReport(r),copy=parseSharedReport(serialized);
 assert.equal(copy.score,r.score);assert.equal(copy.shared,true);assert.equal(copy.unknowns,null);assert.deepEqual(copy.priorities.map(w=>w.id),r.priorities.map(w=>w.id));
 assert.deepEqual([...new URLSearchParams(serialized).keys()],['v','s','w','p','d']);
 assert.ok(!serialized.includes('email='));assert.ok(!serialized.includes('backups='));
});
test('invalid or malicious shared snapshots fail closed',()=>{
 const p=new URLSearchParams(serializeReport(assess(safest())));
 const mutations=[['s','101'],['s','NaN'],['s','-1'],['s',''],['s','1.5'],['w','__proto__,access,email'],['w','backups,backups,email'],['w','<script>,access,email'],['p','javascript:alert(1)'],['v','2'],['d','2026-02-30'],['d','invalid']];
 for(const [k,v]of mutations){const next=new URLSearchParams(p);next.set(k,v);assert.equal(parseSharedReport(next.toString()),null,`${k}=${v}`);}
 assert.equal(parseSharedReport(p+'&name=client'),null);assert.equal(parseSharedReport(p+'&s=1'),null);assert.equal(parseSharedReport('x'.repeat(401)),null);assert.equal(parseSharedReport(null),null);
});
test('search is case-insensitive, multiword and category-aware',()=>{
 assert.equal(searchFixes('EXCEL')[0].id,'excel-report');assert.equal(searchFixes('email','Email & access').length,2);assert.equal(searchFixes('sharepoint pilot')[0].id,'sharepoint-move');assert.equal(searchFixes('zzzz unknown').length,0);assert.equal(searchFixes('', 'All problems').length,10);
});
test('PDF has valid header, xref byte offsets, page lengths and evidence caveat',()=>{
 const pdf=Buffer.from(createReportPDF(reportLines(assess(riskiest())))).toString('ascii');assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.endsWith('%%EOF\n'));assert.match(pdf,/not a security scan/);assert.match(pdf,/Proposed CAD planning ranges/);
 const offset=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(offset,offset+4),'xref');
 const count=Number(pdf.match(/xref\n0 (\d+)/)[1]);const rows=pdf.slice(offset).split('\n').slice(3,3+count-1);
 rows.forEach((row,i)=>assert.equal(pdf.slice(Number(row.slice(0,10)),Number(row.slice(0,10))+`${i+1} 0 obj`.length),`${i+1} 0 obj`));
 for(const match of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g))assert.equal(match[2].length,Number(match[1]));
 assert.ok(!/[^\x00-\x7f]/.test(pdf));
});
test('mail is an encoded draft to a fixed address, not a network submission',()=>{
 const draft=createMailDraft({kind:'15-minute tech question',name:'A&B',context:'A test? x=1 & safe=true\nNever include secrets.'});
 const url=new URL(draft.url);assert.equal(url.pathname,'contact@mapledominionconsult.com');assert.match(url.searchParams.get('body'),/A&B/);assert.match(url.searchParams.get('body'),/not a confirmed appointment/);assert.equal(url.searchParams.get('safe'),null);
});
