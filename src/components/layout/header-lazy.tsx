"use client"

import dynamic from "next/dynamic"

const Header = dynamic(
    () => import("@/components/layout/header").then((mod) => mod.Header),
    { ssr: false },
)

export { Header }
