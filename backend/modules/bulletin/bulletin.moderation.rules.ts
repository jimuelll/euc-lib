export type Screening = {action:'allow'|'revise'|'hold';priority:'normal'|'urgent';reason:string;rule:string|null};
// Deliberately bounded bilingual rules. Identity words by themselves are not abuse.
// These rules screen for review; they never delete content or sanction an account.
export const screeningRules = [
 {id:'threat',priority:'urgent' as const,reason:'Possible threat or encouragement of harm',phrases:['i will kill you',"i'll kill you",'kill yourself','kys','papatayin kita','papatayin ko kayo','magpakamatay ka','sana mamatay ka']},
 {id:'targeted-abuse',priority:'normal' as const,reason:'Possible severe targeted or identity-based abuse',phrases:['nigger','nigga','faggot','retarded','salot ang mga bakla','kadiri ang mga bakla','salot ang mga muslim']},
];
export const profanityPhrases=['fuck','fucking','fucker','motherfucker','shit','bullshit','bitch','putangina','putang ina','tangina','tang ina','gago','gaga','ulol','punyeta','bobo','tanga','asshole','dickhead','cunt','putanginamo','tanginamo','gagoka','boboka','pakyu','tarantado','kupal'];
export function normalizeScreeningText(text:string){return text.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g,'').toLocaleLowerCase().replace(/[@013457]/g,c=>({'@':'a','0':'o','1':'i','3':'e','4':'a','5':'s','7':'t'}[c]!)).replace(/[^a-z0-9]+/g,' ').replace(/\b(?:[a-z]\s+){2,}[a-z]\b/g,m=>m.replace(/\s/g,'')).replace(/([a-z])\1{2,}/g,'$1').trim().replace(/\s+/g,' ');}
const hasPhrase=(text:string,phrase:string)=>` ${text} `.includes(` ${normalizeScreeningText(phrase)} `);
export function screenComment(text:string):Screening{
 const normalized=normalizeScreeningText(text);
 for(const rule of screeningRules)if(rule.phrases.some(phrase=>hasPhrase(normalized,phrase)))return {action:'hold',priority:rule.priority,reason:rule.reason,rule:rule.id};
 if(profanityPhrases.some(phrase=>hasPhrase(normalized,phrase)))return {action:'revise',priority:'normal',reason:'Please revise the profanity or insulting language before posting. Your text is kept.',rule:'profanity'};
 return {action:'allow',priority:'normal',reason:'',rule:null};
}
