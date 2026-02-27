"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { createBrowserClient } from "@supabase/ssr";

interface Preferences {
  emailAlerts: boolean;
  dailyDigest: boolean;
  digestTime: string;
  timezone: string;
  marketOpenReminder: boolean;
  marketCloseReminder: boolean;
}

const defaultPrefs: Preferences = {
  emailAlerts: true,
  dailyDigest: false,
  digestTime: "08:00",
  timezone: "America/New_York",
  marketOpenReminder: false,
  marketCloseReminder: false,
};

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch user data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) setEmail(user.email);

        const res = await fetch("/api/user/preferences");
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            setPrefs({
              emailAlerts: json.data.emailAlerts ?? true,
              dailyDigest: json.data.dailyDigest ?? false,
              digestTime: json.data.digestTime ?? "08:00",
              timezone: json.data.timezone ?? "America/New_York",
              marketOpenReminder: json.data.marketOpenReminder ?? false,
              marketCloseReminder: json.data.marketCloseReminder ?? false,
            });
          }
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");

      // Sign out from Supabase
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

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
              <Input value={email} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                placeholder="Your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={prefs.timezone}
                onValueChange={(value) =>
                  setPrefs((p) => ({ ...p, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">
                    Pacific (PT)
                  </SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-text-primary">
            Notifications
          </h2>
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Email alerts
                </p>
                <p className="text-xs text-text-secondary">
                  Receive every triggered alert.
                </p>
              </div>
              <Switch
                checked={prefs.emailAlerts}
                onCheckedChange={(value) =>
                  setPrefs((p) => ({ ...p, emailAlerts: value }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Daily digest
                </p>
                <p className="text-xs text-text-secondary">
                  One email with a recap each day.
                </p>
              </div>
              <Switch
                checked={prefs.dailyDigest}
                onCheckedChange={(value) =>
                  setPrefs((p) => ({ ...p, dailyDigest: value }))
                }
              />
            </div>
            {prefs.dailyDigest ? (
              <div className="space-y-2">
                <Label>Digest time</Label>
                <Input
                  type="time"
                  value={prefs.digestTime}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, digestTime: e.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Market open reminder
                </p>
                <p className="text-xs text-text-secondary">
                  Get a ping at 9:30am ET.
                </p>
              </div>
              <Switch
                checked={prefs.marketOpenReminder}
                onCheckedChange={(value) =>
                  setPrefs((p) => ({ ...p, marketOpenReminder: value }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Market close reminder
                </p>
                <p className="text-xs text-text-secondary">
                  Get a ping before close.
                </p>
              </div>
              <Switch
                checked={prefs.marketCloseReminder}
                onCheckedChange={(value) =>
                  setPrefs((p) => ({ ...p, marketCloseReminder: value }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {saved && (
          <span className="text-sm text-success font-medium">
            ✓ Settings saved
          </span>
        )}
        {error && (
          <span className="text-sm text-danger font-medium">{error}</span>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-white p-6 shadow-soft">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Delete account
            </h2>
            <p className="text-sm text-text-secondary">
              This permanently removes your alerts and history.
            </p>
          </div>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm account deletion</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-text-secondary">
                This action cannot be undone. All alerts and history will be
                deleted.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
