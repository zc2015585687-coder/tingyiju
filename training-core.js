import {grammarUnits} from './training-data.js';
import {defaultCourse} from './course.js';
export const normalizeAnswer=s=>String(s).normalize('NFC').replace(/[\s.,!?，。！？…“”‘’'"()[\]{}-]/g,'');
const fingerprint=s=>{let h=2166136261;for(const c of s){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
export function unitFor(p){const original=defaultCourse.phrases.find(x=>x.id===p.id);return original&&normalizeAnswer(original.ko)===normalizeAnswer(p.ko)?grammarUnits[p.id]:null;}
export function shuffle(items,random=Math.random){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function buildQuestions(course,phraseId,kind){
 const phrases=phraseId?course.phrases.filter(p=>p.id===phraseId):course.phrases,allMeanings=[...new Set(course.phrases.flatMap(p=>p.vocab.map(v=>v.meaning.trim())).filter(Boolean))],questions=[];
 const add=(p,q)=>questions.push({...q,phraseId:p.id,lyric:p.ko,id:`${p.id}-${q.kind}-${q.slot}-${fingerprint(JSON.stringify([q.prompt,q.answer,q.explanation,q.tokens]))}`});
 for(const p of phrases){
  if(!kind||kind==='vocab')p.vocab.forEach((v,i)=>{const term=v.term.trim(),meaning=v.meaning.trim();if(!term||!meaning)return;
   const options=[meaning,...allMeanings.filter(x=>x!==meaning&&x!==term).slice(i%Math.max(1,allMeanings.length-1)).slice(0,3)];
   if(options.length<2)options.push(...allMeanings.filter(x=>!options.includes(x)).slice(0,3));
   if(options.length>=2)add(p,{kind:'vocab',slot:`meaning${i}`,type:'choice',prompt:`「${term}」在本句中的意思是哪一个？`,answer:meaning,options:[...new Set(options)],explanation:`${term}：${meaning}`,hint:'先回想本句情境，再辨认这个词的含义。'});
   add(p,{kind:'vocab',slot:`recall${i}`,type:'text',prompt:`根据中文写出本句词条：${meaning}`,answer:term,explanation:`本课程词条为「${term}」。词典形、缩略词和固定词组按课程词条回忆。`,hint:`首字：${[...term][0]}；共 ${[...term.replace(/\s/g,'')].length} 个字符（不计空格）。`});
  });
  const unit=unitFor(p);
  if((!kind||kind==='grammar')&&unit){
   add(p,{kind:'grammar',slot:'meaning',type:'choice',prompt:`本句「${unit.pattern}」重点表达什么？`,answer:unit.meaning,options:[unit.meaning,...unit.distractors],explanation:unit.rule+' '+unit.pitfall,hint:'先辨认它在句中承担时间、愿望、比较还是修饰作用。'});
   add(p,{kind:'grammar',slot:'form',type:'text',prompt:unit.cloze,answer:unit.answer,explanation:unit.form+' 例句：'+unit.example+'（'+unit.translation+'）',hint:unit.pattern});
  }
  if(!kind||kind==='sentence'){
   const tokens=p.ko.trim().split(/\s+/);if(tokens.length>1)add(p,{kind:'sentence',slot:'order',type:'order',prompt:`按本课程原句重组：${p.zh||'还原本句歌词'}`,answer:p.ko,tokens,explanation:unit?.parts||p.grammar||'按本课程原句顺序练习。',hint:`开头词组：${tokens[0]}`});
   if(p.zh.trim())add(p,{kind:'sentence',slot:'recall',type:'text',prompt:`看中文，回忆本课程韩文原句：${p.zh}`,answer:p.ko,explanation:unit?.parts||p.grammar||'答案按本课程原句核对。',hint:`开头词组：${tokens[0]}。可保留原歌词空格或规范分写。`});
  }
 }
 return questions;
}
export function isCorrect(question,answer){return question.type==='choice'?answer===question.answer:normalizeAnswer(answer)===normalizeAnswer(question.answer);}
export function recordAttempt(records,question,correct,assisted=false,at=Date.now()){
 const previous=records[question.id];records[question.id]={attempts:Math.min(1000000,(previous?.attempts||0)+1),correct:Math.min(1000000,(previous?.correct||0)+(correct&&!assisted?1:0)),lastCorrect:correct&&!assisted,assisted,at};return records[question.id];
}
export function mergePractice(current,incoming){
 const out=structuredClone(current||{});if(incoming===undefined)return out;
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming)||Object.keys(incoming).length>5000)throw Error('练习记录格式不正确');
 for(const [key,r] of Object.entries(incoming)){
  if(!/^[a-zA-Z0-9_-]{1,160}$/.test(key)||['__proto__','constructor','prototype'].includes(key)||!r||!Number.isInteger(r.attempts)||r.attempts<1||r.attempts>1000000||!Number.isInteger(r.correct)||r.correct<0||r.correct>r.attempts||typeof r.lastCorrect!=='boolean'||typeof r.assisted!=='boolean'||!Number.isFinite(r.at)||r.at<0||r.at>Date.now()+86400000)throw Error('练习记录格式不正确');
  if(!out[key]||r.at>out[key].at)out[key]={attempts:r.attempts,correct:r.correct,lastCorrect:r.lastCorrect,assisted:r.assisted,at:r.at};
 }
 return out;
}
export function practiceStats(questions,records={}){return {total:questions.length,done:questions.filter(q=>records[q.id]).length,independent:questions.filter(q=>records[q.id]?.lastCorrect).length,review:questions.filter(q=>records[q.id]&&!records[q.id].lastCorrect).length};}
