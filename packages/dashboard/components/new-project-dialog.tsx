"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function NewProjectDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button className="h-11 px-4">
            New project
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Give the project a name and a slug. Leave the database name empty if you want us to
            use the slug for you.
          </DialogDescription>
        </DialogHeader>

        <form action="/api/dashboard/projects" method="post" className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Project name</span>
            <Input
              name="name"
              type="text"
              autoComplete="off"
              placeholder="Billing API"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Slug</span>
            <Input
              name="slug"
              type="text"
              autoComplete="off"
              placeholder="billing-api"
              required
            />
            <span className="text-xs text-muted-foreground">
              Use a short, unique slug with lowercase letters, numbers, and hyphens.
            </span>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Database name (optional)</span>
            <Input
              name="databaseName"
              type="text"
              autoComplete="off"
              placeholder="billing_api"
            />
            <span className="text-xs text-muted-foreground">
              Leave this empty to reuse the slug as the database name.
            </span>
          </label>
          <DialogFooter className="pt-2">
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            <Button type="submit">Create project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
