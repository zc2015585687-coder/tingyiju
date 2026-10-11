import {buildQuestions,shuffle,isCorrect,recordAttempt,practiceStats,unitFor} from './training-core.js';
import {trainingSources} from './training-data.js';
const $=id=>document.getElementById(id),element=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const labels={vocab:'词汇回忆',grammar:'语法练习',sentence:'整句训练',review:'错题复练'};
export class PracticeController{
 constructor({getCourse,getPhrase,getProgress,save,stop,canListen,listen,onError}){
  Object.assign(this,{getCourse,getPhrase,getProgress,save,stop,canListen,listen,onError});this.queue=[];this.position=0;this.results=[];
  document.querySelectorAll('[data-training]').forEach(b=>b.onclick=()=>this.start(b.dataset.training));
  $('practiceForm').onsubmit=e=>{e.preventDefault();this.submit().catch(onError);};
  $('practiceReveal').onclick=()=>this.finish(false,true).catch(onError);
  $('practiceHint').onclick=()=>{this.assisted=true;$('practiceHintText').textContent=this.question.hint;$('practiceHintText').hidden=false;};
  $('practiceNext').onclick=()=>{this.position++;this.showQuestion();};
  $('practiceRestart').onclick=()=>this.start(this.kind);
  $('practiceAgain').onclick=()=>this.start('review');
  $('practiceListen').onclick=async()=>{try{this.assisted=true;$('practiceHintText').textContent='本题已用录音提示；播放按当前候选时间，首尾仍需核对。';$('practiceHintText').hidden=false;await this.listen(this.question);}catch(e){this.onError(e);}};
  $('practiceDialog').addEventListener('close',()=>this.stop());
 }
 sync(){
  const p=this.getPhrase(),c=this.getCourse(),records=this.getProgress().practice||{},all=buildQuestions(c),stats=practiceStats(all,records),local=practiceStats(buildQuestions(c,p.id),records);
  $('practiceSummary').textContent=`本句 ${local.total} 题 · 已独立答对 ${local.independent} 题`;
  $('practiceCourseStats').textContent=`全课 ${stats.total} 题 · 已练 ${stats.done} · 待复练 ${stats.review}`;
  document.querySelector('[data-training=grammar]').disabled=!buildQuestions(c,p.id,'grammar').length;
  $('practiceAgainCount').textContent=String(stats.review);document.querySelector('[data-training=review]').disabled=stats.review===0;
  $('grammarFocus').replaceChildren();const unit=unitFor(p);$('grammarFocus').hidden=!unit;
  if(unit){for(const [title,text] of [['本句句型',unit.pattern],['结构拆解',unit.parts],['怎么使用',unit.rule],['迁移例句',`${unit.example}\n${unit.translation}`],['容易混淆',unit.pitfall]]){const section=element('div',undefined,'grammar-focus-row');section.append(element('strong',title),element('p',text));$('grammarFocus').append(section);}}
 }
 start(kind){
  this.stop();this.kind=kind;this.courseId=this.getCourse().id;const all=buildQuestions(this.getCourse()),records=this.getProgress().practice||{};
  this.queue=kind==='review'?all.filter(q=>records[q.id]&&!records[q.id].lastCorrect).sort((a,b)=>records[a.id].at-records[b.id].at).slice(0,12):buildQuestions(this.getCourse(),this.getPhrase().id,kind);
  this.position=0;this.results=[];$('practiceTitle').textContent=labels[kind];
  if(!$('practiceDialog').open)$('practiceDialog').showModal();this.showQuestion();
 }
 showQuestion(){
  $('practiceDialog').scrollTop=0;this.done=false;this.assisted=false;this.answer='';this.chosen=[];
  for(const id of ['practiceFeedback','practiceHintText','practiceNext','practiceCompletion'])$(id).hidden=true;
  $('practiceForm').hidden=this.position>=this.queue.length;$('practiceHelp').hidden=this.position>=this.queue.length;
  if(this.position>=this.queue.length){
   $('practicePosition').textContent='这一组完成';$('practiceCompletion').hidden=false;
   const independent=this.results.filter(r=>r.correct&&!r.assisted).length;
   $('practiceResult').textContent=this.queue.length?`完成 ${this.queue.length} 题，独立答对 ${independent} 题。用过提示、看过答案或答错的题会保留在待复练中。`:'当前没有可练题目。编辑后的歌词不再套用旧语法题；仍可练词汇和整句。';
   const stats=practiceStats(buildQuestions(this.getCourse()),this.getProgress().practice||{});$('practiceAgain').disabled=stats.review===0;this.sync();return;
  }
  this.question=this.queue[this.position];const q=this.question;$('practicePosition').textContent=`${this.position+1} / ${this.queue.length} · ${labels[q.kind]}`;
  $('practicePrompt').textContent=q.prompt;$('practicePhraseLabel').textContent=`第 ${q.phraseId.replace(/^p0?/,'')} 个学习句`;
  $('practiceAnswerArea').replaceChildren();$('practiceCheck').disabled=false;$('practiceReveal').disabled=false;$('practiceHint').disabled=false;
  $('practiceListen').disabled=!this.canListen(q);
  $('practiceMethod').textContent=q.type==='order'?'点击词块拼句；点已选词块可撤回。按原歌词顺序核对，不评价所有可能的韩语表达。':q.type==='text'?'先回忆再输入韩文。空格和标点不计分；文字须对应课程词条或原句。':'先选择一个答案，再点“核对”。';
  if(q.type==='choice'){
   const list=element('div',undefined,'practice-options');for(const option of shuffle(q.options)){const b=element('button',option);b.type='button';b.setAttribute('aria-pressed','false');b.onclick=()=>{if(this.done)return;this.answer=option;for(const x of list.children)x.setAttribute('aria-pressed',String(x===b));};list.append(b);}$('practiceAnswerArea').append(list);
  }else if(q.type==='text'){
   const label=element('label','你的韩文答案');label.htmlFor='practiceAnswer';const input=element('textarea');input.id='practiceAnswer';input.lang='ko';input.rows=q.kind==='sentence'?3:2;input.maxLength=1000;input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label','你的韩文答案');$('practiceAnswerArea').append(label,input);
  }else{
   $('practiceAnswerArea').append(element('div',undefined,'practice-built'),element('div',undefined,'practice-bank'));this.bank=shuffle(q.tokens.map((text,id)=>({text,id})));if(this.bank.every((t,i)=>t.id===i))this.bank.push(this.bank.shift());this.renderOrder();
  }
 }
 renderOrder(){
  const built=document.querySelector('#practiceAnswerArea .practice-built'),bank=document.querySelector('#practiceAnswerArea .practice-bank');built.replaceChildren();bank.replaceChildren();
  if(!this.chosen.length)built.append(element('span','在这里拼出原句','muted'));
  for(const id of this.chosen){const token=this.bank.find(t=>t.id===id),b=element('button',token.text);b.type='button';b.lang='ko';b.setAttribute('aria-label','撤回词块 '+token.text);b.onclick=()=>{if(!this.done){this.chosen=this.chosen.filter(x=>x!==id);this.renderOrder();}};built.append(b);}
  for(const token of this.bank){const b=element('button',token.text);b.type='button';b.lang='ko';b.disabled=this.done||this.chosen.includes(token.id);b.onclick=()=>{this.chosen.push(token.id);this.renderOrder();};bank.append(b);}
 }
 async submit(){
  if(this.done)return;const q=this.question;
  let answer=q.type==='text'?$('practiceAnswer').value:q.type==='order'?this.chosen.map(id=>this.bank.find(t=>t.id===id).text).join(' '):this.answer;
  if(!answer.trim()||(q.type==='order'&&this.chosen.length!==q.tokens.length)){$('practiceHintText').textContent=q.type==='order'?'请先选齐词块，再核对。':'请先填写或选择答案。';$('practiceHintText').hidden=false;return;}
  await this.finish(isCorrect(q,answer),this.assisted);
 }
 async finish(correct,assisted){
  if(this.done)return;this.done=true;this.stop();const q=this.question;this.results.push({correct,assisted});
  const records=this.getProgress().practice??={};recordAttempt(records,q,correct,assisted);
  $('practiceFeedback').replaceChildren();const message=correct?(assisted?'答案正确，用过提示；保留待复练。':'答对了！这题已记录为独立答对。'):(assisted?'已查看答案，保留待复练。':'这题需要再练。看看哪里不同。');
  $('practiceFeedback').append(element('strong',message),element('p',`课程答案：${q.answer}`,'practice-correct-answer'),element('p',q.explanation));
  const detail=element('details'),summary=element('summary','回看原句与讲解');detail.append(summary,element('p',q.lyric));const p=this.getCourse().phrases.find(x=>x.id===q.phraseId);detail.append(element('p',p?.grammar||''));$('practiceFeedback').append(detail);
  $('practiceFeedback').hidden=false;$('practiceFeedback').dataset.result=correct&&!assisted?'correct':'review';
  $('practiceCheck').disabled=true;$('practiceReveal').disabled=true;$('practiceHint').disabled=true;$('practiceListen').disabled=true;
  $('practiceAnswerArea').querySelectorAll('button,textarea').forEach(b=>b.disabled=true);$('practiceNext').hidden=false;$('practiceNext').textContent=this.position===this.queue.length-1?'查看本组结果':'下一题';
  try{await this.save();}catch(e){this.onError(e);$('practiceFeedback').append(element('p','本次练习尚未写入本机。请保留页面并导出进度备份；后续成功保存会写入最新记录。','muted'));}
  this.sync();$('practiceNext').focus();
 }
}
export function appendTrainingSources(){for(const source of trainingSources){const a=element('a',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';$('trainingReferences').append(a);}}
