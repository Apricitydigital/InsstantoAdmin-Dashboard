import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AuthProvider } from "@/lib/auth"
import { RoleRouteGuard } from "@/components/auth/role-route-guard"
import "./globals.css"

export const metadata: Metadata = {
  title: "Insstanto Admin Dashboard",
  description: "Comprehensive admin dashboard for service booking business management",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <AuthProvider>
          <RoleRouteGuard>{children}</RoleRouteGuard>
        </AuthProvider>
      </body>
    </html>
  )
}
