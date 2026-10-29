import {it,expect} from 'vitest'
import {exceptionCategory,createTailCollector} from './preview-diagnostic-safety.mjs'
it('never outputs arbitrary text or short credentials',()=>{
 for(const value of ['token=abc123 phone=0901234567','Private Person','https://example.test/?token=secret'])expect(exceptionCategory(value)).toBe('UNCLASSIFIED_EXCEPTION')
 expect(exceptionCategory('Cannot perform I/O on behalf of a different request')).toBe('CROSS_REQUEST_IO')
})
it('preserves every possible stream chunk boundary in multiline JSON',()=>{
 const input='Starting tail\n'+JSON.stringify({exceptions:[{name:'Error',message:'too many subrequests'}]},null,2)+'\n'
 for(let i=0;i<input.length;i++){
  const values=[],c=createTailCollector(v=>values.push(v));c.feed(input.slice(0,i));c.feed(input.slice(i));expect(values).toHaveLength(1);expect(c.stats()).toEqual({parsed:1,dropped:0,incomplete:false})
 }
})
