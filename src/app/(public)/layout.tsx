import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { FloatingContact } from "@/components/layout/floating-contact"

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 pt-[126px]">
                {children}
            </main>
            <Footer />
            <FloatingContact />
        </div>
    )
}
