/**
Rôle: Composant applicatif — src/frontend/components/AppHeader.tsx
Domaine: Frontend/Components
Exports: AppHeader
Dépendances: react, @/contexts/AuthContext, @/components/ui/button, react-router-dom, @/components/ui/badge, lucide-react, @/components/ui/avatar, @/utils/avatar
Liens: ui/* (atomes), hooks, contexts, services côté client
*/
/*
  Header global de l'application
  - useState/useEffect: gestion du menu utilisateur, notifications, état d'avatar
  - ReactNode: permet d'accepter des enfants rendus dynamiquement
  Les blocs ci-dessous détaillent la logique d'affichage, accessibilité et sécurités (logout).
*/
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  User,
  LogOut,
  Settings,
  Shield,
  Users,
  X,
  History,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/utils/avatar";
import NotificationCenter from "@/components/NotificationCenter";

interface AppHeaderProps {
  title?: string;
  children?: ReactNode;
}

export function AppHeader({ title, children }: AppHeaderProps) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);

  useEffect(() => {
    const onAvatarUpdated = () => setAvatarVersion((v) => v + 1);
    window.addEventListener("avatar-updated", onAvatarUpdated as EventListener);
    return () =>
      window.removeEventListener(
        "avatar-updated",
        onAvatarUpdated as EventListener,
      );
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
    }
  };

  const handleAdminClick = () => {
    navigate("/admin/users");
  };

  const handleUserManagementClick = () => {
    navigate("/user-management");
  };

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleHistoryClick = () => {
    navigate("/history");
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "user":
        return "default";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrateur";
      case "user":
        return "Utilisateur";
      default:
        return role;
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        {/* Desktop and Mobile Header */}
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <img
              src="/logo.png"
              alt="2SND Technologies"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain flex-shrink-0"
            />
            <h1 className="text-lg sm:text-xl font-bold">
              {title || "Gestion des DAO"}
            </h1>
          </div>

          {/* Centre - Contenu personnalisé (Desktop uniquement) */}
          {children && (
            <div className="hidden xl:flex flex-1 justify-center">
              {children}
            </div>
          )}

          {/* Right side - Always on one line */}
          <div className="flex items-center space-x-2">
            <NotificationCenter />
            {user && (
              <>
                {/* Desktop: User info + Role badge + Menu */}
                <div className="hidden lg:flex items-center space-x-3">
                  {/* User info */}
                  <div className="hidden xl:block text-right">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </div>

                  {/* Role badge */}
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {isAdmin() && <Shield className="w-3 h-3 mr-1" />}
                    {getRoleLabel(user.role)}
                  </Badge>

                  {/* Desktop Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage
                            key={avatarVersion}
                            src={getAvatarUrl(user.id, user.name)}
                            alt={user.name}
                          />
                          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        Menu
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <div className="px-3 py-2 text-sm flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            key={avatarVersion}
                            src={getAvatarUrl(user.id, user.name)}
                            alt={user.name}
                          />
                          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {user.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </div>
                          <Badge
                            variant={getRoleBadgeVariant(user.role)}
                            className="mt-1 text-xs"
                          >
                            {getRoleLabel(user.role)}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={handleProfileClick}>
                        <User className="mr-2 h-4 w-4" />
                        Mon profil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleHistoryClick}>
                        <History className="mr-2 h-4 w-4" />
                        Historique
                      </DropdownMenuItem>

                      {isAdmin() && (
                        <>
                          <DropdownMenuItem onClick={handleUserManagementClick}>
                            <Users className="mr-2 h-4 w-4" />
                            Gestion des utilisateurs
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleAdminClick}>
                            <Settings className="mr-2 h-4 w-4" />
                            Gestion des rôles
                          </DropdownMenuItem>
                        </>
                      )}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-red-600 focus:text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Se déconnecter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile & Tablet: Hamburger Menu */}
                <div className="lg:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="relative"
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div className="relative w-4 h-4">
                        <span
                          className={`absolute h-0.5 w-4 bg-current transition-all duration-300 ease-in-out ${
                            isMobileMenuOpen ? "top-1.5 rotate-45" : "top-0.5"
                          }`}
                        />
                        <span
                          className={`absolute h-0.5 w-4 bg-current transition-all duration-300 ease-in-out top-1.5 ${
                            isMobileMenuOpen ? "opacity-0" : "opacity-100"
                          }`}
                        />
                        <span
                          className={`absolute h-0.5 w-4 bg-current transition-all duration-300 ease-in-out ${
                            isMobileMenuOpen ? "top-1.5 -rotate-45" : "top-2.5"
                          }`}
                        />
                      </div>
                    </div>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Sidebar Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Dark Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Sidebar */}
          <div
            className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white z-50 lg:hidden transform transition-transform duration-300 ease-out shadow-2xl ${
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center space-x-3">
                <img
                  src="/logo.png"
                  alt="2SND Technologies"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-semibold text-gray-900">Menu</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-8 w-8 p-0 hover:bg-white/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* User Profile Section */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    key={avatarVersion}
                    src={user ? getAvatarUrl(user.id, user.name) : undefined}
                    alt={user?.name || "Utilisateur"}
                  />
                  <AvatarFallback>
                    {(user?.name?.charAt(0) || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {user?.name}
                  </div>
                  <div className="text-sm text-gray-600">{user?.email}</div>
                  <Badge
                    variant={getRoleBadgeVariant(user?.role || "")}
                    className="mt-1"
                  >
                    {getRoleLabel(user?.role || "")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="flex-1 p-4">
              <nav className="space-y-2">
                <button
                  onClick={() => {
                    handleProfileClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-4 p-4 text-left hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      key={avatarVersion}
                      src={user ? getAvatarUrl(user.id, user.name) : undefined}
                      alt={user?.name || "Utilisateur"}
                    />
                    <AvatarFallback>
                      {(user?.name?.charAt(0) || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-gray-700">Mon profil</span>
                </button>

                <button
                  onClick={() => {
                    handleHistoryClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-4 p-4 text-left hover:bg-gray-100 rounded-xl transition-colors group"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <History className="w-5 h-5 text-blue-700" />
                  </div>
                  <span className="font-medium text-gray-700">Historique</span>
                </button>

                {isAdmin() && (
                  <>
                    <button
                      onClick={() => {
                        handleUserManagementClick();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-4 p-4 text-left hover:bg-gray-100 rounded-xl transition-colors group"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                        <Users className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="font-medium text-gray-700">
                        Gestion des utilisateurs
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        handleAdminClick();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-4 p-4 text-left hover:bg-gray-100 rounded-xl transition-colors group"
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                        <Settings className="w-5 h-5 text-purple-600" />
                      </div>
                      <span className="font-medium text-gray-700">
                        Gestion des rôles
                      </span>
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Logout Button at Bottom */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center space-x-4 p-4 text-left hover:bg-red-50 text-red-600 rounded-xl transition-colors group"
              >
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <span className="font-medium">Se déconnecter</span>
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
