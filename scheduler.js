// Janki scheduling engine. This is an original implementation of the
// classic SM-2-style scheduler described in the Anki manual; it does not
// copy Anki source code or assets.
export const DAY = 86400000, MIN = 60000;
export const RATING = Object.freeze({ AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 });

export function defaultOptions() {
  return {
    learningSteps: [1, 10], relearningSteps: [10], graduatingInterval: 1,
    easyInterval: 4, startingEase: 2.5, easyBonus: 1.3,
    intervalModifier: 1, hardIntervalFactor: 1.2, newLapseIntervalPercent: 0,
    minimumInterval: 1, maximumInterval: 36500, leechThreshold: 8,
    leechAction: "tag", fuzz: true, learnAheadMinutes: 20,
    dayCutoffHour: 4, timezone: "local", newPerDay: 20, reviewPerDay: 200,
  };
}

export function initialState() {
  return { state: "new", due: 0, interval: 0, ease: null, step: 0,
    reps: 0, lapses: 0, suspended: false, leech: false, lastRating: null };
}

export function formatDelay(ms) {
  if (ms < MIN) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < DAY) return `${Math.max(1, Math.round(ms / MIN))}m`;
  const d = ms / DAY;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}y`;
}

function localCutoff(ts, hour) {
  const d = new Date(ts);
  d.setHours(hour, 0, 0, 0);
  if (ts < d.getTime()) d.setDate(d.getDate() - 1);
  return d.getTime();
}
function utcCutoff(ts, hour) {
  const d = new Date(ts);
  let c = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour);
  if (ts < c) c -= DAY;
  return c;
}
/** Return the start of the current Anki-style day. Default stays UTC for
 * deterministic pure-function tests; the shipped app uses timezone="local". */
export function cutoffInstant(ts, cutoffHour = 4, timezone = "utc") {
  return timezone === "local" ? localCutoff(ts, cutoffHour) : utcCutoff(ts, cutoffHour);
}

function stepDelayMs(steps, i) { return (steps[i] ?? steps.at(-1) ?? 1) * MIN; }
function hardStepDelayMs(steps, i) {
  const cur = steps[i] ?? steps.at(-1) ?? 1, next = steps[i + 1];
  return (next == null ? cur * 1.5 : (cur + next) / 2) * MIN;
}
function fuzzedInterval(rawDays, opts, rand) {
  const capped = Math.min(Math.max(rawDays, opts.minimumInterval), opts.maximumInterval);
  if (!opts.fuzz || capped < 2) return Math.round(capped);
  const pct = capped < 7 ? .15 : capped < 30 ? .10 : .05;
  const range = Math.max(1, Math.round(capped * pct));
  const delta = Math.round((rand() * 2 - 1) * range);
  return Math.min(opts.maximumInterval, Math.max(opts.minimumInterval, Math.round(capped) + delta));
}
function graduate(s, intervalDays, now, opts) {
  s.state = "review"; s.step = 0;
  s.interval = Math.min(opts.maximumInterval, Math.max(opts.minimumInterval, intervalDays));
  s.ease = s.ease ?? opts.startingEase;
  s.due = cutoffInstant(now, opts.dayCutoffHour, opts.timezone) + s.interval * DAY;
  return s;
}

export function next(card, rating, now = Date.now(), opts = {}, rand = Math.random) {
  const o = { ...defaultOptions(), ...opts };
  const s = { ...initialState(), ...card };
  const learn = o.learningSteps.length ? o.learningSteps : [1];
  const relearn = o.relearningSteps.length ? o.relearningSteps : [10];
  const cutoff = () => cutoffInstant(now, o.dayCutoffHour, o.timezone);

  if (s.state === "new") {
    if (rating === RATING.AGAIN) { s.state="learning"; s.step=0; s.due=now+stepDelayMs(learn,0); }
    else if (rating === RATING.HARD) { s.state="learning"; s.step=0; s.due=now+hardStepDelayMs(learn,0); }
    else if (rating === RATING.GOOD) learn.length > 1
      ? (s.state="learning", s.step=1, s.due=now+stepDelayMs(learn,1))
      : graduate(s,o.graduatingInterval,now,o);
    else graduate(s,o.easyInterval,now,o);
  } else if (s.state === "learning") {
    if (rating === RATING.AGAIN) { s.step=0; s.due=now+stepDelayMs(learn,0); }
    else if (rating === RATING.HARD) s.due=now+hardStepDelayMs(learn,s.step);
    else if (rating === RATING.GOOD) s.step+1<learn.length
      ? (s.step++, s.due=now+stepDelayMs(learn,s.step))
      : graduate(s,o.graduatingInterval,now,o);
    else graduate(s,o.easyInterval,now,o);
  } else if (s.state === "review") {
    if (rating === RATING.AGAIN) {
      s.lapses=(s.lapses||0)+1; s.ease=Math.max(1.3,(s.ease??o.startingEase)-.20);
      s.interval=Math.max(o.minimumInterval,Math.round(s.interval*(o.newLapseIntervalPercent/100)));
      s.state="relearning"; s.step=0; s.due=now+stepDelayMs(relearn,0);
      if (o.leechThreshold>0 && s.lapses%o.leechThreshold===0) {
        s.leech=true; if (o.leechAction==="suspend") s.suspended=true;
      }
    } else if (rating === RATING.HARD) {
      const ivl=Math.max(s.interval+1,Math.round(s.interval*o.hardIntervalFactor*o.intervalModifier));
      s.ease=Math.max(1.3,(s.ease??o.startingEase)-.15); s.interval=fuzzedInterval(ivl,o,rand);
      s.due=cutoff()+s.interval*DAY;
    } else if (rating === RATING.GOOD) {
      const ease=s.ease??o.startingEase, ivl=Math.max(s.interval+1,Math.round(s.interval*ease*o.intervalModifier));
      s.interval=fuzzedInterval(ivl,o,rand); s.due=cutoff()+s.interval*DAY;
    } else {
      const ease=s.ease??o.startingEase, ivl=Math.max(s.interval+1,Math.round(s.interval*ease*o.easyBonus*o.intervalModifier));
      s.ease=(s.ease??o.startingEase)+.15; s.interval=fuzzedInterval(ivl,o,rand); s.due=cutoff()+s.interval*DAY;
    }
  } else if (s.state === "relearning") {
    if (rating === RATING.AGAIN) { s.step=0; s.due=now+stepDelayMs(relearn,0); }
    else if (rating === RATING.HARD) s.due=now+hardStepDelayMs(relearn,s.step);
    else if (rating === RATING.GOOD) s.step+1<relearn.length
      ? (s.step++, s.due=now+stepDelayMs(relearn,s.step))
      : (s.state="review",s.step=0,s.due=cutoff()+s.interval*DAY);
    else { s.state="review"; s.step=0; s.due=cutoff()+s.interval*DAY; }
  }
  s.reps=(s.reps||0)+1; s.lastRating=rating;
  return s;
}

export function isDue(card, now = Date.now()) { return !card.suspended && (!card.due || card.due <= now); }
export function previewDelays(card, opts, now = Date.now()) {
  const out={}, mid=()=>.5;
  for (const r of Object.values(RATING)) out[r]=formatDelay(Math.max(0,next(card,r,now,opts,mid).due-now));
  return out;
}
