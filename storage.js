import { defaultOptions, initialState } from "./scheduler.js";
import { seedDecks, makeNote } from "./data.js";
export const KEY="janki.collection.v5", OLD_KEYS=["janki.collection.v4","janki.collection.v3"];
export function blank(){return {version:5,notes:[],cards:{},reviews:[],settings:defaultOptions()};}
export function seed(){const d=blank();for(const [deck,arr] of Object.entries(seedDecks))for(const a of arr){const n=makeNote(a,deck);d.notes.push(n);d.cards[n.id]={...initialState(),noteId:n.id};}return d;}
function normalize(raw){const d=blank();d.notes=Array.isArray(raw?.notes)?raw.notes:[];d.reviews=Array.isArray(raw?.reviews)?raw.reviews.map(r=>({...r,wasState:r.wasState||"review"})):[];d.settings={...defaultOptions(),...(raw?.settings||{})};for(const n of d.notes)d.cards[n.id]={...initialState(),...(raw?.cards?.[n.id]||{}),noteId:n.id};return d;}
export function parseBackup(text){const raw=JSON.parse(text);if(!raw||!Array.isArray(raw.notes)||typeof raw.cards!=="object")throw new Error("Invalid Janki backup");return normalize(raw);}
export function load(storage=localStorage){for(const key of [KEY,...OLD_KEYS]){try{const raw=storage.getItem(key);if(raw){const d=normalize(JSON.parse(raw));storage.setItem(KEY,JSON.stringify(d));return d;}}catch{ /* try the next source */ }}const d=seed();storage.setItem(KEY,JSON.stringify(d));return d;}
export function save(db,storage=localStorage){storage.setItem(KEY,JSON.stringify(db));}
export function serialize(db){return JSON.stringify(db,null,2);}
