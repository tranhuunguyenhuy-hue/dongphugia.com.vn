import { CategoryMobileFilter as Canonical } from '../../../../src/components/category/category-mobile-filter'
import type {ComponentProps} from 'react'
export function CategoryMobileFilter(props:ComponentProps<typeof Canonical>){return <div><p className="text-xs text-stone-500 py-2">Bộ lọc tạm khóa; giá và thuộc tính chưa được xác nhận.</p><fieldset disabled className="opacity-60"><Canonical {...props} /></fieldset></div>}
