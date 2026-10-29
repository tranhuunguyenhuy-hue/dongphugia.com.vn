// Never expose arbitrary exception text, even after attempted redaction.
export function exceptionCategory(message) {
 const s=String(message)
 const patterns=[['CROSS_REQUEST_IO',/I\/O.*different request|different request.*I\/O/i],['GLOBAL_SCOPE_IO',/global scope|outside.*request handler/i],['SUBREQUEST_LIMIT',/too many subrequests|too many API requests/i],['CPU_LIMIT',/CPU time|CPU limit/i],['MEMORY_LIMIT',/memory limit|out of memory/i],['NO_RESPONSE',/never generate a response|unresolved.*promise/i],['STREAM_CLOSED',/stream.*closed|stream.*cancel/i],['BODY_USED',/body.*used|body.*locked|body.*disturb/i],['NETWORK_LOST',/network connection.*lost|fetch failed/i],['ASSET_UNAVAILABLE',/PUBLIC_CATALOGUE_UNAVAILABLE/]]
 return patterns.find(([,re])=>re.test(s))?.[0]??'UNCLASSIFIED_EXCEPTION'
}
export function createTailCollector(onEvent) {
 let pending='',record='',recording=false
 let parsed=0,dropped=0
 return {feed(chunk){pending+=chunk;let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(!recording&&line.trim().startsWith('{')){recording=true;record=''}if(!recording)continue;record+=line+'\n';if(record.length>100000){recording=false;record='';dropped++;continue}try{const value=JSON.parse(record);recording=false;record='';parsed++;onEvent(value)}catch{}}},stats(){return {parsed,dropped,incomplete:recording||pending.trim().startsWith('{')}}}
}
