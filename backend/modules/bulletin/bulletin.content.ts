export const contentFields = ['title','content','image_url','image_alt','gallery','post_type','event_starts_at','event_ends_at','event_location','event_registration_url'] as const;
const gallery = (value:any) => {try{const parsed=typeof value === 'string'?JSON.parse(value):value;return Array.isArray(parsed)?parsed:[];}catch{return [];}};
export function contentChanged(before:any,after:any) {
 return contentFields.some(key=>{
  if(key==='gallery')return JSON.stringify(gallery(before[key]).map((image:any)=>({url:image.url,alt:image.alt||''})))!==JSON.stringify(gallery(after[key]).map((image:any)=>({url:image.url,alt:image.alt||''})));
  if(key.endsWith('_at'))return (before[key]?new Date(before[key]).getTime():null)!==(after[key]?new Date(after[key]).getTime():null);
  return (before[key]||null)!==(after[key]||null);
 });
}
const fail=(message:string):never=>{throw Object.assign(new Error(message),{status:400});};
function imageUrl(value:any){if(!value)return null;if(typeof value!=='string'||value.length>512)fail('Invalid image URL.');let url:URL;try{url=new URL(value);}catch{fail('Invalid image URL.');}if(!['https:','http:'].includes(url!.protocol)||url!.username||url!.password)fail('Invalid image URL.');return value;}
export function normalizePostContent(input:any){
 if(typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>255)fail('Enter a title of up to 255 characters.');
 if(typeof input.content!=='string'||!input.content.trim()||input.content.length>50000)fail('Enter post content of up to 50,000 characters.');
 const images=input.gallery||[];if(!Array.isArray(images)||images.length>8)fail('A post supports up to eight gallery images.');
 const alt=(value:any)=>{if(value!=null&&(typeof value!=='string'||value.length>500))fail('Image descriptions must be 500 characters or fewer.');return value?.trim()||'';};
 return {title:input.title.trim(),content:input.content.trim(),image_url:imageUrl(input.image_url),image_public_id:typeof input.image_public_id==='string'?input.image_public_id.slice(0,512):null,image_alt:alt(input.image_alt),gallery:images.map((image:any)=>{if(!image||!image.url)fail('Choose an image for every gallery entry.');return {url:imageUrl(image.url),alt:alt(image.alt),...(typeof image.public_id==='string'?{public_id:image.public_id.slice(0,512)}:{})};})};
}

// Existing undescribed images remain readable; every newly attached image needs author-supplied text.
export function validateImageDescriptions(input:any,previous?:any) {
 const oldImages=[...(previous?.image_url?[{url:previous.image_url,alt:previous.image_alt}]:[]),...gallery(previous?.gallery)];
 const images=[...(input.image_url?[{url:input.image_url,alt:input.image_alt}]:[]),...gallery(input.gallery)];
 for(const image of images) {
  if(typeof image.alt==='string'&&image.alt.trim())continue;
  if(oldImages.some((old:any)=>old.url===image.url&&!old.alt?.trim()))continue;
  fail('Add a description for each new image before publishing.');
 }
}
