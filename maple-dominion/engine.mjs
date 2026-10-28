import { questions, wins, services, fixes, PRICING_NOTICE } from './data.mjs';
export const money = n => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);
export const serviceById = id => services.find(s=>s.id===id);
export const scoreBand = score => score>=65 ? 'Start with the basics this week' : score>=30 ? 'A few useful gaps to close' : 'Keep the good habits going';
export function recommend({team='2-10',pain='tools',urgency='flexible',budget='unsure'}={}) {
 if(pain==='incident')return {mode:'external',serviceId:null,title:'Contain the incident first',note:'Possible account compromise or payment fraud is not a routine consulting enquiry. Contact your current IT/email provider through a trusted channel, and your bank immediately if money may be at risk. Do not wait for a call here.',turnaround:'Use your incident and banking channels now. No response SLA is offered here.'};
 if(team==='100+')return {mode:'external',serviceId:null,title:'Check the fit before choosing a package',note:'A team of more than 100 needs a requirements conversation. An established managed-service provider or specialist may be a better fit for broad operational coverage.',turnaround:'No package or start date assumed.'};
 if(budget==='diy')return {mode:'diy',serviceId:null,title:'Start with the free checklist',note:'Do the low-risk steps you can own. Use the Fix Library before committing to paid work; a short question can help clarify a sticking point.',turnaround:'Self-paced. No paid engagement required.'};
 const id=budget==='under-1000'?'tune-up':pain==='stalled'?'rescue':pain==='ongoing'?'fractional':['manual','tools','training','website','data'].includes(pain)?'fix-sprint':'tune-up';
 const service=serviceById(id);
 return {mode:'service',serviceId:id,title:service.name,note:(team==='31-100'?'Your team size needs explicit scope confirmation. ':'')+(urgency==='today'?'A deadline today does not imply same-day availability. Contact an established support provider if the business cannot wait. ':'')+'A useful starting point, not a formal quote. Confirm access, fit and the written finish line first.',turnaround:`Planning window: ${service.time}. ${urgency==='week'?'A start this week is subject to availability.':'Start date confirmed after scoping.'}`};
}
export function assess(answers) {
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw new Error('Please provide your selected answers.');
 for(const q of questions){if(!Object.hasOwn(answers,q.id)||!q.options.some(o=>o[0]===answers[q.id]))throw new Error(`Please answer: ${q.label}`);}
 const weighted=questions.filter(q=>q.weight).map(q=>{const option=q.options.find(o=>o[0]===answers[q.id]);return {id:q.domain,value:option[2],weight:q.weight,unknown:answers[q.id]==='unknown'};});
 const score=Math.round(100*weighted.reduce((sum,d)=>sum+d.value*d.weight,0)/weighted.reduce((sum,d)=>sum+d.weight,0));
 const priorities=[...weighted].sort((a,b)=>b.value*b.weight-a.value*a.weight || b.weight-a.weight).slice(0,3).map(d=>({id:d.id,...wins[d.id],maintenance:d.value===0}));
 return {score,band:scoreBand(score),priorities,unknowns:weighted.filter(d=>d.unknown).length,recommendation:recommend({team:answers.team,pain:answers.pain,budget:answers.budget}),created:new Date().toISOString().slice(0,10),shared:false};
}
export function serializeReport(report) {
 const params=new URLSearchParams({v:'1',s:String(report.score),w:report.priorities.map(w=>w.id).join(','),p:report.recommendation.serviceId||report.recommendation.mode,d:report.created});
 if(!parseSharedReport(params.toString()))throw new Error('Invalid report');
 return params.toString();
}
export function parseSharedReport(raw) {
 if(typeof raw!=='string'||raw.length>400)return null;
 const p=new URLSearchParams(raw);
 if([...p.keys()].some(k=>!['v','s','w','p','d'].includes(k))||[...p.keys()].length!==5)return null;
 if(p.get('v')!=='1'||!/^\d{1,3}$/.test(p.get('s')||''))return null;
 const score=Number(p.get('s'));if(score<0||score>100)return null;
 const ids=(p.get('w')||'').split(',');if(ids.length!==3||new Set(ids).size!==3||ids.some(id=>!Object.hasOwn(wins,id)))return null;
 const d=p.get('d')||'';if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)return null;
 const service=serviceById(p.get('p'));
 let recommendation;
 if(service)recommendation={mode:'service',serviceId:service.id,title:service.name,note:'Shared planning recommendation, not an approved offer or quote.',turnaround:`Planning window: ${service.time}; availability and scope must be confirmed.`};
 else if(p.get('p')==='diy')recommendation=recommend({budget:'diy'});
 else if(p.get('p')==='external')recommendation={mode:'external',serviceId:null,title:'Use the right specialist or support channel',note:'This shared result recommended outside support or a fit review. It does not contain the original answers. If an incident or fraud is active, contact the appropriate provider and bank now.',turnaround:'Do not infer an appointment or incident-response SLA.'};
 else return null;
 return {score,band:scoreBand(score),priorities:ids.map(id=>({id,...wins[id],maintenance:score===0})),unknowns:null,recommendation,created:d,shared:true};
}
export function searchFixes(query='',category='All problems') {
 const tokens=String(query).normalize('NFKD').toLowerCase().trim().split(/\s+/).filter(Boolean);
 return fixes.filter(f=>(category==='All problems'||f.category===category)&&tokens.every(token=>[f.title,f.short,f.category,...f.symptoms].join(' ').normalize('NFKD').toLowerCase().includes(token)));
}
export function reportLines(r) {
 const service=serviceById(r.recommendation.serviceId);
 return ['MAPLE DOMINION CONSULTING INC.','YOUR PRACTICAL TECH CHECK',`Date: ${r.created}`,`Self-reported priority score: ${r.score}/100 (higher means more attention)`,r.band,'This is a planning aid, not a security scan, diagnosis or compliance audit.',r.shared?'Shared editable snapshot; original answers were not included.':`Unknown risk-control answers: ${r.unknowns}. Unknowns receive the highest attention weight.`,'',...r.priorities.flatMap((w,i)=>[`${i+1}. ${w.title}`,`First step: ${w.verb}`,`DIY time allowance: ${w.time}`,`Cost allowance: ${w.cost}`,...w.steps.map(step=>`[ ] ${step}`),'']),`NEXT STEP: ${r.recommendation.title}`,r.recommendation.note,r.recommendation.turnaround,...(service?[`Proposed range: CAD ${money(service.low)}-${money(service.high)} ${service.period}`,`Includes: ${service.includes.join('; ')}`,`Excludes: ${service.excludes.join('; ')}`,service.boundary]:[]),'',PRICING_NOTICE,'Active fraud or compromise? Use your provider/bank incident channels immediately.','Contact: contact@mapledominionconsult.com','Sharing: the results link contains a score, three priority IDs, a route and date.','Anyone with that link can read and edit that snapshot. It contains no raw answers.'];
}
export function toPlainASCII(text) {
 return String(text).replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/↗/g,'').normalize('NFKD').replace(/[^\x20-\x7E\n]/g,'');
}
// A small dependency-free PDF writer. All encoded text is ASCII, so xref offsets
// remain byte-correct. Fixed-width wrapping is conservative for 10pt Helvetica.
export function createReportPDF(lines) {
 const wrapped=lines.flatMap(line=>{
  const words=toPlainASCII(line).split(/\s+/);const rows=[];let row='';
  for(let word of words){while(word.length>86){if(row){rows.push(row);row='';}rows.push(word.slice(0,86));word=word.slice(86);}if((row+' '+word).trim().length>86){rows.push(row);row=word;}else row=(row+' '+word).trim();}
  rows.push(row);return rows;
 });
 const pages=[];for(let i=0;i<wrapped.length;i+=46)pages.push(wrapped.slice(i,i+46));if(!pages.length)pages.push(['Maple Dominion Consulting Inc.']);
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const refs=[];
 for(const [i,page]of pages.entries()){
  const pageId=objects.length,streamId=pageId+1;refs.push(`${pageId} 0 R`);
  const escape=s=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const stream=`BT /F1 10 Tf 14 TL 48 742 Td ${page.map((s,n)=>`${n?'T* ':''}(${escape(s)}) Tj`).join('\n')} ET\nBT /F1 8 Tf 48 35 Td (Maple Dominion | Planning aid | Page ${i+1} of ${pages.length}) Tj ET\n`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
 }
 objects[2]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${pages.length} >>`;
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('');
 pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new TextEncoder().encode(pdf);
}
export function createMailDraft({kind='Project enquiry',name='',email='',company='',context=''}) {
 const body=[`Request: ${String(kind).slice(0,100)}`,`Name: ${String(name).slice(0,100)}`,`Reply email: ${String(email).slice(0,160)}`,`Business: ${String(company).slice(0,160)}`,'',String(context).slice(0,1800),'','I understand this is a request, not a confirmed appointment.'].join('\n');
 return {text:body,url:`mailto:contact@mapledominionconsult.com?subject=${encodeURIComponent('Maple Dominion: '+String(kind).slice(0,100))}&body=${encodeURIComponent(body)}`};
}
