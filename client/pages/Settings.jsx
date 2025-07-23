import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
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
  const { user, logout } = useAuth();
  const [profileData, setProfileData] = useState({
    name: "Loading...",
    email: "Loading...",
    role: "employee",
    storeAccess: "none",
    userId: "",
    emailVerified: false,
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    // Profile data is now populated from Cognito user context
    if (user && user.attributes) {
      console.log("User attributes:", user.attributes);
      setProfileData({
        name:
          user.attributes?.name ||
          (user.attributes?.given_name
            ? `${user.attributes.given_name} ${user.attributes.family_name || ""}`.trim()
            : "User"),
        email: user.attributes?.email || user.username,
        role: user.attributes?.["custom:role"] || "employee",
        storeAccess: user.attributes?.["custom:store_access"] || "none",
        userId: user.attributes?.sub || user.username,
        emailVerified: user.attributes?.email_verified === "true",
      });
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
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
    alert(
      "Profile saved successfully! Note: Some fields are managed by AWS Cognito and cannot be changed here.",
    );
  };

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "employee":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStoreAccessBadgeColor = (access) => {
    if (access === "all") {
      return "bg-purple-100 text-purple-800 border-purple-200";
    } else if (access?.includes("store_")) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatStoreAccess = (access) => {
    if (access === "all") return "All Stores";
    if (access?.includes("store_")) {
      return access.split(",").join(", ");
    }
    return "No Access";
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

          <div className="grid gap-6 lg:grid-cols-2">
            {/* AWS Cognito Account Information */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  AWS Cognito Account Information
                </CardTitle>
                <CardDescription>
                  Your authentication and authorization details managed by AWS
                  Cognito
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">User ID (Sub)</span>
                      <span className="text-sm text-muted-foreground font-mono">
                        {profileData.userId
                          ? `${profileData.userId.substring(0, 8)}...`
                          : "Loading..."}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">Email Status</span>
                      <div className="flex items-center gap-2">
                        {profileData.emailVerified ? (
                          <Badge className="bg-green-100 text-green-800">
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            Not Verified
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">Role</span>
                      <Badge className={getRoleBadgeColor(profileData.role)}>
                        {profileData.role?.charAt(0).toUpperCase() +
                          profileData.role?.slice(1)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">Store Access</span>
                      <Badge
                        className={getStoreAccessBadgeColor(
                          profileData.storeAccess,
                        )}
                      >
                        {formatStoreAccess(profileData.storeAccess)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">
                        Authentication Provider
                      </span>
                      <span className="text-sm text-muted-foreground">
                        AWS Cognito
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium">Session Management</span>
                      <StatusBadge status="Active" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Settings Cards */}
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
                    disabled={profileData.role !== "admin"}
                  >
                    Manage Users
                  </Button>
                  {profileData.role !== "admin" && (
                    <p className="text-xs text-muted-foreground">
                      Admin access required
                    </p>
                  )}
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
                    <span>AWS Cognito</span>
                    <StatusBadge status="Connected" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>API Status</span>
                    <StatusBadge status="Online" />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleSystemSettings}
                    disabled={profileData.role !== "admin"}
                  >
                    System Settings
                  </Button>
                  {profileData.role !== "admin" && (
                    <p className="text-xs text-muted-foreground">
                      Admin access required
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your profile information from AWS Cognito. Some fields are
                managed by your administrator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSaveProfile}
                className="space-y-6 max-w-2xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, name: e.target.value })
                      }
                      disabled={!isEditingProfile}
                      placeholder="Enter your display name"
                    />
                    <p className="text-xs text-muted-foreground">
                      This can be updated locally
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled={true}
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Managed by AWS Cognito - contact admin to change
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role & Permissions</Label>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <Badge className={getRoleBadgeColor(profileData.role)}>
                        {profileData.role?.charAt(0).toUpperCase() +
                          profileData.role?.slice(1)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Assigned by administrator
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Store Access</Label>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <Badge
                        className={getStoreAccessBadgeColor(
                          profileData.storeAccess,
                        )}
                      >
                        {formatStoreAccess(profileData.storeAccess)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Managed by admin
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <Label>User ID (AWS Cognito Sub)</Label>
                    <Input
                      value={profileData.userId}
                      disabled={true}
                      className="bg-gray-50 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique identifier assigned by AWS Cognito
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
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

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(profileData.userId);
                      alert("User ID copied to clipboard!");
                    }}
                    disabled={!profileData.userId}
                  >
                    Copy User ID
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
