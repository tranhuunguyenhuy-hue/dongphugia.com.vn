import {it,expect} from 'vitest'
import {projectPublicContent,publicText} from './public-product-content.mjs'
it('exposes only reviewed technical content and explicitly public editorial',()=>{
 const c=projectPublicContent({publicDescription:'<p>Chậu rửa <strong>sứ</strong>.</p><script>alert(1)</script>',publicSpecifications:[{key:'Chất liệu',isPdpVisible:true,value:'Sứ'},{key:'Bảo hành',isPdpVisible:true,value:'5 năm'},{key:'Màu sắc',isPdpVisible:false,value:'Trắng'}],publicGallery:['https://cdn.dongphugia.com.vn/a.jpg','javascript:alert(1)']})
 expect(c.summary).toBe('Chậu rửa sứ.');expect(c.specifications).toEqual({'Chất liệu':'Sứ'});expect(c.gallery).toHaveLength(1)
 expect(projectPublicContent({cleanEditorial:'<p>Unapproved</p>'}).summary).toBeNull()
})
it('rejects contacts/commercial terms and arbitrary raw blobs, caps all output',()=>{
 for(const v of ['hotline 0901234567','Giá bán 100 USD','1.200.000đ','Bảo hành 5 năm','token=abc123','x@example.com','https://private.test','<img src=x onerror=alert(1)>'])expect(publicText(v)).toBeNull()
 const c=projectPublicContent({raw_html:'private',raw_value:'private',value_json:{secret:'private'},publicSpecifications:[{key:'Chất liệu',isPdpVisible:true,value:{raw:'private'}}]})
 expect(c).toEqual({summary:null,specifications:{},gallery:[]})
 expect(publicText('a'.repeat(1000),100)).toHaveLength(100)
})

it('preserves plain technical symbols without double encoding',()=>{expect(publicText('A & B')).toBe('A & B');expect(publicText('X < Y')).toBe('X < Y');expect(publicText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBeNull()})

it('strips hidden markup attributes but rejects decoded visible contacts and stale prices',()=>{expect(publicText('<p>Chậu rửa sứ</p><img src="https://private.test/?token=abc">')).toBe('Chậu rửa sứ');expect(publicText('Email: x&#64;example.com')).toBeNull();expect(publicText('Giá 1.200.000&#8363;')).toBeNull();expect(publicText('０９０１２３４５６７')).toBeNull()})

it('rejects standalone prices, currencies and formatted telephone contacts',()=>{for(const s of ['Giá: 1.200.000','Giá 100 EUR','Giá $100','Điện thoại: 090.123.4567','090-123-4567'])expect(publicText(s)).toBeNull()})
