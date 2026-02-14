'use client'

import { useFormStatus } from "react-dom"
import { authenticate } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActionState } from "react"

export default function LoginForm() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined)

    return (
        <Card className="mx-auto max-w-sm">
            <CardHeader>
                <CardTitle className="text-2xl">Đăng nhập</CardTitle>
                <CardDescription>
                    Nhập email và mật khẩu để truy cập trang quản trị
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={dispatch} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            placeholder="admin@dongphugia.com"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Mật khẩu</Label>
                        <Input id="password" type="password" name="password" required />
                    </div>
                    <LoginButton />
                    <div className="flex h-8 items-end space-x-1" aria-live="polite" aria-atomic="true">
                        {errorMessage && (
                            <p className="text-sm text-red-500">{errorMessage}</p>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

function LoginButton() {
    const { pending } = useFormStatus()
    return (
        <Button className="w-full" aria-disabled={pending}>
            {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
    )
}
