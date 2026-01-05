"use client"

import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Users, DollarSign, Zap, Webhook, Shield } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Configure system settings and preferences</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 text-blue-600" />
                <Badge variant="secondary">5</Badge>
              </div>
              <CardTitle className="text-lg text-blue-900">User Roles</CardTitle>
              <CardDescription className="text-blue-700">Manage user permissions</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <DollarSign className="w-8 h-8 text-green-600" />
                <Badge variant="secondary">Active</Badge>
              </div>
              <CardTitle className="text-lg text-green-900">Taxes & Fees</CardTitle>
              <CardDescription className="text-green-700">Configure pricing rules</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Zap className="w-8 h-8 text-purple-600" />
                <Badge variant="secondary">12</Badge>
              </div>
              <CardTitle className="text-lg text-purple-900">Integrations</CardTitle>
              <CardDescription className="text-purple-700">Third-party connections</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="taxes">Taxes</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic system configuration and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">System Configuration</h3>
                  <p className="mb-4">Configure basic system settings and preferences</p>
                  <Button>Configure Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Roles & Permissions</CardTitle>
                <CardDescription>Manage user roles and access permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Role management system coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="taxes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Taxes & Fees</CardTitle>
                <CardDescription>Configure tax rates and service fees</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Tax configuration coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Third-party Integrations</CardTitle>
                <CardDescription>Manage external service integrations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Integration management coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Management</CardTitle>
                <CardDescription>Configure webhooks for external notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <Webhook className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Webhook configuration coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
