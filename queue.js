import { initialState, cutoffInstant, MIN } from "./scheduler.js";
export function cardFor(db,n){return db.cards[n.id]||initialState();}
export function notes(db,deck){return db.notes.filter(n=>n.deck===deck);}
function sameDay(db,ts,now){return cutoffInstant(ts,db.settings.dayCutoffHour,db.settings.timezone)===cutoffInstant(now,db.settings.dayCutoffHour,db.settings.timezone);}
export function newDoneToday(db,deck,now=Date.now()){return db.reviews.filter(r=>r.deck===deck&&r.wasState==="new"&&sameDay(db,r.at,now)).length;}
export function reviewsDoneToday(db,deck,now=Date.now()){return db.reviews.filter(r=>r.deck===deck&&r.wasState==="review"&&sameDay(db,r.at,now)).length;}
export function deckCounts(db,deck,now=Date.now()){
  const ns=notes(db,deck).filter(n=>!cardFor(db,n).suspended), newLeft=Math.max(0,db.settings.newPerDay-newDoneToday(db,deck,now)), revLeft=Math.max(0,db.settings.reviewPerDay-reviewsDoneToday(db,deck,now));
  return {newC:Math.min(ns.filter(n=>cardFor(db,n).state==="new").length,newLeft),learnC:ns.filter(n=>["learning","relearning"].includes(cardFor(db,n).state)).length,reviewC:Math.min(ns.filter(n=>cardFor(db,n).state==="review"&&cardFor(db,n).due<=now).length,revLeft)};
}
export function pickNext(db,deck,now=Date.now(),session={}){
  const ns=notes(db,deck).filter(n=>!cardFor(db,n).suspended);
  const learning=ns.filter(n=>{const c=cardFor(db,n);return ["learning","relearning"].includes(c.state)&&c.due<=now;}).sort((a,b)=>cardFor(db,a).due-cardFor(db,b).due);
  if(learning.length)return learning[0];
  const remainingNew=Math.max(0,db.settings.newPerDay-newDoneToday(db,deck,now)), remainingRev=Math.max(0,db.settings.reviewPerDay-reviewsDoneToday(db,deck,now));
  const reviews=ns.filter(n=>{const c=cardFor(db,n);return c.state==="review"&&c.due<=now;}).sort((a,b)=>cardFor(db,a).due-cardFor(db,b).due).slice(0,remainingRev);
  const news=ns.filter(n=>cardFor(db,n).state==="new").sort((a,b)=>a.createdAt-b.createdAt).slice(0,remainingNew);
  if(reviews.length&&news.length){const ratio=Math.max(1,Math.round(reviews.length/news.length));session.sinceNew??=0;if(session.sinceNew>=ratio){session.sinceNew=0;return news[0];}session.sinceNew++;return reviews[0];}
  if(reviews.length)return reviews[0]; if(news.length)return news[0];
  const ahead=now+db.settings.learnAheadMinutes*MIN;
  return ns.filter(n=>{const c=cardFor(db,n);return ["learning","relearning"].includes(c.state)&&c.due<=ahead;}).sort((a,b)=>cardFor(db,a).due-cardFor(db,b).due)[0]||null;
}
export function deckHasWork(db,deck,now=Date.now()){const c=deckCounts(db,deck,now);return c.newC+c.learnC+c.reviewC>0||!!pickNext(db,deck,now,{});}
