"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function SettingsPage() {
  const [dailyDigest, setDailyDigest] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary">
          Manage your account details and notification preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-text-primary">Account</h2>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input value="trader@freestockalerts.ai" readOnly />
            </div>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input placeholder="Your first name" />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select defaultValue="America/New_York">
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-text-primary">Notifications</h2>
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Email alerts</p>
                <p className="text-xs text-text-secondary">Receive every triggered alert.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Daily digest</p>
                <p className="text-xs text-text-secondary">One email with a recap each day.</p>
              </div>
              <Switch checked={dailyDigest} onCheckedChange={setDailyDigest} />
            </div>
            {dailyDigest ? (
              <div className="space-y-2">
                <Label>Digest time</Label>
                <Input type="time" defaultValue="08:00" />
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Market open reminder</p>
                <p className="text-xs text-text-secondary">Get a ping at 9:30am ET.</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Market close reminder</p>
                <p className="text-xs text-text-secondary">Get a ping before close.</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-white p-6 shadow-soft">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Delete account</h2>
            <p className="text-sm text-text-secondary">
              This permanently removes your alerts and history.
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm account deletion</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-text-secondary">
                This action cannot be undone. All alerts and history will be deleted.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive">Delete</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
