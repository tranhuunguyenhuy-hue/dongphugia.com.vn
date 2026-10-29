import sanitizeHtml from 'sanitize-html'
import {safeImage} from './public-image-policy.mjs'
// Deliberately excludes warranty, price, discounts, inventory and free-form JSON.
export const PUBLIC_SPEC_KEYS=['Chất liệu','Kích thước (DxRxC)','Áp lực nước','Màu sắc','Lớp mạ (màu)','Công nghệ','Thiết kế','Nơi sản xuất','Bộ sưu tập','Chế độ','Điều khiển','Vị trí lắp vòi','Kiểu lắp vòi','Loại vòi','Độ cao vòi','Kích thước đầu vòi','Kiểu thoát','Lượng nước xả','Kiểu dáng','Kiểu xả','Hệ thống xả','Tâm xả','Hình dáng']
const PRIVATE_OR_COMMERCIAL=/https?:|www\.|[\w.+-]+@[\w.-]+|\b\d{9,12}\b|giá\s*(bán|gốc|khuyến|niêm)|\b(vnd|vnđ|usd)\b|₫|\d[\d., ]{2,}\s*(?:đ|vnd|vnđ|usd)(?:\s|$)|đồng\s*\/|hotline|liên hệ|khuyến mãi|bảo hành|giao hàng|miễn phí|chiết khấu|nội bộ|password|token\s*[:=]|secret\s*[:=]/iu
export function publicText(value,max=500){
 if(typeof value!=='string'&&typeof value!=='number')return null
 const raw=String(value)
 if(raw.length>20000||PRIVATE_OR_COMMERCIAL.test(raw))return null
 const text=sanitizeHtml(raw,{allowedTags:[],allowedAttributes:{},nonTextTags:['script','style','textarea','option']}).replace(/&(amp|lt|gt|quot|#39|apos);/g,(_match,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",apos:"'"}[key])).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()
 return text&&!/<\/?[a-z][^>]*>/i.test(text)&&!PRIVATE_OR_COMMERCIAL.test(text)?text.slice(0,max):null
}
export function projectPublicContent(input){
 // Cleaning status does not prove editorial publication approval.
 const summary=null
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
 return {summary,specifications,gallery}
}
