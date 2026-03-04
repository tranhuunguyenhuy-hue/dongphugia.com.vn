import { Metadata } from 'next'
import { ProjectsClient } from './projects-client'
import { getActiveProjects } from '@/lib/public-api-projects'

export const metadata: Metadata = {
    title: 'Dự án tiêu biểu | Đông Phú Gia',
    description: 'Chiêm ngưỡng không gian sống và các công trình trọng điểm mang dấu ấn thẩm mỹ và chất lượng vật tư cao cấp do Đông Phú Gia cung cấp.',
}

export default async function ProjectsPage() {
    const projects = await getActiveProjects()
    return <ProjectsClient projects={projects} />
}
