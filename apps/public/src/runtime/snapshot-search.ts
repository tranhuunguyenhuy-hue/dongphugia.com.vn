import type {SnapshotSearchProduct} from './public-snapshot-catalogue'

const fold=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim()

export function searchSnapshot(products:readonly SnapshotSearchProduct[],query:string,page=1,limit=24){
 const q=query.trim().slice(0,120)
 if(q.length<2||!Number.isSafeInteger(page)||page<1||page>100
   ||!Number.isSafeInteger(limit)||limit<1||limit>48)return {results:[],total:0,page,limit,query:q}
 const fq=fold(q),sq=q.toLocaleLowerCase('vi')
 const matches=products.flatMap(product=>{
  const sku=product.sku.toLocaleLowerCase('vi'),name=fold(product.name)
  const rank=sku===sq?0:sku.startsWith(sq)?1:sku.includes(sq)?2:name.startsWith(fq)?3:name.includes(fq)?4:-1
  return rank<0?[]:[{product,rank}]
 }).sort((a,b)=>a.rank-b.rank||a.product.name.localeCompare(b.product.name,'vi')||a.product.id-b.product.id)
 return {results:matches.slice((page-1)*limit,page*limit).map(({product})=>product),total:matches.length,page,limit,query:q}
}
