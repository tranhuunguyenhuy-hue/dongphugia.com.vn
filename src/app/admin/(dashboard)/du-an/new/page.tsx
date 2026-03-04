import { ProjectForm } from "../project-form"

export default function NewProjectPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Thêm dự án mới</h1>
                <p className="text-sm text-muted-foreground mt-1">Điền thông tin dự án tiêu biểu</p>
            </div>
            <ProjectForm />
        </div>
    )
}
