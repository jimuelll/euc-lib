import type { EmailMessage } from './email.provider';

const colors={ground:'#f1ece3',paper:'#fffdf8',ink:'#1b1719',muted:'#655b58',line:'#d6cebf',maroon:'#7a0000',gold:'#a77b20'};
const sans="Arial, Helvetica, sans-serif",serif="Georgia, 'Times New Roman', serif";
const escape=(value: string)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const paragraph=(content: string,style='')=>`<p style="margin:0 0 20px;font:16px/1.7 ${sans};color:${colors.ink};${style}">${content}</p>`;
const button=(label: string,url: string)=>`<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 24px"><tr><td bgcolor="${colors.maroon}" style="background:${colors.maroon};"><a href="${escape(url)}" style="display:inline-block;border:1px solid ${colors.maroon};padding:16px 28px;font:700 15px/1.2 ${sans};color:#fffdf8;text-decoration:none;text-align:center;">${escape(label)}</a></td></tr></table>`;
function shell({title,preheader,heading,body,note,footer,name}: {title: string; preheader: string; heading: string; body: string; note: string; footer: string; name: string}){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)}</title><style>body{margin:0;padding:0}a:focus-visible{outline:3px solid ${colors.gold};outline-offset:4px}@media(max-width:600px){.outer{padding:16px 10px!important}.inset{padding-left:26px!important;padding-right:26px!important}.title{font-size:34px!important;line-height:1.16!important}.masthead{font-size:25px!important}.school{font-size:11px!important}.recovery-code{font-size:40px!important;letter-spacing:6px!important}}</style></head>
 <body style="margin:0;background:${colors.ground};color:${colors.ink};-webkit-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escape(preheader)}</div>
 <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${colors.ground}" style="background:${colors.ground};"><tr><td class="outer" align="center" style="padding:28px 20px;">
 <table role="presentation" width="640" border="0" cellpadding="0" cellspacing="0" bgcolor="${colors.paper}" style="width:100%;max-width:640px;background:${colors.paper};border:1px solid ${colors.line};border-top:5px solid ${colors.maroon};">
 <tr><td class="inset" style="padding:27px 42px 24px;border-bottom:1px solid ${colors.line};"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td><p class="masthead" style="margin:0;font:normal 29px/1.2 ${serif};letter-spacing:-.5px;color:${colors.maroon};">EUC Library<span style="color:${colors.gold};">.</span></p><p class="school" style="margin:6px 0 0;font:12px/1.5 ${sans};color:${colors.muted};">Manuel S. Enverga University Foundation · Candelaria</p></td><td width="26" valign="top" align="right" aria-hidden="true"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td width="18" height="31" bgcolor="${colors.gold}" style="background:${colors.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table></td></tr>
 <tr><td class="inset" style="padding:32px 42px 28px;"><h1 class="title" style="margin:0 0 26px;font:normal 40px/1.14 ${serif};letter-spacing:-.8px;color:${colors.ink};">${heading}</h1>${paragraph(`Hello ${escape(name)},`,'margin-bottom:12px;')}${body}
 <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:26px;border-top:1px solid ${colors.line};"><tr><td style="padding-top:19px;">${note}</td></tr></table></td></tr>
 <tr><td class="inset" style="padding:20px 42px 23px;border-top:1px solid ${colors.line};background:#f7f3eb;"><p style="margin:0 0 5px;font:normal 18px/1.35 ${serif};color:${colors.maroon};">Your library, within reach.</p><p style="margin:0;font:12px/1.65 ${sans};color:${colors.muted};">${footer}</p></td></tr>
 </table></td></tr></table></body></html>`;
}
const small=(content: string)=>paragraph(content,`margin-bottom:0;font-size:13px;line-height:1.7;color:${colors.muted};`);

// Values are escaped at their point of insertion. Links are validated by renderEmail().
export function brandedEmail(message: EmailMessage, account: boolean): string {
 let body=paragraph(escape(message.message).replace(/\r?\n/g,'<br>'));
 if(account) {
  if(message.login_identifier) body+=`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 4px;border-top:1px solid ${colors.line};border-bottom:1px solid ${colors.line}"><tr><td style="padding:15px 0;font:13px/1.5 ${sans};color:${colors.muted};">Library login ID</td><td align="right" style="padding:15px 0;font:14px/1.5 'Courier New',monospace;color:${colors.ink};overflow-wrap:anywhere;">${escape(message.login_identifier)}</td></tr></table>`;
  if(message.code) body+=`<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:26px 0 22px;border-top:1px solid ${colors.line};border-bottom:1px solid ${colors.line};"><tr><td style="padding:20px 0 22px;"><p style="margin:0 0 12px;font:13px/1.5 ${sans};color:${colors.muted};">Your recovery code</p><p class="recovery-code" style="margin:0;font:normal 49px/1.2 'Courier New',monospace;letter-spacing:9px;color:${colors.maroon};">${escape(message.code)}</p></td></tr></table>`;
 } else {
  if(message.as_of) body+=small(escape(`Balances as of ${message.as_of}. Amounts are in PHP.`));
  for(const loan of message.loans || []) body+=`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid ${colors.line};margin-top:16px"><tr><td style="padding-top:16px;">${paragraph(`<strong>${escape(loan.title)}</strong><br>Due: ${escape(loan.due)}<br>Unsettled balance: PHP ${escape(loan.balance)}`)}</td></tr></table>`;
 }
 if(message.action_url) body+=button(message.action_label || 'Open library',message.action_url);
 return shell({title:message.subject,preheader:message.message.slice(0,160),heading:escape(message.subject),body,name:message.name,
  note:small(account ? 'If you did not request this, contact library staff. Never share your password or recovery code.' : 'You received this email as part of your library account notifications.'),
  footer:`${account ? 'An account email from EUC Library.' : 'Library notices, connected to your account.'}<br>Manuel S. Enverga University Foundation – Candelaria`});
}
