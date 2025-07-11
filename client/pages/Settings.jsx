import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  StatusBadge,
  RoleBadge,
  DepartmentBadge,
} from "@/components/ui/status-badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Database,
} from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    name: "Demo User",
    email: "demo@invencare.com",
    role: "Manager",
    department: "Inventory",
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const handleManageUsers = () => {
    alert(
      "User Management panel would open here. This would typically navigate to a dedicated user management page or open a modal.",
    );
  };

  const handleSecuritySettings = () => {
    alert(
      "Security Settings panel would open here. This would configure 2FA, password policies, and session management.",
    );
  };

  const handleSystemSettings = () => {
    alert(
      "System Settings panel would open here. This would configure database connections, backups, and API settings.",
    );
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setIsEditingProfile(false);
    alert("Profile saved successfully!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <Navigation onLogout={handleLogout} />

      <div className="lg:pl-64">
        <main className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                <SettingsIcon className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Settings
              </h1>
            </div>
            <p className="text-muted-foreground">
              Manage your application settings and user preferences
            </p>
          </div>

          {/* Settings Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage user accounts and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Total Users</span>
                    <Badge variant="secondary">15</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active Users</span>
                    <Badge variant="default">12</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pending Users</span>
                    <Badge variant="outline">3</Badge>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleManageUsers}
                  >
                    Manage Users
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure security and authentication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Two-Factor Auth</span>
                    <StatusBadge status="Active" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Session Timeout</span>
                    <span className="text-sm text-muted-foreground">
                      30 min
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Password Policy</span>
                    <StatusBadge status="Active" />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleSecuritySettings}
                  >
                    Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  System Settings
                </CardTitle>
                <CardDescription>
                  Application and system configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Database Status</span>
                    <StatusBadge status="Online" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Backup Status</span>
                    <StatusBadge status="Success" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>API Status</span>
                    <StatusBadge status="Online" />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleSystemSettings}
                  >
                    System Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Update your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, name: e.target.value })
                    }
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) =>
                      setProfileData({ ...profileData, email: e.target.value })
                    }
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={profileData.role} />
                    <span className="text-sm text-muted-foreground">
                      {profileData.role}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <div className="flex items-center gap-2">
                    <DepartmentBadge department={profileData.department} />
                    <span className="text-sm text-muted-foreground">
                      {profileData.department}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isEditingProfile ? (
                    <>
                      <Button type="submit">Save Changes</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditingProfile(false)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
