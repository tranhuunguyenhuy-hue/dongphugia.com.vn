import sanitizeHtml from 'sanitize-html'
import {safeImage} from './public-image-policy.mjs'
// Deliberately excludes warranty, price, discounts, inventory and free-form JSON.
export const PUBLIC_SPEC_KEYS=['Chất liệu','Kích thước (DxRxC)','Áp lực nước','Màu sắc','Lớp mạ (màu)','Công nghệ','Thiết kế','Nơi sản xuất','Bộ sưu tập','Chế độ','Điều khiển','Vị trí lắp vòi','Kiểu lắp vòi','Loại vòi','Độ cao vòi','Kích thước đầu vòi','Kiểu thoát','Lượng nước xả','Kiểu dáng','Kiểu xả','Hệ thống xả','Tâm xả','Hình dáng','Bề mặt','Số vân','Quy cách','Gạch cắt cạnh','Vị trí ốp lát','Độ chống trượt','Khu vực ốp lát','Kích thước mô phỏng','Độ khác biệt màu sắc','Dung tích','Công suất']
export const PUBLIC_LEGACY_SPEC_PATHS={be_mat:'Bề mặt',so_van:'Số vân',mau_sac:'Màu sắc',xuat_xu:'Nơi sản xuất',quy_cach:'Quy cách',thiet_ke:'Thiết kế',bo_suu_tap:'Bộ sưu tập',gach_cat_canh:'Gạch cắt cạnh',vi_tri_op_lat:'Vị trí ốp lát',do_chong_truot:'Độ chống trượt',khu_vuc_op_lat:'Khu vực ốp lát',kich_thuoc_mo_phong:'Kích thước mô phỏng',do_khac_biet_mau_sac:'Độ khác biệt màu sắc',capacity_liters:'Dung tích',power_watts:'Công suất'}
const PRIVATE_OR_COMMERCIAL=/(?:^|[^\p{L}])giá(?:[^\p{L}]|$)|\p{Sc}|điện thoại|(?:\+?84|0)(?:[ .()-]*\d){8,10}|https?:|www\.|[\w.+-]+@[\w.-]+|\b\d{9,12}\b|giá\s*(bán|gốc|khuyến|niêm)|\b(vnd|vnđ|usd)\b|₫|\d[\d., ]{2,}\s*(?:đ|vnd|vnđ|usd)(?:\s|$)|đồng\s*\/|hotline|liên hệ|khuyến mãi|bảo hành|giao hàng|miễn phí|chiết khấu|nội bộ|password|token\s*[:=]|secret\s*[:=]/iu
const SECRET_MARKER=/\b(?:password|secret|api[_-]?key|bearer|access[_-]?token)\s*[:=]/i
const CDN_OLD='https://cdn.dongphugia.com.vn/'
const CDN_PUBLIC='https://dpg-products.b-cdn.net/'
function publicMedia(value){
 const safe=safeImage(value)
 return safe?.startsWith(CDN_OLD)?CDN_PUBLIC+safe.slice(CDN_OLD.length):safe
}
function publicLink(value){
 if(typeof value!=='string'||value.length>2048)return null
 try{
  const url=new URL(value,'https://www.dongphugia.vn')
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)return null
  if(['www.dongphugia.vn','dongphugia.vn','www.dongphugia.com.vn','dongphugia.com.vn'].includes(url.hostname))
   return 'https://www.dongphugia.vn'+url.pathname
  return ['www.toto.com.vn','toto.com.vn','www.inax.com.vn','inax.com.vn'].includes(url.hostname)&&url.protocol==='https:'?url.href:null
 }catch{return null}
}
export function publicDescriptionHtml(value){
 if(typeof value!=='string'||Buffer.byteLength(value)>20_000||SECRET_MARKER.test(value))return null
 const html=sanitizeHtml(value,{
  allowedTags:['a','b','blockquote','br','div','em','figcaption','figure','h2','h3','h4','hr','i','img','li','ol','p','span','strong','table','tbody','td','th','thead','tr','u','ul'],
  allowedAttributes:{a:['href','target','rel'],img:['src','alt','loading'],td:['colspan','rowspan'],th:['colspan','rowspan']},
  nonTextTags:['script','style','textarea','option','iframe','object','svg'],
  transformTags:{
   img:(_tag,attrs)=>({tagName:'img',attribs:{...(publicMedia(attrs.src)?{src:publicMedia(attrs.src)}:{}),...(typeof attrs.alt==='string'?{alt:attrs.alt.slice(0,200)}:{}),loading:'lazy'}}),
   a:(_tag,attrs)=>publicLink(attrs.href)
    ?{tagName:'a',attribs:{href:publicLink(attrs.href),target:'_blank',rel:'noopener noreferrer nofollow'}}
    :{tagName:'span',attribs:{}},
  },
  exclusiveFilter:frame=>frame.tag==='img'&&!frame.attribs.src,
  allowedSchemes:['https'],
 })
 return html.trim()&&Buffer.byteLength(html)<=20_000?html:null
}
export function publicDocuments(value){
 if(!Array.isArray(value))return []
 const documents=[]
 for(const doc of value.slice(0,20)){
  if(!doc||typeof doc!=='object'||typeof doc.url!=='string'||typeof doc.name!=='string')continue
  const name=sanitizeHtml(doc.name,{allowedTags:[],allowedAttributes:{}}).trim().slice(0,180)
  if(!name||SECRET_MARKER.test(name))continue
  let url
  try{url=new URL(doc.url)}catch{continue}
  if(url.protocol!=='https:'||url.username||url.password||url.hash||doc.url.length>2048)continue
  let href=null
  if(url.hostname==='cdn.dongphugia.com.vn'&&!url.search&&/^\/(?:product_docs|documents)\/[A-Za-z0-9_./%-]+$/.test(url.pathname)&&!url.pathname.includes('..'))
   href=CDN_PUBLIC+url.pathname.slice(1)
  else if(url.hostname==='dpg-products.b-cdn.net'&&!url.search&&/^\/(?:product_docs|documents)\/[A-Za-z0-9_./%-]+$/.test(url.pathname)&&!url.pathname.includes('..'))
   href=url.href
  else if(url.hostname==='cdn.hita.com.vn'){
   if(!url.search&&/^\/storage\/[A-Za-z0-9_./%-]+$/.test(url.pathname)&&!url.pathname.includes('..'))href=url.href
   else if(url.pathname==='/download'&&url.searchParams.size===1&&url.searchParams.has('path')
    &&/^products\/[A-Za-z0-9_./-]+$/.test(url.searchParams.get('path'))&&!url.searchParams.get('path').includes('..'))href=url.href
  }
  if(!href||documents.some(item=>item.url===href))continue
  const type=typeof doc.document_type==='string'&&/^(PDF|CAD|IMAGE)$/i.test(doc.document_type)?doc.document_type.toUpperCase():null
  const ext=typeof doc.file_ext==='string'&&/^(pdf|dwg|dxf|jpg|jpeg|png|webp)$/i.test(doc.file_ext)?doc.file_ext.toLowerCase():null
  documents.push({name,url:href,type:type??(ext?.toUpperCase()??'Tài liệu'),size:Number.isSafeInteger(doc.file_size)&&doc.file_size>0?`${Math.round(doc.file_size/1024)} KB`:undefined})
 }
 return documents
}
export function publicText(value,max=500){
 if(typeof value!=='string'&&typeof value!=='number')return null
 const raw=String(value)
 if(raw.length>20000)return null
 const text=sanitizeHtml(raw,{allowedTags:[],allowedAttributes:{},nonTextTags:['script','style','textarea','option']}).replace(/&(amp|lt|gt|quot|#39|apos);/g,(_match,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",apos:"'"}[key])).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()
 return text&&!/<\/?[a-z][^>]*>/i.test(text)&&!PRIVATE_OR_COMMERCIAL.test(text.normalize('NFKC'))?text.slice(0,max).trim():null
}
export function publicDescriptionBlocks(value){
 if(typeof value!=='string'||value.length>16000)return []
 const safeMarkup=sanitizeHtml(value,{allowedTags:['h2','h3','p','ul','ol','li','strong','em','br'],allowedAttributes:{},nonTextTags:['script','style','textarea','option']})
 const blocks=[]
 for(const match of safeMarkup.matchAll(/<(h2|h3|p|li)>([\s\S]*?)<\/\1>/gi)){
  const kind=match[1]==='h2'||match[1]==='h3'?'heading':match[1]==='li'?'bullet':'paragraph'
  const text=publicText(match[2],2000)
  if(text&&text.length<=800)blocks.push({kind,text})
  if(blocks.length===12)break
 }
 return blocks.length>=2?blocks:[]
}
export function historicalPublicReferencePrice(input){
 const price=Number(input.price)
 const display=typeof input.price_display==='string'?input.price_display.trim():''
 const digits=display.replace(/[^0-9]/g,'')
 const date=input.price_updated_at instanceof Date?input.price_updated_at.toISOString().slice(0,10):null
 if(input.source_system!=='manual'||input.price_source!=='manual'||input.source_url
   ||input.price_state!=='priced'||input.price_confidence!=='high'
   ||!Number.isSafeInteger(price)||price<=0||price>1_000_000_000
   ||!/^\d[\d., ]*\s*(?:đ|vnđ|vnd)$/iu.test(display)
   ||digits!==String(price)||date!=='2026-07-02')return null
 return {amountVnd:price,recordedUpdateDate:date,provenance:'legacy-manual-public-display'}
}
export function isSafeHistoricalReferencePrice(value){
 return value===null||(value&&Object.keys(value).length===3
   &&Number.isSafeInteger(value.amountVnd)&&value.amountVnd>0&&value.amountVnd<=1_000_000_000
   &&value.recordedUpdateDate==='2026-07-02'&&value.provenance==='legacy-manual-public-display')
}
export function projectPublicContent(input,options={}){
 // Existing canonical public PDP field only; never alternate clean/raw HTML.
 const summary=publicText(input.publicDescription,2400)
 const descriptionBlocks=publicDescriptionBlocks(input.publicDescription)
 const specifications={}
 for(const s of (Array.isArray(input.publicSpecifications)?input.publicSpecifications:[]).slice(0,100)){
  if(s.isPdpVisible!==true||!PUBLIC_SPEC_KEYS.includes(s.key)||Object.keys(specifications).length>=24)continue
  const text=publicText(s.value,180);if(text&&!Object.hasOwn(specifications,s.key))specifications[s.key]=text
 }
 const gallery=[]
 for(const value of (Array.isArray(input.publicGallery)?input.publicGallery:[])){
  const url=safeImage(value);if(url&&!gallery.includes(url))gallery.push(url)
  if(gallery.length===6)break
 }
 const base={summary,descriptionBlocks,specifications,gallery,referencePrice:historicalPublicReferencePrice(input)}
 return options.rich?{...base,descriptionHtml:publicDescriptionHtml(input.publicDescription),documents:publicDocuments(input.publicDocuments)}:base
}

// Validate already-projected plain text without parsing it as HTML a second time.
// Re-parsing changes legitimate literal entity notation; the rendering sink escapes it.
export function isSafePublicContent(c){
 const plain=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v)&&!/<(?:\/?[a-z]|!|\?)/i.test(v)&&!PRIVATE_OR_COMMERCIAL.test(v.normalize('NFKC'))&&publicText(v,max)!==null
 if(!c||![5,7].includes(Object.keys(c).length)||Object.keys(c).some(k=>!['summary','descriptionBlocks','specifications','gallery','referencePrice','descriptionHtml','documents'].includes(k)))return false
 if(Object.keys(c).length===7){
  if(!Object.hasOwn(c,'descriptionHtml')||!Object.hasOwn(c,'documents'))return false
  if(c.descriptionHtml!==null&&(typeof c.descriptionHtml!=='string'||publicDescriptionHtml(c.descriptionHtml)!==c.descriptionHtml))return false
  if(!Array.isArray(c.documents)||c.documents.length>20||c.documents.some(doc=>
   !doc||typeof doc.name!=='string'||typeof doc.url!=='string'||typeof doc.type!=='string'
   ||doc.name.length>180||doc.url.length>2048||SECRET_MARKER.test(doc.name)
   ||publicDocuments([{name:doc.name,url:doc.url,document_type:doc.type}]).length!==1))return false
 }
 if(c.summary!==null&&!plain(c.summary,2400))return false
 if(!Array.isArray(c.descriptionBlocks)||c.descriptionBlocks.length>12||!c.descriptionBlocks.every(b=>b&&Object.keys(b).length===2&&['heading','paragraph','bullet'].includes(b.kind)&&plain(b.text,800)))return false
 if(!isSafeHistoricalReferencePrice(c.referencePrice))return false
 if(!c.specifications||typeof c.specifications!=='object'||Array.isArray(c.specifications)||Object.keys(c.specifications).length>24)return false
 if(!Object.entries(c.specifications).every(([k,v])=>PUBLIC_SPEC_KEYS.includes(k)&&plain(v,180)))return false
 return Array.isArray(c.gallery)&&c.gallery.length<=6&&new Set(c.gallery).size===c.gallery.length&&c.gallery.every(u=>typeof u==='string'&&safeImage(u)===u)
}
