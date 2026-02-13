import React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";

import { setTutorialFlag } from "@/contexts/TutorialContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, ArrowLeft, User, Eye, EyeOff, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";

type AuthMode = "select" | "login" | "signup" | "forgot" | "reset-password";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("select");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, updatePassword, isRecoveryMode } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Detect recovery mode from Supabase (user clicked reset link)
  useEffect(() => {
    if (isRecoveryMode) {
      setMode("reset-password");
    }
  }, [isRecoveryMode]);

  useEffect(() => {
    // Don't redirect to home if in recovery mode — user needs to set new password
    if (user && !isRecoveryMode && mode !== "reset-password") {
      navigate("/");
    }
  }, [user, navigate, isRecoveryMode, mode]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to sign in with Google",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (mode !== "forgot" && !password.trim()) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    if (mode === "signup" && password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (mode === "signup" && !username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "login") {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          toast({
            title: "Login Failed",
            description: error.message || "Invalid email or password",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back! 🎉",
            description: "You have successfully signed in to DanieWatch.",
          });
        }
      } else if (mode === "signup") {
        const { error } = await signUpWithEmail(email, password, username);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account Exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Signup Failed",
              description: error.message || "Failed to create account",
              variant: "destructive",
            });
          }
        } else {
          // Set tutorial flag for new signups
          setTutorialFlag();
          toast({
            title: "Account Created! 🎉",
            description: "Check your email for a confirmation link to verify your account.",
          });
        }
      } else if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) {
          toast({
            title: "Error",
            description: error.message || "Failed to send reset email",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Email Sent",
            description: "Check your email for a password reset link.",
          });
          setMode("login");
        }
      } else if (mode === "reset-password") {
        if (newPassword.length < 6) {
          toast({
            title: "Error",
            description: "Password must be at least 6 characters",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          toast({
            title: "Error",
            description: "Passwords do not match",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        const { error } = await updatePassword(newPassword);
        if (error) {
          toast({
            title: "Error",
            description: error.message || "Failed to update password",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Password Updated! 🎉",
            description: "Your password has been changed successfully.",
          });
          navigate("/");
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setEmail("");
    setUsername("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  useRouteContentReady(true);

  return (
    <>
      <Helmet>
        <title>Sign In - DanieWatch</title>
        <meta name="description" content="Sign in to save your watchlist and access all features" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-primary/30 rounded-full animate-bounce"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${2 + i * 0.5}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-md mx-4">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_hsl(var(--primary)/0.6)] relative z-10">
                <defs>
                  <linearGradient id="authLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(0, 84%, 65%)" />
                    <stop offset="100%" stopColor="hsl(0, 84%, 50%)" />
                  </linearGradient>
                </defs>
                <path
                  d="M25 15 C15 15 10 25 10 50 C10 75 15 85 25 85 L55 85 C75 85 90 70 90 50 C90 30 75 15 55 15 L40 15 L40 25 L55 25 C68 25 78 35 78 50 C78 65 68 75 55 75 L25 75 C22 75 22 70 22 50 C22 30 22 25 25 25 L25 15 Z M30 35 L30 65 L55 65 C60 65 65 60 65 50 C65 40 60 35 55 35 L30 35 Z"
                  fill="url(#authLogoGradient)"
                />
              </svg>
            </div>
            <span className="text-4xl font-bold tracking-tight">
              Danie<span className="text-primary">Watch</span>
            </span>
          </div>

          {/* Auth Card */}
          <div
            className="relative bg-card/80 backdrop-blur-xl rounded-3xl p-8 border border-border/50 shadow-2xl shadow-primary/5 overflow-hidden"
          >
            {/* Card glow effect */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10">
              {/* Method Selection Screen */}
              {mode === "select" && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
                    <p className="text-muted-foreground text-sm">Choose how you'd like to continue</p>
                  </div>

                  {/* Google Sign In */}
                  <Button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full h-14 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card/80 backdrop-blur-sm px-3 text-muted-foreground">or</span>
                    </div>
                  </div>

                  {/* Email Option */}
                  <Button
                    onClick={() => switchMode("login")}
                    variant="outline"
                    className="w-full h-14 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] hover:bg-secondary/50 flex items-center justify-center gap-3"
                  >
                    <Mail className="w-5 h-5" />
                    Continue with Email
                  </Button>
                </div>
              )}

              {/* Login/Signup/Forgot/Reset-Password Forms */}
              {mode !== "select" && (
                <>
                  {/* Mode Tabs (not for forgot or reset-password) */}
                  {mode !== "forgot" && mode !== "reset-password" && (
                    <div className="flex mb-8 bg-secondary/30 rounded-2xl p-1.5">
                      <button
                        onClick={() => switchMode("login")}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-500",
                          mode === "login"
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => switchMode("signup")}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-500",
                          mode === "signup"
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Sign Up
                      </button>
                    </div>
                  )}

                  {/* Header Text */}
                  <div className={cn(
                    "text-center mb-6 transition-all duration-500",
                    (mode === "forgot" || mode === "reset-password") && "mt-2"
                  )}>
                    <h2 className="text-2xl font-bold mb-2">
                      {mode === "login" && "Welcome back!"}
                      {mode === "signup" && "Create account"}
                      {mode === "forgot" && "Reset password"}
                      {mode === "reset-password" && "Set new password"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {mode === "login" && "Sign in to continue watching"}
                      {mode === "signup" && "Join DanieWatch today"}
                      {mode === "forgot" && "We'll send you a reset link"}
                      {mode === "reset-password" && "Enter your new password below"}
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {/* Username - Only for signup */}
                    <div className={cn(
                      "space-y-2 transition-all duration-500 overflow-hidden",
                      mode === "signup" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 rounded-xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity duration-300 pointer-events-none" />
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary z-10" />
                          <Input
                            id="username"
                            type="text"
                            placeholder="Choose a username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="pl-11 h-12 rounded-xl bg-secondary/30 border-border/50 focus:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Email (not for reset-password) */}
                    <div className={cn(
                      "space-y-2 transition-all duration-500 overflow-hidden",
                      mode !== "reset-password" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 rounded-xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity duration-300 pointer-events-none" />
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary z-10" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-11 h-12 rounded-xl bg-secondary/30 border-border/50 focus:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Password (login & signup only) */}
                    <div className={cn(
                      "space-y-2 transition-all duration-500 overflow-hidden",
                      mode !== "forgot" && mode !== "reset-password" ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 rounded-xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity duration-300 pointer-events-none" />
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary z-10" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-11 pr-11 h-12 rounded-xl bg-secondary/30 border-border/50 focus:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300"
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* New Password fields (reset-password mode only) */}
                    <div className={cn(
                      "space-y-4 transition-all duration-500 overflow-hidden",
                      mode === "reset-password" ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <div className="space-y-2">
                        <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                        <div className="relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 rounded-xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity duration-300 pointer-events-none" />
                          <div className="relative">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary z-10" />
                            <Input
                              id="new-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter new password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="pl-11 pr-11 h-12 rounded-xl bg-secondary/30 border-border/50 focus:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300"
                              disabled={isLoading}
                              minLength={6}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                        <div className="relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 rounded-xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity duration-300 pointer-events-none" />
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary z-10" />
                            <Input
                              id="confirm-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm new password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="pl-11 h-12 rounded-xl bg-secondary/30 border-border/50 focus:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300"
                              disabled={isLoading}
                              minLength={6}
                            />
                          </div>
                        </div>
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-xs text-destructive pl-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>

                    {/* Forgot Password Link */}
                    {mode === "login" && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-sm text-primary hover:text-primary/80 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/30"
                      disabled={isLoading || (mode === "reset-password" && (!newPassword || !confirmPassword))}
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {mode === "login" && "Sign In"}
                          {mode === "signup" && "Create Account"}
                          {mode === "forgot" && "Send Reset Link"}
                          {mode === "reset-password" && "Update Password"}
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Back to login for forgot mode */}
                  {mode === "forgot" && (
                    <button
                      onClick={() => switchMode("login")}
                      className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to sign in
                    </button>
                  )}

                  {/* Back to sign in for reset-password mode */}
                  {mode === "reset-password" && (
                    <button
                      onClick={() => {
                        switchMode("login");
                        navigate("/auth");
                      }}
                      className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to sign in
                    </button>
                  )}

                  {/* Back to method selection */}
                  {mode !== "forgot" && mode !== "reset-password" && (
                    <button
                      onClick={() => switchMode("select")}
                      className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Other sign in options
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Back to home */}
          <button
            onClick={() => navigate("/")}
            className="mt-6 mx-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        </div>
      </div>
    </>
  );
};

export default Auth;