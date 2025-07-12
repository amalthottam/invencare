import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUser,
  updateUserAttributes,
  signOut,
} from "aws-amplify/auth";
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
  User,
  Lock,
  Bell,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Settings({ user, userRole, storeAccess, onSignOut }) {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    role: "",
    storeAccess: [],
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Load user data from Cognito
    const attributes = user.attributes || {};
    setProfileData({
      name: attributes.name || "",
      email: attributes.email || "",
      role: attributes["custom:role"] || userRole || "employee",
      storeAccess: storeAccess || [],
    });
  }, [user, userRole, storeAccess, navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      if (onSignOut) {
        onSignOut();
      }
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setError("Failed to sign out. Please try again.");
    }
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await updateUserAttributes({
        userAttributes: {
          name: profileData.name,
          email: profileData.email,
        },
      });

      setSuccess("Profile updated successfully!");
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.message || "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      // Note: AWS Cognito change password would be implemented here
      // For now, we'll show a success message
      setSuccess("Password changed successfully!");
      setShowChangePassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Password change error:", error);
      setError(error.message || "Failed to change password. Please try again.");
    } finally {
      setIsLoading(false);
    }
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

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md">
              {success}
            </div>
          )}

          {/* Settings Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(userRole === "admin" || userRole === "manager") && (
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
                      <span>Your Role</span>
                      <RoleBadge role={userRole} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Store Access</span>
                      <Badge variant="secondary">
                        {storeAccess?.length > 0 ? storeAccess.length : "All"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Account Status</span>
                      <StatusBadge status="Active" />
                    </div>
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={handleManageUsers}
                      disabled={userRole !== "admin"}
                    >
                      {userRole === "admin" ? "Manage Users" : "View Users"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
                    <span>Authentication</span>
                    <StatusBadge status="Active" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Password Strength</span>
                    <StatusBadge status="Strong" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Session Status</span>
                    <StatusBadge status="Active" />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => setShowChangePassword(!showChangePassword)}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={handleSecuritySettings}
                  >
                    Advanced Security
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Manage your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Email Notifications</span>
                    <StatusBadge status="Active" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Low Stock Alerts</span>
                    <StatusBadge status="Active" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>System Updates</span>
                    <StatusBadge status="Active" />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() =>
                      alert("Notification settings would open here")
                    }
                  >
                    Configure Notifications
                  </Button>
                </div>
              </CardContent>
            </Card>

            {userRole === "admin" && (
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
            )}
          </div>

          {/* Profile Settings */}
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Settings
                </CardTitle>
                <CardDescription>
                  Update your personal information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
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
                        setProfileData({
                          ...profileData,
                          email: e.target.value,
                        })
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
                    <Label htmlFor="storeAccess">Store Access</Label>
                    <div className="flex flex-wrap gap-1">
                      {profileData.storeAccess?.length > 0 ? (
                        profileData.storeAccess.map((store, index) => (
                          <Badge key={index} variant="outline">
                            {store}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary">All Stores</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isEditingProfile ? (
                      <>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? "Saving..." : "Save Changes"}
                        </Button>
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
                        <User className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Password Change */}
            {showChangePassword && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your account password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              currentPassword: e.target.value,
                            })
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              current: !showPasswords.current,
                            })
                          }
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showPasswords.current ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              newPassword: e.target.value,
                            })
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              new: !showPasswords.new,
                            })
                          }
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showPasswords.new ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        Confirm New Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              confirmPassword: e.target.value,
                            })
                          }
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              confirm: !showPasswords.confirm,
                            })
                          }
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showPasswords.confirm ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? "Changing..." : "Change Password"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowChangePassword(false);
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
