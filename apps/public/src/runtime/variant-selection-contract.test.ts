import {describe,expect,it} from 'vitest'
import {selectSnapshotVariantData,type SnapshotVariantMember} from './variant-selection-contract'

const members:SnapshotVariantMember[]=[
 {id:1,variant_group:'public-17',variant_type:'size',variant_label:'Size 1',variant_options:[{axis:'size',value:'1',label:'Size 1'}]},
 {id:2,variant_group:'public-17',variant_type:'size',variant_label:'Size 2',variant_options:[{axis:'size',value:'2',label:'Size 2'}]},
]
const axes=[{key:'size',label:'Kích thước'}]

describe('snapshot variant selection contract',()=>{
 it('returns the verified axis, current choice, and independently linked sibling',()=>{
  expect(selectSnapshotVariantData('public-17',1,members,axes)).toEqual({
   axes,currentVariantOptions:members[0].variant_options,siblings:[members[1]],
  })
 })

 it.each([
  ['missing axis',members,[]],
  ['unsupported axis',members,[{key:'color',label:'Màu'}]],
  ['duplicate member id',[members[0],{...members[1],id:1}],axes],
  ['duplicate option value',[members[0],{...members[1],variant_options:[{axis:'size',value:'1',label:'Size 2'}]}],axes],
  ['mismatched option label',[members[0],{...members[1],variant_options:[{axis:'size',value:'2',label:'Wrong'}]}],axes],
  ['mixed group',[members[0],{...members[1],variant_group:'public-18'}],axes],
 ] as const)('fails closed for %s',(_name,invalidMembers,invalidAxes)=>{
  expect(selectSnapshotVariantData('public-17',1,invalidMembers,invalidAxes)).toEqual({axes:[],currentVariantOptions:[],siblings:[]})
 })

 it('fails closed for missing current product and unsafe group identifiers',()=>{
  expect(selectSnapshotVariantData('public-17',99,members,axes)).toEqual({axes:[],currentVariantOptions:[],siblings:[]})
  expect(selectSnapshotVariantData('../17',1,members,axes)).toEqual({axes:[],currentVariantOptions:[],siblings:[]})
 })
})
