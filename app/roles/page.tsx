"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { PERMISSION_DEFINITIONS } from "@/lib/permissions"
import {
  assignUserRole,
  createRole,
  fetchRoleManagementData,
  type ManagedRole,
  type ManagedUser,
  updateRole,
} from "@/lib/queries/role-management"
import { Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react"

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<ManagedRole[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<ManagedRole | null | undefined>(undefined)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [permissions, setPermissions] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchRoleManagementData()
      setRoles(data.roles)
      setUsers(data.users)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load roles")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, typeof PERMISSION_DEFINITIONS>()
    for (const permission of PERMISSION_DEFINITIONS) {
      groups.set(permission.group, [...(groups.get(permission.group) || []), permission])
    }
    return [...groups.entries()]
  }, [])

  const openEditor = (role: ManagedRole | null) => {
    setEditing(role)
    setName(role?.name || "")
    setDescription(role?.description || "")
    setPermissions(role?.permissions || [])
    setError("")
  }

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      if (editing) await updateRole(editing.id, name, description, permissions)
      else await createRole(name, description, permissions)
      setEditing(undefined)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save role")
    } finally {
      setSaving(false)
    }
  }

  const changeAssignment = async (userId: string, roleId: string) => {
    setSaving(true)
    setError("")
    try {
      await assignUserRole(userId, roleId)
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, roleId } : user))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assign role")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute roles={["superadmin"]}>
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar />
        <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
              <p className="text-gray-600">Create roles, choose their access, and assign them to admin users.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
              <Button onClick={() => openEditor(null)}><Plus className="mr-2 h-4 w-4" />Create role</Button>
            </div>
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin" /></div> : (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Roles</CardTitle><CardDescription>Built-in roles are protected; custom roles can be edited.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{role.name}</span>{role.system && <Badge variant="secondary">Built-in</Badge>}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{role.description || "No description"}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}</p>
                      </div>
                      {!role.system && <Button size="sm" variant="outline" onClick={() => openEditor(role)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />User assignments</CardTitle><CardDescription>Changes apply from the user's next authentication refresh.</CardDescription></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
                    <TableBody>{users.map((managedUser) => (
                      <TableRow key={managedUser.id}>
                        <TableCell><div className="font-medium">{managedUser.name || managedUser.email || managedUser.id}</div>{managedUser.name && managedUser.email && <div className="text-xs text-muted-foreground">{managedUser.email}</div>}</TableCell>
                        <TableCell>
                          <Select value={managedUser.roleId || undefined} onValueChange={(value) => void changeAssignment(managedUser.id, value)} disabled={saving}>
                            <SelectTrigger className="w-[190px]"><SelectValue placeholder="No role" /></SelectTrigger>
                            <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      <Dialog open={editing !== undefined} onOpenChange={(open) => { if (!open) setEditing(undefined) }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle><DialogDescription>The database document ID is generated automatically; the role name remains editable.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Operations manager" /></div>
            <div className="grid gap-2"><Label htmlFor="role-description">Description</Label><Textarea id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this role is responsible for" /></div>
            <div className="space-y-4">
              <Label>Access permissions</Label>
              {groupedPermissions.map(([group, entries]) => (
                <div key={group} className="rounded-lg border p-4">
                  <div className="mb-3 font-medium">{group}</div>
                  <div className="grid gap-3 sm:grid-cols-2">{entries.map((permission) => (
                    <label key={permission.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={permissions.includes(permission.id)} onCheckedChange={(checked) => setPermissions((current) => checked ? [...new Set([...current, permission.id])] : current.filter((id) => id !== permission.id))} />
                      {permission.label}
                    </label>
                  ))}</div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(undefined)}>Cancel</Button><Button onClick={() => void save()} disabled={saving || !name.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save role</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}
