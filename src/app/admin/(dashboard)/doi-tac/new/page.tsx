import { PartnerForm } from '../partner-form'

export default function NewPartnerPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Thêm đối tác</h1>
                <p className="text-sm text-muted-foreground mt-1">Tạo đối tác mới</p>
            </div>
            <PartnerForm />
        </div>
    )
}
