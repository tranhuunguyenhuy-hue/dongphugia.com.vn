import sanitizeHtml from 'sanitize-html'
import {safeImage} from './public-image-policy.mjs'
// Deliberately excludes warranty, price, discounts, inventory and free-form JSON.
export const PUBLIC_SPEC_KEYS=['Chất liệu','Kích thước (DxRxC)','Áp lực nước','Màu sắc','Lớp mạ (màu)','Công nghệ','Thiết kế','Nơi sản xuất','Bộ sưu tập','Chế độ','Điều khiển','Vị trí lắp vòi','Kiểu lắp vòi','Loại vòi','Độ cao vòi','Kích thước đầu vòi','Kiểu thoát','Lượng nước xả','Kiểu dáng','Kiểu xả','Hệ thống xả','Tâm xả','Hình dáng','Bề mặt','Số vân','Quy cách','Gạch cắt cạnh','Vị trí ốp lát','Độ chống trượt','Khu vực ốp lát','Kích thước mô phỏng','Độ khác biệt màu sắc','Dung tích','Công suất']
export const PUBLIC_LEGACY_SPEC_PATHS={be_mat:'Bề mặt',so_van:'Số vân',mau_sac:'Màu sắc',xuat_xu:'Nơi sản xuất',quy_cach:'Quy cách',thiet_ke:'Thiết kế',bo_suu_tap:'Bộ sưu tập',gach_cat_canh:'Gạch cắt cạnh',vi_tri_op_lat:'Vị trí ốp lát',do_chong_truot:'Độ chống trượt',khu_vuc_op_lat:'Khu vực ốp lát',kich_thuoc_mo_phong:'Kích thước mô phỏng',do_khac_biet_mau_sac:'Độ khác biệt màu sắc',capacity_liters:'Dung tích',power_watts:'Công suất'}
const PRIVATE_OR_COMMERCIAL=/(?:^|[^\p{L}])giá(?:[^\p{L}]|$)|\p{Sc}|điện thoại|(?:\+?84|0)(?:[ .()-]*\d){8,10}|https?:|www\.|[\w.+-]+@[\w.-]+|\b\d{9,12}\b|giá\s*(bán|gốc|khuyến|niêm)|\b(vnd|vnđ|usd)\b|₫|\d[\d., ]{2,}\s*(?:đ|vnd|vnđ|usd)(?:\s|$)|đồng\s*\/|hotline|liên hệ|khuyến mãi|bảo hành|giao hàng|miễn phí|chiết khấu|nội bộ|password|token\s*[:=]|secret\s*[:=]/iu
export function publicText(value,max=500){
 if(typeof value!=='string'&&typeof value!=='number')return null
 const raw=String(value)
 if(raw.length>20000)return null
 const text=sanitizeHtml(raw,{allowedTags:[],allowedAttributes:{},nonTextTags:['script','style','textarea','option']}).replace(/&(amp|lt|gt|quot|#39|apos);/g,(_match,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",apos:"'"}[key])).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()
 return text&&!/<\/?[a-z][^>]*>/i.test(text)&&!PRIVATE_OR_COMMERCIAL.test(text.normalize('NFKC'))?text.slice(0,max).trim():null
}
export function projectPublicContent(input){
 // Existing canonical public PDP field only; never alternate clean/raw HTML.
 const summary=publicText(input.publicDescription,2400)
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

// Validate already-projected plain text without parsing it as HTML a second time.
// Re-parsing changes legitimate literal entity notation; the rendering sink escapes it.
export function isSafePublicContent(c){
 const plain=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v)&&!/<(?:\/?[a-z]|!|\?)/i.test(v)&&!PRIVATE_OR_COMMERCIAL.test(v.normalize('NFKC'))&&publicText(v,max)!==null
 if(!c||Object.keys(c).length!==3||Object.keys(c).some(k=>!['summary','specifications','gallery'].includes(k)))return false
 if(c.summary!==null&&!plain(c.summary,2400))return false
 if(!c.specifications||typeof c.specifications!=='object'||Array.isArray(c.specifications)||Object.keys(c.specifications).length>24)return false
 if(!Object.entries(c.specifications).every(([k,v])=>PUBLIC_SPEC_KEYS.includes(k)&&plain(v,180)))return false
 return Array.isArray(c.gallery)&&c.gallery.length<=6&&new Set(c.gallery).size===c.gallery.length&&c.gallery.every(u=>typeof u==='string'&&safeImage(u)===u)
}
