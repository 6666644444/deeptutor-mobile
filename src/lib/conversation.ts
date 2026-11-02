import type { TurnEvent } from "./client";
export function conversationTitle(title:string){return /^(New conversation|New chat|New reading conversation)$/i.test(title)?"学习对话":title||"学习对话";}
export function dialogueParts(content:string,events:TurnEvent[]=[]):{role:"assistant"|"user";text:string}[]{
  const parts:{role:"assistant"|"user";text:string}[]=[];let offset=0;
  for(const event of events){const meta=event.metadata;if(!meta?.ask_user_resolved)continue;
    const value=Number(meta.assistant_content_offset);const boundary=Number.isFinite(value)?Math.max(offset,Math.min(content.length,value)):offset;
    if(boundary>offset)parts.push({role:"assistant",text:content.slice(offset,boundary)});
    offset=boundary;const answers=Array.isArray(meta.answers)?meta.answers:[];
    const reply=answers.map(a=>a&&typeof a==="object"&&"text" in a?String(a.text):"").filter(Boolean).join("\n");
    const text=reply||(typeof meta.reply_preview==="string"?meta.reply_preview:"");if(text)parts.push({role:"user",text});
  }
  if(offset<content.length)parts.push({role:"assistant",text:content.slice(offset)});return parts;
}
