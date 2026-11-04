import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {fireEvent,render,screen} from '@testing-library/react'

import { ProductDetailTabs } from './product-detail-tabs'

it('renders projected description blocks as escaped React text with canonical tabs', () => {
    const html = renderToStaticMarkup(
        <ProductDetailTabs
            description={'<p>Legacy fallback</p>'}
            descriptionBlocks={[
                { kind: 'heading', text: 'Công nghệ men' },
                { kind: 'paragraph', text: 'Chậu rửa <script>alert(1)</script>' },
                { kind: 'bullet', text: 'Thân sứ cao cấp' },
            ]}
        />,
    )
    expect(html).toContain('Thông tin chung')
    expect(html).toContain('<h2>Công nghệ men</h2>')
    expect(html).toContain('Chậu rửa &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('<li>Thân sứ cao cấp</li>')
    expect(html).not.toContain('Legacy fallback')
    expect(html).not.toContain('<script>')
})

it('shows the technical documents tab and a clear empty state', () => {
    render(<ProductDetailTabs documents={[]} />)
    fireEvent.click(screen.getByRole('tab',{name:'Tài liệu kỹ thuật'}))
    expect(screen.getByText('Sản phẩm này chưa có tài liệu kỹ thuật công khai.')).toBeTruthy()
})
