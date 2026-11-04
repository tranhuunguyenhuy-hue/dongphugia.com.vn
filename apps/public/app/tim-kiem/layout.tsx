import type {Metadata} from 'next'

export const metadata:Metadata={
 title:'Tìm kiếm sản phẩm | Đông Phú Gia',
 robots:{index:false,follow:true},
 alternates:{canonical:'https://www.dongphugia.vn/tim-kiem'},
}

export default function SearchLayout({children}:{children:React.ReactNode}){return children}
