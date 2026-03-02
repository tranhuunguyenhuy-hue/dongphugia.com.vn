import { Metadata } from 'next'
import { ProjectsClient } from './projects-client'

export const metadata: Metadata = {
    title: 'Dự án tiêu biểu | Đông Phú Gia',
    description: 'Chiêm ngưỡng không gian sống và các công trình trọng điểm mang dấu ấn thẩm mỹ và chất lượng vật tư cao cấp do Đông Phú Gia cung cấp.',
}

export default function ProjectsPage() {
    return <ProjectsClient />
}
