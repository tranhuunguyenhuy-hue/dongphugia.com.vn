'use client'

import { useFormStatus } from "react-dom"
import { authenticate } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActionState } from "react"
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useState } from "react"

export default function LoginForm() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined)
    const [showPassword, setShowPassword] = useState(false)

    return (
        <Card className="border-0 shadow-xl shadow-slate-200/50">
            <CardHeader className="space-y-2 pb-4">
                <CardTitle className="text-2xl font-bold">Đăng nhập</CardTitle>
                <CardDescription className="text-sm">
                    Nhập email và mật khẩu để truy cập trang quản trị
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={dispatch} className="grid gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                placeholder="admin@dongphugia.com"
                                className="pl-10 h-11"
                                required
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password" className="text-sm font-medium">Mật khẩu</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                className="pl-10 pr-10 h-11"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <LoginButton />
                    {errorMessage && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3" aria-live="polite" aria-atomic="true">
                            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                            <p className="text-sm text-red-700">{errorMessage}</p>
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
    )
}

function LoginButton() {
    const { pending } = useFormStatus()
    return (
        <Button className="w-full h-11 text-sm font-semibold press-effect" aria-disabled={pending}>
            {pending ? (
                <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang đăng nhập...
                </span>
            ) : (
                "Đăng nhập"
            )}
        </Button>
    )
}
