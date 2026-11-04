import {describe,expect,it} from 'vitest'
import {searchSnapshot} from './snapshot-search'
import type {SnapshotSearchProduct} from './public-snapshot-catalogue'

const item=(id:number,sku:string,name:string):SnapshotSearchProduct=>({id,sku,name,slug:`p-${id}`,url:`/thiet-bi-ve-sinh/bon-cau/p-${id}`,price:null,original_price:null,list_price:null,sale_price:null,online_discount_amount:null,final_online_price:null,price_display:'Liên hệ báo giá',image_main_url:null,category_slug:'thiet-bi-ve-sinh',subcategory_slug:'bon-cau',brand_name:'TOTO',product_feature_values:[],colors:null})

describe('snapshot search',()=>{
 it('ranks exact SKU before prefixes and accent insensitive names',()=>{
  const products=[item(1,'MS636DT2-EXTRA','Bồn cầu khác'),item(2,'MS636DT2','Bồn cầu 1 khối'),item(3,'X1','Bồn cầu MS636DT2')]
  expect(searchSnapshot(products,'ms636dt2').results.map(p=>p.id)).toEqual([2,1,3])
  expect(searchSnapshot(products,'bon cau').total).toBe(3)
 })
 it('paginates without inventing results',()=>{
  const products=Array.from({length:26},(_,i)=>item(i+1,`SKU-${i+1}`,'Chậu lavabo'))
  const first=searchSnapshot(products,'lavabo',1,24)
  const second=searchSnapshot(products,'lavabo',2,24)
  expect(first.total).toBe(26)
  expect(first.results).toHaveLength(24)
  expect(second.results).toHaveLength(2)
  expect(new Set([...first.results,...second.results].map(p=>p.id)).size).toBe(26)
 })
})
